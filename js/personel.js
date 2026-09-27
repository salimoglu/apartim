/* =========================================================
   APARTIM — Personeller
   Otel sahibi kullanıcı adı ve şifre oluşturur, görebileceği
   modülleri seçer. Giriş bilgisini yalnızca otel sahibi değiştirir.
   ========================================================= */

(function () {
  "use strict";

  const AUTH_OLUSTUR = "apartim-personel-olustur";
  const AUTH_GUNCELLE = "apartim-personel-guncelle";

  let otelId = "";
  let uyelerRef = null;
  let girisRef = null;
  let uyeler = {};
  let girisler = {};
  let seciliUid = "";
  let ekleniyor = false;
  let kaydediyor = false;
  let zorlaCiz = false;
  const sifreSor = {};

  function toast(msg, tur) {
    window.APARTIM.toast?.(msg, tur || "bilgi");
  }

  function sahipMi() {
    return window.APARTIM.yetki?.model?.() === "otel" && window.APARTIM.yetki?.sahipMi?.();
  }

  function dinlemeyiKaldir() {
    try { uyelerRef?.off(); } catch (e) {}
    try { girisRef?.off(); } catch (e) {}
    uyelerRef = null;
    girisRef = null;
    otelId = "";
    uyeler = {};
    girisler = {};
    seciliUid = "";
  }

  function bagla(yeniOtelId) {
    if (!window.APARTIM.firebaseAktif || !window.APARTIM.fbDb) return;
    if (!sahipMi() || !yeniOtelId) {
      dinlemeyiKaldir();
      return;
    }
    if (otelId === yeniOtelId && uyelerRef) return;
    dinlemeyiKaldir();
    otelId = yeniOtelId;
    uyelerRef = window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler");
    uyelerRef.on("value", (snap) => {
      uyeler = snap.val() || {};
      if (seciliUid && !uyeler[seciliUid]) seciliUid = "";
      ciz();
    });
    girisRef = window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/giris");
    girisRef.on("value", (snap) => {
      girisler = snap.val() || {};
      ciz();
    }, () => {
      girisler = {};
      ciz();
    });
  }

  function modal() {
    return document.getElementById("modal-personel");
  }

  function ac() {
    if (!sahipMi()) return;
    modal()?.classList.remove("hidden");
    window.APARTIM.app?.modalAcikGuncelle?.();
    ciz();
  }

  function kapat() {
    modal()?.classList.add("hidden");
    window.APARTIM.app?.modalAcikGuncelle?.();
  }

  function el(etiket, sinif, metin) {
    const n = document.createElement(etiket);
    if (sinif) n.className = sinif;
    if (metin != null) n.textContent = metin;
    return n;
  }

  function modulKutulari(hedef, secili) {
    window.APARTIM.yetki.GOREBILIR.forEach((t) => {
      const lbl = el("label", "yetki-satir");
      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.dataset.modul = t.id;
      inp.checked = !!(secili && secili[t.id]);
      lbl.appendChild(inp);
      lbl.appendChild(document.createTextNode(t.etiket));
      hedef.appendChild(lbl);
    });
  }

  function modulleriOku(kapsam) {
    const secim = {};
    kapsam.querySelectorAll("input[type=checkbox][data-modul]").forEach((inp) => {
      secim[inp.dataset.modul] = !!inp.checked;
    });
    return window.APARTIM.yetki.modullerdenYap(secim);
  }

  function dbHata(err, yedek) {
    const ham = String((err && (err.message || err.code)) || "");
    if (/PERMISSION_DENIED|permission_denied/i.test(ham)) {
      return "Kayıt sunucuda reddedildi. Personel ayrımı henüz açık olmayabilir.";
    }
    return (err && err.message) || yedek;
  }

  function sakliSifre(uid) {
    const kayit = girisler[uid];
    const s = kayit && typeof kayit.sifre === "string" ? kayit.sifre : "";
    return s.length >= 6 ? s : "";
  }

  async function ikincilAuth(ad) {
    let app;
    try {
      app = firebase.app(ad);
    } catch (e) {
      app = firebase.initializeApp(firebase.app().options, ad);
    }
    const auth2 = firebase.auth(app);
    try {
      await auth2.setPersistence(firebase.auth.Auth.Persistence.NONE);
    } catch (e) {}
    return auth2;
  }

  async function personelOlustur(form) {
    if (ekleniyor || !sahipMi() || !otelId) return;
    const adArac = window.APARTIM.kullaniciAdi;
    if (!adArac) {
      toast("Kullanıcı adı kontrolü hazır değil", "hata");
      return;
    }
    const ad = adArac.dogrula(form.querySelector("[data-alan=ad]")?.value);
    const sifre = String(form.querySelector("[data-alan=sifre]")?.value || "");
    if (!ad.ok) { toast(ad.mesaj, "hata"); return; }
    if (sifre.length < 6) { toast("Şifre en az 6 karakter olmalı.", "hata"); return; }
    const bayrak = modulleriOku(form);
    if (!Object.keys(bayrak.gorebilir).some((k) => bayrak.gorebilir[k])) {
      toast("En az bir modül seçin.", "hata");
      return;
    }
    ekleniyor = true;
    const btn = form.querySelector("[data-alan=ekle]");
    if (btn) btn.disabled = true;
    const auth2 = await ikincilAuth(AUTH_OLUSTUR);
    let uid = "";
    let yenile = false;
    try {
      const cred = await auth2.createUserWithEmailAndPassword(adArac.email(ad.anahtar), sifre);
      uid = cred.user.uid;
      await cred.user.updateProfile({ displayName: ad.gorunen });
      await auth2.signOut();
      const kayit = {
        rol: "personel",
        ad: ad.gorunen,
        kullaniciAdi: ad.gorunen,
        gorebilir: bayrak.gorebilir,
        yapabilir: bayrak.yapabilir
      };
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler/" + uid).set(kayit);
      await window.APARTIM.fbDb.ref("apartim/uyelik/" + uid).set(otelId);
      form.querySelector("[data-alan=ad]").value = "";
      form.querySelector("[data-alan=sifre]").value = "";
      yenile = true;
      try {
        await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/giris/" + uid).set({ sifre: sifre });
        toast(ad.gorunen + " eklendi. Şifreyi personele iletin. Kullanıcı adı ve şifreyi buradan değiştirebilirsiniz.", "basari");
      } catch (e) {
        toast(ad.gorunen + " eklendi. Şifreyi not edin; sunucu saklayamadı. Sonra değiştirmek için mevcut şifreyi bir kez yazın.", "uyari");
      }
    } catch (err) {
      const metin = err && err.code ? adArac.hata(err) : dbHata(err, "Personel eklenemedi");
      if (uid) {
        toast("Hesap açıldı ama otele bağlanamadı: " + metin, "hata");
      } else {
        toast(metin, "hata");
      }
    } finally {
      try { await auth2.signOut(); } catch (e) {}
      ekleniyor = false;
      if (btn) btn.disabled = false;
      if (yenile) {
        zorlaCiz = true;
        ciz();
      }
    }
  }

  function ekleFormu(govde) {
    const kutu = el("div", "personel-blok");
    kutu.appendChild(el("div", "yetki-grup-baslik", "Yeni personel"));
    kutu.appendChild(el(
      "p",
      "modal-aciklama",
      "Kullanıcı adı ve şifreyi siz belirlersiniz. Personel yalnızca ana sayfadaki Personel kapısından girer; kendi şifresini değiştirmez."
    ));
    const ad = document.createElement("input");
    ad.type = "text";
    ad.className = "field-input";
    ad.placeholder = "Kullanıcı adı";
    ad.autocomplete = "off";
    ad.autocapitalize = "off";
    ad.spellcheck = false;
    ad.dataset.alan = "ad";
    const sifre = document.createElement("input");
    sifre.type = "password";
    sifre.className = "field-input";
    sifre.placeholder = "Şifre (en az 6 karakter)";
    sifre.autocomplete = "new-password";
    sifre.dataset.alan = "sifre";
    kutu.appendChild(ad);
    kutu.appendChild(sifre);
    kutu.appendChild(el("div", "yetki-grup-baslik", "Görebileceği modüller"));
    const kutular = el("div", "personel-moduller");
    const varsayilan = { rezervasyonlar: true, tahsilat: true, odalar: true };
    modulKutulari(kutular, varsayilan);
    kutu.appendChild(kutular);
    const ekle = el("button", "btn-primary", "Personel ekle");
    ekle.type = "button";
    ekle.dataset.alan = "ekle";
    ekle.addEventListener("click", () => personelOlustur(kutu));
    kutu.appendChild(ekle);
    govde.appendChild(kutu);
  }

  function uyeSatirlari(govde) {
    govde.appendChild(el("div", "yetki-grup-baslik", "Kayıtlı kişiler"));
    const uidler = Object.keys(uyeler).sort((a, b) => {
      const ra = uyeler[a]?.rol === "sahip" ? 0 : 1;
      const rb = uyeler[b]?.rol === "sahip" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return String(uyeler[a]?.ad || "").localeCompare(String(uyeler[b]?.ad || ""), "tr");
    });
    if (!uidler.length) {
      govde.appendChild(el("p", "modal-aciklama", "Henüz personel yok."));
      return;
    }
    uidler.forEach((uid) => {
      const uye = uyeler[uid] || {};
      const btn = el("button", "ayar-item personel-uye" + (uid === seciliUid ? " personel-uye-secili" : ""));
      btn.type = "button";
      const ad = uye.ad || uye.kullaniciAdi || uid;
      const rol = uye.rol === "sahip" ? "Otel sahibi" : "Personel";
      btn.textContent = ad + " — " + rol;
      btn.addEventListener("click", () => {
        seciliUid = uye.rol === "sahip" ? "" : uid;
        ciz();
      });
      govde.appendChild(btn);
    });
  }

  function sifreAlani(placeholder, alan, oto) {
    const inp = document.createElement("input");
    inp.type = "password";
    inp.className = "field-input";
    inp.placeholder = placeholder;
    inp.autocomplete = oto;
    inp.dataset.alan = alan;
    return inp;
  }

  function uyeFormu(govde) {
    const uye = seciliUid ? uyeler[seciliUid] : null;
    if (!uye || uye.rol !== "personel") return;
    const kutu = el("div", "personel-blok");
    const ad = uye.ad || uye.kullaniciAdi || "Personel";
    kutu.appendChild(el("div", "yetki-grup-baslik", ad));
    kutu.appendChild(el("div", "yetki-grup-baslik", "Giriş"));
    kutu.appendChild(el(
      "p",
      "modal-aciklama",
      "Personel yalnızca girer. Kullanıcı adı ve şifreyi yalnızca siz değiştirirsiniz."
    ));
    const adInp = document.createElement("input");
    adInp.type = "text";
    adInp.className = "field-input";
    adInp.placeholder = "Kullanıcı adı";
    adInp.autocomplete = "off";
    adInp.autocapitalize = "off";
    adInp.spellcheck = false;
    adInp.dataset.alan = "giris-ad";
    adInp.value = uye.kullaniciAdi || uye.ad || "";
    kutu.appendChild(adInp);
    if (!sakliSifre(seciliUid) || sifreSor[seciliUid]) {
      kutu.appendChild(sifreAlani("Mevcut şifre", "giris-mevcut", "current-password"));
    }
    kutu.appendChild(sifreAlani("Yeni şifre (değişmeyecekse boş)", "giris-yeni", "new-password"));
    kutu.appendChild(sifreAlani("Yeni şifre tekrar", "giris-tekrar", "new-password"));
    const girisBtn = el("button", "btn-primary", "Giriş bilgilerini kaydet");
    girisBtn.type = "button";
    girisBtn.dataset.alan = "giris-kaydet";
    girisBtn.addEventListener("click", () => girisGuncelle(kutu));
    kutu.appendChild(girisBtn);

    kutu.appendChild(el("div", "yetki-grup-baslik", "Görebileceği modüller"));
    const kutular = el("div", "personel-moduller");
    modulKutulari(kutular, uye.gorebilir);
    kutu.appendChild(kutular);
    const eylem = el("div", "personel-eylem");
    const kaydet = el("button", "btn-primary", "Modülleri kaydet");
    kaydet.type = "button";
    kaydet.addEventListener("click", () => uyeKaydet(kutular));
    const sil = el("button", "btn-danger", "Erişimi kaldır");
    sil.type = "button";
    sil.addEventListener("click", uyeSil);
    eylem.appendChild(kaydet);
    eylem.appendChild(sil);
    kutu.appendChild(eylem);
    govde.appendChild(kutu);
  }

  async function eskiEpostaIleGir(auth2, eskiEmail, yeniEmail, sifre) {
    try {
      return await auth2.signInWithEmailAndPassword(eskiEmail, sifre);
    } catch (err) {
      if (yeniEmail && yeniEmail !== eskiEmail) {
        try {
          return await auth2.signInWithEmailAndPassword(yeniEmail, sifre);
        } catch (e2) {
          throw err;
        }
      }
      throw err;
    }
  }

  async function girisGuncelle(kutu) {
    if (kaydediyor || !sahipMi() || !seciliUid || !otelId) return;
    const uye = uyeler[seciliUid];
    if (!uye || uye.rol !== "personel") return;
    const adArac = window.APARTIM.kullaniciAdi;
    if (!adArac) {
      toast("Kullanıcı adı kontrolü hazır değil", "hata");
      return;
    }
    const ad = adArac.dogrula(kutu.querySelector("[data-alan=giris-ad]")?.value);
    if (!ad.ok) { toast(ad.mesaj, "hata"); return; }
    const yeni = String(kutu.querySelector("[data-alan=giris-yeni]")?.value || "");
    const tekrar = String(kutu.querySelector("[data-alan=giris-tekrar]")?.value || "");
    const sakli = sakliSifre(seciliUid);
    const yazilan = String(kutu.querySelector("[data-alan=giris-mevcut]")?.value || "");
    const mevcut = yazilan || sakli;
    const eski = adArac.dogrula(uye.kullaniciAdi || uye.ad || "");
    const adDegisti = !eski.ok || eski.anahtar !== ad.anahtar;
    const sifreDegisti = yeni.length > 0;
    if (!eski.ok) {
      toast("Bu personelin kayıtlı kullanıcı adı okunamadı.", "hata");
      return;
    }
    if (sifreDegisti) {
      if (yeni.length < 6) { toast("Yeni şifre en az 6 karakter olmalı.", "hata"); return; }
      if (yeni !== tekrar) { toast("Yeni şifreler eşleşmiyor.", "hata"); return; }
    }
    if (!adDegisti && !sifreDegisti) {
      toast("Değişiklik yok.", "bilgi");
      return;
    }
    if (mevcut.length < 6) {
      toast("Mevcut şifreyi girin.", "hata");
      return;
    }
    kaydediyor = true;
    const btn = kutu.querySelector("[data-alan=giris-kaydet]");
    if (btn) btn.disabled = true;
    const auth2 = await ikincilAuth(AUTH_GUNCELLE);
    const uid = seciliUid;
    let yenile = false;
    try {
      const cred = await eskiEpostaIleGir(
        auth2,
        adArac.email(eski.anahtar),
        adArac.email(ad.anahtar),
        mevcut
      );
      if (adDegisti) await cred.user.updateEmail(adArac.email(ad.anahtar));
      await cred.user.updateProfile({ displayName: ad.gorunen });
      if (sifreDegisti) await cred.user.updatePassword(yeni);
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler/" + uid).update({
        ad: ad.gorunen,
        kullaniciAdi: ad.gorunen
      });
      yenile = true;
      delete sifreSor[uid];
      try {
        await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/giris/" + uid).set({
          sifre: sifreDegisti ? yeni : mevcut
        });
        toast("Giriş bilgileri kaydedildi", "basari");
      } catch (e) {
        toast("Giriş güncellendi. Sunucu şifreyi saklayamadı; bir sonraki değişiklikte mevcut şifreyi girin.", "uyari");
      }
    } catch (err) {
      const kod = err && err.code ? err.code : "";
      if (kod === "auth/wrong-password" || kod === "auth/invalid-credential" || kod === "auth/user-not-found" || kod === "auth/invalid-login-credentials") {
        if (sakli && !yazilan) {
          sifreSor[uid] = true;
          yenile = true;
          toast("Kayıtlı şifre eşleşmiyor. Mevcut şifreyi yazıp tekrar kaydedin.", "hata");
        } else {
          toast("Mevcut şifre eşleşmiyor.", "hata");
        }
      } else if (kod) {
        toast(adArac.hata(err), "hata");
      } else {
        toast(dbHata(err, "Giriş bilgileri kaydedilemedi"), "hata");
      }
    } finally {
      try { await auth2.signOut(); } catch (e) {}
      kaydediyor = false;
      if (btn) btn.disabled = false;
      if (yenile) {
        zorlaCiz = true;
        ciz();
      }
    }
  }

  async function uyeKaydet(kutu) {
    if (!sahipMi() || !seciliUid || !otelId) return;
    const uye = uyeler[seciliUid];
    if (!uye || uye.rol !== "personel") return;
    const bayrak = modulleriOku(kutu);
    try {
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler/" + seciliUid).update({
        gorebilir: bayrak.gorebilir,
        yapabilir: bayrak.yapabilir
      });
      toast("Modüller kaydedildi", "basari");
    } catch (err) {
      toast(dbHata(err, "Modüller kaydedilemedi"), "hata");
    }
  }

  async function uyeSil() {
    if (!sahipMi() || !seciliUid || !otelId) return;
    const uye = uyeler[seciliUid];
    if (!uye || uye.rol !== "personel") return;
    const ad = uye.ad || uye.kullaniciAdi || "Bu personel";
    if (!window.confirm(ad + " artık otele giremesin mi?")) return;
    const uid = seciliUid;
    try {
      try {
        await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/giris/" + uid).remove();
      } catch (e) {}
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler/" + uid).remove();
      seciliUid = "";
      toast("Erişim kaldırıldı", "basari");
    } catch (err) {
      toast(dbHata(err, "Erişim kaldırılamadı"), "hata");
    }
  }

  function ciz() {
    const govde = document.getElementById("personel-govde");
    if (!govde || modal()?.classList.contains("hidden")) return;
    const odak = document.activeElement;
    if (
      !zorlaCiz &&
      odak &&
      govde.contains(odak) &&
      (odak.matches("input, select, textarea") || ekleniyor || kaydediyor)
    ) return;
    zorlaCiz = false;
    govde.replaceChildren();
    if (!sahipMi()) {
      govde.appendChild(el("p", "modal-aciklama", "Personeli yalnızca otel sahibi yönetir."));
      return;
    }
    ekleFormu(govde);
    uyeSatirlari(govde);
    uyeFormu(govde);
  }

  function init() {
    document.getElementById("ayar-personel")?.addEventListener("click", () => {
      document.getElementById("ayar-menu")?.classList.add("hidden");
      ac();
    });
    document.getElementById("personel-close")?.addEventListener("click", kapat);
    modal()?.addEventListener("click", (e) => {
      if (e.target.id === "modal-personel") kapat();
    });
  }

  document.addEventListener("apartim:otel-hazir", (e) => {
    bagla(e.detail && e.detail.otelId);
  });
  document.addEventListener("apartim:oturum-kapandi", dinlemeyiKaldir);
  document.addEventListener("apartim:yetki-degisti", () => {
    if (!sahipMi()) dinlemeyiKaldir();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
