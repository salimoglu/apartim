/* =========================================================
   APARTIM — Kimlik doğrulama
   Lock screen: Google veya kullanıcı adı/şifre giriş + kayıt
   Firebase yoksa offline (yerel) modda da çalışır
   ========================================================= */

(function () {
  "use strict";

  const KULLANICI_EMAIL_DOMAIN = "@users.apartim.app";
  const OTURUM_KEY = "apartim-oturum";

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
  let authIlkCozum = false;
  let authHazirGonderildi = false;

  function hataGoster(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || "";
  }

  function oturumIsaretle(varMi) {
    try {
      if (varMi) localStorage.setItem(OTURUM_KEY, "1");
      else localStorage.removeItem(OTURUM_KEY);
    } catch (e) { /* yoksay */ }
  }

  function oturumBeklemeBitir() {
    document.documentElement.classList.remove("auth-oturum-bekleniyor");
  }

  /** Türkçe karakterli görünen ad + Firebase için ASCII anahtar */
  function turkceKucult(ad) {
    return String(ad || "").trim().toLocaleLowerCase("tr-TR");
  }

  function kullaniciAdiAnahtar(ad) {
    return turkceKucult(ad)
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9_]/g, "");
  }

  const KULLANICI_ADI_RE = /^[a-zA-Z0-9_ğüşıöçĞÜŞİÖÇ]{3,24}$/;

  function kullaniciAdiGecerliMi(gorunen, anahtar) {
    return KULLANICI_ADI_RE.test(gorunen) && /^[a-z0-9_]{3,24}$/.test(anahtar);
  }

  function kullaniciAdiToEmail(anahtar) {
    return anahtar + KULLANICI_EMAIL_DOMAIN;
  }

  function kullaniciAdiFromEmail(eposta) {
    if (!eposta || !eposta.endsWith(KULLANICI_EMAIL_DOMAIN)) return "";
    return eposta.slice(0, -KULLANICI_EMAIL_DOMAIN.length);
  }

  function firebaseKullaniciBilgi(fbUser) {
    const eposta = fbUser.email || "";
    const dahiliMi = eposta.endsWith(KULLANICI_EMAIL_DOMAIN);
    const kullaniciAdi = dahiliMi
      ? (fbUser.displayName || kullaniciAdiFromEmail(eposta))
      : (fbUser.displayName || "");
    const googleFoto = !dahiliMi && fbUser.photoURL ? fbUser.photoURL : "";
    return {
      uid: fbUser.uid,
      eposta: dahiliMi ? "" : eposta,
      kullaniciAdi,
      ad: fbUser.displayName || kullaniciAdi || eposta,
      googleFoto,
      avatarId: dahiliMi ? (window.APARTIM.avatar?.VARSAYILAN || "ev") : null
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
    oturumBeklemeBitir();
    oturumIsaretle(true);
    const k = window.APARTIM.avatar
      ? window.APARTIM.avatar.kullaniciyaEkle(kullanici)
      : kullanici;
    window.APARTIM.kullanici = k;
    if (lockAcik) {
      lockAcik = false;
      lockScreen.classList.add("hidden");
      app.classList.remove("hidden");
    }
    /* db/app dinleyicileri yüklenmeden önce gelirse bile bir kez yayınla;
       erken yayın kaybolursa sonraki onAuthStateChanged tekrar dener */
    if (!authHazirGonderildi) {
      authHazirGonderildi = true;
      document.dispatchEvent(new CustomEvent("apartim:auth-hazir", { detail: k }));
    }
  }

  function uygulamaKilitle() {
    oturumBeklemeBitir();
    oturumIsaretle(false);
    authHazirGonderildi = false;
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
    const anahtar = kullaniciAdiAnahtar(gorunen);
    if (!gorunen) return { ok: false, mesaj: "Kullanıcı adı gerekli." };
    if (!kullaniciAdiGecerliMi(gorunen, anahtar)) {
      return {
        ok: false,
        mesaj: "Kullanıcı adı 3–24 karakter olmalı; harf (ğ, ü, ş, ı, ö, ç dahil), rakam ve alt çizgi (_) kullanılabilir."
      };
    }
    return { ok: true, gorunen, anahtar };
  }

  if (window.APARTIM.firebaseAktif) {
    const auth = window.APARTIM.fbAuth;
    const provider = window.APARTIM.googleProvider;

    auth.getRedirectResult().catch(() => {});

    const oturumAc = (kullanici) => {
      window.APARTIM.syncDurum("aktif");
      uygulamaAc(firebaseKullaniciBilgi(kullanici));
    };

    auth.onAuthStateChanged((kullanici) => {
      authIlkCozum = true;
      if (kullanici) {
        oturumAc(kullanici);
        return;
      }
      window.APARTIM.syncDurum("");
      uygulamaKilitle();
    });

    /* Persistence hazırsa kilidi hemen aç; db.js APARTIM.kullanici ile bağlanır */
    if (auth.currentUser) {
      authIlkCozum = true;
      oturumAc(auth.currentUser);
    }

    /* Splash takılırsa giriş formunu geri getir */
    setTimeout(() => {
      if (!authIlkCozum) {
        oturumBeklemeBitir();
      }
    }, 3000);

    btnGiris.addEventListener("click", async () => {
      hataGoster("");
      const ad = kullaniciAdiDogrula(inpKullaniciAdi.value);
      const s = inpSifre.value;
      if (!ad.ok) { hataGoster(ad.mesaj); return; }
      if (!s) { hataGoster("Şifre gerekli."); return; }
      try {
        await auth.signInWithEmailAndPassword(kullaniciAdiToEmail(ad.anahtar), s);
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
        const cred = await auth.createUserWithEmailAndPassword(kullaniciAdiToEmail(ad.anahtar), s);
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
      oturumIsaretle(false);
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

    let yerelOturumVar = false;
    try { yerelOturumVar = localStorage.getItem(OTURUM_KEY) === "1"; } catch (e) {}
    const yerelBaslat = () => {
      authIlkCozum = true;
      const yerelKullanici = {
        uid: "yerel",
        eposta: "",
        kullaniciAdi: "yerel",
        ad: "Yerel Kullanıcı",
        googleFoto: "",
        avatarId: window.APARTIM.avatar?.VARSAYILAN || "ev"
      };
      window.APARTIM.syncDurum("beklemede");
      uygulamaAc(yerelKullanici);
    };
    /* db.js dinleyicilerinden sonra aç — auth.js parse anında çağırma */
    if (yerelOturumVar) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", yerelBaslat, { once: true });
      } else {
        setTimeout(yerelBaslat, 0);
      }
    }

    btnGoogle.addEventListener("click", yerelBaslat);

    window.APARTIM.cikis = function () { uygulamaKilitle(); };
  }
})();
