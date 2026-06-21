/* =========================================================
   APARTIM — Uygulama başlatıcı
   Sekme yönetimi, rapor, PWA install, gün değişimi yayını.
   ========================================================= */

(function () {
  "use strict";

  // ---- Sekme yönetimi ----
  function sekmeSec(ad) {
    document.querySelectorAll(".tab-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === ad));
    document.querySelectorAll(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.id === "tab-" + ad));
    if (ad === "rapor") raporCiz();
    if (ad === "rezervasyonlar") {
      window.APARTIM.rezOzet?.tabloCiz();
      window.APARTIM.rezOzet?.yatayModGuncelle();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.addEventListener("click", () => sekmeSec(b.dataset.tab));
    });

    document.getElementById("topbar-home")?.addEventListener("click", () => {
      window.APARTIM.daire?.kapat();
      sekmeSec("bina");
    });

    // PWA install
    let installEvent = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      installEvent = e;
      document.getElementById("install-btn")?.classList.remove("hidden");
    });
    document.getElementById("install-btn")?.addEventListener("click", async () => {
      if (!installEvent) return;
      installEvent.prompt();
      try { await installEvent.userChoice; } catch (e) {}
      installEvent = null;
      document.getElementById("install-btn")?.classList.add("hidden");
    });

    // Service worker kayıt
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("./sw.js")
          .catch((err) => console.warn("SW kayıt hatası:", err));
      });
    }

    // Rapor butonları
    document.getElementById("rapor-prev")?.addEventListener("click", () => raporGit(-1));
    document.getElementById("rapor-next")?.addEventListener("click", () => raporGit(1));
  });

  // ---- Veri hazır olduğunda bina çiz ----
  document.addEventListener("apartim:auth-hazir", () => {
    if (window.APARTIM.bina) window.APARTIM.bina.ciz();
  });

  document.addEventListener("apartim:veri-degisti", () => {
    window.APARTIM.bina?.guncelle();
    window.APARTIM.rezOzet?.tabloCiz();
    window.APARTIM.temizlik?.tumTemizlikListele();
    const aktifRapor = document.getElementById("tab-rapor")?.classList.contains("active");
    if (aktifRapor) raporCiz();
  });

  // ---- Gün değişimi yayını (gece yarısı) ----
  function gunDegisimiPlanla() {
    const simdi = new Date();
    const yarinSabah = new Date(simdi);
    yarinSabah.setDate(simdi.getDate() + 1);
    yarinSabah.setHours(0, 0, 30, 0);
    const fark = yarinSabah - simdi;
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("apartim:gun-degisti"));
      gunDegisimiPlanla();
    }, Math.max(60_000, fark));
  }
  gunDegisimiPlanla();

  // ---- Aylık rapor ----
  const raporDurum = { yil: new Date().getFullYear(), ay: new Date().getMonth() };
  const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                     "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function fmt(n) { return Number(n || 0).toLocaleString("tr-TR"); }

  function ayinGunSayisi(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function rezGeceKesisim(rez, ayBas, ayBit) {
    // [rez.giris, rez.cikis) ile [ayBas, ayBit) kesişimi (gece sayısı)
    const a = rez.giris > ayBas ? rez.giris : ayBas;
    const b = rez.cikis < ayBit ? rez.cikis : ayBit;
    return window.APARTIM.db.geceSayisi(a, b);
  }

  function raporHesapla() {
    const db = window.APARTIM.db;
    const y = raporDurum.yil, m = raporDurum.ay;
    const ayBas = iso(y, m, 1);
    const ayBit = iso(y, m, ayinGunSayisi(y, m) + 1); // ay sonunun ertesi
    const tumRez = Object.values(db.durum.rezervasyonlar);
    const daireler = db.dairelerListele();
    const ayGun = ayinGunSayisi(y, m);
    const toplamKapasite = daireler.length * ayGun;

    let toplamGece = 0, toplamGelir = 0, rezSayisi = 0;
    const daireOzet = {};
    daireler.forEach((d) => { daireOzet[d.id] = { gece: 0, gelir: 0 }; });

    tumRez.forEach((r) => {
      const g = rezGeceKesisim(r, ayBas, ayBit);
      if (g <= 0) return;
      const tutar = g * (Number(r.gunlukUcret) || 0);
      toplamGece += g;
      toplamGelir += tutar;
      rezSayisi++;
      if (daireOzet[r.daireId]) {
        daireOzet[r.daireId].gece += g;
        daireOzet[r.daireId].gelir += tutar;
      }
    });

    return {
      toplamGece,
      toplamGelir,
      rezSayisi,
      doluluk: toplamKapasite > 0 ? (toplamGece * 100 / toplamKapasite) : 0,
      daireOzet,
      daireler,
      ayGun
    };
  }

  function raporCiz() {
    const baslik = document.getElementById("rapor-ay-baslik");
    if (baslik) baslik.textContent = AY_ADLARI[raporDurum.ay] + " " + raporDurum.yil;
    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) return;

    const r = raporHesapla();
    document.getElementById("rapor-gelir").textContent = fmt(r.toplamGelir) + " TL";
    document.getElementById("rapor-gece").textContent = r.toplamGece + " gece";
    document.getElementById("rapor-doluluk").textContent = "%" + Math.round(r.doluluk);
    document.getElementById("rapor-rez").textContent = r.rezSayisi;

    const tbl = document.getElementById("rapor-daire-tablo");
    // İlk satır header kalsın
    tbl.querySelectorAll(".rapor-daire-satir:not(.header)").forEach((x) => x.remove());
    r.daireler.forEach((d) => {
      const o = r.daireOzet[d.id] || { gece: 0, gelir: 0 };
      const doluluk = r.ayGun > 0 ? Math.round(o.gece * 100 / r.ayGun) : 0;
      const sat = document.createElement("div");
      sat.className = "rapor-daire-satir";
      sat.innerHTML =
        '<span>' + d.ad + '</span>' +
        '<span class="gece-val">' + o.gece + '</span>' +
        '<span class="gelir-val">' + fmt(o.gelir) + ' TL</span>' +
        '<span class="doluluk-val">%' + doluluk + '</span>';
      tbl.appendChild(sat);
    });
  }

  function raporGit(yon) {
    let y = raporDurum.yil, m = raporDurum.ay + yon;
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    raporDurum.yil = y;
    raporDurum.ay = m;
    raporCiz();
  }

  window.APARTIM.app = { sekmeSec, raporCiz };
})();
