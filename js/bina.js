/* =========================================================
   APARTIM — Odalar ana ekranı
   Her daire dikdörtgen kart: sol aylık özet, sağ mini takvim.
   ========================================================= */

(function () {
  "use strict";

  const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                     "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const GUN_KISA = ["P", "S", "Ç", "P", "C", "C", "P"];

  const durum = {
    yil: new Date().getFullYear(),
    ay: new Date().getMonth()
  };

  function listeEl() { return document.getElementById("daire-kart-listesi"); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function fmt(n) { return Number(n || 0).toLocaleString("tr-TR"); }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  function ayBaslikGuncelle() {
    const el = document.getElementById("bina-ay-baslik");
    if (el) el.textContent = AY_ADLARI[durum.ay] + " " + durum.yil;
  }

  function gorunumdenSenkron() {
    const gor = window.APARTIM.gorunum;
    if (!gor) return;
    durum.yil = gor.seciliYil();
    const bugun = gor.bugunISO();
    durum.ay = Number(bugun.slice(5, 7)) - 1;
  }

  function ayGit(yon) {
    let y = durum.yil;
    let m = durum.ay + yon;
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    durum.yil = y;
    durum.ay = m;
    window.APARTIM.gorunum?.yilSec?.(y);
    ayBaslikGuncelle();
    kartlariCiz();
  }

  function durumEtiket(bugunDr) {
    if (bugunDr.durum === "dolu") return { metin: "Dolu", sinif: "dolu" };
    return { metin: "Boş", sinif: "bos" };
  }

  function boncukSinifi(gd) {
    if (!gd || gd.tip === "bos") return "";
    if (gd.tip === "turnover") return "turnover";
    if (gd.tip === "checkin") return "giris";
    if (gd.tip === "checkout") return "cikis";
    return "dolu";
  }

  function miniTakvimHtml(daireId, daire) {
    const db = window.APARTIM.db;
    const y = durum.yil;
    const m = durum.ay;
    const ilk = new Date(y, m, 1);
    const sonGun = new Date(y, m + 1, 0).getDate();
    let hafGun = ilk.getDay() - 1;
    if (hafGun < 0) hafGun = 6;
    const bg = window.APARTIM.gorunum?.bugunISO?.() || db.bugunISO();
    const oncekiSon = new Date(y, m, 0).getDate();

    let html = '<div class="mini-takvim"><div class="mini-takvim-baslik">';
    GUN_KISA.forEach((g) => { html += '<span>' + g + "</span>"; });
    html += '</div><div class="mini-takvim-grid">';

    for (let i = hafGun - 1; i >= 0; i--) {
      html += '<div class="mini-takvim-hucre disabled"><span class="mini-takvim-gun">' +
        (oncekiSon - i) + "</span></div>";
    }

    for (let d = 1; d <= sonGun; d++) {
      const isoT = iso(y, m, d);
      const gd = db.daireGunDurumu(daireId, isoT);
      const siniflar = ["mini-takvim-hucre"];
      if (isoT === bg) siniflar.push("bugun");
      const boncuk = boncukSinifi(gd);
      if (boncuk) siniflar.push("mini-takvim-dolu");
      html += '<div class="' + siniflar.join(" ") + '"' +
        ' data-daire-id="' + esc(daireId) + '"' +
        ' data-tarih="' + isoT + '">' +
        '<span class="mini-takvim-gun">' + d + "</span>" +
        (boncuk ? '<span class="mini-takvim-boncuk ' + boncuk + '"></span>' : "") +
        "</div>";
    }

    const hucreSay = hafGun + sonGun;
    const eksik = (7 - (hucreSay % 7)) % 7;
    for (let i = 1; i <= eksik; i++) {
      html += '<div class="mini-takvim-hucre disabled"><span class="mini-takvim-gun">' +
        i + "</span></div>";
    }

    html += "</div></div>";
    return html;
  }

  function kartHtml(d) {
    const db = window.APARTIM.db;
    const bugunDr = db.daireDurumuBugun(d.id);
    const ozet = db.daireAylikOzet(d.id, durum.yil, durum.ay);
    const dr = durumEtiket(bugunDr);

    return (
      '<article class="daire-kart" data-daire-id="' + esc(d.id) + '" tabindex="0" role="button">' +
        '<div class="daire-kart-icerik">' +
          '<div class="daire-kart-sol">' +
            '<div class="daire-kart-baslik">' +
              '<h3 class="daire-kart-ad">' + esc(d.ad) + "</h3>" +
              '<span class="daire-kart-durum durum-' + esc(dr.sinif) + '">' +
                '<span class="daire-kart-durum-nokta"></span>' + esc(dr.metin) +
              "</span>" +
            "</div>" +
            '<div class="daire-kart-ozet">' +
              '<div class="daire-kart-ozet-satir">' +
                '<span class="etiket">Dolu gün</span>' +
                '<span class="deger">' + ozet.gece + " / " + ozet.ayGun + "</span>" +
              "</div>" +
              '<div class="daire-kart-ozet-satir">' +
                '<span class="etiket">Ort. fiyat</span>' +
                '<span class="deger">' + (ozet.gece ? fmt(ozet.ortalama) + " TL" : "—") + "</span>" +
              "</div>" +
              '<div class="daire-kart-ozet-satir">' +
                '<span class="etiket">Aylık gelir</span>' +
                '<span class="deger">' + fmt(ozet.gelir) + " TL</span>" +
              "</div>" +
              '<div class="daire-kart-ozet-satir">' +
                '<span class="etiket">Doluluk</span>' +
                '<span class="deger">%' + ozet.doluluk + "</span>" +
              "</div>" +
            "</div>" +
          "</div>" +
          '<div class="daire-kart-sag" aria-hidden="true">' +
            miniTakvimHtml(d.id, d) +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function ozetGuncelle() {
    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) return;
    const liste = db.dairelerListele();
    let dolu = 0;
    let bos = 0;
    liste.forEach((d) => {
      const dr = db.daireDurumuBugun(d.id);
      if (dr.durum === "dolu") dolu++;
      else bos++;
    });
    setText("ozet-toplam", liste.length);
    setText("ozet-dolu", dolu);
    setText("ozet-bos", bos);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function kartlariCiz() {
    const wrap = listeEl();
    const db = window.APARTIM.db;
    if (!wrap || !db) return;
    if (!db.durum.yuklendi) {
      wrap.innerHTML = '<p class="bina-yukleniyor">Veriler yükleniyor…</p>';
      return;
    }
    const liste = db.dairelerListele();
    if (!liste.length) {
      wrap.innerHTML = '<p class="bina-yukleniyor">Daire bulunamadı.</p>';
      return;
    }
    wrap.innerHTML = liste.map(kartHtml).join("");
    wrap.querySelectorAll(".daire-kart").forEach((kart) => {
      const ac = () => {
        const id = kart.getAttribute("data-daire-id");
        if (window.APARTIM.daire && id) window.APARTIM.daire.ac(id);
      };
      kart.addEventListener("click", ac);
      kart.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ac();
        }
      });
    });
    wrap.querySelectorAll(".mini-takvim-hucre.mini-takvim-dolu").forEach((hucre) => {
      const daireId = hucre.getAttribute("data-daire-id");
      const isoT = hucre.getAttribute("data-tarih");
      window.APARTIM.takvim?.ozetHoverBagla(hucre, daireId, isoT);
    });
    ozetGuncelle();
  }

  function binayiCiz() {
    ayBaslikGuncelle();
    kartlariCiz();
  }

  function guncelle() {
    ayBaslikGuncelle();
    kartlariCiz();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("bina-ay-prev")?.addEventListener("click", () => ayGit(-1));
    document.getElementById("bina-ay-next")?.addEventListener("click", () => ayGit(1));
    document.getElementById("bina-ay-bugun")?.addEventListener("click", () => {
      window.APARTIM.gorunum?.yilSec?.(window.APARTIM.gorunum?.gercekYil?.() ?? new Date().getFullYear());
      gorunumdenSenkron();
      binayiCiz();
    });
    gorunumdenSenkron();
  });
  document.addEventListener("apartim:gorunum-degisti", () => {
    gorunumdenSenkron();
    binayiCiz();
  });
  document.addEventListener("apartim:veri-degisti", guncelle);
  document.addEventListener("apartim:gun-degisti", guncelle);

  window.APARTIM.bina = {
    ciz: binayiCiz,
    guncelle
  };
})();
