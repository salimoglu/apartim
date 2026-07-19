/* =========================================================
   APARTIM — Kasa modülü
   Tahsilatta "Kasa" yöntemiyle girilen ödemeler + manuel harcama
   ========================================================= */

(function () {
  "use strict";

  let aktifPb = "tumu";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tarihGoster(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
    const [y, m, d] = iso.split("-");
    return d + "." + m + "." + y;
  }

  function bugunISO() {
    return window.APARTIM.db?.tarihNormal?.(new Date()) ||
      new Date().toISOString().slice(0, 10);
  }

  function formatTutar(tutar, pb) {
    const para = window.APARTIM.para;
    if (para?.formatTutar) return para.formatTutar(tutar, pb);
    const n = Number(tutar) || 0;
    return n.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + (pb === "USD" ? " $" : " ₺");
  }

  function ozetHesapla(liste) {
    const ozet = {
      gelirTl: 0, gelirUsd: 0,
      harcamaTl: 0, harcamaUsd: 0
    };
    liste.forEach((h) => {
      const t = Number(h.tutar) || 0;
      if (h.tip === "harcama") {
        if (h.pb === "USD") ozet.harcamaUsd += t;
        else ozet.harcamaTl += t;
      } else {
        if (h.pb === "USD") ozet.gelirUsd += t;
        else ozet.gelirTl += t;
      }
    });
    return ozet;
  }

  function pbNavGuncelle() {
    document.querySelectorAll(".kasa-pb-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.pb === aktifPb);
    });
  }

  function ozetCiz(ozet) {
    const el = document.getElementById("kasa-ozet");
    if (!el) return;
    const satirlar = [];
    if (aktifPb === "tumu" || aktifPb === "TL") {
      const netTl = ozet.gelirTl - ozet.harcamaTl;
      satirlar.push(
        '<div class="kasa-ozet-kart">' +
          '<span class="label">TL net</span>' +
          '<span class="val ' + (netTl < 0 ? "eksi" : "arti") + '">' +
            formatTutar(netTl, "TL") +
          "</span>" +
          '<span class="alt">+' + formatTutar(ozet.gelirTl, "TL") +
            " / −" + formatTutar(ozet.harcamaTl, "TL") + "</span>" +
        "</div>"
      );
    }
    if (aktifPb === "tumu" || aktifPb === "USD") {
      const netUsd = ozet.gelirUsd - ozet.harcamaUsd;
      satirlar.push(
        '<div class="kasa-ozet-kart">' +
          '<span class="label">USD net</span>' +
          '<span class="val ' + (netUsd < 0 ? "eksi" : "arti") + '">' +
            formatTutar(netUsd, "USD") +
          "</span>" +
          '<span class="alt">+' + formatTutar(ozet.gelirUsd, "USD") +
            " / −" + formatTutar(ozet.harcamaUsd, "USD") + "</span>" +
        "</div>"
      );
    }
    el.innerHTML = satirlar.join("") ||
      '<div class="kasa-ozet-kart"><span class="label">Net</span><span class="val">—</span></div>';
  }

  function listeCiz(liste) {
    const el = document.getElementById("kasa-liste");
    if (!el) return;
    if (!liste.length) {
      el.innerHTML = '<div class="kasa-bos">Bu görünümde kasa kaydı yok.</div>';
      return;
    }
    const satirlar = liste.map((h) => {
      const harcamaMi = h.tip === "harcama";
      const miktarSinif = harcamaMi ? "eksi" : "arti";
      const miktarOn = harcamaMi ? "−" : "+";
      const silBtn = harcamaMi
        ? '<button type="button" class="kasa-sil-btn" data-id="' +
            esc(h.harcamaId) + '" title="Sil" aria-label="Harcama sil">&#10005;</button>'
        : "";
      return (
        '<div class="kasa-satir ' + (harcamaMi ? "harcama" : "gelir") + '">' +
          '<div class="kasa-satir-ust">' +
            '<span class="kasa-tarih">' + esc(tarihGoster(h.tarih)) + "</span>" +
            '<span class="kasa-miktar ' + miktarSinif + '">' +
              miktarOn + formatTutar(h.tutar, h.pb) +
            "</span>" +
            silBtn +
          "</div>" +
          '<div class="kasa-satir-alt">' +
            '<span class="kasa-musteri">' + esc(h.musteri || "—") + "</span>" +
            (h.not
              ? '<span class="kasa-not">' + esc(h.not) + "</span>"
              : '<span class="kasa-not soluk">Not yok</span>') +
          "</div>" +
        "</div>"
      );
    });
    el.innerHTML = satirlar.join("");
  }

  function ciz() {
    const db = window.APARTIM.db;
    if (!db) return;
    pbNavGuncelle();
    const liste = db.kasaHareketListele(aktifPb) || [];
    ozetCiz(ozetHesapla(liste));
    listeCiz(liste);
  }

  function pbSec(pb) {
    aktifPb = pb === "TL" || pb === "USD" ? pb : "tumu";
    ciz();
  }

  function formSifirla() {
    const tarih = document.getElementById("kasa-harcama-tarih");
    const not = document.getElementById("kasa-harcama-not");
    const tutar = document.getElementById("kasa-harcama-tutar");
    const pb = document.getElementById("kasa-harcama-pb");
    if (tarih) tarih.value = bugunISO();
    if (not) not.value = "";
    if (tutar) tutar.value = "";
    if (pb) pb.value = "TL";
  }

  async function harcamaKaydet() {
    const db = window.APARTIM.db;
    const tarih = document.getElementById("kasa-harcama-tarih")?.value || "";
    const not = document.getElementById("kasa-harcama-not")?.value || "";
    const tutar = Number(document.getElementById("kasa-harcama-tutar")?.value);
    const pb = document.getElementById("kasa-harcama-pb")?.value || "TL";
    if (!tarih) {
      window.APARTIM.toast?.("Tarih gerekli", "uyari");
      return;
    }
    if (!Number.isFinite(tutar) || tutar <= 0) {
      window.APARTIM.toast?.("Geçerli bir miktar girin", "uyari");
      return;
    }
    try {
      await db.kasaHarcamaEkle({ tarih, not, tutar, pb });
      window.APARTIM.toast?.("Harcama eklendi", "basari");
      formSifirla();
      ciz();
    } catch (e) {
      window.APARTIM.toast?.(e?.message || "Harcama kaydedilemedi", "hata");
    }
  }

  async function harcamaSil(id) {
    if (!id) return;
    try {
      await window.APARTIM.db.kasaHarcamaSil(id);
      window.APARTIM.toast?.("Harcama silindi", "basari");
      ciz();
    } catch (e) {
      window.APARTIM.toast?.("Silinemedi", "hata");
    }
  }

  function bagla() {
    document.querySelectorAll(".kasa-pb-btn").forEach((b) => {
      b.addEventListener("click", () => pbSec(b.dataset.pb));
    });
    document.getElementById("kasa-harcama-kaydet")?.addEventListener("click", harcamaKaydet);
    document.getElementById("kasa-liste")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.(".kasa-sil-btn");
      if (!btn) return;
      harcamaSil(btn.dataset.id);
    });
    formSifirla();
  }

  document.addEventListener("DOMContentLoaded", bagla);

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.kasa = { ciz, pbSec };
})();
