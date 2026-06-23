/* =========================================================
   APARTIM — Tema (dark/light) ve ayar menüsü
   ========================================================= */

(function () {
  "use strict";

  const KEY = "apartim-tema";

  function uygula(acik) {
    document.documentElement.classList.toggle("theme-light", !!acik);
    const moon = document.getElementById("ayar-theme-moon");
    const sun = document.getElementById("ayar-theme-sun");
    if (moon) moon.style.display = acik ? "none" : "block";
    if (sun) sun.style.display = acik ? "block" : "none";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", acik ? "#f5efe1" : "#15202b");
    const metin = document.getElementById("ayar-tema-metin");
    if (metin) metin.textContent = acik ? "Koyu tema" : "Açık tema";
  }

  function topla() {
    let acik = false;
    try { acik = localStorage.getItem(KEY) === "light"; } catch (e) {}
    uygula(acik);
  }

  function degistir() {
    const acik = !document.documentElement.classList.contains("theme-light");
    try { localStorage.setItem(KEY, acik ? "light" : "dark"); } catch (e) {}
    uygula(acik);
  }

  // Ayar menüsü açma/kapama
  function menuBagla() {
    const trig = document.getElementById("ayar-trigger");
    const menu = document.getElementById("ayar-menu");
    if (!trig || !menu) return;
    trig.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && e.target !== trig) {
        menu.classList.add("hidden");
      }
    });
    document.getElementById("ayar-tema")?.addEventListener("click", () => {
      degistir();
      menu.classList.add("hidden");
    });
    document.getElementById("ayar-yenile")?.addEventListener("click", () => {
      location.reload();
    });
    document.getElementById("ayar-cikis")?.addEventListener("click", () => {
      if (window.APARTIM.cikis) window.APARTIM.cikis();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    topla();
    menuBagla();
  });

  // Kullanıcı etiketini auth sonrası doldur
  document.addEventListener("apartim:auth-hazir", (e) => {
    const d = e.detail || {};
    const etiket = d.kullaniciAdi
      ? "@" + d.kullaniciAdi
      : (d.ad || d.eposta || "");
    const epEl = document.getElementById("ayar-email");
    if (epEl) epEl.textContent = etiket;
    const av = document.getElementById("ayar-avatar");
    if (av && e.detail && e.detail.foto) av.src = e.detail.foto;
  });

  window.APARTIM.tema = { uygula, degistir };
})();
