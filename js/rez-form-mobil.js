/* =========================================================
   APARTIM — Mobil rezervasyon formu (klavye + viewport)
   Yalnızca CSS sınıfı ve görünür viewport yüksekliği; döngü yok.
   ========================================================= */

(function () {
  "use strict";

  const MODAL_ID = "modal-rez";
  let vpTimer = null;
  let baglandi = false;

  function overlay() {
    return document.getElementById(MODAL_ID);
  }

  function mobilMi() {
    return window.matchMedia("(max-width: 720px)").matches ||
      window.matchMedia("(pointer: coarse)").matches;
  }

  function yatayMi() {
    if (window.APARTIM.app?.yatayModMu?.()) return true;
    return window.matchMedia("(orientation: landscape) and (max-height: 520px)").matches;
  }

  function acikMi() {
    const el = overlay();
    return el && !el.classList.contains("hidden");
  }

  function klavyeAcikMi() {
    const vv = window.visualViewport;
    if (!vv) return false;
    return vv.height < window.innerHeight * 0.78;
  }

  function stilTemizle() {
    const el = overlay();
    if (el) {
      el.style.top = "";
      el.style.left = "";
      el.style.right = "";
      el.style.height = "";
      el.style.bottom = "";
    }
    document.documentElement.style.removeProperty("--rez-vvh");
  }

  function takvimKapat() {
    const el = overlay();
    if (!el) return;
    el.classList.add("rez-takvim-kapali");
    el.classList.remove("rez-takvim-acik");
  }

  function takvimAc() {
    const el = overlay();
    if (!el) return;
    document.activeElement?.blur?.();
    el.classList.remove("rez-takvim-kapali");
    el.classList.add("rez-takvim-acik");
  }

  function alanaKaydir(el) {
    if (!el) return;
    const body = el.closest(".modal-body");
    if (!body) return;
    requestAnimationFrame(() => {
      const bodyRect = body.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const ustBosluk = 48;
      const altBosluk = 72;
      if (elRect.top < bodyRect.top + ustBosluk) {
        body.scrollTop += elRect.top - bodyRect.top - ustBosluk;
      } else if (elRect.bottom > bodyRect.bottom - altBosluk) {
        body.scrollTop += elRect.bottom - bodyRect.bottom + altBosluk;
      }
    });
  }

  function viewportGuncelle() {
    clearTimeout(vpTimer);
    vpTimer = setTimeout(() => {
      const el = overlay();
      if (!el || el.classList.contains("hidden") || !mobilMi()) {
        document.body.classList.remove("rez-form-klavye", "rez-form-yatay");
        stilTemizle();
        return;
      }

      const vv = window.visualViewport;
      if (!vv) return;

      const yatay = yatayMi();
      const klavye = klavyeAcikMi();
      document.body.classList.toggle("rez-form-yatay", yatay);
      document.body.classList.toggle("rez-form-klavye", klavye);
      document.documentElement.style.setProperty("--rez-vvh", Math.round(vv.height) + "px");

      /* Telefon/tablet: her zaman üstten görünür viewport’a yasla (altta boş klavye alanı yok) */
      el.style.top = Math.max(0, vv.offsetTop) + "px";
      el.style.left = "0";
      el.style.right = "0";
      el.style.height = vv.height + "px";
      el.style.bottom = "auto";

      if (klavye) {
        el.classList.add("rez-takvim-kapali");
      }
    }, 60);
  }

  function ac() {
    if (!mobilMi()) return;
    document.body.classList.add("rez-form-mobil");
    const el = overlay();
    el?.classList.remove("rez-takvim-kapali", "rez-takvim-acik");
    if (yatayMi()) {
      document.body.classList.add("rez-form-yatay");
    }
    viewportGuncelle();
  }

  function kapat() {
    document.body.classList.remove("rez-form-mobil", "rez-form-klavye", "rez-form-yatay");
    overlay()?.classList.remove("rez-takvim-kapali", "rez-takvim-acik");
    stilTemizle();
  }

  function tarihSecildi() {
    if (!mobilMi() || !acikMi()) return;
    const giris = document.getElementById("rez-giris")?.value;
    const cikis = document.getElementById("rez-cikis")?.value;
    if (giris && cikis && cikis > giris) {
      takvimKapat();
    }
  }

  function bagla() {
    if (baglandi) return;
    baglandi = true;

    const el = overlay();
    if (!el) return;

    const vv = window.visualViewport;
    vv?.addEventListener("resize", viewportGuncelle);
    vv?.addEventListener("scroll", viewportGuncelle);
    window.addEventListener("resize", viewportGuncelle);
    window.addEventListener("orientationchange", () => setTimeout(viewportGuncelle, 280));

    document.getElementById("rez-tarih-aralik-ozet")?.addEventListener("click", () => {
      if (!mobilMi() || !acikMi()) return;
      const ov = overlay();
      if (ov?.classList.contains("rez-takvim-acik")) {
        takvimKapat();
      } else {
        takvimAc();
      }
    });

    el.addEventListener("focusin", (e) => {
      if (!mobilMi() || !acikMi()) return;
      const t = e.target;
      if (!t.matches?.(".field-input, .field-select, textarea")) return;
      el.classList.add("rez-takvim-kapali");
      el.classList.remove("rez-takvim-acik");
      setTimeout(() => alanaKaydir(t), 320);
    });

    el.addEventListener("focusout", () => {
      if (!mobilMi() || !acikMi()) return;
      setTimeout(() => {
        if (!acikMi()) return;
        const ov = overlay();
        const aktif = document.activeElement;
        if (aktif && ov?.contains(aktif) && aktif.matches?.(".field-input, .field-select, textarea")) {
          return;
        }
        if (!klavyeAcikMi()) {
          ov?.classList.remove("rez-takvim-kapali");
        }
      }, 120);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bagla);
  } else {
    bagla();
  }

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.rezFormMobil = {
    ac, kapat, viewportGuncelle, tarihSecildi, mobilMi
  };
})();
