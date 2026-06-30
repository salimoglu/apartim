/* =========================================================
   APARTIM — Mobil rezervasyon modal klavye sınıfı
   Inline viewport müdahalesi yok — tıklama sorunlarına yol açıyordu.
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
    document.body.classList.remove("klavye-acik");
    overlay()?.classList.remove("rez-takvim-goster");
  }

  function viewportGuncelle() {
    if (!acikMi()) {
      viewportTemizle();
      return;
    }
    if (mobilFormMu()) {
      document.body.classList.toggle("klavye-acik", klavyeAcikMi());
    }
  }

  function bagla() {
    const el = overlay();
    if (!el) return;

    const vv = window.visualViewport;
    vv?.addEventListener("resize", viewportGuncelle);
    window.addEventListener("resize", viewportGuncelle);
    window.addEventListener("orientationchange", () => setTimeout(viewportGuncelle, 300));

    document.getElementById("rez-tarih-aralik-ozet")?.addEventListener("click", () => {
      if (!mobilFormMu()) return;
      overlay()?.classList.toggle("rez-takvim-goster");
    });

    new MutationObserver(() => viewportGuncelle()).observe(el, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bagla);
  } else {
    bagla();
  }

  window.APARTIM.modalKlavye = { viewportGuncelle, viewportTemizle, mobilFormMu };
})();
