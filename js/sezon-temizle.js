/* =========================================================
   APARTIM — Sezon verisi temizleme (şifre + 5 sn uyarı)
   ========================================================= */

(function () {
  "use strict";

  let sayacTimer = null;
  let sayacKalan = 0;

  function toast(msg, tip) {
    window.APARTIM.toast?.(msg, tip || "bilgi");
  }

  function modal() {
    return document.getElementById("modal-sezon-temizle");
  }

  function yil() {
    return window.APARTIM.gorunum?.seciliYil?.() || new Date().getFullYear();
  }

  function sezonAralik(y) {
    if (window.APARTIM.gorunum?.sezonBasBit) {
      return window.APARTIM.gorunum.sezonBasBit(y);
    }
    const pad = (n) => String(n).padStart(2, "0");
    return {
      bas: y + "-06-01",
      bit: y + "-09-30",
      bitHaric: y + "-10-01"
    };
  }

  function sezonRezervasyonlari(y) {
    const db = window.APARTIM.db;
    if (!db?.durum?.rezervasyonlar) return [];
    const { bas, bitHaric } = sezonAralik(y);
    return Object.values(db.durum.rezervasyonlar).filter((r) =>
      r && r.giris && r.cikis && r.giris < bitHaric && r.cikis > bas
    );
  }

  function sifreProviderVarMi() {
    const user = window.APARTIM.fbAuth?.currentUser;
    if (!user) return false;
    return (user.providerData || []).some((p) => p.providerId === "password");
  }

  function googleProviderVarMi() {
    const user = window.APARTIM.fbAuth?.currentUser;
    if (!user) return false;
    return (user.providerData || []).some((p) => p.providerId === "google.com");
  }

  async function sifreDogrula(sifre) {
    if (!window.APARTIM.firebaseAktif || !window.APARTIM.fbAuth?.currentUser) {
      /* Yerel mod: sezon yılını yazarak onay */
      if (String(sifre).trim() !== String(yil())) {
        throw new Error("Onay için sezon yılını (" + yil() + ") yazın.");
      }
      return true;
    }

    const user = window.APARTIM.fbAuth.currentUser;
    if (!sifreProviderVarMi()) {
      throw new Error("GOOGLE");
    }
    if (!sifre) throw new Error("Şifre gerekli.");

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

  function adimGoster(adim) {
    document.querySelectorAll("[data-temizle-adim]").forEach((el) => {
      el.classList.toggle("hidden", el.getAttribute("data-temizle-adim") !== adim);
    });
  }

  function sayacDurdur() {
    if (sayacTimer) {
      clearInterval(sayacTimer);
      sayacTimer = null;
    }
    sayacKalan = 0;
  }

  function modalKapat() {
    sayacDurdur();
    modal()?.classList.add("hidden");
    const inp = document.getElementById("sezon-temizle-sifre");
    if (inp) inp.value = "";
    const hata = document.getElementById("sezon-temizle-hata");
    if (hata) hata.textContent = "";
    adimGoster("sifre");
    window.APARTIM.app?.modalAcikGuncelle?.();
  }

  function modalAc() {
    const db = window.APARTIM.db;
    if (!db?.durum?.yuklendi) {
      toast("Veriler henüz yüklenmedi", "uyari");
      return;
    }
    const y = yil();
    const liste = sezonRezervasyonlari(y);
    const yilEl = document.getElementById("sezon-temizle-yil");
    const adetEl = document.getElementById("sezon-temizle-adet");
    if (yilEl) yilEl.textContent = String(y);
    if (adetEl) adetEl.textContent = String(liste.length);

    const sifreWrap = document.getElementById("sezon-temizle-sifre-wrap");
    const googleBtn = document.getElementById("sezon-temizle-google");
    const yerelNot = document.getElementById("sezon-temizle-yerel-not");
    const fb = !!window.APARTIM.firebaseAktif && !!window.APARTIM.fbAuth?.currentUser;

    if (!fb) {
      sifreWrap?.classList.remove("hidden");
      googleBtn?.classList.add("hidden");
      if (yerelNot) {
        yerelNot.classList.remove("hidden");
        yerelNot.textContent = "Yerel mod: onay için sezon yılını yazın (" + y + ").";
      }
      const lbl = document.querySelector('label[for="sezon-temizle-sifre"]');
      if (lbl) lbl.textContent = "Sezon yılı (" + y + ")";
      const inp = document.getElementById("sezon-temizle-sifre");
      if (inp) {
        inp.type = "text";
        inp.placeholder = String(y);
        inp.autocomplete = "off";
      }
    } else if (sifreProviderVarMi()) {
      sifreWrap?.classList.remove("hidden");
      googleBtn?.classList.add("hidden");
      yerelNot?.classList.add("hidden");
      const lbl = document.querySelector('label[for="sezon-temizle-sifre"]');
      if (lbl) lbl.textContent = "Hesap şifreniz";
      const inp = document.getElementById("sezon-temizle-sifre");
      if (inp) {
        inp.type = "password";
        inp.placeholder = "Şifre";
        inp.autocomplete = "current-password";
      }
    } else {
      sifreWrap?.classList.add("hidden");
      googleBtn?.classList.toggle("hidden", !googleProviderVarMi());
      yerelNot?.classList.add("hidden");
    }

    adimGoster("sifre");
    modal()?.classList.remove("hidden");
    window.APARTIM.app?.modalAcikGuncelle?.();
    setTimeout(() => document.getElementById("sezon-temizle-sifre")?.focus(), 80);
  }

  function geriSayimBaslat() {
    adimGoster("uyari");
    sayacDurdur();
    sayacKalan = 5;
    const sayacEl = document.getElementById("sezon-temizle-sayac");
    const y = yil();
    const adet = sezonRezervasyonlari(y).length;
    const metin = document.getElementById("sezon-temizle-uyari-metin");
    if (metin) {
      metin.textContent =
        y + " sezonundaki " + adet +
        " rezervasyon kalıcı olarak silinecek. Bu işlem geri alınamaz.";
    }
    const yaz = () => {
      if (sayacEl) sayacEl.textContent = String(sayacKalan);
    };
    yaz();
    sayacTimer = setInterval(async () => {
      sayacKalan -= 1;
      yaz();
      if (sayacKalan <= 0) {
        sayacDurdur();
        await temizleUygula();
      }
    }, 1000);
  }

  async function temizleUygula() {
    adimGoster("islem");
    const db = window.APARTIM.db;
    const y = yil();
    const liste = sezonRezervasyonlari(y);
    let ok = 0;
    let hata = 0;
    for (const r of liste) {
      try {
        await db.rezervasyonSil(r.id);
        ok++;
      } catch (e) {
        hata++;
        console.error("sezonTemizle", r.id, e);
      }
    }
    document.dispatchEvent(new CustomEvent("apartim:veri-degisti"));
    window.APARTIM.rezOzet?.tabloCizPlanla?.();
    modalKapat();
    if (hata) toast(ok + " silindi, " + hata + " hata", "uyari");
    else toast(y + " sezonu temizlendi (" + ok + " rezervasyon)", "basari");
  }

  async function devamTik() {
    const hataEl = document.getElementById("sezon-temizle-hata");
    if (hataEl) hataEl.textContent = "";
    const btn = document.getElementById("sezon-temizle-devam");
    if (btn) btn.disabled = true;
    try {
      const sifre = document.getElementById("sezon-temizle-sifre")?.value || "";
      if (window.APARTIM.firebaseAktif && window.APARTIM.fbAuth?.currentUser && !sifreProviderVarMi()) {
        await googleDogrula();
      } else {
        await sifreDogrula(sifre);
      }
      geriSayimBaslat();
    } catch (err) {
      if (err.message === "GOOGLE") {
        try {
          await googleDogrula();
          geriSayimBaslat();
        } catch (e2) {
          if (hataEl) hataEl.textContent = e2.message || "Doğrulama başarısız";
        }
      } else if (hataEl) {
        hataEl.textContent = err.message || "Doğrulama başarısız";
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    document.getElementById("rez-ozet-sezon-temizle")?.addEventListener("click", modalAc);
    document.getElementById("sezon-temizle-close")?.addEventListener("click", modalKapat);
    document.getElementById("sezon-temizle-iptal")?.addEventListener("click", modalKapat);
    document.getElementById("sezon-temizle-iptal-2")?.addEventListener("click", modalKapat);
    document.getElementById("sezon-temizle-devam")?.addEventListener("click", devamTik);
    document.getElementById("sezon-temizle-google")?.addEventListener("click", async () => {
      const hataEl = document.getElementById("sezon-temizle-hata");
      if (hataEl) hataEl.textContent = "";
      try {
        await googleDogrula();
        geriSayimBaslat();
      } catch (err) {
        if (hataEl) hataEl.textContent = err.message || "Doğrulama başarısız";
      }
    });
    document.getElementById("sezon-temizle-sifre")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") devamTik();
    });
    modal()?.addEventListener("click", (e) => {
      if (e.target.id === "modal-sezon-temizle") modalKapat();
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.sezonTemizle = { modalAc, modalKapat, sezonRezervasyonlari };
})();
