/* =========================================================
   APARTIM — Sezon / yıl görünümü
   Seçilen yılın verileri “şimdi” gibi gösterilir; geçmiş sezonlar kaybolmaz.
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "apartim-gorunum-yil";
  const SEZON_BAS_AY = 5;
  const SEZON_BIT_AY = 8;

  const durum = {
    yil: new Date().getFullYear()
  };

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }

  function yukleKayitliYil() {
    try {
      const kayit = localStorage.getItem(STORAGE_KEY);
      if (kayit) {
        const y = Number(kayit);
        if (Number.isFinite(y) && y >= 2000 && y <= 2100) durum.yil = y;
      }
    } catch (e) { /* yoksay */ }
  }

  function kaydetYil(y) {
    try { localStorage.setItem(STORAGE_KEY, String(y)); } catch (e) { /* yoksay */ }
  }

  function seciliYil() { return durum.yil; }

  function gercekYil() { return new Date().getFullYear(); }

  function arsivModu() { return durum.yil !== gercekYil(); }

  function yilSec(yil) {
    const y = Number(yil);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) return;
    if (y === durum.yil) return;
    durum.yil = y;
    kaydetYil(y);
    guncelleUI();
    document.dispatchEvent(new CustomEvent("apartim:gorunum-degisti", { detail: { yil: y } }));
  }

  /** Seçili yılda “bugün” — arşivde mevcut ay/gün sezon içine eşlenir */
  function bugunISO() {
    const db = window.APARTIM?.db;
    const gercek = new Date();
    if (durum.yil === gercek.getFullYear() && db?.bugunISO) return db.bugunISO();

    let m = gercek.getMonth();
    let d = gercek.getDate();
    if (m < SEZON_BAS_AY) { m = SEZON_BAS_AY; d = 1; }
    else if (m > SEZON_BIT_AY) {
      m = SEZON_BIT_AY;
      d = new Date(durum.yil, SEZON_BIT_AY + 1, 0).getDate();
    }
    const maxD = new Date(durum.yil, m + 1, 0).getDate();
    if (d > maxD) d = maxD;
    return iso(durum.yil, m, d);
  }

  function sezonBasBit(y) {
    return {
      bas: iso(y, SEZON_BAS_AY, 1),
      bit: iso(y, SEZON_BIT_AY, new Date(y, SEZON_BIT_AY + 1, 0).getDate()),
      bitHaric: iso(y, SEZON_BIT_AY + 1, 1)
    };
  }

  function mevcutYillar(db) {
    const set = new Set();
    const cy = gercekYil();
    set.add(cy);
    set.add(cy + 1);
    set.add(cy - 1);

    const rez = db?.durum?.rezervasyonlar;
    if (rez) {
      Object.values(rez).forEach((r) => {
        if (r.giris) set.add(Number(r.giris.slice(0, 4)));
        if (r.cikis) set.add(Number(r.cikis.slice(0, 4)));
        if (r.odenenGunleri) {
          Object.keys(r.odenenGunleri).forEach((t) => {
            if (t.length >= 4) set.add(Number(t.slice(0, 4)));
          });
        }
      });
    }

    for (let y = cy - 15; y <= cy + 3; y++) set.add(y);

    return [...set]
      .filter((y) => Number.isFinite(y) && y >= 2000 && y <= 2100)
      .sort((a, b) => b - a);
  }

  function selectDoldur(db) {
    const sel = document.getElementById("gorunum-yil");
    if (!sel) return;
    const secili = seciliYil();
    const yillar = mevcutYillar(db);
    if (!yillar.includes(secili)) yillar.unshift(secili);

    sel.innerHTML = yillar.map((y) => {
      const etiket = y === gercekYil() ? y + " (bu yıl)" : String(y);
      return '<option value="' + y + '"' + (y === secili ? " selected" : "") + ">" + etiket + "</option>";
    }).join("");
  }

  function bannerGuncelle() {
    const el = document.getElementById("gorunum-banner");
    if (!el) return;
    const arsiv = arsivModu();
    el.classList.toggle("hidden", !arsiv);
    if (arsiv) {
      el.innerHTML =
        '<span class="gorunum-banner-metin">' + seciliYil() + " sezon görünümü</span>" +
        '<button type="button" class="gorunum-banner-btn" data-gorunum-bugun>Bu yıla dön</button>';
    }
  }

  function initUI() {
    yukleKayitliYil();
    guncelleUI();

    document.getElementById("gorunum-yil")?.addEventListener("change", (e) => {
      yilSec(Number(e.target.value));
    });

    document.getElementById("gorunum-banner")?.addEventListener("click", (e) => {
      if (e.target.matches("[data-gorunum-bugun]")) {
        yilSec(gercekYil());
        window.APARTIM.rezOzet?.buguneGit?.();
      }
    });

    document.addEventListener("apartim:veri-degisti", () => {
      selectDoldur(window.APARTIM?.db);
      guncelleUI();
    });

    document.addEventListener("apartim:gorunum-degisti", () => {
      selectDoldur(window.APARTIM?.db);
      guncelleUI();
    });

    if (window.APARTIM?.db?.durum?.yuklendi) {
      selectDoldur(window.APARTIM.db);
    }
  }
  function guncelleUI() {
    const sel = document.getElementById("gorunum-yil");
    if (sel && Number(sel.value) !== seciliYil()) sel.value = String(seciliYil());
    bannerGuncelle();
    document.documentElement.dataset.gorunumYil = String(seciliYil());
  }

  document.addEventListener("DOMContentLoaded", initUI);

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.gorunum = {
    seciliYil,
    gercekYil,
    arsivModu,
    yilSec,
    bugunISO,
    sezonBasBit,
    mevcutYillar,
    guncelleUI
  };
})();
