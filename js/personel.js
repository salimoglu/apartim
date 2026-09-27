/* =========================================================
   APARTIM — Personel ve davet kodu
   Yalnızca otel sahibi yönetir. Kod, personelin ilk yetkisini
   kopyalar; sonra kişi bazında değiştirilebilir.
   ========================================================= */

(function () {
  "use strict";

  let otelId = "";
  let uyelerRef = null;
  let kodlarRef = null;
  let uyeler = {};
  let kodlar = {};
  let seciliUid = "";

  function toast(msg, tur) {
    window.APARTIM.toast?.(msg, tur || "bilgi");
  }

  function sahipMi() {
    return window.APARTIM.yetki?.model?.() === "otel" && window.APARTIM.yetki?.sahipMi?.();
  }

  function dinlemeyiKaldir() {
    try { uyelerRef?.off(); } catch (e) {}
    try { kodlarRef?.off(); } catch (e) {}
    uyelerRef = null;
    kodlarRef = null;
    otelId = "";
    uyeler = {};
    kodlar = {};
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
    const kok = window.APARTIM.fbDb.ref("apartim/oteller/" + otelId);
    uyelerRef = kok.child("uyeler");
    kodlarRef = kok.child("davetKodlari");
    uyelerRef.on("value", (snap) => {
      uyeler = snap.val() || {};
      if (seciliUid && !uyeler[seciliUid]) seciliUid = "";
      ciz();
    });
    kodlarRef.on("value", (snap) => {
      kodlar = snap.val() || {};
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

  function kutular(grup, deger, hedef) {
    const yetki = window.APARTIM.yetki;
    const liste = grup === "gorebilir" ? yetki.GOREBILIR : yetki.YAPABILIR;
    const baslik = el("div", "yetki-grup-baslik", grup === "gorebilir" ? "Görebilir" : "Yapabilir");
    hedef.appendChild(baslik);
    liste.forEach((t) => {
      const lbl = el("label", "yetki-satir");
      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.dataset.grup = grup;
      inp.dataset.anahtar = t.id;
      inp.checked = !!(deger && deger[t.id]);
      lbl.appendChild(inp);
      lbl.appendChild(document.createTextNode(t.etiket));
      hedef.appendChild(lbl);
    });
  }

  function kutulardanOku(kapsam) {
    const kaynak = { gorebilir: {}, yapabilir: {} };
    kapsam.querySelectorAll("input[type=checkbox][data-anahtar]").forEach((inp) => {
      const grup = inp.dataset.grup === "yapabilir" ? "yapabilir" : "gorebilir";
      kaynak[grup][inp.dataset.anahtar] = !!inp.checked;
    });
    return window.APARTIM.yetki.bayrakKopya(kaynak);
  }

  function kalipUygula(kapsam, kalipId) {
    const kalip = (window.APARTIM.yetki.KALIPLAR || []).find((k) => k.id === kalipId);
    if (!kalip) return;
    const bayrak = window.APARTIM.yetki.bayrakKopya(kalip);
    kapsam.querySelectorAll("input[type=checkbox][data-anahtar]").forEach((inp) => {
      const grup = inp.dataset.grup === "yapabilir" ? "yapabilir" : "gorebilir";
      inp.checked = !!bayrak[grup][inp.dataset.anahtar];
    });
  }

  function uyeSatirlari(govde) {
    const baslik = el("div", "yetki-grup-baslik", "Kişiler");
    govde.appendChild(baslik);
    const uidler = Object.keys(uyeler).sort((a, b) => {
      const ra = uyeler[a]?.rol === "sahip" ? 0 : 1;
      const rb = uyeler[b]?.rol === "sahip" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return String(uyeler[a]?.ad || "").localeCompare(String(uyeler[b]?.ad || ""), "tr");
    });
    if (!uidler.length) {
      govde.appendChild(el("p", "modal-aciklama", "Henüz üye yok."));
      return;
    }
    uidler.forEach((uid) => {
      const uye = uyeler[uid] || {};
      const btn = el("button", "ayar-item personel-uye" + (uid === seciliUid ? " personel-uye-secili" : ""));
      btn.type = "button";
      const ad = uye.ad || uid;
      const rol = uye.rol === "sahip" ? "Sahip" : "Personel";
      btn.textContent = ad + " — " + rol;
      btn.addEventListener("click", () => {
        seciliUid = uid;
        ciz();
      });
      govde.appendChild(btn);
    });
  }

  function uyeFormu(govde) {
    const uye = seciliUid ? uyeler[seciliUid] : null;
    if (!uye) return;
    const kutu = el("div", "personel-blok");
    kutu.appendChild(el("div", "yetki-grup-baslik", uye.ad || "Üye"));
    if (uye.rol === "sahip") {
      kutu.appendChild(el("p", "modal-aciklama", "Otel sahibi tam yetkilidir. Bu hesap kısıtlanamaz."));
      govde.appendChild(kutu);
      return;
    }
    kutular("gorebilir", uye.gorebilir, kutu);
    kutular("yapabilir", uye.yapabilir, kutu);
    const eylem = el("div", "personel-eylem");
    const kaydet = el("button", "btn-primary", "Yetkileri kaydet");
    kaydet.type = "button";
    kaydet.addEventListener("click", () => uyeKaydet(kutu));
    const sil = el("button", "btn-danger", "Erişimi kaldır");
    sil.type = "button";
    sil.addEventListener("click", uyeSil);
    eylem.appendChild(kaydet);
    eylem.appendChild(sil);
    kutu.appendChild(eylem);
    govde.appendChild(kutu);
  }

  async function uyeKaydet(kutu) {
    if (!sahipMi() || !seciliUid || !otelId) return;
    const uye = uyeler[seciliUid];
    if (!uye || uye.rol !== "personel") return;
    const bayrak = kutulardanOku(kutu);
    try {
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler/" + seciliUid).update({
        gorebilir: bayrak.gorebilir,
        yapabilir: bayrak.yapabilir
      });
      toast("Yetkiler kaydedildi", "basari");
    } catch (err) {
      toast(err.message || "Yetkiler kaydedilemedi", "hata");
    }
  }

  async function uyeSil() {
    if (!sahipMi() || !seciliUid || !otelId) return;
    const uye = uyeler[seciliUid];
    if (!uye || uye.rol !== "personel") return;
    if (!window.confirm((uye.ad || "Bu personel") + " artık otele giremesin mi?")) return;
    try {
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/uyeler/" + seciliUid).remove();
      seciliUid = "";
      toast("Erişim kaldırıldı", "basari");
    } catch (err) {
      toast(err.message || "Erişim kaldırılamadı", "hata");
    }
  }

  function davetFormu(govde) {
    const kutu = el("div", "personel-blok");
    kutu.appendChild(el("div", "yetki-grup-baslik", "Davet kodu"));
    kutu.appendChild(el(
      "p",
      "modal-aciklama",
      "Kodla katılan personel bu yetkilerle başlar. Sonra kişiyi listeden değiştirirsiniz. Yedek, Excel ve sezon temizleme yalnızca sahiptedir."
    ));
    const sel = document.createElement("select");
    sel.className = "field-select";
    sel.id = "personel-kalip";
    window.APARTIM.yetki.KALIPLAR.forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k.id;
      opt.textContent = k.ad;
      sel.appendChild(opt);
    });
    kutu.appendChild(sel);
    const kutukapsam = el("div", "personel-davet-kutular");
    const ilk = window.APARTIM.yetki.bayrakKopya(window.APARTIM.yetki.KALIPLAR[0]);
    kutular("gorebilir", ilk.gorebilir, kutukapsam);
    kutular("yapabilir", ilk.yapabilir, kutukapsam);
    sel.addEventListener("change", () => kalipUygula(kutukapsam, sel.value));
    kutu.appendChild(kutukapsam);
    const uret = el("button", "btn-primary", "Davet kodu oluştur");
    uret.type = "button";
    uret.addEventListener("click", () => kodOlustur(kutukapsam, sel));
    kutu.appendChild(uret);

    const kodUid = Object.keys(kodlar);
    if (kodUid.length) {
      kutu.appendChild(el("div", "yetki-grup-baslik", "Açık kodlar"));
      kodUid.forEach((kod) => {
        const satir = el("div", "personel-kod-satir");
        const metin = el("div", "personel-kod-metin");
        const etiket = typeof kodlar[kod] === "string" ? kodlar[kod] : "Personel";
        metin.appendChild(el("strong", "", kod));
        metin.appendChild(el("span", "personel-kod-etiket", etiket));
        const kopya = el("button", "btn-secondary", "Kopyala");
        kopya.type = "button";
        kopya.addEventListener("click", () => panoya(kod));
        const iptal = el("button", "btn-danger", "İptal");
        iptal.type = "button";
        iptal.addEventListener("click", () => kodIptal(kod));
        satir.appendChild(metin);
        satir.appendChild(kopya);
        satir.appendChild(iptal);
        kutu.appendChild(satir);
      });
    }
    govde.appendChild(kutu);
  }

  function kodUret() {
    const alfabe = "abcdefghjkmnpqrstuvwxyz23456789";
    const buf = new Uint8Array(8);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
    else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    let kod = "";
    for (let i = 0; i < buf.length; i++) kod += alfabe[buf[i] % alfabe.length];
    return kod;
  }

  async function kodOlustur(kapsam, sel) {
    if (!sahipMi() || !otelId) return;
    const uid = window.APARTIM.kullanici?.uid;
    if (!uid) return;
    const bayrak = kutulardanOku(kapsam);
    const kalip = (window.APARTIM.yetki.KALIPLAR || []).find((k) => k.id === sel.value);
    const etiket = (kalip && kalip.ad) || "Personel";
    let kod = kodUret();
    for (let i = 0; i < 4 && kodlar[kod]; i++) kod = kodUret();
    const kayit = {
      otelId,
      kod,
      olusturan: uid,
      etiket,
      gorebilir: bayrak.gorebilir,
      yapabilir: bayrak.yapabilir
    };
    try {
      await window.APARTIM.fbDb.ref("apartim/davetler/" + kod).set(kayit);
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/davetKodlari/" + kod).set(etiket);
      await panoya(kod);
      toast("Davet kodu hazır", "basari");
    } catch (err) {
      toast(err.message || "Davet kodu oluşturulamadı", "hata");
    }
  }

  async function kodIptal(kod) {
    if (!sahipMi() || !otelId) return;
    try {
      await window.APARTIM.fbDb.ref("apartim/davetler/" + kod).remove();
      await window.APARTIM.fbDb.ref("apartim/oteller/" + otelId + "/davetKodlari/" + kod).remove();
      toast("Davet kodu iptal edildi", "basari");
    } catch (err) {
      toast(err.message || "Kod iptal edilemedi", "hata");
    }
  }

  async function panoya(metin) {
    try {
      await navigator.clipboard.writeText(metin);
      toast("Kod kopyalandı", "basari");
    } catch (e) {
      toast(metin, "bilgi");
    }
  }

  function ciz() {
    const govde = document.getElementById("personel-govde");
    if (!govde || modal()?.classList.contains("hidden")) return;
    const odak = document.activeElement;
    if (odak && govde.contains(odak) && odak.matches("input, select, textarea")) return;
    govde.replaceChildren();
    if (!sahipMi()) {
      govde.appendChild(el("p", "modal-aciklama", "Personeli yalnızca otel sahibi yönetir."));
      return;
    }
    uyeSatirlari(govde);
    uyeFormu(govde);
    davetFormu(govde);
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
