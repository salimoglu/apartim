/* =========================================================
   APARTIM — Kimlik doğrulama
   Lock screen: Google veya kullanıcı adı/şifre giriş + kayıt
   Firebase yoksa offline (yerel) modda da çalışır
   ========================================================= */

(function () {
  "use strict";

  const KULLANICI_EMAIL_DOMAIN = "@users.apartim.app";

  const lockScreen = document.getElementById("lock-screen");
  const app = document.getElementById("app");
  const errorEl = document.getElementById("fb-auth-error");
  const inpKullaniciAdi = document.getElementById("lock-kullanici-adi");
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

  /** Giriş/kayıt için dahili e-posta anahtarı */
  function kullaniciAdiNormalize(ad) {
    return String(ad || "").trim().toLowerCase();
  }

  function kullaniciAdiGecerliMi(norm) {
    return /^[a-z0-9_]{3,24}$/.test(norm);
  }

  function kullaniciAdiToEmail(norm) {
    return norm + KULLANICI_EMAIL_DOMAIN;
  }

  function kullaniciAdiFromEmail(eposta) {
    if (!eposta || !eposta.endsWith(KULLANICI_EMAIL_DOMAIN)) return "";
    return eposta.slice(0, -KULLANICI_EMAIL_DOMAIN.length);
  }

  function firebaseKullaniciBilgi(fbUser) {
    const eposta = fbUser.email || "";
    const dahiliAd = kullaniciAdiFromEmail(eposta);
    const kullaniciAdi = dahiliAd || fbUser.displayName || "";
    return {
      uid: fbUser.uid,
      eposta: dahiliAd ? "" : eposta,
      kullaniciAdi,
      ad: fbUser.displayName || kullaniciAdi || eposta,
      foto: fbUser.photoURL || ""
    };
  }

  function modGuncelle() {
    if (mod === "kayit") {
      baslik.textContent = "Kayıt ol";
      aciklama.textContent = "Kullanıcı adı ve şifre ile hesap oluşturun. Verileriniz buluta güvenli şekilde kaydedilir.";
      btnGiris.classList.add("hidden");
      btnKayit.classList.remove("hidden");
      toggleKayit.classList.add("hidden");
      toggleGiris.classList.remove("hidden");
      inpSifre.autocomplete = "new-password";
    } else {
      baslik.textContent = "Giriş";
      aciklama.textContent = "Google ile tek tık veya kullanıcı adı ile giriş yapın. Verileriniz yalnızca size aittir.";
      btnGiris.classList.remove("hidden");
      btnKayit.classList.add("hidden");
      toggleKayit.classList.remove("hidden");
      toggleGiris.classList.add("hidden");
      inpSifre.autocomplete = "current-password";
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
      "auth/invalid-email": "Geçersiz kullanıcı adı.",
      "auth/user-not-found": "Kullanıcı adı veya şifre hatalı.",
      "auth/wrong-password": "Kullanıcı adı veya şifre hatalı.",
      "auth/invalid-credential": "Kullanıcı adı veya şifre hatalı.",
      "auth/email-already-in-use": "Bu kullanıcı adı zaten alınmış.",
      "auth/weak-password": "Şifre en az 6 karakter olmalı.",
      "auth/popup-closed-by-user": "Google giriş penceresi kapatıldı.",
      "auth/network-request-failed": "İnternet bağlantınızı kontrol edin."
    };
    return map[c] || (err && err.message) || "Bir hata oluştu.";
  }

  function kullaniciAdiDogrula(ham) {
    const gorunen = String(ham || "").trim();
    const norm = kullaniciAdiNormalize(gorunen);
    if (!gorunen || !norm) return { ok: false, mesaj: "Kullanıcı adı gerekli." };
    if (!kullaniciAdiGecerliMi(norm)) {
      return {
        ok: false,
        mesaj: "Kullanıcı adı 3–24 karakter olmalı; yalnızca harf, rakam ve alt çizgi (_) kullanın."
      };
    }
    return { ok: true, gorunen, norm };
  }

  if (window.APARTIM.firebaseAktif) {
    const auth = window.APARTIM.fbAuth;
    const provider = window.APARTIM.googleProvider;

    auth.getRedirectResult().catch(() => {});

    auth.onAuthStateChanged((kullanici) => {
      if (kullanici) {
        window.APARTIM.syncDurum("aktif");
        uygulamaAc(firebaseKullaniciBilgi(kullanici));
      } else {
        window.APARTIM.syncDurum("");
        uygulamaKilitle();
      }
    });

    btnGiris.addEventListener("click", async () => {
      hataGoster("");
      const ad = kullaniciAdiDogrula(inpKullaniciAdi.value);
      const s = inpSifre.value;
      if (!ad.ok) { hataGoster(ad.mesaj); return; }
      if (!s) { hataGoster("Şifre gerekli."); return; }
      try {
        await auth.signInWithEmailAndPassword(kullaniciAdiToEmail(ad.norm), s);
      } catch (err) { hataGoster(firebaseHataMetni(err)); }
    });

    btnKayit.addEventListener("click", async () => {
      hataGoster("");
      const ad = kullaniciAdiDogrula(inpKullaniciAdi.value);
      const s = inpSifre.value;
      if (!ad.ok) { hataGoster(ad.mesaj); return; }
      if (!s) { hataGoster("Şifre gerekli."); return; }
      if (s.length < 6) { hataGoster("Şifre en az 6 karakter olmalı."); return; }
      try {
        const cred = await auth.createUserWithEmailAndPassword(kullaniciAdiToEmail(ad.norm), s);
        await cred.user.updateProfile({ displayName: ad.gorunen });
      } catch (err) { hataGoster(firebaseHataMetni(err)); }
    });

    btnGoogle.addEventListener("click", async () => {
      hataGoster("");
      try {
        await auth.signInWithPopup(provider);
      } catch (err) {
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

    inpKullaniciAdi?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") inpSifre.focus();
    });

    window.APARTIM.cikis = async function () {
      try { await auth.signOut(); }
      catch (e) { console.warn("signOut hatası:", e); }
    };
  } else {
    aciklama.textContent =
      "Firebase yapılandırması henüz girilmedi. Uygulamayı yerel (cihaz) modunda kullanabilirsiniz; sonra ayarlardan bulut hesabını bağlayın.";
    btnGoogle.textContent = "Yerel olarak başla";
    btnGoogle.classList.remove("google");
    btnGoogle.classList.add("primary");
    btnGiris.classList.add("hidden");
    btnKayit.classList.add("hidden");
    toggleKayit.classList.add("hidden");
    toggleGiris.classList.add("hidden");
    inpKullaniciAdi?.classList.add("hidden");
    inpSifre.classList.add("hidden");
    document.querySelector(".lock-auth-veya")?.classList.add("hidden");

    btnGoogle.addEventListener("click", () => {
      const yerelKullanici = {
        uid: "yerel",
        eposta: "",
        kullaniciAdi: "yerel",
        ad: "Yerel Kullanıcı",
        foto: ""
      };
      window.APARTIM.syncDurum("beklemede");
      uygulamaAc(yerelKullanici);
    });

    window.APARTIM.cikis = function () { uygulamaKilitle(); };
  }
})();
