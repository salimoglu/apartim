/* =========================================================
   APARTIM — Hassas işlemler için kimlik doğrulama
   ========================================================= */

(function () {
  "use strict";

  let bekleyen = null;
  let yerelAnahtar = "SIL";

  function modal() {
    return document.getElementById("modal-kimlik-dogrula");
  }

  function sifreVarMi() {
    const user = window.APARTIM.fbAuth?.currentUser;
    if (!user) return false;
    return (user.providerData || []).some((p) => p.providerId === "password");
  }

  function googleVarMi() {
    const user = window.APARTIM.fbAuth?.currentUser;
    if (!user) return false;
    return (user.providerData || []).some((p) => p.providerId === "google.com");
  }

  async function sifreDogrula(sifre, anahtar) {
    if (!window.APARTIM.firebaseAktif || !window.APARTIM.fbAuth?.currentUser) {
      const beklenen = String(anahtar || "SIL").trim();
      if (String(sifre || "").trim() !== beklenen) {
        throw new Error("Onay için \"" + beklenen + "\" yazın.");
      }
      return true;
    }
    if (!sifreVarMi()) throw new Error("GOOGLE");
    if (!sifre) throw new Error("Şifre gerekli.");
    const user = window.APARTIM.fbAuth.currentUser;
    const email = user.email;
    if (!email) throw new Error("Hesap e-postası bulunamadı.");
    const cred = firebase.auth.EmailAuthProvider.credential(email, sifre);
    try {
      await user.reauthenticateWithCredential(cred);
      return true;
    } catch (err) {
      const c = err && err.code ? err.code : "";
      if (c === "auth/wrong-password" || c === "auth/invalid-credential") {
        throw new Error("Şifre hatalı.");
      }
      if (c === "auth/too-many-requests") {
        throw new Error("Çok fazla deneme. Bir süre sonra tekrar deneyin.");
      }
      throw new Error(err.message || "Doğrulama başarısız.");
    }
  }

  async function googleDogrula() {
    const auth = window.APARTIM.fbAuth;
    const user = auth?.currentUser;
    if (!user || !window.APARTIM.googleProvider) {
      throw new Error("Google doğrulama kullanılamıyor.");
    }
    try {
      await user.reauthenticateWithPopup(window.APARTIM.googleProvider);
      return true;
    } catch (err) {
      if (err && err.code === "auth/popup-closed-by-user") {
        throw new Error("Google doğrulama iptal edildi.");
      }
      throw new Error(err.message || "Google doğrulama başarısız.");
    }
  }

  function kapat(sonuc) {
    modal()?.classList.add("hidden");
    const inp = document.getElementById("kimlik-sifre");
    if (inp) inp.value = "";
    const hata = document.getElementById("kimlik-hata");
    if (hata) hata.textContent = "";
    window.APARTIM.app?.modalAcikGuncelle?.();
    if (bekleyen) {
      const r = bekleyen;
      bekleyen = null;
      r(!!sonuc);
    }
  }

  function iste(secenek) {
    const opts = secenek || {};
    return new Promise((resolve) => {
      if (bekleyen) {
        resolve(false);
        return;
      }
      bekleyen = resolve;
      yerelAnahtar = String(opts.yerelAnahtar || "SIL");

      const baslik = document.getElementById("kimlik-title");
      const aciklama = document.getElementById("kimlik-aciklama");
      const yerelNot = document.getElementById("kimlik-yerel-not");
      const sifreWrap = document.getElementById("kimlik-sifre-wrap");
      const googleBtn = document.getElementById("kimlik-google");
      const lbl = document.querySelector('label[for="kimlik-sifre"]');
      const inp = document.getElementById("kimlik-sifre");
      const hata = document.getElementById("kimlik-hata");
      const onay = document.getElementById("kimlik-onay");

      if (baslik) baslik.textContent = opts.baslik || "Kimlik doğrulama";
      if (aciklama) aciklama.textContent = opts.aciklama || "Devam etmek için doğrulayın.";
      if (hata) hata.textContent = "";
      if (onay) {
        onay.textContent = opts.onayMetin || "Onayla";
        onay.classList.toggle("btn-danger", opts.tehlike !== false);
        onay.classList.toggle("btn-primary", opts.tehlike === false);
      }

      const fb = !!window.APARTIM.firebaseAktif && !!window.APARTIM.fbAuth?.currentUser;

      if (!fb) {
        sifreWrap?.classList.remove("hidden");
        googleBtn?.classList.add("hidden");
        if (yerelNot) {
          yerelNot.classList.remove("hidden");
          yerelNot.textContent = "Yerel mod: onay için \"" + yerelAnahtar + "\" yazın.";
        }
        if (lbl) lbl.textContent = "Onay metni";
        if (inp) {
          inp.type = "text";
          inp.placeholder = yerelAnahtar;
          inp.autocomplete = "off";
        }
      } else if (sifreVarMi()) {
        sifreWrap?.classList.remove("hidden");
        googleBtn?.classList.add("hidden");
        yerelNot?.classList.add("hidden");
        if (lbl) lbl.textContent = "Hesap şifreniz";
        if (inp) {
          inp.type = "password";
          inp.placeholder = "Şifre";
          inp.autocomplete = "current-password";
        }
      } else {
        sifreWrap?.classList.add("hidden");
        googleBtn?.classList.toggle("hidden", !googleVarMi());
        yerelNot?.classList.add("hidden");
      }

      modal()?.classList.remove("hidden");
      window.APARTIM.app?.modalAcikGuncelle?.();
      setTimeout(() => inp?.focus(), 80);
    });
  }

  async function onayTik() {
    const hata = document.getElementById("kimlik-hata");
    const btn = document.getElementById("kimlik-onay");
    if (hata) hata.textContent = "";
    if (btn) btn.disabled = true;
    try {
      const sifre = document.getElementById("kimlik-sifre")?.value || "";
      if (window.APARTIM.firebaseAktif && window.APARTIM.fbAuth?.currentUser && !sifreVarMi()) {
        await googleDogrula();
      } else {
        await sifreDogrula(sifre, yerelAnahtar);
      }
      kapat(true);
    } catch (err) {
      if (err.message === "GOOGLE") {
        try {
          await googleDogrula();
          kapat(true);
        } catch (e2) {
          if (hata) hata.textContent = e2.message || "Doğrulama başarısız";
        }
      } else if (hata) {
        hata.textContent = err.message || "Doğrulama başarısız";
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    document.getElementById("kimlik-close")?.addEventListener("click", () => kapat(false));
    document.getElementById("kimlik-iptal")?.addEventListener("click", () => kapat(false));
    document.getElementById("kimlik-onay")?.addEventListener("click", onayTik);
    document.getElementById("kimlik-google")?.addEventListener("click", async () => {
      const hata = document.getElementById("kimlik-hata");
      if (hata) hata.textContent = "";
      try {
        await googleDogrula();
        kapat(true);
      } catch (err) {
        if (hata) hata.textContent = err.message || "Doğrulama başarısız";
      }
    });
    document.getElementById("kimlik-sifre")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onayTik();
    });
    modal()?.addEventListener("click", (e) => {
      if (e.target.id === "modal-kimlik-dogrula") kapat(false);
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.kimlik = {
    iste,
    sifreDogrula,
    googleDogrula,
    sifreVarMi,
    googleVarMi
  };
})();
