/* =========================================================
   APARTIM — Firebase yapılandırması
   ---------------------------------------------------------
   Bu dosyaya kendi Firebase projenizin web app config bilgilerini
   girin. Konfigürasyon eksikse uygulama otomatik olarak "offline"
   moda düşer (yalnızca yerelde localStorage).

   Adımlar:
   1) https://console.firebase.google.com adresinden yeni proje açın
   2) "Web" uygulaması ekleyin, ayardan config'i kopyalayın
   3) Authentication > Google ve E-posta/Şifre sağlayıcılarını açın
   4) Realtime Database'i etkinleştirin
   5) Aşağıdaki APARTIM_CONFIG nesnesine bilgileri yapıştırın
   ========================================================= */

(function () {
  "use strict";

  // ---- KONFİGÜRASYON ----
  const APARTIM_CONFIG = {
    apiKey: "AIzaSyAAUjKNJGmrRLd7xQN9XZde-n2PlDYprv4",
    authDomain: "apartim-app.firebaseapp.com",
    databaseURL: "https://apartim-app-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "apartim-app",
    storageBucket: "apartim-app.firebasestorage.app",
    messagingSenderId: "934154332443",
    appId: "1:934154332443:web:ade10950b1f115d2358bbe"
  };

  const cfgDoluMu = APARTIM_CONFIG.apiKey && APARTIM_CONFIG.projectId && APARTIM_CONFIG.databaseURL;

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.firebaseAktif = !!cfgDoluMu;

  if (cfgDoluMu) {
    try {
      firebase.initializeApp(APARTIM_CONFIG);
      window.APARTIM.fbAuth = firebase.auth();
      window.APARTIM.fbDb = firebase.database();
      // Local persistence
      try {
        window.APARTIM.fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (e) {}
      window.APARTIM.googleProvider = new firebase.auth.GoogleAuthProvider();
    } catch (err) {
      console.warn("Firebase init hatası:", err);
      window.APARTIM.firebaseAktif = false;
    }
  } else {
    console.info("Apartım: Firebase yapılandırması boş, OFFLINE modda çalışıyor (localStorage).");
  }

  // ---- Yerel veri katmanı (Firebase yokken) ----
  // Yalnızca konfigürasyon gelene kadar geçici depolama.
  const YEREL_KEY = "apartim-veri-v1";

  function yerelOku() {
    try {
      const raw = localStorage.getItem(YEREL_KEY);
      return raw ? JSON.parse(raw) : { daireler: {}, rezervasyonlar: {}, temizlikKayit: {}, musteriKaynaklari: {} };
    } catch (e) {
      return { daireler: {}, rezervasyonlar: {}, temizlikKayit: {}, musteriKaynaklari: {} };
    }
  }
  function yerelYaz(veri) {
    try {
      localStorage.setItem(YEREL_KEY, JSON.stringify(veri));
    } catch (e) {}
  }
  window.APARTIM.yerelOku = yerelOku;
  window.APARTIM.yerelYaz = yerelYaz;

  // Bildirim (toast) — global
  window.APARTIM.toast = function (mesaj, tip) {
    const wrap = document.getElementById("toast-wrap");
    if (!wrap) return;
    const t = document.createElement("div");
    t.className = "toast" + (tip ? " " + tip : "");
    t.textContent = mesaj;
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      t.style.transition = "opacity 200ms ease";
      setTimeout(() => t.remove(), 220);
    }, 2400);
  };

  // Senkron durumu göstergesi
  window.APARTIM.syncDurum = function (durum) {
    const el = document.getElementById("sync-durum");
    if (!el) return;
    el.classList.remove("aktif", "beklemede", "hata");
    if (durum === "aktif") el.classList.add("aktif");
    else if (durum === "beklemede") el.classList.add("beklemede");
    else if (durum === "hata") el.classList.add("hata");
  };
})();
