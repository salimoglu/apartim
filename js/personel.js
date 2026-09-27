/* =========================================================
   APARTIM — Personeller
   Otel sahibi liste üzerinden modül, şifre ve durdurmayı yönetir.
   Personel yalnızca giriş yapar.
   ========================================================= */

(function () {
  "use strict";

  const AUTH_OLUSTUR = "apartim-personel-olustur";
  const AUTH_GUNCELLE = "apartim-personel-guncelle";
  const KISA = {
    rezervasyonlar: "Rezervasyon",
    tahsilat: "Tahsilat",
    odalar: "Odalar",
    rapor: "Rapor",
    kasa: "Kasa"
  };
  const IKON_ANAHTAR = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12.65 10A6 6 0 1 0 7 16h1v2h2v-2h2.65A6 6 0 0 0 12.65 10zM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>';
  const IKON_KALEM = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
  const IKON_DUR = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  const IKON_AC = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';

  let otelId = "";
  let uyelerRef = null;
  let girisRef = null;
  let duranRef = null;
  let uyeler = {};
  let girisler = {};
  let duranlar = {};
  let panelUid = "";
  let panelTur = "";
  let ekleAcik = false;
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
    try { duranRef?.off(); } catch (e) {}
    uyelerRef = null;
    girisRef = null;
    duranRef = null;
    otelId = "";
    uyeler = {};
    girisler = {};
    duranlar = {};
    panelUid = "";
    panelTur = "";
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
    duranRef = window.APARTIM.fbDb.ref("apartim/kullanicilar/" + otelId + "/personelDurum");
    duranRef.on("value", (snap) => {
      duranlar = snap.val() || {};
      ciz();
    }, () => {
      duranlar = {};
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

  function kisaEtiket(id) {
    return KISA[id] || id;
  }

  function modulleriOku(kapsam) {
    const secim = {};
    kapsam.querySelectorAll("[data-modul]").forEach((inp) => {
      if (inp.matches("input[type=checkbox]")) secim[inp.dataset.modul] = !!inp.checked;
      else secim[inp.dataset.modul] = inp.getAttribute("aria-pressed") === "true";
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

  function kaynak(uid) {
    const aktif = uyeler[uid];
    if (aktif && aktif.rol === "personel") return { uye: aktif, durdu: false };
    if (duranlar[uid] && uyeler[uid]?.rol !== "sahip") return { uye: duranlar[uid], durdu: true };
    return null;
  }

  function uyeKaydi(uye) {
    const bayrak = window.APARTIM.yetki.modullerdenYap(uye && uye.gorebilir);
    const ad = String((uye && (uye.ad || uye.kullaniciAdi)) || "Personel").trim().slice(0, 80) || "Personel";
    const kayit = {
      rol: "personel",
      ad: ad,
      gorebilir: bayrak.gorebilir,
      yapabilir: bayrak.yapabilir
    };
    const kullanici = String((uye && uye.kullaniciAdi) || "").trim();
    if (kullanici) kayit.kullaniciAdi = kullanici;
    return kayit;
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
      ekleAcik = false;
      yenile = true;
      try {
        await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/giris/" + uid).set({ sifre: sifre });
        toast(ad.gorunen + " eklendi. Şifreyi personele iletin.", "basari");
      } catch (e) {
        toast(ad.gorunen + " eklendi. Şifreyi not edin; sunucu saklayamadı. Sonra değiştirmek için mevcut şifreyi bir kez yazın.", "uyari");
      }
    } catch (err) {
      const metin = err && err.code ? adArac.hata(err) : dbHata(err, "Personel eklenemedi");
      if (uid) toast("Hesap açıldı ama otele bağlanamadı: " + metin, "hata");
      else toast(metin, "hata");
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

  function cipEkle(hedef, secili, onTik) {
    window.APARTIM.yetki.GOREBILIR.forEach((t) => {
      const acik = !!(secili && secili[t.id]);
      const b = el("button", "personel-cip" + (acik ? " personel-cip-acik" : ""), kisaEtiket(t.id));
      b.type = "button";
      b.dataset.modul = t.id;
      b.setAttribute("aria-pressed", acik ? "true" : "false");
      b.addEventListener("click", () => onTik(b, t.id));
      hedef.appendChild(b);
    });
  }

  function ekleFormu(govde) {
    const acBtn = el("button", "btn-primary personel-ekle-btn", ekleAcik ? "Vazgeç" : "Personel ekle");
    acBtn.type = "button";
    acBtn.addEventListener("click", () => {
      ekleAcik = !ekleAcik;
      zorlaCiz = true;
      ciz();
    });
    govde.appendChild(acBtn);
    if (!ekleAcik) return;
    const kutu = el("div", "personel-kart personel-blok");
    kutu.appendChild(el(
      "p",
      "modal-aciklama",
      "Kullanıcı adı ve şifreyi siz belirlersiniz. Personel yalnızca Personel kapısından girer."
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
    const kutular = el("div", "personel-cipler");
    cipEkle(kutular, { rezervasyonlar: true, tahsilat: true, odalar: true }, (b) => {
      const acik = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", acik ? "true" : "false");
      b.classList.toggle("personel-cip-acik", acik);
    });
    kutu.appendChild(kutular);
    const ekle = el("button", "btn-primary", "Ekle");
    ekle.type = "button";
    ekle.dataset.alan = "ekle";
    ekle.addEventListener("click", () => personelOlustur(kutu));
    kutu.appendChild(ekle);
    govde.appendChild(kutu);
  }

  function ikonBtn(sinif, etiket, svg, onClick) {
    const b = el("button", "personel-ikon " + sinif);
    b.type = "button";
    b.title = etiket;
    b.setAttribute("aria-label", etiket);
    b.innerHTML = svg;
    b.addEventListener("click", onClick);
    return b;
  }

  function panelAc(uid, tur) {
    if (panelUid === uid && panelTur === tur) {
      panelUid = "";
      panelTur = "";
    } else {
      panelUid = uid;
      panelTur = tur;
    }
    zorlaCiz = true;
    ciz();
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

  function kartlar(govde) {
    const liste = el("div", "personel-liste");
    const satirlar = [];
    Object.keys(uyeler).forEach((uid) => {
      const uye = uyeler[uid] || {};
      if (uye.rol === "sahip" || uye.rol === "personel") satirlar.push({ uid: uid, uye: uye, durdu: false });
    });
    Object.keys(duranlar).forEach((uid) => {
      if (uyeler[uid]) return;
      satirlar.push({ uid: uid, uye: duranlar[uid] || {}, durdu: true });
    });
    satirlar.sort((a, b) => {
      const ra = a.uye.rol === "sahip" ? 0 : 1;
      const rb = b.uye.rol === "sahip" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return String(a.uye.ad || "").localeCompare(String(b.uye.ad || ""), "tr");
    });
    if (!satirlar.length) {
      govde.appendChild(el("p", "modal-aciklama", "Henüz personel yok."));
      return;
    }
    satirlar.forEach((satir) => liste.appendChild(kart(satir)));
    govde.appendChild(liste);
  }

  function kart(satir) {
    const uid = satir.uid;
    const uye = satir.uye || {};
    const sahip = uye.rol === "sahip";
    const kutu = el("div", "personel-kart" + (satir.durdu ? " personel-kart-durdu" : ""));
    const ust = el("div", "personel-kart-ust");
    const kim = el("div", "personel-kim");
    kim.appendChild(el("div", "personel-kart-ad", uye.ad || uye.kullaniciAdi || "Personel"));
    if (uye.kullaniciAdi) kim.appendChild(el("div", "personel-kart-kullanici", "@" + uye.kullaniciAdi));
    ust.appendChild(kim);
    ust.appendChild(el(
      "span",
      "personel-rozet" + (sahip ? " personel-rozet-sahip" : ""),
      sahip ? "Otel sahibi" : "Personel"
    ));
    if (!sahip) {
      const islem = el("div", "personel-islemler");
      islem.appendChild(ikonBtn("personel-ikon-anahtar", "Şifre", IKON_ANAHTAR, () => panelAc(uid, "sifre")));
      islem.appendChild(ikonBtn("personel-ikon-kalem", "Kullanıcı adı", IKON_KALEM, () => panelAc(uid, "ad")));
      islem.appendChild(ikonBtn(
        "personel-ikon-dur" + (satir.durdu ? " personel-durdu" : ""),
        satir.durdu ? "Girişi aç" : "Girişi durdur",
        satir.durdu ? IKON_AC : IKON_DUR,
        () => (satir.durdu ? girisiAc(uid) : girisiDurdur(uid))
      ));
      ust.appendChild(islem);
    }
    kutu.appendChild(ust);
    if (!sahip) {
      const cipler = el("div", "personel-cipler");
      cipEkle(cipler, uye.gorebilir, (b, modulId) => {
        if (satir.durdu) return;
        modulCevir(uid, modulId, b);
      });
      kutu.appendChild(cipler);
    }
    if (!sahip && panelUid === uid && panelTur) kutu.appendChild(panel(uid, uye));
    return kutu;
  }

  function panel(uid, uye) {
    const kutu = el("div", "personel-panel");
    if (panelTur === "ad") {
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
    }
    if (!sakliSifre(uid) || sifreSor[uid]) {
      kutu.appendChild(sifreAlani("Mevcut şifre", "giris-mevcut", "current-password"));
    }
    if (panelTur === "sifre") {
      kutu.appendChild(sifreAlani("Yeni şifre", "giris-yeni", "new-password"));
      kutu.appendChild(sifreAlani("Yeni şifre tekrar", "giris-tekrar", "new-password"));
    }
    const kaydet = el("button", "btn-primary", panelTur === "sifre" ? "Şifreyi kaydet" : "Kullanıcı adını kaydet");
    kaydet.type = "button";
    kaydet.dataset.alan = "giris-kaydet";
    kaydet.addEventListener("click", () => girisGuncelle(kutu, uid));
    kutu.appendChild(kaydet);
    return kutu;
  }

  async function modulCevir(uid, modulId, btn) {
    if (!sahipMi() || !otelId) return;
    const bulunan = kaynak(uid);
    if (!bulunan || bulunan.durdu) return;
    const once = btn.getAttribute("aria-pressed") === "true";
    const secim = {};
    window.APARTIM.yetki.GOREBILIR.forEach((t) => {
      secim[t.id] = !!(bulunan.uye.gorebilir && bulunan.uye.gorebilir[t.id]);
    });
    secim[modulId] = !once;
    btn.setAttribute("aria-pressed", secim[modulId] ? "true" : "false");
    btn.classList.toggle("personel-cip-acik", !!secim[modulId]);
    const bayrak = window.APARTIM.yetki.modullerdenYap(secim);
    try {
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler/" + uid).update({
        gorebilir: bayrak.gorebilir,
        yapabilir: bayrak.yapabilir
      });
    } catch (err) {
      btn.setAttribute("aria-pressed", once ? "true" : "false");
      btn.classList.toggle("personel-cip-acik", once);
      toast(dbHata(err, "Modül kaydedilemedi"), "hata");
    }
  }

  async function girisiDurdur(uid) {
    if (!sahipMi() || !otelId) return;
    const uye = uyeler[uid];
    if (!uye || uye.rol !== "personel") return;
    const ad = uye.ad || uye.kullaniciAdi || "Bu personel";
    if (!window.confirm(ad + " durdurulsun mu? Girişi kapanır.")) return;
    if (panelUid === uid) {
      panelUid = "";
      panelTur = "";
    }
    const kopya = uyeKaydi(uye);
    kopya.askida = true;
    try {
      await window.APARTIM.fbDb.ref("apartim/kullanicilar/" + otelId + "/personelDurum/" + uid).set(kopya);
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler/" + uid).remove();
      toast(ad + " durduruldu", "basari");
    } catch (err) {
      toast(dbHata(err, "Durdurulamadı"), "hata");
    }
  }

  async function girisiAc(uid) {
    if (!sahipMi() || !otelId) return;
    const uye = duranlar[uid];
    if (!uye) return;
    const ad = uye.ad || uye.kullaniciAdi || "Bu personel";
    if (!window.confirm(ad + " yeniden girsin mi?")) return;
    try {
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler/" + uid).set(uyeKaydi(uye));
      await window.APARTIM.fbDb.ref("apartim/kullanicilar/" + otelId + "/personelDurum/" + uid).remove();
      toast(ad + " yeniden açıldı", "basari");
    } catch (err) {
      toast(dbHata(err, "Açılamadı"), "hata");
    }
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

  async function girisGuncelle(kutu, uid) {
    if (kaydediyor || !sahipMi() || !uid || !otelId) return;
    const bulunan = kaynak(uid);
    if (!bulunan || bulunan.uye.rol === "sahip") return;
    const uye = bulunan.uye;
    const adArac = window.APARTIM.kullaniciAdi;
    if (!adArac) {
      toast("Kullanıcı adı kontrolü hazır değil", "hata");
      return;
    }
    const adInp = kutu.querySelector("[data-alan=giris-ad]");
    const ad = adArac.dogrula(adInp ? adInp.value : (uye.kullaniciAdi || uye.ad || ""));
    if (!ad.ok) { toast(ad.mesaj, "hata"); return; }
    const yeni = String(kutu.querySelector("[data-alan=giris-yeni]")?.value || "");
    const tekrar = String(kutu.querySelector("[data-alan=giris-tekrar]")?.value || "");
    const sakli = sakliSifre(uid);
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
      const yol = bulunan.durdu
        ? "apartim/kullanicilar/" + otelId + "/personelDurum/" + uid
        : "apartim/oteller/" + otelId + "/uyeler/" + uid;
      await window.APARTIM.fbDb.ref(yol).update({
        ad: ad.gorunen,
        kullaniciAdi: ad.gorunen
      });
      yenile = true;
      delete sifreSor[uid];
      panelUid = "";
      panelTur = "";
      try {
        await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/giris/" + uid).set({
          sifre: sifreDegisti ? yeni : mevcut
        });
        toast(sifreDegisti && !adDegisti ? "Şifre kaydedildi" : "Giriş bilgileri kaydedildi", "basari");
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
    kartlar(govde);
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
