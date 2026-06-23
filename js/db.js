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
    { id: "oda-5", ad: "5. Oda", kat: 0, konum: "tek", gunlukUcret: 1000, sira: 5 },
    { id: "oda-6", ad: "6. Oda", kat: 0, konum: "tek", gunlukUcret: 1000, sira: 6 }
  ];

  const durum = {
    daireler: {},      // { id: {ad, gunlukUcret, temizlik, ...} }
    rezervasyonlar: {},// { rezId: {...} }
    temizlikKayit: {}, // { kayitId: {...} }
    musteriKaynaklari: {}, // { id: { id, ad, simge, sira, sistem } }
    dovizKurlari: { USD: 46.5, EUR: 50.5 },
    yuklendi: false
  };
  const dinleyiciler = [];

  function bildir(olay, veri) {
    document.dispatchEvent(new CustomEvent("apartim:" + olay, { detail: veri }));
    dinleyiciler.forEach((fn) => { try { fn(olay, veri); } catch (e) {} });
  }

  function dinle(fn) { if (typeof fn === "function") dinleyiciler.push(fn); }

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

  function tarihFiyatlariToObject(fiyatlar) {
    if (!fiyatlar) return null;
    if (typeof fiyatlar === "object" && !Array.isArray(fiyatlar)) {
      const out = {};
      Object.keys(fiyatlar).forEach((k) => {
        const u = Number(fiyatlar[k]);
        if (u > 0) out[k] = u;
      });
      return Object.keys(out).length ? out : null;
    }
    return null;
  }

  /** Tüm geceler aynı fiyatsa true (tek fiyat modu) */
  function tarihFiyatlariTekMi(giris, cikis, fiyatlar, varsayilanUcret) {
    const tf = tarihFiyatlariToObject(fiyatlar);
    if (!tf) return true;
    const tarihler = geceTarihleri(giris, cikis);
    if (!tarihler.length) return true;
    const fallback = Number(varsayilanUcret) || 0;
    const vals = tarihler.map((t) => Number(tf[t]) || fallback);
    return vals.every((v) => v === vals[0]);
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
    return kaydet("doviz-kurlari", durum.dovizKurlari);
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

  function rezervasyonGeceUcreti(rez, geceNo) {
    const fallback = Number(rez.gunlukUcret) || 0;
    const tarih = gunEkleISO(rez.giris, geceNo - 1);
    const tf = tarihFiyatlariToObject(rez.tarihFiyatlari);
    if (tf && tf[tarih] != null) return Number(tf[tarih]) || fallback;
    const kademeler = ucretKademeleriToArray(rez.ucretKademeleri);
    if (kademeler && kademeler.length) {
      return geceUcretiBul(kademeler, geceNo, fallback);
    }
    return fallback;
  }

  function rezervasyonTarihUcreti(rez, tarihISO) {
    const geceNo = geceSayisi(rez.giris, tarihISO) + 1;
    const toplamGece = geceSayisi(rez.giris, rez.cikis);
    if (geceNo < 1 || geceNo > toplamGece) return Number(rez.gunlukUcret) || 0;
    return rezervasyonGeceUcreti(rez, geceNo);
  }

  function rezervasyonTutarHesapla(rez) {
    const gece = geceSayisi(rez.giris, rez.cikis);
    const gecelik = [];
    let toplam = 0;
    for (let i = 1; i <= gece; i++) {
      const tarih = gunEkleISO(rez.giris, i - 1);
      const ucret = rezervasyonGeceUcreti(rez, i);
      gecelik.push({ gece: i, tarih, ucret });
      toplam += ucret;
    }
    return { gece, toplam, gecelik };
  }

  function rezervasyonKalanTutar(rez, tarih) {
    const geceNo = geceSayisi(rez.giris, tarih) + 1;
    const toplamGece = geceSayisi(rez.giris, rez.cikis);
    let kalan = 0;
    for (let i = geceNo + 1; i <= toplamGece; i++) {
      kalan += rezervasyonGeceUcreti(rez, i);
    }
    return kalan;
  }

  function rezervasyonOzeti(rez) {
    const { gece, toplam, gecelik } = rezervasyonTutarHesapla(rez);
    const gunluk = Number(rez.gunlukUcret) || 0;
    const tf = tarihFiyatlariToObject(rez.tarihFiyatlari);
    const tarihliFiyat = tf && !tarihFiyatlariTekMi(rez.giris, rez.cikis, tf, gunluk);
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
      tarihFiyatlari: tarihliFiyat ? tf : null,
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
    if (ozet.tarihFiyatlari) {
      kayit.tarihFiyatlari = ozet.tarihFiyatlari;
      delete kayit.ucretKademeleri;
    } else {
      delete kayit.tarihFiyatlari;
      if (ozet.kademeler) kayit.ucretKademeleri = ozet.kademeler;
      else delete kayit.ucretKademeleri;
    }
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

  function kullaniciHazir(kullanici) {
    kullaniciUid = kullanici.uid;
    if (window.APARTIM.firebaseAktif) {
      fbRef = window.APARTIM.fbDb.ref("apartim/kullanicilar/" + kullaniciUid);
      // Profil
      fbRef.child("profil").update({
        ad: kullanici.ad || "",
        eposta: kullanici.eposta || "",
        son: firebase.database.ServerValue.TIMESTAMP
      }).catch(() => {});

      // Daireler
      fbRef.child("daireler").on("value", (snap) => {
        durum.daireler = snap.val() || {};
        dairelerSeedEt();
        durum.yuklendi = true;
        bildir("veri-degisti", { sebep: "daireler" });
        window.APARTIM.syncDurum("aktif");
      }, () => window.APARTIM.syncDurum("hata"));

      // Rezervasyonlar
      fbRef.child("rezervasyonlar").on("value", (snap) => {
        durum.rezervasyonlar = rezervasyonlariNormalize(snap.val() || {});
        bildir("veri-degisti", { sebep: "rezervasyonlar" });
      });

      // Temizlik kayıtları
      fbRef.child("temizlik-kayit").on("value", (snap) => {
        durum.temizlikKayit = snap.val() || {};
        bildir("veri-degisti", { sebep: "temizlik-kayit" });
      });

      fbRef.child("musteri-kaynaklari").on("value", (snap) => {
        durum.musteriKaynaklari = snap.val() || {};
        musteriKaynaklariSeedEt();
        bildir("veri-degisti", { sebep: "musteri-kaynaklari" });
      });

      fbRef.child("doviz-kurlari").on("value", (snap) => {
        const v = snap.val();
        if (v) durum.dovizKurlari = dovizKurlariNorm(v);
        dovizKurlariSenkron();
        bildir("veri-degisti", { sebep: "doviz-kurlari" });
      });
    } else {
      const v = window.APARTIM.yerelOku();
      durum.daireler = v.daireler || {};
      durum.rezervasyonlar = rezervasyonlariNormalize(v.rezervasyonlar || {});
      durum.temizlikKayit = v.temizlikKayit || {};
      durum.musteriKaynaklari = v.musteriKaynaklari || {};
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
    return null;
  }

  function yeniId() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Domain API ----------
  function rezAyKesisimGelir(rez, ayBas, ayBit) {
    const tarihler = geceTarihleri(rez.giris, rez.cikis);
    let gece = 0;
    let gelir = 0;
    tarihler.forEach((t, idx) => {
      if (t >= ayBas && t < ayBit) {
        gece++;
        gelir += rezervasyonGeceUcreti(rez, idx + 1);
      }
    });
    return { gece, gelir };
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
      const pb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
      gelir += window.APARTIM.para?.tlKarsiligi(k.gelir, pb) ?? k.gelir;
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
    return SABIT_DAIRELER
      .map((t) => durum.daireler[t.id])
      .filter(Boolean)
      .sort((a, b) => (a.sira || 0) - (b.sira || 0));
  }
  function daireGetir(id) { return durum.daireler[id] || null; }
  function daireGuncelle(id, partial) {
    durum.daireler[id] = Object.assign({}, durum.daireler[id] || {}, partial);
    return guncelle("daireler/" + id, partial);
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

  // ---------- Public API ----------
  window.APARTIM.db = {
    durum,
    dinle,
    bugunISO,
    geceSayisi,
    gunEkleISO,
    geceTarihleri,
    tarihFiyatlariToObject,
    tarihFiyatlariTekMi,
    ucretKademeleriNormalize,
    ucretKademeleriToArray,
    geceUcretiBul,
    rezervasyonGeceUcreti,
    rezervasyonTarihUcreti,
    rezervasyonTutarHesapla,
    rezervasyonKalanTutar,
    rezervasyonOzeti,
    rezAyKesisimGelir,
    daireAylikOzet,
    tarihNormal,
    dairelerListele,
    daireGetir,
    daireGuncelle,
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
    dovizKurlariKaydet,
    musteriKaynaklariListele,
    musteriKaynagiGetir,
    musteriKaynagiAd,
    musteriKaynagiSimge,
    musteriKaynagiEkle,
    musteriKaynagiSil,
    VARSAYILAN_MUSTERI_KAYNAKLARI,
    KATEGORI_SIMGELER,
    SABIT_DAIRELER
  };
})();
