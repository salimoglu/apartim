/* =========================================================
   APARTIM — PWA yükleme banner'ı
   beforeinstallprompt (Android/Chrome) + iOS yönergeleri
   ========================================================= */

(function () {
  "use strict";

  const DISMISS_KEY = "apartim-pwa-dismiss";
  const DISMISS_GUN = 5;

  let deferredPrompt = null;
  let bannerAcik = false;

  function zatenYuklu() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true;
  }

  function iosMu() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function mobilMi() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);
  }

  function dismissEdildiMi() {
    try {
      const t = Number(localStorage.getItem(DISMISS_KEY));
      if (!t) return false;
      return (Date.now() - t) < DISMISS_GUN * 86400000;
    } catch (e) {
      return false;
    }
  }

  function dismissKaydet() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
  }

  function bar() { return document.getElementById("pwa-install-bar"); }

  function bannerGizle() {
    bar()?.classList.add("hidden");
    bannerAcik = false;
  }

  function bannerGoster(tip) {
    if (zatenYuklu() || dismissEdildiMi() || bannerAcik) return;
    const el = bar();
    if (!el) return;

    const aciklama = document.getElementById("pwa-install-aciklama");
    const yukleBtn = document.getElementById("pwa-install-yukle");

    if (tip === "ios") {
      if (aciklama) {
        aciklama.textContent = "Safari'de Paylaş (□↑) → Ana Ekrana Ekle";
      }
      if (yukleBtn) {
        yukleBtn.textContent = "Tamam";
        yukleBtn.classList.add("pwa-install-ios-btn");
      }
    } else {
      if (aciklama) aciklama.textContent = "Ana ekrana ekleyin, çevrimdışı da çalışır";
      if (yukleBtn) {
        yukleBtn.textContent = "Yükle";
        yukleBtn.classList.remove("pwa-install-ios-btn");
      }
    }

    el.classList.remove("hidden");
    bannerAcik = true;
    document.getElementById("install-btn")?.classList.remove("hidden");
  }

  function bannerDene() {
    if (zatenYuklu() || dismissEdildiMi()) return;
    if (deferredPrompt) {
      bannerGoster("chrome");
    } else if (iosMu() && mobilMi()) {
      bannerGoster("ios");
    }
  }

  async function yukleTikla() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch (e) {}
      deferredPrompt = null;
      bannerGizle();
      document.getElementById("install-btn")?.classList.add("hidden");
      return;
    }
    if (iosMu()) {
      bannerGizle();
      window.APARTIM?.toast?.("Safari'de alttaki Paylaş → Ana Ekrana Ekle", "bilgi");
    }
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(bannerDene, 400);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    bannerGizle();
    document.getElementById("install-btn")?.classList.add("hidden");
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("pwa-install-yukle")?.addEventListener("click", yukleTikla);
    document.getElementById("pwa-install-kapat")?.addEventListener("click", () => {
      dismissKaydet();
      bannerGizle();
    });
    document.getElementById("install-btn")?.addEventListener("click", yukleTikla);

    if ("serviceWorker" in navigator) {
      const swKayit = () => {
        const swV = window.APARTIM_VERSION?.ASSET || Date.now();
        navigator.serviceWorker.register("./sw.js?v=" + swV).catch((err) => {
          console.warn("SW kayıt hatası:", err);
        });
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(swKayit, { timeout: 5000 });
      } else {
        window.addEventListener("load", () => setTimeout(swKayit, 800), { once: true });
      }
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!window.APARTIM_SW_RELOAD) return;
        window.APARTIM_SW_RELOAD = false;
        location.reload();
      });
    }

    setTimeout(bannerDene, 1200);
  });

  document.addEventListener("apartim:auth-hazir", () => {
    setTimeout(bannerDene, 600);
  });

  window.APARTIM.pwaInstall = {
    bannerDene,
    bannerGizle,
    yukle: yukleTikla,
    zatenYuklu
  };
})();
