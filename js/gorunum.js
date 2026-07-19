/* =========================================================
   APARTIM — Sezon / yıl görünümü
   Seçilen yılın verileri “şimdi” gibi gösterilir; geçmiş sezonlar kaybolmaz.
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "apartim-gorunum-yil";
  const EXTRA_KEY = "apartim-sezon-ekstra";
  const SEZON_MIN = 2020;
  const SEZON_BAS_AY = 5;
  const SEZON_BIT_AY = 8;

  const durum = {
    yil: new Date().getFullYear(),
    menuAcik: false
  };

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }

  function yukleKayitliYil() {
    try {
      const kayit = localStorage.getItem(STORAGE_KEY);
      if (kayit) {
        const y = Number(kayit);
        if (Number.isFinite(y) && y >= SEZON_MIN && y <= 2100) durum.yil = y;
      }
    } catch (e) { /* yoksay */ }
  }

  function kaydetYil(y) {
    try { localStorage.setItem(STORAGE_KEY, String(y)); } catch (e) { /* yoksay */ }
  }

  function ekstraYillarOku() {
    try {
      const ham = localStorage.getItem(EXTRA_KEY);
      if (!ham) return [];
      const arr = JSON.parse(ham);
      if (!Array.isArray(arr)) return [];
      return arr
        .map(Number)
        .filter((y) => Number.isFinite(y) && y >= SEZON_MIN && y <= 2100);
    } catch (e) {
      return [];
    }
  }

  function ekstraYilKaydet(y) {
    const set = new Set(ekstraYillarOku());
    set.add(y);
    try {
      localStorage.setItem(EXTRA_KEY, JSON.stringify([...set].sort((a, b) => a - b)));
    } catch (e) { /* yoksay */ }
  }

  function seciliYil() { return durum.yil; }

  function gercekYil() { return new Date().getFullYear(); }

  function arsivModu() { return durum.yil !== gercekYil(); }

  function yilSec(yil) {
    const y = Number(yil);
    if (!Number.isFinite(y) || y < SEZON_MIN || y > 2100) return;
    if (y === durum.yil) {
      menuKapat();
      return;
    }
    durum.yil = y;
    kaydetYil(y);
    guncelleUI();
    menuKapat();
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

    for (let y = SEZON_MIN; y <= cy; y++) set.add(y);
    set.add(cy + 1);
    ekstraYillarOku().forEach((y) => set.add(y));

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

    return [...set]
      .filter((y) => Number.isFinite(y) && y >= SEZON_MIN && y <= 2100)
      .sort((a, b) => b - a);
  }

  function menuDoldur(db) {
    const liste = document.getElementById("gorunum-yil-liste");
    if (!liste) return;
    const secili = seciliYil();
    const yillar = mevcutYillar(db);
    if (!yillar.includes(secili)) yillar.unshift(secili);

    liste.innerHTML = yillar.map((y) => {
      const aktif = y === secili ? " aktif" : "";
      const buYil = y === gercekYil() ? ' <span class="gorunum-yil-badge">bu yıl</span>' : "";
      return (
        '<button type="button" class="gorunum-yil-item' + aktif + '" role="option" data-yil="' + y + '"' +
          (y === secili ? ' aria-selected="true"' : ' aria-selected="false"') + ">" +
          "<span>" + y + "</span>" + buYil +
        "</button>"
      );
    }).join("");
  }

  function btnMetinGuncelle() {
    const deger = document.getElementById("gorunum-yil-deger");
    if (!deger) return;
    const y = seciliYil();
    deger.textContent = y === gercekYil() ? y + " · bu yıl" : String(y);
  }

  function menuAc() {
    const menu = document.getElementById("gorunum-yil-menu");
    const btn = document.getElementById("gorunum-yil-btn");
    if (!menu || !btn) return;
    menuDoldur(window.APARTIM?.db);
    menu.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
    durum.menuAcik = true;
    const aktif = menu.querySelector(".gorunum-yil-item.aktif");
    aktif?.scrollIntoView({ block: "nearest" });
  }

  function menuKapat() {
    const menu = document.getElementById("gorunum-yil-menu");
    const btn = document.getElementById("gorunum-yil-btn");
    if (!menu || !btn) return;
    menu.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
    durum.menuAcik = false;
  }

  function menuToggle() {
    if (durum.menuAcik) menuKapat();
    else menuAc();
  }

  function sezonEkle() {
    const yillar = mevcutYillar(window.APARTIM?.db);
    const max = yillar.length ? Math.max.apply(null, yillar) : gercekYil();
    const yeni = Math.min(2100, max + 1);
    if (yillar.includes(yeni)) {
      yilSec(yeni);
      return;
    }
    ekstraYilKaydet(yeni);
    yilSec(yeni);
    window.APARTIM.toast?.(yeni + " sezonu eklendi", "basari");
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

    document.getElementById("gorunum-yil-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      menuToggle();
    });

    document.getElementById("gorunum-yil-menu")?.addEventListener("click", (e) => {
      const item = e.target.closest("[data-yil]");
      if (item) {
        yilSec(Number(item.dataset.yil));
        return;
      }
      if (e.target.closest("#gorunum-yil-ekle")) {
        sezonEkle();
      }
    });

    document.addEventListener("click", (e) => {
      if (!durum.menuAcik) return;
      if (e.target.closest("#gorunum-yil-wrap")) return;
      menuKapat();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && durum.menuAcik) menuKapat();
    });

    document.getElementById("gorunum-banner")?.addEventListener("click", (e) => {
      if (e.target.matches("[data-gorunum-bugun]")) {
        yilSec(gercekYil());
        window.APARTIM.rezOzet?.buguneGit?.();
      }
    });

    document.addEventListener("apartim:veri-degisti", () => {
      if (durum.menuAcik) menuDoldur(window.APARTIM?.db);
      guncelleUI();
    });

    document.addEventListener("apartim:gorunum-degisti", () => {
      if (durum.menuAcik) menuDoldur(window.APARTIM?.db);
      guncelleUI();
    });

    if (window.APARTIM?.db?.durum?.yuklendi) {
      menuDoldur(window.APARTIM.db);
    }
  }

  function guncelleUI() {
    btnMetinGuncelle();
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
    sezonEkle,
    guncelleUI
  };
})();
