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
    }
    yatayModGuncelle();
  }

  const YATAY_MQ = window.matchMedia("(orientation: landscape) and (max-width: 960px)");

  function yatayModMu() {
    if (!YATAY_MQ.matches) return false;
    const w = window.visualViewport?.width || window.innerWidth;
    const h = window.visualViewport?.height || window.innerHeight;
    return Math.min(w, h) > 0 && Math.min(w, h) <= 520;
  }

  function yatayModGuncelle() {
    const yatay = yatayModMu() || !!document.fullscreenElement;
    document.documentElement.classList.toggle("mobil-yatay-mod", yatay);
    document.body.classList.toggle("mobil-yatay-mod", yatay);
  }

  async function yonKilidiAc() {
    try {
      if (screen.orientation && typeof screen.orientation.unlock === "function") {
        screen.orientation.unlock();
      }
    } catch (e) { /* yoksay */ }
  }

  function yatayModBagla() {
    yatayModGuncelle();
    yonKilidiAc();
    YATAY_MQ.addEventListener("change", yatayModGuncelle);
    window.addEventListener("resize", yatayModGuncelle);
    window.visualViewport?.addEventListener("resize", yatayModGuncelle);
    window.addEventListener("orientationchange", () => {
      setTimeout(yatayModGuncelle, 200);
    });
    document.addEventListener("fullscreenchange", yatayModGuncelle);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.addEventListener("click", () => sekmeSec(b.dataset.tab));
    });

    document.getElementById("topbar-home")?.addEventListener("click", () => {
      window.APARTIM.daire?.kapat();
      sekmeSec("bina");
    });

    // PWA — pwa-install.js banner ve yükleme akışını yönetir

    // Rapor butonları
    document.getElementById("rapor-prev")?.addEventListener("click", () => raporGit(-1));
    document.getElementById("rapor-next")?.addEventListener("click", () => raporGit(1));

    yatayModBagla();
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

  function rezGeceGelirKesisim(rez, ayBas, ayBit) {
    const db = window.APARTIM.db;
    const tarihler = db.geceTarihleri(rez.giris, rez.cikis);
    let gece = 0;
    let gelir = 0;
    tarihler.forEach((t, idx) => {
      if (t >= ayBas && t < ayBit) {
        gece++;
        gelir += db.rezervasyonGeceUcreti(rez, idx + 1);
      }
    });
    return { gece, gelir };
  }

  function raporHesapla() {
    const db = window.APARTIM.db;
    const y = raporDurum.yil, m = raporDurum.ay;
    const ayBas = iso(y, m, 1);
    const ayBit = iso(y, m, ayinGunSayisi(y, m) + 1);
    const tumRez = Object.values(db.durum.rezervasyonlar);
    const daireler = db.dairelerListele();
    const ayGun = ayinGunSayisi(y, m);
    const toplamKapasite = daireler.length * ayGun;

    let toplamGece = 0, toplamGelir = 0, rezSayisi = 0;
    const daireOzet = {};
    daireler.forEach((d) => { daireOzet[d.id] = { gece: 0, gelir: 0 }; });

    tumRez.forEach((r) => {
      const { gece, gelir } = rezGeceGelirKesisim(r, ayBas, ayBit);
      if (gece <= 0) return;
      toplamGece += gece;
      toplamGelir += gelir;
      rezSayisi++;
      if (daireOzet[r.daireId]) {
        daireOzet[r.daireId].gece += gece;
        daireOzet[r.daireId].gelir += gelir;
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

  window.APARTIM.app = {
    sekmeSec,
    raporCiz,
    yatayModMu,
    yatayModGuncelle,
    yonKilidiAc
  };
})();
