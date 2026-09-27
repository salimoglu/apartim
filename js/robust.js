/* =========================================================
   APARTIM — Robust yedek
   ---------------------------------------------------------
   Odalar, rezervasyonlar, kasa, kategoriler ve kurlar.
   - Bu cihazda IndexedDB (olmazsa localStorage)
   - Hesabın kendi bulut düğümünde 5'li halka + koruma kopyası
   - Parmak izi (SHA-256) ile bütünlük
   - Kayıt sayısı belirgin düşünce koruma ve bulut halkası ezilmez
   - Sezon temizliği, Excel aktarımı ve oda silmeden önce zorunlu kopya
   ========================================================= */

(function () {
  "use strict";

  const FORMAT = "apartim-robust";
  const SURUM = 1;
  const HALKA = 5;
  const IDB_AD = "apartim-robust";
  const LS_DEPO = "apartim-robust-ls";
  const META_KEY = "apartim-robust-meta";
  const CIHAZ_KEY = "apartim-robust-cihaz";
  const DOSYA_LIMIT = 8 * 1024 * 1024;
  const GUN = 86400000;
  const OTO_GECIKME = 12000;
  const ILK_GECIKME = 8000;
  const BULUT_ARALIK = 2 * 60 * 1000;
  const NABIZ = 20 * 60 * 60 * 1000;
  const KORUMA_YENILE = 7 * GUN;
  const YASAK_ANAHTAR = Object.create(null);
  YASAK_ANAHTAR["__proto__"] = 1;
  YASAK_ANAHTAR.prototype = 1;
  YASAK_ANAHTAR.constructor = 1;

  const KRITIK = {
    "sezon-temizle": 1,
    "excel-aktar": 1,
    "geri-yukle-oncesi": 1,
    "oda-sil": 1
  };

  const SEBEP_ETIKET = {
    otomatik: "Otomatik",
    gorunurluk: "Kapanış",
    manuel: "Elle",
    "sezon-temizle": "Sezon temizliği öncesi",
    "excel-aktar": "Excel aktarımı öncesi",
    "geri-yukle-oncesi": "Geri yükleme öncesi",
    "oda-sil": "Oda silmeden önce"
  };

  let depoModu = null;
  let zincir = Promise.resolve();
  let zamanlayici = null;
  let bulutOnbellek = null;
  let bulutOnbellekZaman = 0;
  let listeOnbellek = new Map();
  let sonSupheliParmak = "";
  let mesgul = false;

  function kritikMi(sebep) {
    return !!KRITIK[sebep];
  }

  function uidAl() {
    return window.APARTIM.kullanici?.uid || "yerel";
  }

  function cihazId() {
    try {
      let id = localStorage.getItem(CIHAZ_KEY);
      if (!id) {
        id = "c" + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(CIHAZ_KEY, id);
      }
      return id;
    } catch (e) {
      return "c";
    }
  }

  function yeniId() {
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function duzNesneMi(o) {
    return !!o && typeof o === "object" && !Array.isArray(o);
  }

  function veriNorm(veri) {
    const src = duzNesneMi(veri) ? veri : {};
    const al = (k) => (duzNesneMi(src[k]) ? src[k] : {});
    const out = {
      daireler: al("daireler"),
      rezervasyonlar: al("rezervasyonlar"),
      temizlikKayit: al("temizlikKayit"),
      musteriKaynaklari: al("musteriKaynaklari"),
      kasaHarcama: al("kasaHarcama"),
      dovizKurlari: al("dovizKurlari")
    };
    /* Eski yedeklerde yok: parmak izine boş alan ekleme */
    if (duzNesneMi(src.odemeYontemleri)) out.odemeYontemleri = src.odemeYontemleri;
    return out;
  }

  function derinKopya(v) {
    return JSON.parse(JSON.stringify(v));
  }

  /** Anahtar sırasından bağımsız, null alanları yok sayan kanonik JSON */
  function kanon(v) {
    if (v === undefined || v === null) return "null";
    if (typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map((x) => kanon(x)).join(",") + "]";
    const keys = Object.keys(v).filter((k) => v[k] !== undefined && v[k] !== null).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + kanon(v[k])).join(",") + "}";
  }

  function fnv1a(metin) {
    let h1 = 0x811c9dc5;
    let h2 = 0x811c9dc5;
    for (let i = 0; i < metin.length; i++) {
      h1 ^= metin.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= metin.charCodeAt(metin.length - 1 - i);
      h2 = Math.imul(h2, 0x01000193);
    }
    const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
    return hex(h1) + hex(h2);
  }

  async function parmakUret(veri, algoritma) {
    const metin = kanon(veriNorm(veri));
    const fnv = () => ({ parmak: fnv1a(metin), algoritma: "fnv1a" });
    if (algoritma === "fnv1a" || !globalThis.crypto?.subtle) return fnv();
    try {
      const buf = new TextEncoder().encode(metin);
      const hash = await crypto.subtle.digest("SHA-256", buf);
      const parmak = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return { parmak, algoritma: "sha256" };
    } catch (e) {
      return fnv();
    }
  }

  function ozet(veri) {
    const say = (o) => (duzNesneMi(o) ? Object.keys(o).length : 0);
    const v = veriNorm(veri);
    return {
      rezervasyon: say(v.rezervasyonlar),
      daire: say(v.daireler),
      kasa: say(v.kasaHarcama),
      temizlik: say(v.temizlikKayit),
      kaynak: say(v.musteriKaynaklari)
    };
  }

  function supheliMi(oncekiOzet, yeniOzet) {
    if (!oncekiOzet || !yeniOzet) return false;
    const r0 = Number(oncekiOzet.rezervasyon) || 0;
    const r1 = Number(yeniOzet.rezervasyon) || 0;
    if (r0 >= 5 && r1 <= r0 - 5 && r1 < r0 * 0.6) return true;
    const d0 = Number(oncekiOzet.daire) || 0;
    const d1 = Number(yeniOzet.daire) || 0;
    if (d0 >= 1 && d1 === 0) return true;
    const k0 = Number(oncekiOzet.kasa) || 0;
    const k1 = Number(yeniOzet.kasa) || 0;
    if (k0 >= 8 && k1 < k0 * 0.5 && r1 < r0) return true;
    return false;
  }

  function gunAnahtari(zaman) {
    const d = new Date(zaman);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const gun = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + gun;
  }

  /**
   * Tutulacaklar: son 12 otomatik, 45 gün boyunca günde bir,
   * son 10 elle alınmış, 90 gün / 20 kritik. Toplam tavan 60.
   * korumaSlot kayıtları budanmaz.
   */
  function budamaKarar(kayitlar, simdi) {
    const simdiMs = simdi || Date.now();
    const aday = (kayitlar || []).filter((k) => k && k.id && !k.korumaSlot);
    const tut = new Set();

    const kritik = aday.filter((k) => kritikMi(k.sebep)).sort((a, b) => b.zaman - a.zaman);
    kritik.forEach((k, i) => {
      if (i < 20 && simdiMs - k.zaman <= 90 * GUN) tut.add(k.id);
    });

    aday.filter((k) => k.sebep === "manuel")
      .sort((a, b) => b.zaman - a.zaman)
      .slice(0, 10)
      .forEach((k) => tut.add(k.id));

    const oto = aday
      .filter((k) => k.sebep === "otomatik" || k.sebep === "gorunurluk")
      .sort((a, b) => b.zaman - a.zaman);
    oto.slice(0, 12).forEach((k) => tut.add(k.id));

    const gunluk = new Map();
    oto.forEach((k) => {
      if (simdiMs - k.zaman > 45 * GUN) return;
      const gun = gunAnahtari(k.zaman);
      const once = gunluk.get(gun);
      if (!once) {
        gunluk.set(gun, k);
        return;
      }
      const onceIyi = !once.supheli;
      const buIyi = !k.supheli;
      if (buIyi && !onceIyi) gunluk.set(gun, k);
      else if (buIyi === onceIyi && k.zaman > once.zaman) gunluk.set(gun, k);
    });
    gunluk.forEach((k) => tut.add(k.id));

    let tutulan = () => aday.filter((k) => tut.has(k.id));
    if (tutulan().length > 60) {
      const yakinKritik = new Set(
        kritik.filter((k) => simdiMs - k.zaman <= 30 * GUN).map((k) => k.id)
      );
      const eskiden = tutulan().slice().sort((a, b) => a.zaman - b.zaman);
      for (const k of eskiden) {
        if (tutulan().length <= 60) break;
        if (yakinKritik.has(k.id) || kritikMi(k.sebep)) continue;
        tut.delete(k.id);
      }
    }
    if (tutulan().length > 60) {
      const eskiden = tutulan().slice().sort((a, b) => a.zaman - b.zaman);
      for (const k of eskiden) {
        if (tutulan().length <= 60) break;
        tut.delete(k.id);
      }
    }
    return aday.filter((k) => !tut.has(k.id)).map((k) => k.id);
  }

  function cekimKarari(o) {
    if (o.zorla || kritikMi(o.sebep) || o.sebep === "manuel") return "yaz";
    const ayni = !!(o.parmak && o.parmak === o.metaParmak);
    const eski = !o.metaZaman || (o.simdi - o.metaZaman) >= NABIZ;
    if (!ayni || eski) return "yaz";
    return "atla";
  }

  function bulutKarari(o) {
    const onemli = kritikMi(o.sebep) || o.sebep === "manuel";
    if (o.supheli && !onemli) return false;
    if (onemli) return true;
    if (o.parmak && o.parmak === o.sonBulutParmak) {
      return !o.sonBulutZaman || (o.simdi - o.sonBulutZaman) >= NABIZ;
    }
    if (o.sebep === "gorunurluk") return true;
    if (o.sonBulutZaman && o.simdi - o.sonBulutZaman < BULUT_ARALIK) return false;
    return true;
  }

  function korumaGuncellenmeli(eskiZarf, yeniZarf) {
    if (!eskiZarf || !eskiZarf.veri) return true;
    const e = eskiZarf.ozet || ozet(eskiZarf.veri);
    const y = yeniZarf.ozet || ozet(yeniZarf.veri);
    if (supheliMi(e, y)) return false;
    const r0 = Number(e.rezervasyon) || 0;
    const r1 = Number(y.rezervasyon) || 0;
    if (r1 > r0) return true;
    if (r1 === r0 && (Number(y.kasa) || 0) >= (Number(e.kasa) || 0) && (Number(y.daire) || 0) >= (Number(e.daire) || 0)) {
      const eskiZ = Date.parse(eskiZarf.olusturulma) || 0;
      return Date.now() - eskiZ > KORUMA_YENILE;
    }
    return false;
  }

  function fbAnahtar(k) {
    return typeof k === "string" && k.length > 0 && k.length < 768 && !/[.#$[\]/]/.test(k);
  }

  function anahtarTemizMi(o, derinlik) {
    if (derinlik < 0) return true;
    if (Array.isArray(o)) {
      for (let i = 0; i < o.length; i++) {
        const x = o[i];
        if ((duzNesneMi(x) || Array.isArray(x)) && !anahtarTemizMi(x, derinlik - 1)) return false;
      }
      return true;
    }
    if (!duzNesneMi(o)) return false;
    const keys = Object.keys(o);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (YASAK_ANAHTAR[k]) return false;
      const v = o[k];
      if ((duzNesneMi(v) || Array.isArray(v)) && !anahtarTemizMi(v, derinlik - 1)) return false;
    }
    return true;
  }

  async function zarfDogrula(ham) {
    if (!duzNesneMi(ham)) return { ok: false, hata: "Dosya tanınmadı." };
    if (ham.format !== FORMAT) return { ok: false, hata: "Bu dosya Robust yedeği değil." };
    if (ham.surum !== SURUM) return { ok: false, hata: "Yedek sürümü desteklenmiyor." };
    if (!duzNesneMi(ham.veri)) return { ok: false, hata: "Yedek içeriği bozuk." };
    const alanlar = ["daireler", "rezervasyonlar", "temizlikKayit", "musteriKaynaklari", "kasaHarcama", "dovizKurlari"];
    const veri = {};
    for (let i = 0; i < alanlar.length; i++) {
      const a = alanlar[i];
      const parca = ham.veri[a] == null ? {} : ham.veri[a];
      if (!duzNesneMi(parca)) return { ok: false, hata: "Yedek alanı geçersiz." };
      if (!anahtarTemizMi(parca, 8)) return { ok: false, hata: "Yedekte güvenli olmayan alan var." };
      if (a !== "dovizKurlari") {
        const anahtarlar = Object.keys(parca);
        for (let j = 0; j < anahtarlar.length; j++) {
          if (!fbAnahtar(anahtarlar[j])) return { ok: false, hata: "Geçersiz kayıt anahtarı." };
        }
      }
      veri[a] = parca;
    }
    if (duzNesneMi(ham.veri.odemeYontemleri)) {
      const parca = ham.veri.odemeYontemleri;
      if (!anahtarTemizMi(parca, 8)) return { ok: false, hata: "Yedekte güvenli olmayan alan var." };
      const anahtarlar = Object.keys(parca);
      for (let j = 0; j < anahtarlar.length; j++) {
        if (!fbAnahtar(anahtarlar[j])) return { ok: false, hata: "Geçersiz kayıt anahtarı." };
      }
      veri.odemeYontemleri = parca;
    }
    const beklenen = ham.algoritma === "fnv1a" ? "fnv1a" : "sha256";
    const uret = await parmakUret(veri, beklenen);
    if (!ham.parmak || uret.parmak !== ham.parmak || uret.algoritma !== beklenen) {
      if (ham.algoritma) return { ok: false, hata: "Yedek bütünlüğü doğrulanamadı." };
      const diger = await parmakUret(veri, beklenen === "sha256" ? "fnv1a" : "sha256");
      if (diger.parmak !== ham.parmak) return { ok: false, hata: "Yedek bütünlüğü doğrulanamadı." };
    }
    return { ok: true, veri, parmak: ham.parmak };
  }

  function metaOku() {
    try {
      const raw = localStorage.getItem(META_KEY);
      const tum = raw ? JSON.parse(raw) : {};
      const kayit = tum && tum[uidAl()];
      return kayit && typeof kayit === "object" ? kayit : {};
    } catch (e) {
      return {};
    }
  }

  function metaYaz(patch) {
    try {
      const raw = localStorage.getItem(META_KEY);
      const tum = raw ? JSON.parse(raw) : {};
      const uid = uidAl();
      tum[uid] = Object.assign({}, tum[uid] || {}, patch);
      localStorage.setItem(META_KEY, JSON.stringify(tum));
    } catch (e) { /* kota / gizli mod */ }
  }

  function idbAc() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("IndexedDB yok"));
        return;
      }
      const req = indexedDB.open(IDB_AD, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("anlik")) {
          const st = db.createObjectStore("anlik", { keyPath: "id" });
          st.createIndex("uid", "uid", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB açılamadı"));
    });
  }

  async function depoHazir() {
    if (depoModu) return depoModu;
    try {
      const db = await idbAc();
      db.close();
      depoModu = "idb";
    } catch (e) {
      depoModu = "ls";
    }
    return depoModu;
  }

  function lsTum() {
    try {
      const raw = localStorage.getItem(LS_DEPO);
      const v = raw ? JSON.parse(raw) : {};
      return v && typeof v === "object" ? v : {};
    } catch (e) {
      return {};
    }
  }

  function lsYazTum(tum) {
    localStorage.setItem(LS_DEPO, JSON.stringify(tum));
  }

  async function depoListele(uid) {
    const mod = await depoHazir();
    if (mod === "idb") {
      const db = await idbAc();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("anlik", "readonly");
        const req = tx.objectStore("anlik").index("uid").getAll(uid);
        req.onsuccess = () => {
          db.close();
          resolve(req.result || []);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      });
    }
    const dizi = lsTum()[uid];
    return Array.isArray(dizi) ? dizi : [];
  }

  async function depoSil(id) {
    const mod = await depoHazir();
    const uid = uidAl();
    if (mod === "idb") {
      const db = await idbAc();
      await new Promise((resolve, reject) => {
        const tx = db.transaction("anlik", "readwrite");
        tx.objectStore("anlik").delete(id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
      return;
    }
    const tum = lsTum();
    tum[uid] = (tum[uid] || []).filter((k) => k.id !== id);
    lsYazTum(tum);
  }

  async function depoPut(kayit) {
    const mod = await depoHazir();
    if (mod === "idb") {
      const yaz = async () => {
        const db = await idbAc();
        await new Promise((resolve, reject) => {
          const tx = db.transaction("anlik", "readwrite");
          tx.objectStore("anlik").put(kayit);
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        });
      };
      try {
        await yaz();
      } catch (e) {
        await budamaUygula();
        await yaz();
      }
      return;
    }
    const tum = lsTum();
    const uid = kayit.uid;
    const dizi = Array.isArray(tum[uid]) ? tum[uid].filter((k) => k.id !== kayit.id) : [];
    dizi.push(kayit);
    tum[uid] = dizi;
    try {
      lsYazTum(tum);
    } catch (e) {
      const koruma = dizi.filter((k) => k.korumaSlot);
      const diger = dizi.filter((k) => !k.korumaSlot).sort((a, b) => b.zaman - a.zaman).slice(0, 2);
      tum[uid] = koruma.concat(diger);
      lsYazTum(tum);
    }
  }

  async function budamaUygula() {
    const uid = uidAl();
    const liste = await depoListele(uid);
    const silinecek = budamaKarar(liste, Date.now());
    for (let i = 0; i < silinecek.length; i++) {
      await depoSil(silinecek[i]);
    }
    if (depoModu === "ls") {
      const tum = lsTum();
      const dizi = (tum[uid] || []).slice().sort((a, b) => b.zaman - a.zaman);
      const koruma = dizi.filter((k) => k.korumaSlot);
      const diger = dizi.filter((k) => !k.korumaSlot).slice(0, 3);
      tum[uid] = koruma.concat(diger);
      try { lsYazTum(tum); } catch (e) { /* yoksay */ }
    }
  }

  function hazirMi() {
    return !!(window.APARTIM.db?.durum?.yuklendi && window.APARTIM.db.anlikVeriAl);
  }

  async function bulutGetir(zorla) {
    const db = window.APARTIM.db;
    if (!db?.robustBulutOku || !db.robustBulutHazir?.()) return null;
    if (!zorla && bulutOnbellek && Date.now() - bulutOnbellekZaman < 15000) return bulutOnbellek;
    bulutOnbellek = await db.robustBulutOku();
    bulutOnbellekZaman = Date.now();
    return bulutOnbellek;
  }

  async function bulutaKoy(zarf, halkaYaz, korumaYaz) {
    const db = window.APARTIM.db;
    if (!db?.robustBulutYaz || !db.robustBulutHazir?.()) return false;
    const bulut = (await bulutGetir(false)) || {};
    let ok = true;
    if (halkaYaz) {
      const imlec = Number(bulut.imlec);
      const slot = Number.isFinite(imlec) ? (imlec + 1) % HALKA : 0;
      const yazildi = await db.robustBulutYaz("halka/" + slot, zarf);
      if (!yazildi) ok = false;
      else {
        const imlecOk = await db.robustBulutYaz("imlec", slot);
        const parmakOk = await db.robustBulutYaz("sonParmak", zarf.parmak);
        if (!imlecOk || !parmakOk) ok = false;
        bulut.halka = bulut.halka || {};
        bulut.halka[String(slot)] = zarf;
        bulut.imlec = slot;
        bulut.sonParmak = zarf.parmak;
      }
    }
    if (korumaYaz) {
      const yazildi = await db.robustBulutYaz("koruma", zarf);
      if (!yazildi) ok = false;
      else bulut.koruma = zarf;
    }
    bulutOnbellek = bulut;
    bulutOnbellekZaman = Date.now();
    return ok;
  }

  async function calistir(sebep, opts) {
    const secenek = opts || {};
    if (!hazirMi()) {
      const err = new Error("Veriler henüz yüklenmedi.");
      if (kritikMi(sebep) || sebep === "manuel") throw err;
      return { atlandi: true, yerel: false };
    }
    const veri = derinKopya(veriNorm(window.APARTIM.db.anlikVeriAl()));
    const uret = await parmakUret(veri);
    const simdi = Date.now();
    const meta = metaOku();
    const karar = cekimKarari({
      sebep,
      zorla: !!secenek.zorla,
      parmak: uret.parmak,
      metaParmak: meta.parmak || "",
      metaZaman: Number(meta.zaman) || 0,
      simdi
    });
    if (karar === "atla") return { atlandi: true, yerel: true, parmak: uret.parmak };

    const yeniOzet = ozet(veri);
    let referans = null;
    try {
      const liste = await depoListele(uidAl());
      const korumaKayit = liste.find((k) => k.korumaSlot && k.zarf);
      if (korumaKayit) referans = korumaKayit.zarf.ozet;
    } catch (e) { /* referans şart değil */ }
    if (!referans && meta.ozet) referans = meta.ozet;
    const supheli = !kritikMi(sebep) && sebep !== "manuel" && supheliMi(referans, yeniOzet);

    const zarf = {
      format: FORMAT,
      surum: SURUM,
      id: yeniId(),
      olusturulma: new Date(simdi).toISOString(),
      sebep,
      supheli: !!supheli,
      ozet: yeniOzet,
      parmak: uret.parmak,
      algoritma: uret.algoritma,
      uygulama: window.APARTIM_VERSION?.APP || "",
      cihaz: cihazId(),
      veri
    };

    const kayit = {
      id: zarf.id,
      uid: uidAl(),
      zaman: simdi,
      sebep,
      supheli: !!supheli,
      korumaSlot: false,
      zarf
    };
    await depoPut(kayit);
    await budamaUygula();

    let korumaYaz = false;
    try {
      const liste = await depoListele(uidAl());
      const korumaKayit = liste.find((k) => k.korumaSlot && k.zarf);
      if (korumaGuncellenmeli(korumaKayit && korumaKayit.zarf, zarf)) {
        await depoPut({
          id: "koruma-" + uidAl(),
          uid: uidAl(),
          zaman: simdi,
          sebep,
          supheli: false,
          korumaSlot: true,
          zarf
        });
        korumaYaz = true;
      }
    } catch (e) {
      console.warn("Robust koruma:", e);
    }

    metaYaz({
      parmak: uret.parmak,
      zaman: simdi,
      ozet: yeniOzet
    });

    let bulut = false;
    const bulutaIzin = secenek.bulut !== false && bulutKarari({
      sebep,
      supheli,
      parmak: uret.parmak,
      sonBulutParmak: meta.bulutParmak || "",
      sonBulutZaman: Number(meta.bulutZaman) || 0,
      simdi
    });
    if (bulutaIzin) {
      try {
        bulut = await bulutaKoy(zarf, true, korumaYaz);
        if (bulut) metaYaz({ bulutParmak: uret.parmak, bulutZaman: simdi });
      } catch (e) {
        console.warn("Robust bulut:", e);
        bulut = false;
      }
    }

    if (supheli && uret.parmak !== sonSupheliParmak) {
      sonSupheliParmak = uret.parmak;
      window.APARTIM.toast?.("Kayıt sayısı düştü. Robust koruma yedeği duruyor.", "uyari");
    }

    if (modalAcikMi()) listeyiYenile().catch(() => {});
    return { atlandi: false, yerel: true, bulut, supheli, parmak: uret.parmak, zarf };
  }

  function hemen(sebep, opts) {
    const is = zincir.then(() => calistir(sebep, opts));
    zincir = is.then(() => {}, () => {});
    return is;
  }

  function planla(sebep, ms) {
    clearTimeout(zamanlayici);
    zamanlayici = setTimeout(() => {
      zamanlayici = null;
      hemen(sebep).catch(() => {});
    }, ms);
  }

  function onVeri(e) {
    if (mesgul) return;
    if (!hazirMi()) return;
    const sebep = (e && e.detail && e.detail.sebep) || "";
    if (sebep === "ilk-senkron") planla("otomatik", ILK_GECIKME);
    else if (sebep === "yerel-yuklendi") planla("otomatik", 1500);
    else planla("otomatik", OTO_GECIKME);
  }

  function flushGorunurluk() {
    if (!hazirMi()) return;
    clearTimeout(zamanlayici);
    zamanlayici = null;
    hemen("gorunurluk").catch(() => {});
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  function tarihYazi(ms) {
    try {
      return new Date(ms).toLocaleString("tr-TR", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch (e) {
      return new Date(ms).toISOString();
    }
  }

  function modal() {
    return document.getElementById("modal-robust");
  }

  function modalAcikMi() {
    const m = modal();
    return !!(m && !m.classList.contains("hidden"));
  }

  function uyari(msg) {
    const el = document.getElementById("robust-uyari");
    if (!el) return;
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.classList.remove("hidden");
    el.textContent = msg;
  }

  function mesgulAyarla(acik) {
    mesgul = !!acik;
    modal()?.classList.toggle("robust-mesgul", mesgul);
  }

  function ozetYazi(o) {
    const x = o || {};
    return (x.rezervasyon || 0) + " rezervasyon · " +
      (x.daire || 0) + " oda · " +
      (x.kasa || 0) + " kasa";
  }

  async function listeTopla() {
    const uid = uidAl();
    const yerel = await depoListele(uid);
    let bulut = null;
    try { bulut = await bulutGetir(true); } catch (e) { bulut = null; }

    const grup = new Map();
    const ekle = (oge) => {
      if (!oge || !oge.parmak) return;
      const varOlan = grup.get(oge.parmak);
      if (!varOlan) {
        grup.set(oge.parmak, oge);
        return;
      }
      varOlan.yerel = varOlan.yerel || oge.yerel;
      varOlan.bulut = varOlan.bulut || oge.bulut;
      if (oge.koruma) varOlan.koruma = true;
      if (oge.zaman > varOlan.zaman) {
        varOlan.zaman = oge.zaman;
        varOlan.zarf = oge.zarf;
        varOlan.id = oge.id;
        varOlan.sebep = oge.sebep;
        varOlan.supheli = oge.supheli;
      }
    };

    yerel.forEach((k) => {
      if (!k.zarf || !k.zarf.parmak) return;
      ekle({
        id: k.id,
        parmak: k.zarf.parmak,
        zaman: k.zaman || Date.parse(k.zarf.olusturulma) || 0,
        sebep: k.zarf.sebep || k.sebep,
        supheli: !!(k.supheli || k.zarf.supheli),
        koruma: !!k.korumaSlot,
        yerel: true,
        bulut: false,
        zarf: k.zarf
      });
    });

    const halka = bulut && bulut.halka;
    if (halka && typeof halka === "object") {
      Object.keys(halka).forEach((slot) => {
        const z = halka[slot];
        if (!z || !z.parmak) return;
        ekle({
          id: z.id || ("bulut-" + slot),
          parmak: z.parmak,
          zaman: Date.parse(z.olusturulma) || 0,
          sebep: z.sebep || "otomatik",
          supheli: !!z.supheli,
          koruma: false,
          yerel: false,
          bulut: true,
          zarf: z
        });
      });
    }
    if (bulut && bulut.koruma && bulut.koruma.parmak) {
      const z = bulut.koruma;
      ekle({
        id: z.id || "bulut-koruma",
        parmak: z.parmak,
        zaman: Date.parse(z.olusturulma) || 0,
        sebep: z.sebep || "otomatik",
        supheli: false,
        koruma: true,
        yerel: false,
        bulut: true,
        zarf: z
      });
    }

    return Array.from(grup.values()).sort((a, b) => {
      if (a.koruma !== b.koruma) return a.koruma ? -1 : 1;
      return b.zaman - a.zaman;
    });
  }

  async function durumYaz(liste) {
    const el = document.getElementById("robust-durum");
    if (!el) return;
    const meta = metaOku();
    const son = meta.zaman ? tarihYazi(meta.zaman) : "henüz yok";
    const bulut = window.APARTIM.db?.robustBulutHazir?.()
      ? "bulut açık"
      : "yalnızca bu cihaz";
    const adet = liste ? liste.length : 0;
    el.textContent = "Son yedek: " + son + " · " + adet + " kopya · " + bulut +
      ". Koruma kopyası, kayıt sayısı düşen otomatik yedeklerle güncellenmez.";
  }

  async function listeyiYenile() {
    const ul = document.getElementById("robust-liste");
    if (!ul) return;
    let liste = [];
    try {
      liste = await listeTopla();
    } catch (e) {
      uyari(e.message || "Yedek listesi okunamadı.");
      return;
    }
    listeOnbellek = new Map();
    ul.innerHTML = "";
    await durumYaz(liste);
    if (!liste.length) {
      const li = document.createElement("li");
      li.className = "robust-bos";
      li.textContent = "Henüz yedek yok. Veriler yüklenince otomatik alınır.";
      ul.appendChild(li);
      return;
    }
    liste.slice(0, 30).forEach((oge) => {
      listeOnbellek.set(oge.id, oge.zarf);
      const li = document.createElement("li");
      li.className = "robust-oge";
      const kaynak = oge.yerel && oge.bulut
        ? "Bu cihaz + bulut"
        : (oge.bulut ? "Bulut" : "Bu cihaz");
      const rozet = oge.koruma
        ? '<span class="robust-rozet">Koruma</span>'
        : "";
      const suphe = oge.supheli
        ? '<span class="robust-rozet supheli">Düşüş</span>'
        : "";
      li.innerHTML =
        '<div class="robust-oge-metin">' +
          '<div class="robust-oge-baslik">' + esc(tarihYazi(oge.zaman)) + rozet + suphe + "</div>" +
          '<div class="robust-ozet">' + esc(ozetYazi(oge.zarf.ozet)) + "</div>" +
          '<div class="robust-kaynak">' + esc((SEBEP_ETIKET[oge.sebep] || "Yedek") + " · " + kaynak) + "</div>" +
        "</div>" +
        '<button type="button" class="btn-secondary robust-geri-btn" data-id="' + esc(oge.id) + '">Geri yükle</button>';
      li.querySelector(".robust-geri-btn")?.addEventListener("click", () => {
        const zarf = listeOnbellek.get(oge.id);
        if (zarf) geriYukle(zarf);
      });
      ul.appendChild(li);
    });
  }

  function modalAc() {
    uyari("");
    modal()?.classList.remove("hidden");
    window.APARTIM.app?.modalAcikGuncelle?.();
    listeyiYenile().catch((e) => uyari(e.message || "Yedekler okunamadı."));
  }

  function modalKapat() {
    modal()?.classList.add("hidden");
    uyari("");
    window.APARTIM.app?.modalAcikGuncelle?.();
  }

  async function simdiTik() {
    if (mesgul) return;
    uyari("");
    mesgulAyarla(true);
    try {
      const sonuc = await hemen("manuel");
      if (!sonuc?.yerel) throw new Error("Yedek kaydedilemedi.");
      window.APARTIM.toast?.(
        sonuc.bulut ? "Robust yedek alındı" : "Yedek bu cihaza alındı",
        "basari"
      );
      await listeyiYenile();
    } catch (err) {
      uyari(err.message || "Yedek alınamadı.");
    } finally {
      mesgulAyarla(false);
    }
  }

  async function indirTik() {
    if (mesgul) return;
    uyari("");
    if (!hazirMi()) {
      uyari("Veriler henüz yüklenmedi.");
      return;
    }
    mesgulAyarla(true);
    try {
      const sonuc = await hemen("manuel");
      const zarf = sonuc?.zarf;
      if (!zarf) throw new Error("Yedek oluşturulamadı.");
      const gun = zarf.olusturulma.slice(0, 16).replace(/[:T]/g, "-");
      const blob = new Blob([JSON.stringify(zarf, null, 2)], { type: "application/json" });
      await window.APARTIM.dosyaIndir(blob, "apartim-robust-" + gun + ".json", {
        baslik: "Robust yedek",
        basariMesaj: "Yedek dosyası indirildi",
        mobilPaylasMesaj: "Yedek dosyasını kaydedin",
        mobilIndirMesaj: "Yedek dosyası indirildi"
      });
      await listeyiYenile();
    } catch (err) {
      if (err && err.name === "AbortError") return;
      uyari(err.message || "Dosya indirilemedi.");
    } finally {
      mesgulAyarla(false);
    }
  }

  async function geriYukle(zarfHam) {
    if (mesgul) return;
    uyari("");
    const kontrol = await zarfDogrula(zarfHam);
    if (!kontrol.ok) {
      uyari(kontrol.hata || "Yedek doğrulanamadı.");
      return;
    }
    if (!hazirMi()) {
      uyari("Veriler henüz yüklenmedi.");
      return;
    }
    const simdiki = ozet(window.APARTIM.db.anlikVeriAl());
    const gelen = ozet(kontrol.veri);
    const ayni = await parmakUret(window.APARTIM.db.anlikVeriAl());
    if (ayni.parmak === (zarfHam.parmak)) {
      window.APARTIM.toast?.("Bu yedek zaten yüklü", "bilgi");
      return;
    }
    let aciklama = "Bu yedek mevcut verinin yerine geçer. Hemen önce güncel hal de Robust'a kaydedilir. " +
      "Şimdi " + ozetYazi(simdiki) + ". Yedekte " + ozetYazi(gelen) + ".";
    if ((gelen.rezervasyon || 0) < (simdiki.rezervasyon || 0)) {
      aciklama += " Yedekte daha az rezervasyon var.";
    }
    const kimlik = window.APARTIM.kimlik;
    let onay = false;
    if (kimlik?.iste) {
      onay = await kimlik.iste({
        baslik: "Yedeği geri yükle",
        aciklama,
        onayMetin: "Geri yükle",
        tehlike: true,
        yerelAnahtar: "GERİ"
      });
    } else {
      onay = confirm(aciklama);
    }
    if (!onay) return;

    mesgulAyarla(true);
    try {
      const oncesi = await hemen("geri-yukle-oncesi");
      if (!oncesi?.yerel) throw new Error("Güncel hal yedeklenemedi. Geri yükleme iptal edildi.");
      await window.APARTIM.db.anlikVeriUygula(kontrol.veri);
      window.APARTIM.toast?.("Robust yedeği geri yüklendi", "basari");
      window.APARTIM.rezOzet?.tabloCizPlanla?.();
      planla("otomatik", 3000);
      await listeyiYenile();
    } catch (err) {
      uyari(err.message || "Geri yüklenemedi.");
    } finally {
      mesgulAyarla(false);
    }
  }

  function dosyaOku(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("Dosya seçilmedi."));
        return;
      }
      if (file.size > DOSYA_LIMIT) {
        reject(new Error("Dosya 8 MB sınırından büyük."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Dosya okunamadı."));
      reader.readAsText(file);
    });
  }

  async function dosyadanTik(file) {
    const input = document.getElementById("robust-dosya");
    try {
      const metin = await dosyaOku(file);
      let ham;
      try { ham = JSON.parse(metin); }
      catch (e) { throw new Error("Dosya JSON değil."); }
      await geriYukle(ham);
    } catch (err) {
      uyari(err.message || "Dosya yüklenemedi.");
    } finally {
      if (input) input.value = "";
    }
  }

  function uiBagla() {
    document.getElementById("ayar-robust")?.addEventListener("click", () => {
      document.getElementById("ayar-menu")?.classList.add("hidden");
      modalAc();
    });
    document.getElementById("robust-close")?.addEventListener("click", modalKapat);
    document.getElementById("robust-kapat")?.addEventListener("click", modalKapat);
    document.getElementById("robust-simdi")?.addEventListener("click", simdiTik);
    document.getElementById("robust-indir")?.addEventListener("click", indirTik);
    document.getElementById("robust-dosya")?.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) dosyadanTik(f);
    });
    modal()?.addEventListener("click", (e) => {
      if (e.target.id === "modal-robust") modalKapat();
    });
  }

  function baslat() {
    document.addEventListener("apartim:veri-degisti", onVeri);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushGorunurluk();
    });
    window.addEventListener("pagehide", flushGorunurluk);
    if (hazirMi()) planla("otomatik", ILK_GECIKME);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", uiBagla);
    } else {
      uiBagla();
    }
  }

  baslat();

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.robust = {
    hemen,
    modalAc,
    modalKapat,
    _cekirdek: {
      kanon,
      veriNorm,
      parmakUret,
      ozet,
      supheliMi,
      budamaKarar,
      cekimKarari,
      bulutKarari,
      korumaGuncellenmeli,
      zarfDogrula,
      kritikMi,
      FORMAT,
      SURUM
    }
  };

})();
