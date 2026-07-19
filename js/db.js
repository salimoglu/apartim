/* =========================================================
   APARTIM — Veri katmanı
   Hem Firebase Realtime DB hem de yerel localStorage'ı saran
   ortak bir API sağlar. Diğer modüller window.APARTIM.db üzerinden
   konuşur, alttaki kaynakla ilgilenmez.
   ========================================================= */

(function () {
  "use strict";

  const VARSAYILAN_MUSTERI_KAYNAKLARI = [
    { id: "booking",       ad: "Booking",         simge: "🌐", sira: 1, sistem: true },
    { id: "eski-musteri",  ad: "Eski müşteri",    simge: "⭐", sira: 2, sistem: true },
    { id: "kapi",          ad: "Kapıdan gelen",   simge: "🚪", sira: 3, sistem: true },
    { id: "misafir",       ad: "Misafir",         simge: "👋", sira: 4, sistem: true },
    { id: "albatros",      ad: "Albatros",        simge: "🦅", sira: 5, sistem: true }
  ];

  const KATEGORI_SIMGELER = [
    "🌐", "⭐", "🚪", "👋", "🦅", "📞", "✈️", "🏠", "💼", "❤️",
    "📱", "🧳", "🏖️", "🎯", "💰", "🔵", "🟢", "🟡", "🏷️", "👤"
  ];

  const SABIT_DAIRELER = [
    { id: "oda-1", ad: "1. Oda", kat: 0, konum: "tek", gunlukUcret: 1000, sira: 1 },
    { id: "oda-2", ad: "2. Oda", kat: 0, konum: "tek", gunlukUcret: 1000, sira: 2 },
    { id: "oda-3", ad: "3. Oda", kat: 0, konum: "tek", gunlukUcret: 1000, sira: 3 },
    { id: "oda-4", ad: "4. Oda", kat: 0, konum: "tek", gunlukUcret: 1000, sira: 4 },
    { id: "oda-5", ad: "5. Oda", kat: 0, konum: "tek", gunlukUcret: 1000, sira: 5 }
  ];

  const durum = {
    daireler: {},      // { id: {ad, gunlukUcret, temizlik, ...} }
    rezervasyonlar: {},// { rezId: {...} }
    temizlikKayit: {}, // { kayitId: {...} }
    musteriKaynaklari: {}, // { id: { id, ad, simge, sira, sistem } }
    kasaHarcama: {},   // { id: { id, tarih, not, tutar, pb, tip: gelir|gider, olusturulma } }
    dovizKurlari: { USD: 46.5, EUR: 50.5 },
    yuklendi: false
  };
  function bildir(olay, veri) {
    document.dispatchEvent(new CustomEvent("apartim:" + olay, { detail: veri }));
  }

  let fbIlkSenkronBitti = false;
  let fbIlkSenkronTimer = null;
  let fbIlkDaireler = false;
  let fbIlkRez = false;

  function fbYuklemeDurumuGuncelle() {
    if (fbIlkDaireler && fbIlkRez) durum.yuklendi = true;
  }

  function veriDegistiBildir(sebep) {
    if (window.APARTIM.firebaseAktif && !fbIlkSenkronBitti) {
      fbYuklemeDurumuGuncelle();
      clearTimeout(fbIlkSenkronTimer);
      fbIlkSenkronTimer = setTimeout(() => {
        fbIlkSenkronBitti = true;
        fbYuklemeDurumuGuncelle();
        bildir("veri-degisti", { sebep: "ilk-senkron" });
      }, 16);
      return;
    }
    fbYuklemeDurumuGuncelle();
    bildir("veri-degisti", { sebep });
  }

  // ---------- Tarih yardımcıları ----------
  function tarihNormal(s) {
    if (!s) return "";
    if (s instanceof Date) {
      const y = s.getFullYear();
      const m = String(s.getMonth() + 1).padStart(2, "0");
      const d = String(s.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + d;
    }
    return String(s);
  }
  function bugunISO() { return tarihNormal(new Date()); }
  function geceSayisi(giris, cikis) {
    if (!giris || !cikis) return 0;
    const a = new Date(giris + "T00:00:00");
    const b = new Date(cikis + "T00:00:00");
    const fark = Math.round((b - a) / 86400000);
    return Math.max(0, fark);
  }
  function gunEkleISO(iso, ekle) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + ekle);
    return tarihNormal(d);
  }
  function geceTarihleri(giris, cikis) {
    const n = geceSayisi(giris, cikis);
    const liste = [];
    for (let i = 0; i < n; i++) liste.push(gunEkleISO(giris, i));
    return liste;
  }

  /** Tek gece fiyat kaydı: { tutar, pb } — sayı veya nesne kabul eder */
  function tarihFiyatKaydiNorm(deger, varsayilanPb) {
    const para = window.APARTIM.para;
    const defPb = para?.paraBirimiNorm(varsayilanPb) || "TL";
    if (deger == null || deger === "") return null;
    if (typeof deger === "number" || typeof deger === "string") {
      const tutar = Number(deger);
      if (!Number.isFinite(tutar) || tutar <= 0) return null;
      return { tutar, pb: defPb };
    }
    if (typeof deger === "object") {
      const raw = deger.tutar != null ? deger.tutar
        : (deger.ucret != null ? deger.ucret : deger.fiyat);
      const tutar = Number(raw);
      if (!Number.isFinite(tutar) || tutar <= 0) return null;
      const pb = para?.paraBirimiNorm(deger.pb || deger.paraBirimi) || defPb;
      return { tutar, pb };
    }
    return null;
  }

  /** { tarih: { tutar, pb } } */
  function tarihFiyatlariNorm(fiyatlar, varsayilanPb) {
    if (!fiyatlar || typeof fiyatlar !== "object" || Array.isArray(fiyatlar)) return null;
    const out = {};
    Object.keys(fiyatlar).forEach((k) => {
      const kayit = tarihFiyatKaydiNorm(fiyatlar[k], varsayilanPb);
      if (kayit) out[k] = kayit;
    });
    return Object.keys(out).length ? out : null;
  }

  /**
   * Geriye uyumlu okuma:
   * - Tek PB ise { tarih: tutar }
   * - Karışık PB ise { tarih: { tutar, pb } }
   * İç kullanım için tarihFiyatlariNorm tercih edin.
   */
  function tarihFiyatlariToObject(fiyatlar, varsayilanPb) {
    const norm = tarihFiyatlariNorm(fiyatlar, varsayilanPb);
    if (!norm) return null;
    const pbs = new Set(Object.values(norm).map((k) => k.pb));
    if (pbs.size <= 1) {
      const out = {};
      Object.keys(norm).forEach((k) => { out[k] = norm[k].tutar; });
      return out;
    }
    const out = {};
    Object.keys(norm).forEach((k) => {
      out[k] = { tutar: norm[k].tutar, pb: norm[k].pb };
    });
    return out;
  }

  /** Kayıt için sıkıştır: tek PB → sayılar; karışık → nesneler */
  function tarihFiyatlariKayitIcin(fiyatlar, varsayilanPb) {
    const norm = tarihFiyatlariNorm(fiyatlar, varsayilanPb);
    if (!norm) return null;
    return tarihFiyatlariToObject(norm, varsayilanPb);
  }

  /** Tüm geceler aynı fiyat ve aynı para birimiyse true (tek fiyat modu) */
  function tarihFiyatlariTekMi(giris, cikis, fiyatlar, varsayilanUcret, varsayilanPb) {
    const defPb = window.APARTIM.para?.paraBirimiNorm(varsayilanPb) || "TL";
    const tf = tarihFiyatlariNorm(fiyatlar, defPb);
    if (!tf) return true;
    const tarihler = geceTarihleri(giris, cikis);
    if (!tarihler.length) return true;
    const fallback = Number(varsayilanUcret) || 0;
    const kayitlar = tarihler.map((t) => tf[t] || { tutar: fallback, pb: defPb });
    const ilk = kayitlar[0];
    return kayitlar.every((k) => k.tutar === ilk.tutar && k.pb === ilk.pb);
  }

  /** Gece fiyatlarından gösterim PB: yalnızca TL → TL; TL+döviz → döviz */
  function fiyatPbListesindenGosterim(pbs) {
    const list = [...new Set((pbs || []).map((p) =>
      window.APARTIM.para?.paraBirimiNorm(p) || "TL"
    ))];
    if (!list.length) return "TL";
    if (list.includes("USD")) return "USD";
    if (list.length === 1) return list[0] === "EUR" ? "TL" : list[0];
    return "TL";
  }

  /** Kademeleri nesne olarak döndürebilir */
  function ucretKademeleriToArray(kademeler) {
    if (!kademeler) return null;
    if (Array.isArray(kademeler)) return kademeler.slice();
    if (typeof kademeler === "object") {
      return Object.keys(kademeler)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => kademeler[k])
        .filter(Boolean);
    }
    return null;
  }

  /** Kademeleri sırala / normalize et */
  function ucretKademeleriNormalize(kademeler, varsayilanUcret) {
    const dizi = ucretKademeleriToArray(kademeler);
    if (!dizi || !dizi.length) {
      const u = Number(varsayilanUcret) || 0;
      return u > 0 ? [{ basGece: 1, bitGece: null, ucret: u }] : [];
    }
    return dizi
      .map((k) => ({
        basGece: Math.max(1, Number(k.basGece) || 1),
        bitGece: k.bitGece != null && k.bitGece !== "" ? Number(k.bitGece) : null,
        ucret: Number(k.ucret) || 0
      }))
      .filter((k) => k.ucret > 0)
      .sort((a, b) => a.basGece - b.basGece);
  }

  function rezervasyonlariNormalize(obj) {
    if (!obj || typeof obj !== "object") return {};
    const out = {};
    Object.keys(obj).forEach((key) => {
      const r = obj[key];
      if (r && typeof r === "object") {
        const kayit = Object.assign({}, r, { id: r.id || key });
        if (!kayit.paraBirimi) kayit.paraBirimi = "TL";
        delete kayit.kalanGunleri;
        out[key] = kayit;
      }
    });
    return out;
  }

  function dovizKurlariSenkron() {
    if (window.APARTIM.para) {
      window.APARTIM.para.kurlariYukle(durum.dovizKurlari);
    }
  }

  function dovizKurlariNorm(kurlar) {
    const v = window.APARTIM.para?.VARSAYILAN || { USD: 46.5, EUR: 50.5 };
    const out = {
      USD: Number(kurlar?.USD) > 0 ? Number(kurlar.USD) : v.USD,
      EUR: Number(kurlar?.EUR) > 0 ? Number(kurlar.EUR) : v.EUR
    };
    if (kurlar?.guncelleme) out.guncelleme = kurlar.guncelleme;
    if (kurlar?.kaynak) out.kaynak = kurlar.kaynak;
    return out;
  }

  function dovizKurlariKaydet(kurlar) {
    durum.dovizKurlari = dovizKurlariNorm(kurlar);
    dovizKurlariSenkron();
    if (window.APARTIM.firebaseAktif) {
      return kaydet("doviz-kurlari", durum.dovizKurlari);
    }
    yereliKaydet();
    bildir("veri-degisti", { sebep: "doviz-kurlari" });
    return Promise.resolve();
  }

  /** Konak gecesi (1 tabanlı) için ücret */
  function geceUcretiBul(kademeler, geceNo, varsayilanUcret) {
    const liste = ucretKademeleriNormalize(kademeler, varsayilanUcret);
    if (!liste.length) return Number(varsayilanUcret) || 0;
    for (let i = liste.length - 1; i >= 0; i--) {
      const k = liste[i];
      if (geceNo >= k.basGece && (k.bitGece == null || geceNo <= k.bitGece)) {
        return k.ucret;
      }
    }
    return liste[0].ucret;
  }

  function rezervasyonKurCift(rez) {
    const para = window.APARTIM.para;
    const canli = para?.kurlariGetir?.() || { USD: 46.5, EUR: 50.5 };
    let usd = Number(rez?.kurUsd) > 0 ? Number(rez.kurUsd) : 0;
    let eur = Number(rez?.kurEur) > 0 ? Number(rez.kurEur) : 0;
    const og = rez?.odenenGunleri;
    if (og && typeof og === "object") {
      Object.keys(og).sort().forEach((t) => {
        odenenGunDegerListe(og[t], t).forEach((kayit) => {
          if (Number(kayit?.kurUsd) > 0) usd = Number(kayit.kurUsd);
          if (Number(kayit?.kurEur) > 0) eur = Number(kayit.kurEur);
        });
      });
    }
    return {
      USD: usd > 0 ? usd : canli.USD,
      EUR: eur > 0 ? eur : canli.EUR
    };
  }

  function rezervasyonGeceKaydi(rez, geceNo) {
    const fallback = Number(rez.gunlukUcret) || 0;
    const defPb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    const tarih = gunEkleISO(rez.giris, geceNo - 1);
    const tf = tarihFiyatlariNorm(rez.tarihFiyatlari, defPb);
    if (tf && tf[tarih]) return tf[tarih];
    const kademeler = ucretKademeleriToArray(rez.ucretKademeleri);
    if (kademeler && kademeler.length) {
      return { tutar: geceUcretiBul(kademeler, geceNo, fallback), pb: defPb };
    }
    return { tutar: fallback, pb: defPb };
  }

  function rezervasyonGeceUcreti(rez, geceNo) {
    return rezervasyonGeceKaydi(rez, geceNo).tutar;
  }

  function rezervasyonTarihUcreti(rez, tarihISO) {
    const geceNo = geceSayisi(rez.giris, tarihISO) + 1;
    const toplamGece = geceSayisi(rez.giris, rez.cikis);
    if (geceNo < 1 || geceNo > toplamGece) return Number(rez.gunlukUcret) || 0;
    return rezervasyonGeceUcreti(rez, geceNo);
  }

  function rezervasyonTutarHesapla(rez) {
    const para = window.APARTIM.para;
    const gece = geceSayisi(rez.giris, rez.cikis);
    const kur = rezervasyonKurCift(rez);
    const gecelik = [];
    let toplamTl = 0;
    for (let i = 1; i <= gece; i++) {
      const tarih = gunEkleISO(rez.giris, i - 1);
      const kayit = rezervasyonGeceKaydi(rez, i);
      const ucretTl = para
        ? para.tlKarsiligi(kayit.tutar, kayit.pb, kur)
        : kayit.tutar;
      gecelik.push({
        gece: i,
        tarih,
        ucret: kayit.tutar,
        pb: kayit.pb,
        ucretTl
      });
      toplamTl += ucretTl;
    }
    const gosterimPb = fiyatPbListesindenGosterim(gecelik.map((g) => g.pb));
    const toplam = para
      ? para.tlDenPb(toplamTl, gosterimPb, kur)
      : toplamTl;
    return { gece, toplam, toplamTl, gecelik, gosterimPb };
  }

  function rezervasyonToplamTutar(rez) {
    if (rez.toplamTutar != null) return Number(rez.toplamTutar) || 0;
    return rezervasyonTutarHesapla(rez).toplam;
  }

  /**
   * Kalan / özet gösterim PB:
   * yalnızca TL → TL; TL yanında başka birim varsa o birim (USD tercih).
   * Fiyat geceleri + tahsilat girdileri birlikte değerlendirilir.
   */
  function rezervasyonGosterimPb(rez) {
    const para = window.APARTIM.para;
    const pbs = [];
    const defPb = para?.rezParaBirimi(rez) || "TL";
    pbs.push(defPb);
    const gece = geceSayisi(rez?.giris, rez?.cikis);
    for (let i = 1; i <= gece; i++) {
      pbs.push(rezervasyonGeceKaydi(rez, i).pb);
    }
    const og = odenenGunleriTemizle(rez) || rez?.odenenGunleri;
    if (og && typeof og === "object") {
      Object.keys(og).forEach((t) => {
        odenenGunDegerListe(og[t], t).forEach((kayit) => {
          if (!kayit) return;
          if ((Number(kayit.tutarTl) || 0) > 0) pbs.push("TL");
          if ((Number(kayit.tutarUsd) || 0) > 0) pbs.push("USD");
          if (
            !(Number(kayit.tutarTl) > 0) &&
            !(Number(kayit.tutarUsd) > 0) &&
            (Number(kayit.tutar) || 0) > 0
          ) {
            pbs.push(kayit.tutarBirim === "TL" ? "TL" : defPb);
          }
        });
      });
    }
    return fiyatPbListesindenGosterim(pbs);
  }

  const ODEME_YONTEMLERI = {
    kasa: "Kasa",
    pos: "Pos",
    booking: "Booking",
    havale: "Hesaba havale",
    diger: "Diğer"
  };
  const ODEME_YONTEM_VARSAYILAN = "kasa";

  function odemeYontemNorm(yontem) {
    const y = String(yontem || "").toLowerCase();
    /* Eski kayıtlar: elden → kasa */
    if (y === "elden") return "kasa";
    return ODEME_YONTEMLERI[y] ? y : ODEME_YONTEM_VARSAYILAN;
  }

  function odenenKayitDoluMu(kayit) {
    if (!kayit) return false;
    if ((Number(kayit.tutarTl) || 0) > 0) return true;
    if ((Number(kayit.tutarUsd) || 0) > 0) return true;
    return (Number(kayit.tutar) || 0) > 0;
  }

  function odemeIdUret() {
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function odenenGunKaydiNorm(deger) {
    if (deger == null || deger === "") return null;
    if (Array.isArray(deger)) return null;
    if (typeof deger === "number" || typeof deger === "string") {
      const tutar = Number(deger);
      if (!Number.isFinite(tutar) || tutar < 0) return null;
      return { tutar, yontem: ODEME_YONTEM_VARSAYILAN };
    }
    if (typeof deger === "object") {
      const yontem = odemeYontemNorm(deger.yontem);
      const not = String(deger.not || "").trim().slice(0, 200);
      const id = deger.id != null && String(deger.id).trim() ? String(deger.id).trim() : "";
      const tutarTl = Number(deger.tutarTl);
      const tutarUsd = Number(deger.tutarUsd);
      const hasSplit =
        (Number.isFinite(tutarTl) && tutarTl > 0) ||
        (Number.isFinite(tutarUsd) && tutarUsd > 0);
      if (hasSplit) {
        const kurUsd = Number(deger.kurUsd) > 0 ? Number(deger.kurUsd) : undefined;
        const para = window.APARTIM.para;
        const tlTop = para
          ? para.tahsilatTlToplam(
            Number.isFinite(tutarTl) && tutarTl > 0 ? tutarTl : 0,
            Number.isFinite(tutarUsd) && tutarUsd > 0 ? tutarUsd : 0,
            kurUsd
          )
          : (Number.isFinite(tutarTl) ? tutarTl : 0);
        const out = { tutar: tlTop, tutarBirim: "TL", yontem };
        if (Number.isFinite(tutarTl) && tutarTl > 0) out.tutarTl = tutarTl;
        if (Number.isFinite(tutarUsd) && tutarUsd > 0) out.tutarUsd = tutarUsd;
        if (kurUsd) out.kurUsd = kurUsd;
        if (not) out.not = not;
        if (id) out.id = id;
        return out;
      }
      const tutar = Number(deger.tutar);
      if (!Number.isFinite(tutar) || tutar < 0) return null;
      const out = { tutar, yontem };
      if (deger.tutarBirim === "TL") out.tutarBirim = "TL";
      if (Number(deger.kurUsd) > 0) out.kurUsd = Number(deger.kurUsd);
      if (not) out.not = not;
      if (id) out.id = id;
      return out;
    }
    return null;
  }

  /** Eski tek kayıt veya dizi → id'li kayıt listesi (id yoksa kararlı parmak izi) */
  function odenenGunDegerListe(deger, tarihHint) {
    if (deger == null || deger === "") return [];
    const arr = Array.isArray(deger) ? deger : [deger];
    const out = [];
    arr.forEach((item, idx) => {
      const kayit = odenenGunKaydiNorm(item);
      if (!kayit || !odenenKayitDoluMu(kayit)) return;
      if (!kayit.id) {
        const hamId = item && typeof item === "object" && item.id != null
          ? String(item.id).trim()
          : "";
        if (hamId) {
          kayit.id = hamId;
        } else {
          const iz =
            String(tarihHint || "") + "|" + idx + "|" +
            (Number(kayit.tutarTl) || 0) + "|" +
            (Number(kayit.tutarUsd) || 0) + "|" +
            (Number(kayit.tutar) || 0) + "|" +
            (kayit.yontem || "") + "|" +
            String(kayit.not || "").slice(0, 40);
          kayit.id = "p_leg_" + iz.replace(/\s+/g, "_").slice(0, 96);
        }
      }
      out.push(kayit);
    });
    return out;
  }

  /** Tek tahsilat kaydının TL karşılığı (kayıtlı kur tercih edilir) */
  function odenenKayitTl(kayit, rez) {
    if (!kayit) return 0;
    const para = window.APARTIM.para;
    const pb = para?.rezParaBirimi(rez) || "TL";
    const kur = rezervasyonKurCift(rez);
    if (Number(kayit.kurUsd) > 0) kur.USD = Number(kayit.kurUsd);
    if ((Number(kayit.tutarTl) || 0) > 0 || (Number(kayit.tutarUsd) || 0) > 0) {
      return para
        ? para.tahsilatTlToplam(kayit.tutarTl, kayit.tutarUsd, kur.USD)
        : (Number(kayit.tutarTl) || 0);
    }
    const tutar = Number(kayit.tutar) || 0;
    if (!para) return tutar;
    /* Yeni kayıtlar: tutar TL toplamı; eski kayıtlar: rezervasyon PB'si */
    if (kayit.tutarBirim === "TL") return tutar;
    return para.tlKarsiligi(tutar, pb, kur);
  }

  /** Tahsilatın gösterim para birimindeki karşılığı */
  function odenenKayitPb(kayit, rez) {
    const para = window.APARTIM.para;
    const pb = rezervasyonGosterimPb(rez);
    const tl = odenenKayitTl(kayit, rez);
    if (!para || pb === "TL") return tl;
    const kur = rezervasyonKurCift(rez);
    if (Number(kayit?.kurUsd) > 0) kur.USD = Number(kayit.kurUsd);
    return para.tlDenPb(tl, pb, kur);
  }

  function odenenGunleriTemizle(rez) {
    if (!rez.odenenGunleri || typeof rez.odenenGunleri !== "object") return undefined;
    const out = {};
    Object.keys(rez.odenenGunleri).forEach((t) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return;
      const liste = odenenGunDegerListe(rez.odenenGunleri[t], t);
      if (liste.length) out[t] = liste;
    });
    return Object.keys(out).length ? out : undefined;
  }

  /** Rezervasyonun tüm tahsilat kayıtları (tarih artan; aynı günde birden fazla olabilir) */
  function rezervasyonOdenenListe(rez) {
    const og = odenenGunleriTemizle(rez) || rez?.odenenGunleri;
    if (!og) return [];
    const liste = [];
    Object.keys(og).sort().forEach((tarih) => {
      odenenGunDegerListe(og[tarih], tarih).forEach((kayit) => {
        liste.push(Object.assign(
          { tarih, manuel: true, tutarPb: odenenKayitPb(kayit, rez) },
          kayit
        ));
      });
    });
    return liste;
  }

  function rezervasyonOdenenKayitGetir(rez, odemeId) {
    if (!rez || !odemeId) return null;
    const liste = rezervasyonOdenenListe(rez);
    return liste.find((k) => k.id === odemeId) || null;
  }

  function rezervasyonToplamTl(rez) {
    const para = window.APARTIM.para;
    const hesap = rezervasyonTutarHesapla(rez);
    if (hesap.gece > 0 && hesap.toplamTl != null) return hesap.toplamTl;
    const toplam = rezervasyonToplamTutar(rez);
    const pb = para?.rezParaBirimi(rez) || "TL";
    return para ? para.tlKarsiligi(toplam, pb, rezervasyonKurCift(rez)) : toplam;
  }

  function rezervasyonOdenenToplamTl(rez) {
    const og = odenenGunleriTemizle(rez) || rez.odenenGunleri;
    if (!og) return 0;
    return Object.keys(og).reduce((s, t) => {
      return s + odenenGunDegerListe(og[t], t).reduce((s2, kayit) => {
        return s2 + odenenKayitTl(kayit, rez);
      }, 0);
    }, 0);
  }

  /** Gösterim PB'sinde ödenen toplam (kayıt günü kuru) */
  function rezervasyonOdenenToplam(rez) {
    const para = window.APARTIM.para;
    const pb = rezervasyonGosterimPb(rez);
    const tl = rezervasyonOdenenToplamTl(rez);
    if (!para || pb === "TL") return tl;
    return para.tlDenPb(tl, pb, rezervasyonKurCift(rez));
  }

  function rezervasyonKalanTl(rez) {
    return rezervasyonToplamTl(rez) - rezervasyonOdenenToplamTl(rez);
  }

  /** Gösterim PB'sinde toplam tutar (kayıt günü kuru) */
  function rezervasyonToplamGosterim(rez) {
    const para = window.APARTIM.para;
    const pb = rezervasyonGosterimPb(rez);
    const tl = rezervasyonToplamTl(rez);
    if (!para || pb === "TL") return tl;
    return para.tlDenPb(tl, pb, rezervasyonKurCift(rez));
  }

  /**
   * Toplam − ödemeler (gösterim PB'sinde).
   * Yalnızca TL → TL; TL + döviz → döviz (kayıt günü kuru).
   */
  function rezervasyonKalanHesapla(rez) {
    const para = window.APARTIM.para;
    const pb = rezervasyonGosterimPb(rez);
    const kalanTl = rezervasyonKalanTl(rez);
    if (!para || pb === "TL") return kalanTl;
    return para.tlDenPb(kalanTl, pb, rezervasyonKurCift(rez));
  }

  function rezervasyonFazlaOdenen(rez) {
    const k = rezervasyonKalanHesapla(rez);
    return k < 0 ? -k : 0;
  }

  function rezervasyonTahsilatTamamMi(rez) {
    if (!rez) return false;
    if (rez.tahsilatTamamlandi) return true;
    return rezervasyonKalanTl(rez) <= 0.009 && rezervasyonOdenenToplamTl(rez) > 0;
  }

  function rezervasyonOdenenGosterim(rez, tarih) {
    const og = rez.odenenGunleri;
    const liste = og && Object.prototype.hasOwnProperty.call(og, tarih)
      ? odenenGunDegerListe(og[tarih], tarih)
      : [];
    if (liste.length) {
      let tutarTl = 0;
      let tutarUsd = 0;
      let tutar = 0;
      let kurUsd;
      liste.forEach((kayit) => {
        tutarTl += Number(kayit.tutarTl) || 0;
        tutarUsd += Number(kayit.tutarUsd) || 0;
        tutar += odenenKayitTl(kayit, rez);
        if (Number(kayit.kurUsd) > 0) kurUsd = Number(kayit.kurUsd);
      });
      const son = liste[liste.length - 1];
      return {
        tutar,
        tutarBirim: "TL",
        tutarTl,
        tutarUsd,
        kurUsd,
        tutarPb: odenenKayitPb(
          { tutar, tutarBirim: "TL", tutarTl, tutarUsd, kurUsd, yontem: son.yontem },
          rez
        ),
        manuel: true,
        yontem: son.yontem,
        not: son.not || "",
        adet: liste.length,
        kayitlar: liste
      };
    }
    return {
      tutar: 0,
      tutarTl: 0,
      tutarUsd: 0,
      tutarPb: 0,
      manuel: false,
      yontem: ODEME_YONTEM_VARSAYILAN,
      not: "",
      adet: 0,
      kayitlar: []
    };
  }

  /**
   * Tahsilat ekle / güncelle / sil.
   * ekstra.odemeId varsa o kayıt; yoksa yeni ekler. deger null → sil.
   */
  function rezervasyonOdenenHucreKaydet(rezId, tarih, deger, ekstra) {
    const mevcut = durum.rezervasyonlar[rezId];
    if (!mevcut) throw new Error("Rezervasyon bulunamadı");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih || "")) {
      throw new Error("Geçersiz tahsilat tarihi");
    }
    const odenenGunleri = Object.assign({}, mevcut.odenenGunleri || {});
    const odemeId = ekstra && ekstra.odemeId ? String(ekstra.odemeId) : "";

    /* Aynı id başka günde varsa önce oradan çıkar (tarih taşıma / silme) */
    if (odemeId) {
      Object.keys(odenenGunleri).forEach((t) => {
        const L = odenenGunDegerListe(odenenGunleri[t], t).filter((k) => k.id !== odemeId);
        if (L.length) odenenGunleri[t] = L;
        else delete odenenGunleri[t];
      });
    }

    let liste = odenenGunDegerListe(odenenGunleri[tarih], tarih);

    if (deger == null || deger === "") {
      if (!odemeId) liste = [];
      /* odemeId varsa yukarıda tüm günlerden silindi */
    } else {
      const kayit = odenenGunKaydiNorm(deger);
      if (kayit && odenenKayitDoluMu(kayit)) {
        kayit.id = odemeId || odemeIdUret();
        liste.push(kayit);
      }
    }

    if (liste.length) odenenGunleri[tarih] = liste;
    else delete odenenGunleri[tarih];

    const partial = {
      odenenGunleri: Object.keys(odenenGunleri).length ? odenenGunleri : null
    };
    if (ekstra && Object.prototype.hasOwnProperty.call(ekstra, "tahsilatTamamlandi")) {
      partial.tahsilatTamamlandi = !!ekstra.tahsilatTamamlandi;
    }
    return rezervasyonGuncelle(rezId, partial);
  }

  /** Dönem içindeki tahsilatları ödeme yöntemi × para birimi olarak toplar */
  function rezervasyonOdemeDonemToplam(rez, donemBas, donemBit) {
    const og = odenenGunleriTemizle(rez) || rez.odenenGunleri;
    if (!og) return null;
    const pb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    const yontemToplam = {};
    Object.keys(og).forEach((t) => {
      if (t < donemBas || t >= donemBit) return;
      odenenGunDegerListe(og[t], t).forEach((kayit) => {
        if (!kayit || !odenenKayitDoluMu(kayit)) return;
        const y = kayit.yontem;
        if (!yontemToplam[y]) yontemToplam[y] = { TL: 0, USD: 0, EUR: 0 };
        if ((kayit.tutarTl || 0) > 0 || (kayit.tutarUsd || 0) > 0) {
          if ((kayit.tutarTl || 0) > 0) yontemToplam[y].TL += kayit.tutarTl;
          if ((kayit.tutarUsd || 0) > 0) yontemToplam[y].USD += kayit.tutarUsd;
        } else {
          yontemToplam[y][pb] += kayit.tutar;
        }
      });
    });
    return Object.keys(yontemToplam).length ? yontemToplam : null;
  }

  function rezervasyonOzeti(rez) {
    const { gece, toplam, gecelik, gosterimPb } = rezervasyonTutarHesapla(rez);
    const gunluk = Number(rez.gunlukUcret) || 0;
    const defPb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    const tfNorm = tarihFiyatlariNorm(rez.tarihFiyatlari, defPb);
    const tarihliFiyat = tfNorm &&
      !tarihFiyatlariTekMi(rez.giris, rez.cikis, tfNorm, gunluk, defPb);
    const kademeler = ucretKademeleriNormalize(
      rez.ucretKademeleri,
      rez.gunlukUcret
    );
    const tekKademe = kademeler.length <= 1 &&
      kademeler[0] && kademeler[0].basGece === 1 && kademeler[0].bitGece == null;
    return {
      toplamGece: gece,
      toplamTutar: toplam,
      gecelik,
      gosterimPb,
      tarihFiyatlari: tarihliFiyat ? tarihFiyatlariKayitIcin(tfNorm, defPb) : null,
      kademeler: !tarihliFiyat && !tekKademe ? kademeler : null,
      gunlukUcret: gunluk || kademeler[0]?.ucret || 0
    };
  }

  function rezervasyonKayitHazirla(rez) {
    const ozet = rezervasyonOzeti(rez);
    const kayit = Object.assign({}, rez, {
      toplamGece: ozet.toplamGece,
      toplamTutar: ozet.toplamTutar,
      gunlukUcret: ozet.gunlukUcret
    });
    if (ozet.gosterimPb) kayit.paraBirimi = ozet.gosterimPb;
    if (ozet.tarihFiyatlari) {
      kayit.tarihFiyatlari = ozet.tarihFiyatlari;
      delete kayit.ucretKademeleri;
    } else {
      delete kayit.tarihFiyatlari;
      if (ozet.kademeler) kayit.ucretKademeleri = ozet.kademeler;
      else delete kayit.ucretKademeleri;
    }
    const og = odenenGunleriTemizle(kayit);
    if (og) kayit.odenenGunleri = og;
    else delete kayit.odenenGunleri;
    if (kayit.tahsilatTamamlandi) kayit.tahsilatTamamlandi = true;
    else delete kayit.tahsilatTamamlandi;
    if (!(Number(kayit.kurUsd) > 0)) delete kayit.kurUsd;
    if (!(Number(kayit.kurEur) > 0)) delete kayit.kurEur;
    delete kayit.kalanGunleri;
    return kayit;
  }

  // ---------- Çakışma kontrolü ----------
  // Yarı açık aralık [giris, cikis) — çıkış günü dolu sayılmaz
  function tarihCakisiyorMu(rezA, rezB) {
    if (rezA.daireId !== rezB.daireId) return false;
    const a1 = rezA.giris, a2 = rezA.cikis;
    const b1 = rezB.giris, b2 = rezB.cikis;
    return a1 < b2 && b1 < a2;
  }

  function dairedeCakisanRez(daireId, giris, cikis, hariRezId) {
    const rezList = Object.values(durum.rezervasyonlar);
    const test = { daireId, giris, cikis };
    return rezList.find((r) =>
      r && r.id !== hariRezId && tarihCakisiyorMu(r, test)
    );
  }

  // ---------- Daire varsayılan seed ----------
  function slugId(ad) {
    const temel = String(ad || "")
      .toLowerCase()
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return temel || "kaynak";
  }

  function musteriKaynaklariSeedEt() {
    let degisti = false;
    VARSAYILAN_MUSTERI_KAYNAKLARI.forEach((t) => {
      if (!durum.musteriKaynaklari[t.id]) {
        durum.musteriKaynaklari[t.id] = Object.assign({}, t);
        degisti = true;
      } else {
        const k = durum.musteriKaynaklari[t.id];
        if (k.ad == null) { k.ad = t.ad; degisti = true; }
        if (k.sira == null) { k.sira = t.sira; degisti = true; }
        if (k.sistem == null) { k.sistem = true; degisti = true; }
        if (!k.simge) { k.simge = t.simge || "🏷️"; degisti = true; }
      }
    });
    Object.values(durum.musteriKaynaklari).forEach((k) => {
      if (!k.simge) {
        k.simge = "🏷️";
        degisti = true;
      }
    });
    if (degisti) {
      Object.values(durum.musteriKaynaklari).forEach((k) =>
        kaydet("musteri-kaynaklari/" + k.id, k)
      );
    }
  }

  function dairelerSeedEt() {
    let degisti = false;
    /* Varsayılan 5 odayı yoksa ekle; kullanıcı eklediği odaları silme */
    SABIT_DAIRELER.forEach((tanim) => {
      if (!durum.daireler[tanim.id]) {
        durum.daireler[tanim.id] = {
          id: tanim.id,
          ad: tanim.ad,
          kat: tanim.kat,
          konum: tanim.konum,
          sira: tanim.sira,
          gunlukUcret: tanim.gunlukUcret,
          temizlik: "temiz",
          temizlikGuncelleme: Date.now()
        };
        degisti = true;
      } else {
        // eksik alanları tamamla
        const d = durum.daireler[tanim.id];
        if (d.kat == null) { d.kat = tanim.kat; degisti = true; }
        if (d.konum == null) { d.konum = tanim.konum; degisti = true; }
        if (d.sira == null) { d.sira = tanim.sira; degisti = true; }
        if (d.gunlukUcret == null) { d.gunlukUcret = tanim.gunlukUcret; degisti = true; }
        if (d.temizlik == null) { d.temizlik = "temiz"; degisti = true; }
      }
    });
    if (degisti) {
      Object.values(durum.daireler).forEach((d) => kaydet("daireler/" + d.id, d));
    }
  }

  // ---------- Firebase / yerel kaynak ----------
  let kullaniciUid = null;
  let fbRef = null; // ana ref
  let yerelAktif = !window.APARTIM.firebaseAktif;
  let profilAvatarListener = null;

  function profilAvatarDinlemeyiKaldir() {
    if (profilAvatarListener && fbRef) {
      fbRef.child("profil").off("value", profilAvatarListener);
      profilAvatarListener = null;
    }
  }

  function profilAvatarUygula(kullanici) {
    if (!window.APARTIM.kullanici || !kullanici) return;
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(kullanici, "avatarId")) {
      patch.avatarId = kullanici.avatarId || null;
    }
    window.APARTIM.kullanici = Object.assign({}, window.APARTIM.kullanici, patch);
    if (window.APARTIM.avatar) {
      window.APARTIM.kullanici = window.APARTIM.avatar.kullaniciyaEkle(window.APARTIM.kullanici);
      window.APARTIM.avatar.guncelle(
        document.getElementById("ayar-avatar"),
        window.APARTIM.kullanici
      );
    }
  }

  function profilAvatarFirebaseUygula(p) {
    const uid = kullaniciUid || window.APARTIM.kullanici?.uid;
    if (!uid) return;
    const avatarId = p && p.avatarId ? p.avatarId : null;
    if (avatarId) {
      profilAvatarUygula({ avatarId });
      window.APARTIM.avatar?.depoYaz?.(uid, avatarId);
      return;
    }
    const yerel = window.APARTIM.avatar?.depoOku?.(uid);
    if (yerel && fbRef) {
      fbRef.child("profil").update({ avatarId: yerel }).catch(() => {});
      return;
    }
    if (yerel && window.APARTIM.avatar?.depoSil) {
      window.APARTIM.avatar.depoSil(uid);
    }
    profilAvatarUygula({ avatarId: null });
  }

  function profilAvatarFirebaseBagla() {
    if (!window.APARTIM.firebaseAktif || !fbRef) return;
    profilAvatarDinlemeyiKaldir();
    profilAvatarListener = (snap) => {
      profilAvatarFirebaseUygula(snap.val() || {});
    };
    fbRef.child("profil").on("value", profilAvatarListener);
  }

  function profilAvatarKaydet(avatarId) {
    const uid = kullaniciUid || window.APARTIM.kullanici?.uid;
    if (!uid || !avatarId) return Promise.resolve();
    window.APARTIM.kullanici = Object.assign({}, window.APARTIM.kullanici || {}, { avatarId });
    profilAvatarUygula(window.APARTIM.kullanici);
    if (window.APARTIM.avatar?.depoYaz) {
      window.APARTIM.avatar.depoYaz(uid, avatarId);
    } else {
      try { localStorage.setItem("apartim-avatar-" + uid, avatarId); } catch (e) {}
    }
    if (window.APARTIM.firebaseAktif && fbRef) {
      return fbRef.child("profil").update({ avatarId }).catch(() => {});
    }
    return Promise.resolve();
  }

  function profilAvatarYukle(kullanici) {
    const uid = kullanici?.uid;
    if (!uid || window.APARTIM.firebaseAktif) return;
    const yerel = window.APARTIM.avatar?.depoOku?.(uid);
    if (yerel) {
      profilAvatarUygula({ avatarId: yerel });
    }
  }

  function kullaniciHazir(kullanici) {
    kullaniciUid = kullanici.uid;
    profilAvatarDinlemeyiKaldir();
    if (fbRef) {
      try { fbRef.off(); } catch (e) { /* yoksay */ }
      fbRef = null;
    }
    fbIlkSenkronBitti = false;
    fbIlkDaireler = false;
    fbIlkRez = false;
    durum.yuklendi = false;
    clearTimeout(fbIlkSenkronTimer);
    profilAvatarYukle(kullanici);
    if (window.APARTIM.firebaseAktif) {
      fbRef = window.APARTIM.fbDb.ref("apartim/kullanicilar/" + kullaniciUid);
      profilAvatarFirebaseBagla();
      const profilPatch = {
        ad: kullanici.ad || "",
        kullaniciAdi: kullanici.kullaniciAdi || "",
        eposta: kullanici.eposta || "",
        son: firebase.database.ServerValue.TIMESTAMP
      };
      const profilGuncelle = () => {
        fbRef?.child("profil").update(profilPatch).catch(() => {});
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(profilGuncelle, { timeout: 3000 });
      } else {
        setTimeout(profilGuncelle, 300);
      }

      fbRef.child("daireler").on("value", (snap) => {
        durum.daireler = snap.val() || {};
        dairelerSeedEt();
        fbIlkDaireler = true;
        fbYuklemeDurumuGuncelle();
        veriDegistiBildir("daireler");
        window.APARTIM.syncDurum("aktif");
      }, () => window.APARTIM.syncDurum("hata"));

      fbRef.child("rezervasyonlar").on("value", (snap) => {
        durum.rezervasyonlar = rezervasyonlariNormalize(snap.val() || {});
        fbIlkRez = true;
        fbYuklemeDurumuGuncelle();
        veriDegistiBildir("rezervasyonlar");
      });

      /* Kasa harcamaları ana veriyle birlikte — boş flaş olmasın */
      fbRef.child("kasa-harcama").on("value", (snap) => {
        durum.kasaHarcama = snap.val() || {};
        veriDegistiBildir("kasa-harcama");
      });

      const ikincilDinleyicileriBagla = () => {
        if (!fbRef) return;
        fbRef.child("temizlik-kayit").on("value", (snap) => {
          durum.temizlikKayit = snap.val() || {};
          veriDegistiBildir("temizlik-kayit");
        });
        fbRef.child("musteri-kaynaklari").on("value", (snap) => {
          durum.musteriKaynaklari = snap.val() || {};
          musteriKaynaklariSeedEt();
          veriDegistiBildir("musteri-kaynaklari");
        });
        fbRef.child("doviz-kurlari").on("value", (snap) => {
          const v = snap.val();
          if (v) durum.dovizKurlari = dovizKurlariNorm(v);
          dovizKurlariSenkron();
          veriDegistiBildir("doviz-kurlari");
        });
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(ikincilDinleyicileriBagla, { timeout: 2500 });
      } else {
        setTimeout(ikincilDinleyicileriBagla, 400);
      }
    } else {
      profilAvatarYukle(kullanici);
      const v = window.APARTIM.yerelOku();
      durum.daireler = v.daireler || {};
      durum.rezervasyonlar = rezervasyonlariNormalize(v.rezervasyonlar || {});
      durum.temizlikKayit = v.temizlikKayit || {};
      durum.musteriKaynaklari = v.musteriKaynaklari || {};
      durum.kasaHarcama = v.kasaHarcama || {};
      if (v.dovizKurlari) durum.dovizKurlari = dovizKurlariNorm(v.dovizKurlari);
      dovizKurlariSenkron();
      musteriKaynaklariSeedEt();
      dairelerSeedEt();
      durum.yuklendi = true;
      bildir("veri-degisti", { sebep: "yerel-yuklendi" });
      window.APARTIM.syncDurum("beklemede");
    }
  }

  function yereliKaydet() {
    if (!yerelAktif) return;
    window.APARTIM.yerelYaz({
      daireler: durum.daireler,
      rezervasyonlar: durum.rezervasyonlar,
      temizlikKayit: durum.temizlikKayit,
      musteriKaynaklari: durum.musteriKaynaklari,
      kasaHarcama: durum.kasaHarcama,
      dovizKurlari: durum.dovizKurlari
    });
  }

  // path örnek: "daireler/ust", "rezervasyonlar/abc"
  function nesneTemizle(obj) {
    if (obj == null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(nesneTemizle);
    const out = {};
    Object.keys(obj).forEach((k) => {
      if (obj[k] !== undefined) out[k] = nesneTemizle(obj[k]);
    });
    return out;
  }

  function kaydet(yol, deger) {
    if (window.APARTIM.firebaseAktif) {
      if (!fbRef) {
        return Promise.reject(new Error("Bulut bağlantısı henüz hazır değil. Birkaç saniye bekleyin."));
      }
      const temiz = deger == null ? null : nesneTemizle(deger);
      return fbRef.child(yol).set(temiz).catch((err) => {
        console.warn("Firebase yazma hatası:", yol, err);
        window.APARTIM.toast("Sunucuya kaydedilemedi", "hata");
        throw err;
      });
    }
    // yerel mod
    if (yol === "doviz-kurlari") {
      if (deger != null) durum.dovizKurlari = dovizKurlariNorm(deger);
      yereliKaydet();
      bildir("veri-degisti", { sebep: "doviz-kurlari" });
      return Promise.resolve();
    }
    const [tip, id] = yol.split("/");
    const kok = tipKovasi(tip);
    if (!kok) return Promise.resolve();
    if (deger == null) delete kok[id];
    else kok[id] = deger;
    yereliKaydet();
    bildir("veri-degisti", { sebep: tip });
    return Promise.resolve();
  }
  function guncelle(yol, partialDeger) {
    if (window.APARTIM.firebaseAktif) {
      if (!fbRef) {
        return Promise.reject(new Error("Bulut bağlantısı henüz hazır değil."));
      }
      return fbRef.child(yol).update(partialDeger).catch((err) => {
        console.warn("Firebase update hatası:", yol, err);
        window.APARTIM.toast("Güncelleme başarısız", "hata");
        throw err;
      });
    }
    const [tip, id] = yol.split("/");
    const kok = tipKovasi(tip);
    if (!kok) return Promise.resolve();
    kok[id] = Object.assign({}, kok[id] || {}, partialDeger);
    yereliKaydet();
    bildir("veri-degisti", { sebep: tip });
    return Promise.resolve();
  }
  function sil(yol) { return kaydet(yol, null); }

  function tipKovasi(tip) {
    if (tip === "daireler") return durum.daireler;
    if (tip === "rezervasyonlar") return durum.rezervasyonlar;
    if (tip === "temizlik-kayit") return durum.temizlikKayit;
    if (tip === "musteri-kaynaklari") return durum.musteriKaynaklari;
    if (tip === "kasa-harcama") return durum.kasaHarcama;
    return null;
  }

  function kasaHarcamaNorm(deger) {
    if (!deger || typeof deger !== "object") return null;
    const tarih = tarihNormal(deger.tarih);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return null;
    const tutar = Number(deger.tutar);
    if (!Number.isFinite(tutar) || tutar <= 0) return null;
    const pb = window.APARTIM.para?.paraBirimiSecimNorm?.(deger.pb) ||
      (String(deger.pb || "TL").toUpperCase() === "USD" ? "USD" : "TL");
    const not = String(deger.not || "").trim().slice(0, 200);
    const tipHam = String(deger.tip || deger.yon || "gider").toLowerCase();
    const tip = tipHam === "gelir" ? "gelir" : "gider";
    const id = deger.id != null && String(deger.id).trim()
      ? String(deger.id).trim()
      : yeniId();
    return {
      id,
      tarih,
      not,
      tutar,
      pb,
      tip,
      olusturulma: Number(deger.olusturulma) || Date.now()
    };
  }

  function kasaHarcamaListele() {
    return Object.values(durum.kasaHarcama || {})
      .map(kasaHarcamaNorm)
      .filter(Boolean)
      .sort((a, b) => {
        if (a.tarih !== b.tarih) return b.tarih.localeCompare(a.tarih);
        return (b.olusturulma || 0) - (a.olusturulma || 0);
      });
  }

  function kasaHarcamaEkle(veri) {
    const id = veri?.id || yeniId();
    const eski = durum.kasaHarcama[id];
    const kayit = kasaHarcamaNorm(Object.assign({}, veri, {
      id,
      olusturulma: eski?.olusturulma || Date.now()
    }));
    if (!kayit) return Promise.reject(new Error("Geçersiz kasa kaydı"));
    durum.kasaHarcama[kayit.id] = kayit;
    return kaydet("kasa-harcama/" + kayit.id, kayit).then(() => kayit);
  }

  function kasaHarcamaGuncelle(id, veri) {
    if (!id || !durum.kasaHarcama[id]) {
      return Promise.reject(new Error("Harcama bulunamadı"));
    }
    return kasaHarcamaEkle(Object.assign({}, durum.kasaHarcama[id], veri, { id }));
  }

  function kasaHarcamaSil(id) {
    if (!id || !durum.kasaHarcama[id]) return Promise.resolve();
    delete durum.kasaHarcama[id];
    return sil("kasa-harcama/" + id);
  }

  /** Kasa listesinden gelir (tahsilat) satırını güncelle */
  function kasaGelirGuncelle(rezId, odemeId, eskiPb, form) {
    const rez = durum.rezervasyonlar[rezId];
    if (!rez) return Promise.reject(new Error("Rezervasyon bulunamadı"));
    if (!odemeId) return Promise.reject(new Error("Ödeme kaydı yok"));
    const mevcut = rezervasyonOdenenKayitGetir(rez, odemeId);
    if (!mevcut) return Promise.reject(new Error("Ödeme bulunamadı"));
    const tarih = tarihNormal(form.tarih);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
      return Promise.reject(new Error("Geçersiz tarih"));
    }
    const tutar = Number(form.tutar);
    if (!Number.isFinite(tutar) || tutar <= 0) {
      return Promise.reject(new Error("Geçerli bir miktar girin"));
    }
    const pbYeni = window.APARTIM.para?.paraBirimiSecimNorm?.(form.pb) ||
      (String(form.pb || "TL").toUpperCase() === "USD" ? "USD" : "TL");
    const pbEski = window.APARTIM.para?.paraBirimiSecimNorm?.(eskiPb) ||
      (String(eskiPb || "TL").toUpperCase() === "USD" ? "USD" : "TL");
    const not = String(form.not || "").trim().slice(0, 200);

    let tl = 0;
    let usd = 0;
    const hasSplit =
      (Number(mevcut.tutarTl) || 0) > 0 || (Number(mevcut.tutarUsd) || 0) > 0;
    if (hasSplit) {
      tl = Number(mevcut.tutarTl) || 0;
      usd = Number(mevcut.tutarUsd) || 0;
      if (pbEski === pbYeni) {
        if (pbYeni === "USD") usd = tutar;
        else tl = tutar;
      } else {
        /* Diğer para birimini koru; taşınan tutarı yeni birime ekle */
        if (pbEski === "USD") usd = 0;
        else tl = 0;
        if (pbYeni === "USD") usd += tutar;
        else tl += tutar;
      }
    } else if (pbEski === "USD") {
      if (pbYeni === "USD") usd = tutar;
      else tl = tutar;
    } else {
      if (pbYeni === "TL") tl = tutar;
      else usd = tutar;
    }

    const deger = { yontem: "kasa", not, id: odemeId };
    if (tl > 0) deger.tutarTl = tl;
    if (usd > 0) deger.tutarUsd = usd;
    if (Number(mevcut.kurUsd) > 0) deger.kurUsd = Number(mevcut.kurUsd);
    if (!tl && !usd) return Promise.reject(new Error("Geçerli bir miktar girin"));

    return rezervasyonOdenenHucreKaydet(rezId, tarih, deger, { odemeId });
  }

  /**
   * Tahsilattan kasa yöntemiyle girilen ödemeler + manuel harcamalar.
   * pbFiltre: null/"tumu" | "TL" | "USD"
   */
  function kasaHareketListele(pbFiltre) {
    const para = window.APARTIM.para;
    const filtre = !pbFiltre || pbFiltre === "tumu"
      ? null
      : (para?.paraBirimiSecimNorm?.(pbFiltre) || String(pbFiltre).toUpperCase());
    const hareketler = [];

    Object.values(durum.rezervasyonlar || {}).forEach((rez) => {
      if (!rez) return;
      const misafir = String(rez.misafirAdi || rez.misafir || "").trim() || "—";
      const daire = daireGetir(rez.daireId);
      const odaHam = String(daire?.ad || "").trim();
      /* Minimal etiket: "1. Oda" → "1", aksi halde kısa ad */
      let oda = odaHam;
      const odaSayi = /^(\d+)\s*\.?\s*(oda)?$/i.exec(odaHam);
      if (odaSayi) oda = odaSayi[1];
      else if (odaHam.length > 8) oda = odaHam.slice(0, 8);
      const rezPb = para?.rezParaBirimi?.(rez) || "TL";
      rezervasyonOdenenListe(rez).forEach((kayit) => {
        if (odemeYontemNorm(kayit.yontem) !== "kasa") return;
        const not = String(kayit.not || "").trim();
        const ortak = {
          tip: "gelir",
          tarih: kayit.tarih,
          oda,
          musteri: misafir,
          not,
          rezId: rez.id,
          odemeId: kayit.id || ""
        };
        const hasSplit =
          (Number(kayit.tutarTl) || 0) > 0 || (Number(kayit.tutarUsd) || 0) > 0;
        if (hasSplit) {
          if ((Number(kayit.tutarTl) || 0) > 0) {
            hareketler.push(Object.assign({}, ortak, {
              id: "g-" + (kayit.id || kayit.tarih) + "-tl",
              tutar: Number(kayit.tutarTl),
              pb: "TL"
            }));
          }
          if ((Number(kayit.tutarUsd) || 0) > 0) {
            hareketler.push(Object.assign({}, ortak, {
              id: "g-" + (kayit.id || kayit.tarih) + "-usd",
              tutar: Number(kayit.tutarUsd),
              pb: "USD"
            }));
          }
        } else {
          const tutar = Number(kayit.tutar) || 0;
          if (tutar <= 0) return;
          const pb = kayit.tutarBirim === "TL" ? "TL" : rezPb;
          const pbSec = pb === "USD" ? "USD" : "TL";
          hareketler.push(Object.assign({}, ortak, {
            id: "g-" + (kayit.id || kayit.tarih) + "-" + pbSec.toLowerCase(),
            tutar,
            pb: pbSec
          }));
        }
      });
    });

    kasaHarcamaListele().forEach((h) => {
      const gelirMi = h.tip === "gelir";
      hareketler.push({
        tip: gelirMi ? "gelir" : "harcama",
        id: "h-" + h.id,
        harcamaId: h.id,
        manuel: true,
        tarih: h.tarih,
        oda: "",
        musteri: gelirMi ? "Gelir" : "Gider",
        not: h.not || "",
        tutar: h.tutar,
        pb: h.pb,
        olusturulma: h.olusturulma
      });
    });

    const filtreli = filtre
      ? hareketler.filter((h) => h.pb === filtre)
      : hareketler;

    return filtreli.sort((a, b) => {
      if (a.tarih !== b.tarih) return b.tarih.localeCompare(a.tarih);
      const ao = a.olusturulma || 0;
      const bo = b.olusturulma || 0;
      if (ao !== bo) return bo - ao;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function yeniId() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Domain API ----------
  function rezAyKesisimGelir(rez, ayBas, ayBit) {
    const para = window.APARTIM.para;
    const kur = rezervasyonKurCift(rez);
    const tarihler = geceTarihleri(rez.giris, rez.cikis);
    let gece = 0;
    let gelirTl = 0;
    const gelirPb = { TL: 0, USD: 0, EUR: 0 };
    tarihler.forEach((t, idx) => {
      if (t >= ayBas && t < ayBit) {
        gece++;
        const kayit = rezervasyonGeceKaydi(rez, idx + 1);
        gelirPb[kayit.pb] = (gelirPb[kayit.pb] || 0) + kayit.tutar;
        gelirTl += para
          ? para.tlKarsiligi(kayit.tutar, kayit.pb, kur)
          : kayit.tutar;
      }
    });
    /* gelir: geriye uyumluluk — TL karşılığı */
    return { gece, gelir: gelirTl, gelirTl, gelirPb };
  }

  function daireAylikOzet(daireId, yil, ay) {
    const m = Number(ay);
    const y = Number(yil);
    const ayGun = new Date(y, m + 1, 0).getDate();
    const pad = (n) => String(n).padStart(2, "0");
    const ayBas = y + "-" + pad(m + 1) + "-01";
    const ayBit = gunEkleISO(y + "-" + pad(m + 1) + "-" + pad(ayGun), 1);
    let gece = 0;
    let gelir = 0;
    Object.values(durum.rezervasyonlar).forEach((rez) => {
      if (!rez || rez.daireId !== daireId) return;
      const k = rezAyKesisimGelir(rez, ayBas, ayBit);
      gece += k.gece;
      gelir += k.gelirTl != null ? k.gelirTl : k.gelir;
    });
    return {
      gece,
      gelir,
      ortalama: gece > 0 ? Math.round(gelir / gece) : 0,
      ayGun,
      doluluk: ayGun > 0 ? Math.round(gece * 100 / ayGun) : 0
    };
  }

  function dairelerListele() {
    return Object.values(durum.daireler)
      .filter((d) => d && d.id)
      .sort((a, b) =>
        (a.sira || 0) - (b.sira || 0) ||
        (a.ad || "").localeCompare(b.ad || "", "tr")
      );
  }
  function daireGetir(id) { return durum.daireler[id] || null; }
  function daireGuncelle(id, partial) {
    durum.daireler[id] = Object.assign({}, durum.daireler[id] || {}, partial);
    return guncelle("daireler/" + id, partial);
  }
  function sonrakiOdaIdVeSira() {
    let maxN = 0;
    let maxSira = 0;
    Object.values(durum.daireler).forEach((d) => {
      if (!d) return;
      const m = /^oda-(\d+)$/.exec(String(d.id || ""));
      if (m) maxN = Math.max(maxN, Number(m[1]));
      maxSira = Math.max(maxSira, Number(d.sira) || 0);
    });
    return { id: "oda-" + (maxN + 1), sira: maxSira + 1 };
  }
  function daireEkle(ad) {
    const metin = String(ad || "").trim();
    if (!metin) throw new Error("Oda adı boş olamaz.");
    if (metin.length > 40) throw new Error("Oda adı en fazla 40 karakter olabilir.");
    const ayni = dairelerListele().find((d) =>
      (d.ad || "").toLocaleLowerCase("tr") === metin.toLocaleLowerCase("tr")
    );
    if (ayni) throw new Error("Bu isimde oda zaten var.");
    const { id, sira } = sonrakiOdaIdVeSira();
    const kayit = {
      id,
      ad: metin,
      kat: 0,
      konum: "tek",
      sira,
      gunlukUcret: 1000,
      temizlik: "temiz",
      temizlikGuncelleme: Date.now()
    };
    durum.daireler[id] = kayit;
    return kaydet("daireler/" + id, kayit).then(() => kayit);
  }
  function daireSil(id) {
    const d = durum.daireler[id];
    if (!d) throw new Error("Oda bulunamadı.");
    if (dairelerListele().length <= 1) {
      throw new Error("En az bir oda kalmalı.");
    }
    const kullanan = Object.values(durum.rezervasyonlar).filter((r) => r && r.daireId === id);
    if (kullanan.length) {
      throw new Error("Bu odada " + kullanan.length + " rezervasyon var; silinemez.");
    }
    delete durum.daireler[id];
    return sil("daireler/" + id);
  }

  function rezervasyonlarListele(daireId) {
    const liste = Object.values(durum.rezervasyonlar);
    const filtreli = daireId ? liste.filter((r) => r.daireId === daireId) : liste;
    return filtreli.sort((a, b) => (a.giris || "").localeCompare(b.giris || ""));
  }
  function musteriKaynaklariListele() {
    if (!Object.keys(durum.musteriKaynaklari).length) {
      musteriKaynaklariSeedEt();
    }
    return Object.values(durum.musteriKaynaklari).sort((a, b) =>
      (a.sira || 0) - (b.sira || 0) || (a.ad || "").localeCompare(b.ad || "", "tr")
    );
  }
  function musteriKaynagiGetir(id) { return durum.musteriKaynaklari[id] || null; }
  function musteriKaynagiAd(id) {
    const k = musteriKaynagiGetir(id);
    return k ? k.ad : "";
  }
  function musteriKaynagiSimge(id) {
    const k = musteriKaynagiGetir(id);
    return k?.simge || "🏷️";
  }
  function musteriKaynagiEkle(ad, simge) {
    const metin = String(ad || "").trim();
    if (!metin) throw new Error("Kategori adı boş olamaz.");
    const simgeMetin = String(simge || "🏷️").trim() || "🏷️";
    const mevcut = musteriKaynaklariListele().find((k) =>
      (k.ad || "").toLocaleLowerCase("tr") === metin.toLocaleLowerCase("tr")
    );
    if (mevcut) throw new Error("Bu isimde kategori zaten var.");
    let id = slugId(metin);
    let n = 2;
    while (durum.musteriKaynaklari[id]) {
      id = slugId(metin) + "-" + n;
      n++;
    }
    const sira = musteriKaynaklariListele().reduce((m, k) => Math.max(m, k.sira || 0), 0) + 1;
    const kayit = { id, ad: metin, simge: simgeMetin, sira, sistem: false };
    durum.musteriKaynaklari[id] = kayit;
    return kaydet("musteri-kaynaklari/" + id, kayit).then(() => kayit);
  }
  function musteriKaynagiSil(id) {
    const k = durum.musteriKaynaklari[id];
    if (!k) throw new Error("Kategori bulunamadı.");
    if (k.sistem) throw new Error("Varsayılan kategoriler silinemez.");
    const kullanan = Object.values(durum.rezervasyonlar).filter((r) => r && r.kaynakId === id);
    if (kullanan.length) {
      throw new Error("Bu kategoride " + kullanan.length + " rezervasyon var; önce onları değiştirin.");
    }
    delete durum.musteriKaynaklari[id];
    return sil("musteri-kaynaklari/" + id);
  }

  function rezervasyonKaynakDogrula(rez) {
    if (!rez.kaynakId) throw new Error("Müşteri kaynağı seçin.");
    if (!musteriKaynagiGetir(rez.kaynakId)) throw new Error("Geçersiz müşteri kaynağı.");
  }

  function rezervasyonEkle(rez) {
    rezervasyonKaynakDogrula(rez);
    const cakis = dairedeCakisanRez(rez.daireId, rez.giris, rez.cikis);
    if (cakis) {
      throw new Error("Bu tarih aralığı " + cakis.misafirAdi + " ile çakışıyor (" + cakis.giris + " → " + cakis.cikis + ")");
    }
    const id = rez.id || yeniId();
    const tam = rezervasyonKayitHazirla(Object.assign({}, rez, {
      id,
      kaynakAd: musteriKaynagiAd(rez.kaynakId),
      olusturulma: Date.now()
    }));
    durum.rezervasyonlar[id] = tam;
    return kaydet("rezervasyonlar/" + id, tam).then(() => tam);
  }
  function rezervasyonGuncelle(id, partial) {
    const mevcut = durum.rezervasyonlar[id];
    if (!mevcut) throw new Error("Rezervasyon bulunamadı");
    const yeni = Object.assign({}, mevcut, partial);
    if (Object.prototype.hasOwnProperty.call(partial, "ucretKademeleri") && partial.ucretKademeleri == null) {
      delete yeni.ucretKademeleri;
    }
    if (Object.prototype.hasOwnProperty.call(partial, "tarihFiyatlari") && partial.tarihFiyatlari == null) {
      delete yeni.tarihFiyatlari;
    }
    if (Object.prototype.hasOwnProperty.call(partial, "odenenGunleri") && partial.odenenGunleri == null) {
      delete yeni.odenenGunleri;
    }
    if (Object.prototype.hasOwnProperty.call(partial, "tahsilatTamamlandi") && !partial.tahsilatTamamlandi) {
      delete yeni.tahsilatTamamlandi;
    }
    if (Object.prototype.hasOwnProperty.call(partial, "kurUsd") && !(Number(partial.kurUsd) > 0)) {
      delete yeni.kurUsd;
    }
    if (Object.prototype.hasOwnProperty.call(partial, "kurEur") && !(Number(partial.kurEur) > 0)) {
      delete yeni.kurEur;
    }
    delete yeni.kalanGunleri;
    if (partial.kaynakId != null) {
      rezervasyonKaynakDogrula(yeni);
      yeni.kaynakAd = musteriKaynagiAd(yeni.kaynakId);
    }
    const cakis = dairedeCakisanRez(yeni.daireId, yeni.giris, yeni.cikis, id);
    if (cakis) {
      throw new Error("Bu tarih aralığı " + cakis.misafirAdi + " ile çakışıyor (" + cakis.giris + " → " + cakis.cikis + ")");
    }
    yeni.toplamGece = geceSayisi(yeni.giris, yeni.cikis);
    const hazir = rezervasyonKayitHazirla(yeni);
    durum.rezervasyonlar[id] = hazir;
    return kaydet("rezervasyonlar/" + id, hazir).then(() => hazir);
  }
  function rezervasyonSil(id) {
    delete durum.rezervasyonlar[id];
    return sil("rezervasyonlar/" + id);
  }

  function temizlikLogEkle(daireId, eskiDurum, yeniDurum) {
    const id = yeniId();
    const k = { id, daireId, eskiDurum, yeniDurum, zaman: Date.now() };
    durum.temizlikKayit[id] = k;
    return kaydet("temizlik-kayit/" + id, k);
  }
  function temizlikLogListele(daireId) {
    const liste = Object.values(durum.temizlikKayit);
    const filtreli = daireId ? liste.filter((k) => k.daireId === daireId) : liste;
    return filtreli.sort((a, b) => (b.zaman || 0) - (a.zaman || 0));
  }

  // ---------- Yardımcı: bugün için durum hesabı ----------
  function dairedeBuTariheRez(daireId, isoTarih) {
    const liste = rezervasyonlarListele(daireId);
    return liste.find((r) => r.giris <= isoTarih && isoTarih < r.cikis) || null;
  }

  /** Özet/takvim: [giris,cikis) + aynı gün çıkış+giriş (turnover) */
  function daireGunDurumu(daireId, isoTarih) {
    const liste = rezervasyonlarListele(daireId);
    const cikisList = liste.filter((r) => r.cikis === isoTarih);
    const girisList = liste.filter((r) => r.giris === isoTarih);

    for (const cikis of cikisList) {
      for (const giris of girisList) {
        if (cikis.id !== giris.id) {
          return { tip: "turnover", cikis, giris, rez: giris };
        }
      }
    }

    if (cikisList.length) {
      return { tip: "checkout", rez: cikisList[0] };
    }

    if (girisList.length) {
      return { tip: "checkin", rez: girisList[0] };
    }

    const konak = liste.find((r) => r.giris <= isoTarih && isoTarih < r.cikis);
    if (konak) {
      return { tip: "konak", rez: konak };
    }

    return { tip: "bos", rez: null };
  }
  function daireDurumuBugun(daireId) {
    const daire = daireGetir(daireId);
    if (!daire) return { durum: "yok", rez: null };
    const bg = bugunISO();
    const rez = dairedeBuTariheRez(daireId, bg);
    if (rez) return { durum: "dolu", rez, temizlik: daire.temizlik };
    return {
      durum: daire.temizlik === "temizleniyor" ? "temizleniyor" :
             daire.temizlik === "kirli" ? "bos-kirli" : "bos-temiz",
      rez: null,
      temizlik: daire.temizlik
    };
  }

  // ---------- Auth eventine bağlan ----------
  document.addEventListener("apartim:auth-hazir", (e) => {
    kullaniciHazir(e.detail);
  });
  /* auth.js bazen db'den önce oturum açar — kaçırılan olayı yakala */
  if (window.APARTIM.kullanici) {
    kullaniciHazir(window.APARTIM.kullanici);
  }

  // ---------- Public API ----------
  window.APARTIM.db = {
    durum,
    bugunISO,
    geceSayisi,
    gunEkleISO,
    geceTarihleri,
    tarihFiyatKaydiNorm,
    tarihFiyatlariNorm,
    tarihFiyatlariToObject,
    tarihFiyatlariKayitIcin,
    tarihFiyatlariTekMi,
    ucretKademeleriNormalize,
    ucretKademeleriToArray,
    geceUcretiBul,
    rezervasyonGeceKaydi,
    rezervasyonGeceUcreti,
    rezervasyonTarihUcreti,
    rezervasyonTutarHesapla,
    rezervasyonToplamTutar,
    rezervasyonToplamGosterim,
    rezervasyonGosterimPb,
    rezervasyonKurCift,
    rezervasyonOdenenToplam,
    rezervasyonOdenenToplamTl,
    rezervasyonToplamTl,
    rezervasyonKalanTl,
    rezervasyonKalanHesapla,
    rezervasyonFazlaOdenen,
    rezervasyonTahsilatTamamMi,
    rezervasyonOdenenGosterim,
    rezervasyonOdenenListe,
    rezervasyonOdenenKayitGetir,
    rezervasyonOdenenHucreKaydet,
    rezervasyonOdemeDonemToplam,
    odemeYontemNorm,
    ODEME_YONTEMLERI,
    rezervasyonOzeti,
    rezAyKesisimGelir,
    daireAylikOzet,
    tarihNormal,
    dairelerListele,
    daireGetir,
    daireGuncelle,
    daireEkle,
    daireSil,
    rezervasyonlarListele,
    rezervasyonEkle,
    rezervasyonGuncelle,
    rezervasyonSil,
    dairedeBuTariheRez,
    daireGunDurumu,
    dairedeCakisanRez,
    daireDurumuBugun,
    temizlikLogEkle,
    temizlikLogListele,
    kasaHarcamaListele,
    kasaHarcamaEkle,
    kasaHarcamaGuncelle,
    kasaHarcamaSil,
    kasaGelirGuncelle,
    kasaHareketListele,
    dovizKurlariKaydet,
    musteriKaynaklariListele,
    musteriKaynagiGetir,
    musteriKaynagiAd,
    musteriKaynagiSimge,
    musteriKaynagiEkle,
    musteriKaynagiSil,
    profilAvatarKaydet,
    VARSAYILAN_MUSTERI_KAYNAKLARI,
    KATEGORI_SIMGELER,
    SABIT_DAIRELER
  };
})();
