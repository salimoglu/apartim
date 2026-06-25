/* =========================================================
   APARTIM — Uygulama başlatıcı
   Sekme yönetimi, rapor, PWA install, gün değişimi yayını.
   ========================================================= */

(function () {
  "use strict";

  let yenilemeBekleniyor = false;

  // ---- Sürüm gösterimi ----
  function versiyonGoster() {
    const el = document.getElementById("app-version");
    const v = window.APARTIM_VERSION;
    if (el && v) el.textContent = v.LABEL || v.ASSET || "—";
  }

  // ---- Güncelleme kontrol + yenile ----
  async function guncellemeYenile() {
    if (yenilemeBekleniyor) return;
    yenilemeBekleniyor = true;
    const ptr = document.getElementById("ptr-gosterge");
    if (ptr) {
      ptr.textContent = "Güncelleme kontrol ediliyor…";
      ptr.classList.remove("hidden", "ptr-hazir");
    }

    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            window.APARTIM_SW_RELOAD = true;
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
            return;
          }
          if (reg.installing) {
            await new Promise((resolve) => {
              reg.installing.addEventListener("statechange", function onState() {
                if (reg.installing.state === "installed") {
                  reg.installing.removeEventListener("statechange", onState);
                  if (navigator.serviceWorker.controller && reg.waiting) {
                    window.APARTIM_SW_RELOAD = true;
                    reg.waiting.postMessage({ type: "SKIP_WAITING" });
                  }
                  resolve();
                }
              });
            });
            if (window.APARTIM_SW_RELOAD) return;
          }
        }
      }
      location.reload();
    } catch (err) {
      console.warn("guncellemeYenile", err);
      location.reload();
    }
  }

  // ---- Aşağı çekerek yenile (pull-to-refresh) ----
  const PTR_ESIK = 72;
  let ptrBasY = 0;
  let ptrMesafe = 0;
  let ptrAktif = false;
  let ptrScrollEl = null;

  function aktifScrollElemani() {
    const panel = document.querySelector(".tab-panel.active");
    if (!panel) return document.documentElement;
    const adaylar = [
      panel.querySelector(".rez-ozet-scroll"),
      panel.querySelector(".bina-wrap"),
      panel.querySelector(".rapor-wrap"),
      panel.querySelector(".daire-wrap"),
      panel
    ];
    for (let i = 0; i < adaylar.length; i++) {
      const el = adaylar[i];
      if (el && el.scrollHeight > el.clientHeight + 2) return el;
    }
    return document.documentElement;
  }

  function scrollUstteMi(el) {
    if (!el || el === document.documentElement) {
      return (window.scrollY || document.documentElement.scrollTop || 0) <= 2;
    }
    return (el.scrollTop || 0) <= 2;
  }

  function ptrGostergeGuncelle(mesafe, hazir) {
    const ptr = document.getElementById("ptr-gosterge");
    if (!ptr) return;
    ptr.classList.remove("hidden");
    ptr.classList.toggle("ptr-hazir", !!hazir);
    ptr.textContent = hazir ? "Bırakın, yenilenecek" : "Güncellemek için çekin";
  }

  function ptrSifirla() {
    ptrAktif = false;
    ptrScrollEl = null;
    ptrMesafe = 0;
    document.body.classList.remove("ptr-cekiliyor");
    const ptr = document.getElementById("ptr-gosterge");
    ptr?.classList.add("hidden");
    ptr?.classList.remove("ptr-hazir");
  }

  function cekerekYenileBagla() {
    document.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1 || yenilemeBekleniyor) return;
      ptrScrollEl = aktifScrollElemani();
      if (!scrollUstteMi(ptrScrollEl)) return;
      ptrBasY = e.touches[0].clientY;
      ptrMesafe = 0;
      ptrAktif = true;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!ptrAktif || e.touches.length !== 1) return;
      if (!scrollUstteMi(ptrScrollEl)) {
        ptrSifirla();
        return;
      }
      ptrMesafe = e.touches[0].clientY - ptrBasY;
      if (ptrMesafe > 8) {
        document.body.classList.add("ptr-cekiliyor");
        ptrGostergeGuncelle(ptrMesafe, ptrMesafe >= PTR_ESIK);
        if (ptrMesafe > 12) e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener("touchend", () => {
      if (!ptrAktif) return;
      const tetik = ptrMesafe >= PTR_ESIK;
      ptrSifirla();
      if (tetik) guncellemeYenile();
    }, { passive: true });

    document.addEventListener("touchcancel", ptrSifirla, { passive: true });
  }

  // ---- Sekme yönetimi ----
  function sekmeSec(ad) {
    if (ad !== "rezervasyonlar") {
      window.APARTIM.rezOzet?.tamEkranKapat?.();
    }
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
    const tamEkran = document.querySelector("#tab-rezervasyonlar .rez-ozet-wrap.rez-ozet-tam-ekran");
    const yatay = yatayModMu() || !!document.fullscreenElement || !!tamEkran;
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
      sekmeSec("rezervasyonlar");
    });

    // PWA — pwa-install.js banner ve yükleme akışını yönetir

    // Rapor butonları
    document.getElementById("rapor-prev")?.addEventListener("click", () => raporGit(-1));
    document.getElementById("rapor-next")?.addEventListener("click", () => raporGit(1));
    document.querySelectorAll(".rapor-mod-btn").forEach((b) => {
      b.addEventListener("click", () => raporModSec(b.dataset.mod));
    });

    yatayModBagla();
    cekerekYenileBagla();
    versiyonGoster();
    sekmeSec("rezervasyonlar");
  });

  // ---- Veri hazır olduğunda bina çiz ----
  document.addEventListener("apartim:auth-hazir", () => {
    if (window.APARTIM.bina) window.APARTIM.bina.ciz();
  });

  document.addEventListener("apartim:veri-degisti", () => {
    window.APARTIM.bina?.guncelle();
    window.APARTIM.rezOzet?.tabloCizPlanla?.();
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

  // ---- Aylık / yıllık rapor ----
  const raporDurum = {
    mod: "ay",
    yil: new Date().getFullYear(),
    ay: new Date().getMonth()
  };
  const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                     "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function fmt(n) { return Number(n || 0).toLocaleString("tr-TR"); }

  function gelirPbToplamTL(gelirPB) {
    const para = window.APARTIM.para;
    if (!para) return gelirPB.TL + gelirPB.USD + gelirPB.EUR;
    return gelirPB.TL +
      para.tlKarsiligi(gelirPB.USD, "USD") +
      para.tlKarsiligi(gelirPB.EUR, "EUR");
  }

  function raporPbParcaHtml(tutar, pb) {
    const para = window.APARTIM.para;
    if (!tutar || tutar <= 0) return "";
    const ana = para ? para.formatTutar(tutar, pb) : fmt(tutar) + " " + pb;
    if (pb === "USD" || pb === "EUR") {
      const tl = para ? para.tlKarsiligi(tutar, pb) : tutar;
      return '<span class="rapor-pb-grup">' +
        '<span class="rapor-pb ' + pb.toLowerCase() + '">' + ana + "</span>" +
        '<span class="rapor-pb-tl-alt">≈ ' + fmt(Math.round(tl)) + " ₺</span>" +
        "</span>";
    }
    return '<span class="rapor-pb tl">' + ana + "</span>";
  }

  function raporGelirOzetHtml(gelirPB, kompakt) {
    const parcalar = [];
    if (gelirPB.TL > 0) parcalar.push(raporPbParcaHtml(gelirPB.TL, "TL"));
    if (gelirPB.USD > 0) parcalar.push(raporPbParcaHtml(gelirPB.USD, "USD"));
    if (gelirPB.EUR > 0) parcalar.push(raporPbParcaHtml(gelirPB.EUR, "EUR"));
    const cls = "rapor-gelir-inline" + (kompakt ? " kompakt" : "");
    if (!parcalar.length) {
      return '<div class="' + cls + '"><span class="rapor-pb tl">0 ₺</span></div>';
    }
    const yabanci = gelirPB.USD > 0 || gelirPB.EUR > 0;
    const coklu = parcalar.length > 1;
    let icerik = parcalar.join('<span class="rapor-gelir-ayrac">·</span>');
    if (yabanci || coklu) {
      const tlToplam = gelirPbToplamTL(gelirPB);
      icerik +=
        '<span class="rapor-gelir-ayrac">|</span>' +
        '<span class="rapor-gelir-toplam-inline">Toplam ≈ ' + fmt(Math.round(tlToplam)) + " ₺</span>";
    }
    return '<div class="' + cls + '">' + icerik + "</div>";
  }

  function ayinGunSayisi(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function yilinGunSayisi(y) {
    return Math.round((Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000);
  }

  function raporDonemSinirlari() {
    const y = raporDurum.yil;
    if (raporDurum.mod === "yil") {
      return {
        bas: iso(y, 0, 1),
        bit: iso(y + 1, 0, 1),
        gunSayisi: yilinGunSayisi(y),
        baslik: String(y)
      };
    }
    const m = raporDurum.ay;
    return {
      bas: iso(y, m, 1),
      bit: iso(y, m, ayinGunSayisi(y, m) + 1),
      gunSayisi: ayinGunSayisi(y, m),
      baslik: AY_ADLARI[m] + " " + y
    };
  }

  function rezGeceGelirKesisim(rez, donemBas, donemBit) {
    const db = window.APARTIM.db;
    const tarihler = db.geceTarihleri(rez.giris, rez.cikis);
    let gece = 0;
    let gelir = 0;
    tarihler.forEach((t, idx) => {
      if (t >= donemBas && t < donemBit) {
        gece++;
        gelir += db.rezervasyonGeceUcreti(rez, idx + 1);
      }
    });
    return { gece, gelir };
  }

  function raporTahsilatYontemHesapla() {
    const db = window.APARTIM.db;
    const donem = raporDonemSinirlari();
    const tumRez = Object.values(db.durum.rezervasyonlar);
    const yontemler = Object.keys(db.ODEME_YONTEMLERI || {
      elden: 1, havale: 1, booking: 1, diger: 1
    });
    const ozet = {};
    yontemler.forEach((y) => { ozet[y] = { TL: 0, USD: 0, EUR: 0 }; });

    tumRez.forEach((r) => {
      if (!r) return;
      const parca = db.rezervasyonOdemeDonemToplam(r, donem.bas, donem.bit);
      if (!parca) return;
      Object.keys(parca).forEach((y) => {
        if (!ozet[y]) ozet[y] = { TL: 0, USD: 0, EUR: 0 };
        ozet[y].TL += parca[y].TL || 0;
        ozet[y].USD += parca[y].USD || 0;
        ozet[y].EUR += parca[y].EUR || 0;
      });
    });

    return ozet;
  }

  function raporTahsilatOzetHtml(tahsilatYontem) {
    const db = window.APARTIM.db;
    const yontemler = db?.ODEME_YONTEMLERI || {
      elden: "Elden", havale: "Hesaba havale", booking: "Booking", diger: "Diğer"
    };
    const parcalar = [];
    Object.keys(yontemler).forEach((key) => {
      const pb = tahsilatYontem[key] || { TL: 0, USD: 0, EUR: 0 };
      const alt = [];
      if (pb.TL > 0) alt.push(raporPbParcaHtml(pb.TL, "TL"));
      if (pb.USD > 0) alt.push(raporPbParcaHtml(pb.USD, "USD"));
      if (pb.EUR > 0) alt.push(raporPbParcaHtml(pb.EUR, "EUR"));
      if (!alt.length) return;
      parcalar.push(
        '<div class="rapor-tahsilat-yontem">' +
          '<span class="rapor-tahsilat-etiket">' + yontemler[key] + "</span>" +
          '<div class="rapor-gelir-inline kompakt">' + alt.join('<span class="rapor-gelir-ayrac">·</span>') + "</div>" +
        "</div>"
      );
    });
    if (!parcalar.length) {
      return '<div class="rapor-gelir-inline"><span class="rapor-pb tl">0 ₺</span></div>';
    }
    return '<div class="rapor-tahsilat-liste">' + parcalar.join("") + "</div>";
  }

  function raporHesapla() {
    const db = window.APARTIM.db;
    const donem = raporDonemSinirlari();
    const tumRez = Object.values(db.durum.rezervasyonlar);
    const daireler = db.dairelerListele();
    const toplamKapasite = daireler.length * donem.gunSayisi;

    let toplamGece = 0, rezSayisi = 0;
    const gelirPB = { TL: 0, USD: 0, EUR: 0 };
    const daireOzet = {};
    daireler.forEach((d) => {
      daireOzet[d.id] = { gece: 0, gelirPB: { TL: 0, USD: 0, EUR: 0 } };
    });

    tumRez.forEach((r) => {
      const { gece, gelir } = rezGeceGelirKesisim(r, donem.bas, donem.bit);
      if (gece <= 0) return;
      toplamGece += gece;
      const pb = window.APARTIM.para?.rezParaBirimi(r) || "TL";
      gelirPB[pb] += gelir;
      rezSayisi++;
      if (daireOzet[r.daireId]) {
        daireOzet[r.daireId].gece += gece;
        daireOzet[r.daireId].gelirPB[pb] += gelir;
      }
    });

    const toplamGelir = gelirPbToplamTL(gelirPB);
    const tahsilatYontem = raporTahsilatYontemHesapla();

    return {
      toplamGece,
      toplamGelir,
      gelirPB,
      tahsilatYontem,
      rezSayisi,
      doluluk: toplamKapasite > 0 ? (toplamGece * 100 / toplamKapasite) : 0,
      daireOzet,
      daireler,
      gunSayisi: donem.gunSayisi,
      baslik: donem.baslik
    };
  }

  function raporCiz() {
    const baslik = document.getElementById("rapor-ay-baslik");
    const gelirLabel = document.getElementById("rapor-gelir-label");
    const tahsilatLabel = document.getElementById("rapor-tahsilat-label");
    const yillik = raporDurum.mod === "yil";
    if (gelirLabel) gelirLabel.textContent = yillik ? "Yıllık gelir (gece)" : "Aylık gelir (gece)";
    if (tahsilatLabel) tahsilatLabel.textContent = yillik ? "Yıllık tahsilat" : "Aylık tahsilat";
    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) {
      if (baslik) baslik.textContent = "—";
      return;
    }

    const r = raporHesapla();
    if (baslik) baslik.textContent = r.baslik;
    const gelirEl = document.getElementById("rapor-gelir");
    if (gelirEl) gelirEl.innerHTML = raporGelirOzetHtml(r.gelirPB, false);
    const tahsilatEl = document.getElementById("rapor-tahsilat");
    if (tahsilatEl) tahsilatEl.innerHTML = raporTahsilatOzetHtml(r.tahsilatYontem);
    document.getElementById("rapor-gece").textContent = r.toplamGece + " gece";
    document.getElementById("rapor-doluluk").textContent = "%" + Math.round(r.doluluk);
    document.getElementById("rapor-rez").textContent = r.rezSayisi;

    const tbl = document.getElementById("rapor-daire-tablo");
    tbl.querySelectorAll(".rapor-daire-satir:not(.header)").forEach((x) => x.remove());
    r.daireler.forEach((d) => {
      const o = r.daireOzet[d.id] || { gece: 0, gelirPB: { TL: 0, USD: 0, EUR: 0 } };
      const doluluk = r.gunSayisi > 0 ? Math.round(o.gece * 100 / r.gunSayisi) : 0;
      const sat = document.createElement("div");
      sat.className = "rapor-daire-satir";
      sat.innerHTML =
        "<span>" + d.ad + "</span>" +
        '<span class="gece-val">' + o.gece + "</span>" +
        '<span class="gelir-val">' + raporGelirOzetHtml(o.gelirPB, true) + "</span>" +
        '<span class="doluluk-val">%' + doluluk + "</span>";
      tbl.appendChild(sat);
    });
  }

  function raporGit(yon) {
    if (raporDurum.mod === "yil") {
      raporDurum.yil += yon;
    } else {
      let y = raporDurum.yil, m = raporDurum.ay + yon;
      if (m < 0) { m = 11; y--; }
      else if (m > 11) { m = 0; y++; }
      raporDurum.yil = y;
      raporDurum.ay = m;
    }
    raporCiz();
  }

  function raporModSec(mod) {
    if (mod !== "ay" && mod !== "yil") return;
    raporDurum.mod = mod;
    document.querySelectorAll(".rapor-mod-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.mod === mod));
    raporCiz();
  }

  let kurGuncellemeCalisti = false;

  async function dovizKurlariCanliGuncelle(zorla) {
    const para = window.APARTIM.para;
    const db = window.APARTIM.db;
    if (!para || !db?.durum?.yuklendi) return null;

    const live = await para.kurlariOtomatikGuncelle({
      zorla: !!zorla,
      sonGuncelleme: db.durum.dovizKurlari?.guncelleme
    });
    if (!live || live.onbellek) return live;

    await db.dovizKurlariKaydet({
      USD: live.USD,
      EUR: live.EUR,
      guncelleme: live.guncelleme,
      kaynak: live.kaynak
    });
    window.APARTIM.rezOzet?.tabloCiz();
    raporCiz();
    return live;
  }

  document.addEventListener("apartim:veri-degisti", () => {
    if (kurGuncellemeCalisti) return;
    if (!window.APARTIM.db?.durum?.yuklendi) return;
    kurGuncellemeCalisti = true;
    dovizKurlariCanliGuncelle(false).catch(() => {});
  });

  window.APARTIM.app = {
    sekmeSec,
    raporCiz,
    yatayModMu,
    yatayModGuncelle,
    yonKilidiAc,
    dovizKurlariCanliGuncelle,
    guncellemeYenile,
    versiyonGoster
  };
})();
