/* =========================================================
   APARTIM — Veri katmanı
   Hem Firebase Realtime DB hem de yerel localStorage'ı saran
   ortak bir API sağlar. Diğer modüller window.APARTIM.db üzerinden
   konuşur, alttaki kaynakla ilgilenmez.
   ========================================================= */

(function () {
  "use strict";

  const SABIT_DAIRELER = [
    { id: "ust",       ad: "Üst Kat",         kat: 3, konum: "tek",       gunlukUcret: 1500, sira: 1 },
    { id: "orta-sol",  ad: "Orta Kat - Sol",  kat: 2, konum: "sol",       gunlukUcret: 1200, sira: 2 },
    { id: "orta-sag",  ad: "Orta Kat - Sağ",  kat: 2, konum: "sag",       gunlukUcret: 1200, sira: 3 },
    { id: "alt-sol",   ad: "Alt Kat - Sol",   kat: 1, konum: "sol",       gunlukUcret: 1000, sira: 4 },
    { id: "alt-sag",   ad: "Alt Kat - Sağ",   kat: 1, konum: "sag",       gunlukUcret: 1000, sira: 5 }
  ];

  const durum = {
    daireler: {},      // { id: {ad, gunlukUcret, temizlik, ...} }
    rezervasyonlar: {},// { rezId: {...} }
    temizlikKayit: {}, // { kayitId: {...} }
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
        durum.rezervasyonlar = snap.val() || {};
        bildir("veri-degisti", { sebep: "rezervasyonlar" });
      });

      // Temizlik kayıtları
      fbRef.child("temizlik-kayit").on("value", (snap) => {
        durum.temizlikKayit = snap.val() || {};
        bildir("veri-degisti", { sebep: "temizlik-kayit" });
      });
    } else {
      const v = window.APARTIM.yerelOku();
      durum.daireler = v.daireler || {};
      durum.rezervasyonlar = v.rezervasyonlar || {};
      durum.temizlikKayit = v.temizlikKayit || {};
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
      temizlikKayit: durum.temizlikKayit
    });
  }

  // path örnek: "daireler/ust", "rezervasyonlar/abc"
  function kaydet(yol, deger) {
    if (window.APARTIM.firebaseAktif && fbRef) {
      return fbRef.child(yol).set(deger).catch((err) => {
        console.warn("Firebase yazma hatası:", yol, err);
        window.APARTIM.toast("Sunucuya kaydedilemedi", "hata");
      });
    } else {
      // yerel
      const [tip, id] = yol.split("/");
      const kok = tipKovasi(tip);
      if (!kok) return Promise.resolve();
      if (deger == null) delete kok[id];
      else kok[id] = deger;
      yereliKaydet();
      bildir("veri-degisti", { sebep: tip });
      return Promise.resolve();
    }
  }
  function guncelle(yol, partialDeger) {
    if (window.APARTIM.firebaseAktif && fbRef) {
      return fbRef.child(yol).update(partialDeger).catch((err) => {
        console.warn("Firebase update hatası:", yol, err);
        window.APARTIM.toast("Güncelleme başarısız", "hata");
      });
    } else {
      const [tip, id] = yol.split("/");
      const kok = tipKovasi(tip);
      if (!kok) return Promise.resolve();
      kok[id] = Object.assign({}, kok[id] || {}, partialDeger);
      yereliKaydet();
      bildir("veri-degisti", { sebep: tip });
      return Promise.resolve();
    }
  }
  function sil(yol) { return kaydet(yol, null); }

  function tipKovasi(tip) {
    if (tip === "daireler") return durum.daireler;
    if (tip === "rezervasyonlar") return durum.rezervasyonlar;
    if (tip === "temizlik-kayit") return durum.temizlikKayit;
    return null;
  }

  function yeniId() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Domain API ----------
  function dairelerListele() {
    return Object.values(durum.daireler).sort((a, b) => (a.sira || 0) - (b.sira || 0));
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
  function rezervasyonEkle(rez) {
    const cakis = dairedeCakisanRez(rez.daireId, rez.giris, rez.cikis);
    if (cakis) {
      throw new Error("Bu tarih aralığı " + cakis.misafirAdi + " ile çakışıyor (" + cakis.giris + " → " + cakis.cikis + ")");
    }
    const id = rez.id || yeniId();
    const tam = Object.assign({}, rez, {
      id,
      olusturulma: Date.now(),
      toplamGece: geceSayisi(rez.giris, rez.cikis),
      toplamTutar: geceSayisi(rez.giris, rez.cikis) * (Number(rez.gunlukUcret) || 0)
    });
    durum.rezervasyonlar[id] = tam;
    return kaydet("rezervasyonlar/" + id, tam).then(() => tam);
  }
  function rezervasyonGuncelle(id, partial) {
    const mevcut = durum.rezervasyonlar[id];
    if (!mevcut) throw new Error("Rezervasyon bulunamadı");
    const yeni = Object.assign({}, mevcut, partial);
    const cakis = dairedeCakisanRez(yeni.daireId, yeni.giris, yeni.cikis, id);
    if (cakis) {
      throw new Error("Bu tarih aralığı " + cakis.misafirAdi + " ile çakışıyor (" + cakis.giris + " → " + cakis.cikis + ")");
    }
    yeni.toplamGece = geceSayisi(yeni.giris, yeni.cikis);
    yeni.toplamTutar = yeni.toplamGece * (Number(yeni.gunlukUcret) || 0);
    durum.rezervasyonlar[id] = yeni;
    return kaydet("rezervasyonlar/" + id, yeni).then(() => yeni);
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
    tarihNormal,
    dairelerListele,
    daireGetir,
    daireGuncelle,
    rezervasyonlarListele,
    rezervasyonEkle,
    rezervasyonGuncelle,
    rezervasyonSil,
    dairedeBuTariheRez,
    dairedeCakisanRez,
    daireDurumuBugun,
    temizlikLogEkle,
    temizlikLogListele,
    SABIT_DAIRELER
  };
})();
