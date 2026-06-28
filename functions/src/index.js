"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { buildRaporXls, sezonIcindeMi, bugunISO, tarihBaslikMetni } = require("./rapor-engine");
const { raporMailGonder } = require("./mail");

initializeApp();

const sendgridKey = defineSecret("SENDGRID_API_KEY");
const sendgridFrom = defineSecret("SENDGRID_FROM");
const MAIL_SECRETS = [sendgridKey, sendgridFrom];
const REGION = "europe-west1";

function mailEnvYukle() {
  process.env.SENDGRID_API_KEY = sendgridKey.value();
  process.env.SENDGRID_FROM = sendgridFrom.value();
}

function istanbulNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
}

async function kullaniciVerisiOku(uid) {
  const db = getDatabase();
  const base = db.ref("apartim/kullanicilar/" + uid);
  const [daireler, rezervasyonlar, musteriKaynaklari, dovizKurlari, profil] = await Promise.all([
    base.child("daireler").once("value"),
    base.child("rezervasyonlar").once("value"),
    base.child("musteri-kaynaklari").once("value"),
    base.child("doviz-kurlari").once("value"),
    base.child("profil").once("value")
  ]);
  return {
    profil: profil.val() || {},
    veri: {
      daireler: daireler.val() || {},
      rezervasyonlar: rezervasyonlar.val() || {},
      musteriKaynaklari: musteriKaynaklari.val() || {},
      dovizKurlari: dovizKurlari.val() || {}
    }
  };
}

function epostaGecerliMi(ep) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(ep || "").trim());
}

async function kullaniciyaRaporGonder(uid, profil, veri, tarih) {
  const eposta = String(profil.raporEposta || "").trim();
  if (!epostaGecerliMi(eposta)) return { uid, ok: false, sebep: "eposta-yok" };
  if (profil.raporPazarAktif === false) return { uid, ok: false, sebep: "kapali" };

  const y = tarih.getFullYear();
  const xls = buildRaporXls(veri, y);
  const dosyaAdi = "Apartim-Rezervasyon-" + y + "-Haziran-Eylul.xls";
  const tarihMetni = tarihBaslikMetni(tarih);
  const konu = "Apartım — Rezervasyon Özeti — " + tarihMetni;
  const metin =
    "Merhaba,\n\n" +
    "Apartım haftalık rezervasyon özetiniz ektedir.\n" +
    "Rapor tarihi: " + tarihMetni + "\n\n" +
    "Manuel rapor indirmek için uygulamadaki Excel ikonunu kullanabilirsiniz.\n\n" +
    "— Apartım";

  await raporMailGonder({ alici: eposta, konu, metin, dosyaAdi, xlsIcerik: xls });
  return { uid, ok: true, eposta };
}

async function tumPazarRaporlariGonder(tarih) {
  const bugun = bugunISO(tarih);
  if (!sezonIcindeMi(bugun)) {
    return { atlandi: true, sebep: "sezon-disinda", bugun };
  }
  if (tarih.getDay() !== 0) {
    return { atlandi: true, sebep: "pazar-degil", bugun };
  }

  const snap = await getDatabase().ref("apartim/kullanicilar").once("value");
  const kullanicilar = snap.val() || {};
  const sonuclar = [];

  for (const uid of Object.keys(kullanicilar)) {
    try {
      const node = kullanicilar[uid] || {};
      const profil = node.profil || {};
      const veri = {
        daireler: node.daireler || {},
        rezervasyonlar: node.rezervasyonlar || {},
        musteriKaynaklari: node["musteri-kaynaklari"] || {},
        dovizKurlari: node["doviz-kurlari"] || {}
      };
      const sonuc = await kullaniciyaRaporGonder(uid, profil, veri, tarih);
      sonuclar.push(sonuc);
    } catch (err) {
      console.error("rapor gonderim hatasi", uid, err);
      sonuclar.push({ uid, ok: false, sebep: err.message });
    }
  }

  return { atlandi: false, bugun, sonuclar };
}

exports.pazarRaporu = onSchedule({
  schedule: "0 8 * * 0",
  timeZone: "Europe/Istanbul",
  region: REGION,
  secrets: MAIL_SECRETS
}, async () => {
  mailEnvYukle();
  const now = istanbulNow();
  const sonuc = await tumPazarRaporlariGonder(now);
  console.log("pazarRaporu", JSON.stringify(sonuc));
});

exports.raporTestGonder = onCall({
  region: REGION,
  secrets: MAIL_SECRETS
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Giriş yapmanız gerekir");
  }
  mailEnvYukle();

  const uid = request.auth.uid;
  const { profil, veri } = await kullaniciVerisiOku(uid);
  const eposta = String(profil.raporEposta || "").trim();
  if (!epostaGecerliMi(eposta)) {
    throw new HttpsError("failed-precondition", "Önce geçerli bir e-posta adresi kaydedin");
  }

  const now = istanbulNow();
  try {
    const sonuc = await kullaniciyaRaporGonder(
      uid, Object.assign({}, profil, { raporPazarAktif: true }), veri, now
    );
    if (!sonuc.ok) throw new Error(sonuc.sebep || "gonderilemedi");
    return { ok: true, eposta, mesaj: "Test raporu " + eposta + " adresine gönderildi" };
  } catch (err) {
    console.error("raporTestGonder", err);
    throw new HttpsError("internal", err.message || "E-posta gönderilemedi");
  }
});
