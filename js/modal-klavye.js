/* =========================================================
   APARTIM — Mobil modal + klavye (visualViewport)
   Rezervasyon formunda klavye açıkken görünür alanı kullanır.
   ========================================================= */

(function () {
  "use strict";

  const MODAL_ID = "modal-rez";

  function mobilFormMu() {
    return window.matchMedia("(max-width: 720px)").matches ||
      window.matchMedia("(pointer: coarse)").matches;
  }

  function overlay() {
    return document.getElementById(MODAL_ID);
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

  function viewportTemizle() {
    const el = overlay();
    document.body.classList.remove("klavye-acik");
    if (el) {
      el.style.top = "";
      el.style.left = "";
      el.style.right = "";
      el.style.width = "";
      el.style.height = "";
      el.style.padding = "";
      el.classList.remove("rez-takvim-goster");
    }
  }

  function viewportGuncelle() {
    const el = overlay();
    const vv = window.visualViewport;
    if (!el || !acikMi() || !mobilFormMu() || !vv) {
      if (!acikMi()) viewportTemizle();
      return;
    }

    const klavye = klavyeAcikMi();
    document.body.classList.toggle("klavye-acik", klavye);

    el.style.top = vv.offsetTop + "px";
    el.style.left = "0";
    el.style.right = "0";
    el.style.width = "100%";
    el.style.height = vv.height + "px";
    el.style.padding = "0";
  }

  function alanGorunurYap(hedef) {
    if (!hedef?.closest?.("#" + MODAL_ID)) return;
    const body = hedef.closest(".modal-body");
    if (!body) return;
    const gecikme = mobilFormMu() ? 350 : 80;
    setTimeout(() => {
      viewportGuncelle();
      try {
        hedef.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {
        hedef.scrollIntoView(true);
      }
    }, gecikme);
  }

  function bagla() {
    const el = overlay();
    if (!el) return;

    const vv = window.visualViewport;
    vv?.addEventListener("resize", viewportGuncelle);
    vv?.addEventListener("scroll", viewportGuncelle);
    window.addEventListener("resize", viewportGuncelle);
    window.addEventListener("orientationchange", () => setTimeout(viewportGuncelle, 400));

    document.addEventListener("focusin", (e) => alanGorunurYap(e.target));

    document.getElementById("rez-tarih-aralik-ozet")?.addEventListener("click", () => {
      if (!mobilFormMu()) return;
      overlay()?.classList.toggle("rez-takvim-goster");
      viewportGuncelle();
    });

    new MutationObserver(() => {
      if (!acikMi()) viewportTemizle();
      else viewportGuncelle();
    }).observe(el, { attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bagla);
  } else {
    bagla();
  }

  window.APARTIM.modalKlavye = { viewportGuncelle, viewportTemizle, mobilFormMu };
})();
