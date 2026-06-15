/* =========================================================
   APARTIM — Kimlik doğrulama
   Lock screen, Google ve e-posta/şifre giriş + kayıt
   Firebase yoksa offline (anonim yerel) modda da çalışır
   ========================================================= */

(function () {
  "use strict";

  const lockScreen = document.getElementById("lock-screen");
  const app = document.getElementById("app");
  const errorEl = document.getElementById("fb-auth-error");
  const inpEmail = document.getElementById("lock-email");
  const inpSifre = document.getElementById("lock-sifre");
  const btnGiris = document.getElementById("lock-btn-giris");
  const btnKayit = document.getElementById("lock-btn-kayit");
  const btnGoogle = document.getElementById("lock-btn-google");
  const toggleKayit = document.getElementById("lock-toggle-kayit");
  const toggleGiris = document.getElementById("lock-toggle-giris");
  const baslik = document.getElementById("lock-auth-baslik");
  const aciklama = document.getElementById("lock-auth-aciklama");

  let mod = "giris"; // "giris" | "kayit"
  let lockAcik = true;

  function hataGoster(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || "";
  }

  function modGuncelle() {
    if (mod === "kayit") {
      baslik.textContent = "Kayıt ol";
      aciklama.textContent = "Yeni bir hesap oluşturun. Verileriniz buluta güvenli şekilde kaydedilir.";
      btnGiris.classList.add("hidden");
      btnKayit.classList.remove("hidden");
      toggleKayit.classList.add("hidden");
      toggleGiris.classList.remove("hidden");
    } else {
      baslik.textContent = "Giriş";
      aciklama.textContent = "Google ile tek tık veya e-posta ile kayıt olun. Verileriniz yalnızca size aittir.";
      btnGiris.classList.remove("hidden");
      btnKayit.classList.add("hidden");
      toggleKayit.classList.remove("hidden");
      toggleGiris.classList.add("hidden");
    }
    hataGoster("");
  }

  toggleKayit?.addEventListener("click", () => { mod = "kayit"; modGuncelle(); });
  toggleGiris?.addEventListener("click", () => { mod = "giris"; modGuncelle(); });

  function uygulamaAc(kullanici) {
    if (!lockAcik) return;
    lockAcik = false;
    lockScreen.classList.add("hidden");
    app.classList.remove("hidden");
    window.APARTIM.kullanici = kullanici;
    document.dispatchEvent(new CustomEvent("apartim:auth-hazir", { detail: kullanici }));
  }

  function uygulamaKilitle() {
    if (lockAcik) return;
    lockAcik = true;
    lockScreen.classList.remove("hidden");
    app.classList.add("hidden");
  }

  function firebaseHataMetni(err) {
    const c = err && err.code ? err.code : "";
    const map = {
      "auth/invalid-email": "Geçersiz e-posta.",
      "auth/user-not-found": "Bu e-posta ile kayıtlı kullanıcı bulunamadı.",
      "auth/wrong-password": "Şifre hatalı.",
      "auth/invalid-credential": "Bilgiler hatalı veya hesap bulunamadı.",
      "auth/email-already-in-use": "Bu e-posta zaten kayıtlı.",
      "auth/weak-password": "Şifre en az 6 karakter olmalı.",
      "auth/popup-closed-by-user": "Google giriş penceresi kapatıldı.",
      "auth/network-request-failed": "İnternet bağlantınızı kontrol edin."
    };
    return map[c] || (err && err.message) || "Bir hata oluştu.";
  }

  if (window.APARTIM.firebaseAktif) {
    const auth = window.APARTIM.fbAuth;
    const provider = window.APARTIM.googleProvider;

    auth.onAuthStateChanged((kullanici) => {
      if (kullanici) {
        window.APARTIM.syncDurum("aktif");
        uygulamaAc({
          uid: kullanici.uid,
          eposta: kullanici.email || "",
          ad: kullanici.displayName || "",
          foto: kullanici.photoURL || ""
        });
      } else {
        window.APARTIM.syncDurum("");
        uygulamaKilitle();
      }
    });

    btnGiris.addEventListener("click", async () => {
      hataGoster("");
      const e = inpEmail.value.trim();
      const s = inpSifre.value;
      if (!e || !s) { hataGoster("E-posta ve şifre gerekli."); return; }
      try {
        await auth.signInWithEmailAndPassword(e, s);
      } catch (err) { hataGoster(firebaseHataMetni(err)); }
    });

    btnKayit.addEventListener("click", async () => {
      hataGoster("");
      const e = inpEmail.value.trim();
      const s = inpSifre.value;
      if (!e || !s) { hataGoster("E-posta ve şifre gerekli."); return; }
      if (s.length < 6) { hataGoster("Şifre en az 6 karakter olmalı."); return; }
      try {
        await auth.createUserWithEmailAndPassword(e, s);
      } catch (err) { hataGoster(firebaseHataMetni(err)); }
    });

    btnGoogle.addEventListener("click", async () => {
      hataGoster("");
      try {
        await auth.signInWithPopup(provider);
      } catch (err) {
        // Mobil tarayıcılarda popup engellenebilir, redirect dene
        if (err && err.code === "auth/popup-blocked") {
          try { await auth.signInWithRedirect(provider); return; } catch (_) {}
        }
        hataGoster(firebaseHataMetni(err));
      }
    });

    inpSifre.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        (mod === "kayit" ? btnKayit : btnGiris).click();
      }
    });

    window.APARTIM.cikis = async function () {
      try { await auth.signOut(); }
      catch (e) { console.warn("signOut hatası:", e); }
    };
  } else {
    // ---- OFFLINE / yerel mod ----
    // Firebase yapılandırılmadan da uygulama denenebilsin diye
    // tek tıkla "yerel kullanıcı" ile giriş yapılıyor.
    aciklama.textContent =
      "Firebase yapılandırması henüz girilmedi. Uygulamayı yerel (cihaz) modunda kullanabilirsiniz; sonra ayarlardan bulut hesabını bağlayın.";
    btnGoogle.textContent = "Yerel olarak başla";
    btnGoogle.classList.remove("google");
    btnGoogle.classList.add("primary");
    btnGiris.classList.add("hidden");
    btnKayit.classList.add("hidden");
    toggleKayit.classList.add("hidden");
    toggleGiris.classList.add("hidden");
    inpEmail.classList.add("hidden");
    inpSifre.classList.add("hidden");
    document.querySelector(".lock-auth-veya")?.classList.add("hidden");

    btnGoogle.addEventListener("click", () => {
      const yerelKullanici = { uid: "yerel", eposta: "yerel@apartim", ad: "Yerel Kullanıcı", foto: "" };
      window.APARTIM.syncDurum("beklemede");
      uygulamaAc(yerelKullanici);
    });

    window.APARTIM.cikis = function () { uygulamaKilitle(); };
  }
})();
