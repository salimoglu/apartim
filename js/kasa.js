/* =========================================================
   APARTIM — Kasa modülü
   Tüm tahsilat kalemleri + manuel gelir/gider.
   Kalem filtresi: Tümü, Kasa, Pos, Booking, Havale, Diğer.
   ========================================================= */

(function () {
  "use strict";

  const KALEM_AD = {
    kasa: "Kasa",
    pos: "Pos",
    booking: "Booking",
    havale: "Havale",
    diger: "Diğer"
  };
  const KALEM_SIRA = ["tumu", "kasa", "pos", "booking", "havale", "diger"];
  const YONTEM_SIRA = ["kasa", "pos", "booking", "havale", "diger"];

  let aktifPb = "tumu";
  let aktifKalem = "tumu";
  let aktifYon = "tumu";
  let aktifTip = "gider";
  let hareketMap = {};
  let duzenlenen = null;
  let longPressTimer = null;
  let longPressSatir = null;
  let longPressMoved = false;
  const LONG_PRESS_MS = 480;
  const LONG_PRESS_MOVE = 12;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tarihGoster(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
    const [y, m, d] = iso.split("-");
    return d + "." + m + "." + String(y).slice(-2);
  }

  function seciliYil() {
    const y = window.APARTIM.gorunum?.seciliYil?.();
    return Number.isFinite(y) ? y : new Date().getFullYear();
  }

  /** Seçili sezon yılında “bugün”: aynı ay ve gün, yıl seçiciden. */
  function bugunISO() {
    const db = window.APARTIM.db;
    const gercek = db?.bugunISO?.() || db?.tarihNormal?.(new Date()) || "";
    const y = seciliYil();
    if (/^\d{4}-\d{2}-\d{2}$/.test(gercek) && Number(gercek.slice(0, 4)) === y) {
      return gercek;
    }
    const kaynak = /^\d{4}-\d{2}-\d{2}$/.test(gercek) ? gercek : "";
    const simdi = new Date();
    const m = kaynak ? Number(kaynak.slice(5, 7)) : simdi.getMonth() + 1;
    let d = kaynak ? Number(kaynak.slice(8, 10)) : simdi.getDate();
    const maxD = new Date(y, m, 0).getDate();
    if (d > maxD) d = maxD;
    const pad = (n) => String(n).padStart(2, "0");
    return y + "-" + pad(m) + "-" + pad(d);
  }

  function tarihSeciliYilda(iso) {
    return String(iso || "").slice(0, 4) === String(seciliYil());
  }

  function tarihSinirla() {
    const y = seciliYil();
    const min = y + "-01-01";
    const max = y + "-12-31";
    ["kasa-harcama-tarih", "kasa-duzenle-tarih"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.min = min;
      el.max = max;
    });
  }

  function formatTutar(tutar, pb) {
    const para = window.APARTIM.para;
    if (para?.formatTutar) return para.formatTutar(tutar, pb);
    const n = Number(tutar) || 0;
    return n.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + (pb === "USD" ? " $" : " ₺");
  }

  function ozetHesapla(liste) {
    const ozet = {
      gelirTl: 0, gelirUsd: 0,
      harcamaTl: 0, harcamaUsd: 0
    };
    liste.forEach((h) => {
      const t = Number(h.tutar) || 0;
      if (h.tip === "gider" || h.tip === "harcama") {
        if (h.pb === "USD") ozet.harcamaUsd += t;
        else ozet.harcamaTl += t;
      } else {
        if (h.pb === "USD") ozet.gelirUsd += t;
        else ozet.gelirTl += t;
      }
    });
    return ozet;
  }

  function kalemAd(yontem) {
    const y = String(yontem || "kasa").toLowerCase() === "elden" ? "kasa" : String(yontem || "kasa");
    if (KALEM_AD[y]) return KALEM_AD[y];
    return window.APARTIM.db?.ODEME_YONTEMLERI?.[y] || "Kasa";
  }

  function kalemTamAd(yontem) {
    const y = String(yontem || "kasa").toLowerCase() === "elden" ? "kasa" : String(yontem || "kasa");
    return window.APARTIM.db?.ODEME_YONTEMLERI?.[y] || kalemAd(y);
  }

  function pbNavGuncelle() {
    document.querySelectorAll(".kasa-pb-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.pb === aktifPb);
    });
  }

  function kalemNavGuncelle() {
    document.querySelectorAll(".kasa-kalem-btn").forEach((b) => {
      const secili = b.dataset.kalem === aktifKalem;
      b.classList.toggle("active", secili);
      b.setAttribute("aria-selected", secili ? "true" : "false");
    });
  }

  function yonNavGuncelle() {
    document.querySelectorAll(".kasa-yon-btn").forEach((b) => {
      const secili = b.dataset.yon === aktifYon;
      b.classList.toggle("active", secili);
      b.setAttribute("aria-selected", secili ? "true" : "false");
    });
  }

  function giderMi(h) {
    return h.tip === "gider" || h.tip === "harcama";
  }

  function ozetCiz(ozet) {
    const el = document.getElementById("kasa-ozet");
    if (!el) return;
    const parcalar = [];
    if (aktifPb === "tumu" || aktifPb === "TL") {
      const netTl = ozet.gelirTl - ozet.harcamaTl;
      parcalar.push(
        '<span class="kasa-ozet-parca">' +
          '<span class="kasa-ozet-lbl">TL</span>' +
          '<span class="kasa-ozet-val ' + (netTl < 0 ? "eksi" : "arti") + '">' +
            formatTutar(netTl, "TL") +
          "</span>" +
        "</span>"
      );
    }
    if (aktifPb === "tumu" || aktifPb === "USD") {
      const netUsd = ozet.gelirUsd - ozet.harcamaUsd;
      parcalar.push(
        '<span class="kasa-ozet-parca">' +
          '<span class="kasa-ozet-lbl">USD</span>' +
          '<span class="kasa-ozet-val ' + (netUsd < 0 ? "eksi" : "arti") + '">' +
            formatTutar(netUsd, "USD") +
          "</span>" +
        "</span>"
      );
    }
    el.innerHTML = parcalar.join('<span class="kasa-ozet-ayrac">·</span>') || "—";
  }

  function listeCiz(liste) {
    const el = document.getElementById("kasa-liste");
    if (!el) return;
    hareketMap = {};
    if (!liste.length) {
      const parca = [];
      if (aktifKalem !== "tumu") parca.push(kalemAd(aktifKalem));
      if (aktifYon === "gelir") parca.push("gelir");
      else if (aktifYon === "gider") parca.push("gider");
      const bos = parca.length
        ? seciliYil() + " sezonunda " + parca.join(" ") + " kaydı yok."
        : seciliYil() + " sezonunda kasa kaydı yok.";
      el.innerHTML = '<div class="kasa-bos">' + esc(bos) + "</div>";
      return;
    }
    const baslik =
      '<div class="kasa-satir kasa-satir-baslik" aria-hidden="true">' +
        '<span class="kasa-tarih">Tarih</span>' +
        '<span class="kasa-oda">Oda</span>' +
        '<span class="kasa-musteri">Müşteri</span>' +
        '<span class="kasa-kalem">Kalem</span>' +
        '<span class="kasa-not">Not</span>' +
        '<span class="kasa-miktar">Miktar</span>' +
        '<span class="kasa-aksiyon-slot"></span>' +
        '<span class="kasa-sil-slot"></span>' +
      "</div>";
    const satirlar = liste.map((h) => {
      hareketMap[h.id] = h;
      const giderSatir = giderMi(h);
      const miktarSinif = giderSatir ? "eksi" : "arti";
      const miktarOn = giderSatir ? "−" : "+";
      const oda = String(h.oda || "").trim();
      const yontem = h.yontem || "kasa";
      const kalem = kalemAd(yontem);
      const duzenleBtn =
        '<button type="button" class="kasa-duzenle-btn" data-hid="' +
          esc(h.id) + '" title="Düzenle" aria-label="Düzenle">✎</button>';
      /* X yalnızca masaüstünde görünür (CSS); telefon/tablette basılı tut */
      const silBtn = h.harcamaId
        ? '<button type="button" class="kasa-sil-btn" data-id="' +
            esc(h.harcamaId) + '" title="Sil" aria-label="Kaydı sil">&#10005;</button>'
        : '<span class="kasa-sil-slot" aria-hidden="true"></span>';
      return (
        '<div class="kasa-satir" data-hid="' + esc(h.id) + '">' +
          '<span class="kasa-tarih">' + esc(tarihGoster(h.tarih)) + "</span>" +
          '<span class="kasa-oda' + (oda ? "" : " soluk") + '">' +
            esc(oda || "—") +
          "</span>" +
          '<span class="kasa-musteri">' + esc(h.musteri || "—") + "</span>" +
          '<span class="kasa-kalem kasa-kalem-' + esc(yontem) + '" title="' +
            esc(kalemTamAd(yontem)) + '">' + esc(kalem) + "</span>" +
          '<span class="kasa-not' + (h.not ? "" : " soluk") + '">' +
            esc(h.not || "—") +
          "</span>" +
          '<span class="kasa-miktar ' + miktarSinif + '">' +
            miktarOn + formatTutar(h.tutar, h.pb) +
          "</span>" +
          duzenleBtn +
          silBtn +
        "</div>"
      );
    });
    el.innerHTML = baslik + satirlar.join("");
  }

  function ciz() {
    const db = window.APARTIM.db;
    if (!db) return;
    pbNavGuncelle();
    kalemNavGuncelle();
    yonNavGuncelle();
    tarihSinirla();
    const yil = String(seciliYil());
    const liste = (db.kasaHareketListele(aktifPb) || [])
      .filter((h) => String(h.tarih || "").slice(0, 4) === yil)
      .filter((h) => aktifKalem === "tumu" || (h.yontem || "kasa") === aktifKalem)
      .filter((h) => {
        if (aktifYon === "gider") return giderMi(h);
        if (aktifYon === "gelir") return !giderMi(h);
        return true;
      });
    ozetCiz(ozetHesapla(liste));
    listeCiz(liste);
  }

  function pbSec(pb) {
    aktifPb = pb === "TL" || pb === "USD" ? pb : "tumu";
    ciz();
  }

  function kalemSec(kalem) {
    const k = String(kalem || "tumu").toLowerCase();
    aktifKalem = KALEM_SIRA.includes(k) ? k : "tumu";
    ciz();
  }

  function yonSec(yon) {
    const y = String(yon || "tumu").toLowerCase();
    aktifYon = y === "gelir" || y === "gider" ? y : "tumu";
    ciz();
  }

  function pbNorm(secili) {
    const p = window.APARTIM.para?.paraBirimiSecimNorm?.(secili) ||
      (String(secili || "TL").toUpperCase() === "USD" ? "USD" : "TL");
    return p === "USD" ? "USD" : "TL";
  }

  function pbToggleAyarla(btn, pb) {
    if (!btn) return;
    const sonraki = pbNorm(pb);
    btn.dataset.pb = sonraki;
    btn.textContent = window.APARTIM.para?.simge?.(sonraki) || (sonraki === "USD" ? "$" : "₺");
    btn.setAttribute(
      "aria-label",
      "Para birimi: " + sonraki + ". Tıklayınca TL / USD değişir."
    );
  }

  function pbToggleDegistir(btn) {
    if (!btn) return;
    pbToggleAyarla(btn, pbNorm(btn.dataset.pb) === "USD" ? "TL" : "USD");
  }

  function tipNavGuncelle() {
    document.querySelectorAll(".kasa-tip-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tip === aktifTip);
    });
    const kaydet = document.getElementById("kasa-harcama-kaydet");
    const form = document.getElementById("kasa-kayit-form");
    const gelirMi = aktifTip === "gelir";
    if (form) {
      form.classList.toggle("gelir", gelirMi);
      form.classList.toggle("gider", !gelirMi);
    }
    if (kaydet) {
      const etiket = gelirMi ? "Gelir ekle" : "Gider ekle";
      kaydet.title = etiket;
      kaydet.setAttribute("aria-label", etiket);
      kaydet.classList.toggle("gelir", gelirMi);
      kaydet.classList.toggle("gider", !gelirMi);
    }
  }

  function tipSec(tip) {
    aktifTip = tip === "gelir" ? "gelir" : "gider";
    tipNavGuncelle();
  }

  function yontemNorm(yontem) {
    const y = String(yontem || "kasa").toLowerCase();
    if (y === "elden") return "kasa";
    return YONTEM_SIRA.includes(y) ? y : "kasa";
  }

  function yontemSeciciSenkron(el, yontem) {
    if (!el) return;
    const y = yontemNorm(yontem != null ? yontem : el.value);
    el.value = y;
    YONTEM_SIRA.forEach((k) => el.classList.toggle("kasa-kalem-" + k, k === y));
  }

  function seciliYontem() {
    return yontemNorm(document.getElementById("kasa-harcama-yontem")?.value);
  }

  function formSifirla() {
    const tarih = document.getElementById("kasa-harcama-tarih");
    const not = document.getElementById("kasa-harcama-not");
    const tutar = document.getElementById("kasa-harcama-tutar");
    const pbBtn = document.getElementById("kasa-harcama-pb");
    if (tarih) tarih.value = bugunISO();
    if (not) not.value = "";
    if (tutar) tutar.value = "";
    pbToggleAyarla(pbBtn, "TL");
    yontemSeciciSenkron(document.getElementById("kasa-harcama-yontem"));
    tipNavGuncelle();
  }

  async function kayitEkle() {
    const db = window.APARTIM.db;
    const tarih = document.getElementById("kasa-harcama-tarih")?.value || "";
    const not = document.getElementById("kasa-harcama-not")?.value || "";
    const tutar = Number(document.getElementById("kasa-harcama-tutar")?.value);
    const pb = pbNorm(document.getElementById("kasa-harcama-pb")?.dataset.pb || "TL");
    const yontem = seciliYontem();
    const tip = aktifTip === "gelir" ? "gelir" : "gider";
    if (!tarih) {
      window.APARTIM.toast?.("Tarih gerekli", "uyari");
      return;
    }
    if (!tarihSeciliYilda(tarih)) {
      window.APARTIM.toast?.("Kayıt " + seciliYil() + " sezonuna ait olmalı", "uyari");
      return;
    }
    if (!Number.isFinite(tutar) || tutar <= 0) {
      window.APARTIM.toast?.("Geçerli bir miktar girin", "uyari");
      return;
    }
    try {
      await db.kasaHarcamaEkle({ tarih, not, tutar, pb, tip, yontem });
      window.APARTIM.toast?.(tip === "gelir" ? "Gelir eklendi" : "Gider eklendi", "basari");
      formSifirla();
      ciz();
    } catch (e) {
      window.APARTIM.toast?.(e?.message || "Kayıt eklenemedi", "hata");
    }
  }

  async function kayitSil(id) {
    if (!id) return;
    try {
      await window.APARTIM.db.kasaHarcamaSil(id);
      window.APARTIM.toast?.("Kayıt silindi", "basari");
      ciz();
    } catch (e) {
      window.APARTIM.toast?.("Silinemedi", "hata");
    }
  }

  function kayitSilIste(id) {
    if (!id) return;
    const kayit = Object.values(hareketMap).find((h) => h.harcamaId === id);
    const tipAd = kayit?.tip === "gelir" ? "gelir" : "gider";
    const baslik = tipAd === "gelir" ? "Geliri sil?" : "Gideri sil?";
    const metin = "Bu " + tipAd + " kaydı kalıcı olarak silinecek. Emin misiniz?";
    const onayAc = window.APARTIM.rezervasyon?.onayAc;
    if (typeof onayAc === "function") {
      onayAc(baslik, metin, () => { kayitSil(id); });
      return;
    }
    if (window.confirm(baslik + "\n\n" + metin)) {
      kayitSil(id);
    }
  }

  function modalAc() {
    document.getElementById("modal-kasa-duzenle")?.classList.remove("hidden");
  }

  function modalKapat() {
    document.getElementById("modal-kasa-duzenle")?.classList.add("hidden");
    duzenlenen = null;
  }

  function duzenleAc(hid) {
    const h = hareketMap[hid];
    if (!h) return;
    duzenlenen = h;
    const title = document.getElementById("kasa-duzenle-title");
    const musteriEl = document.getElementById("kasa-duzenle-musteri");
    if (title) {
      if (h.manuel) title.textContent = h.tip === "gelir" ? "Gelir düzenle" : "Gider düzenle";
      else title.textContent = "Gelir düzenle";
    }
    if (musteriEl) {
      if (h.tip === "gelir") {
        musteriEl.textContent = (h.musteri || "—") + " · " + kalemAd(h.yontem || "kasa");
        musteriEl.classList.remove("hidden");
      } else {
        musteriEl.textContent = "";
        musteriEl.classList.add("hidden");
      }
    }
    const tarih = document.getElementById("kasa-duzenle-tarih");
    const not = document.getElementById("kasa-duzenle-not");
    const tutar = document.getElementById("kasa-duzenle-tutar");
    const yontemAlan = document.getElementById("kasa-duzenle-yontem-alan");
    const yontemSel = document.getElementById("kasa-duzenle-yontem");
    if (tarih) tarih.value = h.tarih || bugunISO();
    if (not) not.value = h.not || "";
    if (tutar) tutar.value = String(h.tutar ?? "");
    if (yontemAlan) yontemAlan.classList.toggle("hidden", !h.harcamaId);
    if (h.harcamaId) yontemSeciciSenkron(yontemSel, h.yontem || "kasa");
    pbToggleAyarla(document.getElementById("kasa-duzenle-pb"), h.pb || "TL");
    modalAc();
  }

  async function duzenleKaydet() {
    if (!duzenlenen) return;
    const db = window.APARTIM.db;
    const tarih = document.getElementById("kasa-duzenle-tarih")?.value || "";
    const not = document.getElementById("kasa-duzenle-not")?.value || "";
    const tutar = Number(document.getElementById("kasa-duzenle-tutar")?.value);
    const pb = pbNorm(document.getElementById("kasa-duzenle-pb")?.dataset.pb || "TL");
    if (!tarih) {
      window.APARTIM.toast?.("Tarih gerekli", "uyari");
      return;
    }
    if (!tarihSeciliYilda(tarih)) {
      window.APARTIM.toast?.("Kayıt " + seciliYil() + " sezonuna ait olmalı", "uyari");
      return;
    }
    if (!Number.isFinite(tutar) || tutar <= 0) {
      window.APARTIM.toast?.("Geçerli bir miktar girin", "uyari");
      return;
    }
    try {
      if (duzenlenen.harcamaId) {
        const tip = duzenlenen.tip === "gelir" ? "gelir" : "gider";
        const yontem = yontemNorm(document.getElementById("kasa-duzenle-yontem")?.value);
        await db.kasaHarcamaGuncelle(duzenlenen.harcamaId, { tarih, not, tutar, pb, tip, yontem });
      } else {
        await db.kasaGelirGuncelle(
          duzenlenen.rezId,
          duzenlenen.odemeId,
          duzenlenen.pb,
          { tarih, not, tutar, pb }
        );
      }
      window.APARTIM.toast?.("Kaydedildi", "basari");
      modalKapat();
      ciz();
    } catch (e) {
      window.APARTIM.toast?.(e?.message || "Kaydedilemedi", "hata");
    }
  }

  function longPressIptal() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressSatir = null;
    longPressMoved = false;
  }

  function dokunmatikMu() {
    return window.matchMedia("(max-width: 1024px)").matches ||
      window.matchMedia("(pointer: coarse)").matches;
  }

  function listeBagla(listeEl) {
    listeEl.addEventListener("click", (e) => {
      const sil = e.target.closest?.(".kasa-sil-btn");
      if (sil) {
        e.preventDefault();
        kayitSilIste(sil.dataset.id);
        return;
      }
      const duzenle = e.target.closest?.(".kasa-duzenle-btn");
      if (duzenle) {
        e.preventDefault();
        duzenleAc(duzenle.dataset.hid);
      }
    });

    /* Telefon/tablet: basılı tut = silme onayı (X gizli) */
    listeEl.addEventListener("pointerdown", (e) => {
      if (!dokunmatikMu()) return;
      if (e.target.closest?.("button")) return;
      const satir = e.target.closest?.(".kasa-satir:not(.kasa-satir-baslik)");
      if (!satir?.dataset.hid) return;
      longPressIptal();
      longPressSatir = satir;
      longPressMoved = false;
      const startX = e.clientX;
      const startY = e.clientY;
      const ac = new AbortController();
      const { signal } = ac;
      longPressTimer = setTimeout(() => {
        if (!longPressSatir || longPressMoved) return;
        const hid = longPressSatir.dataset.hid;
        const kayit = hareketMap[hid];
        try { longPressSatir.setPointerCapture?.(e.pointerId); } catch (err) { /* yoksay */ }
        if (navigator.vibrate) {
          try { navigator.vibrate(18); } catch (err) { /* yoksay */ }
        }
        longPressSatir.classList.add("kasa-satir-basili");
        setTimeout(() => longPressSatir?.classList.remove("kasa-satir-basili"), 220);
        if (kayit?.harcamaId) {
          kayitSilIste(kayit.harcamaId);
        } else {
          window.APARTIM.toast?.("Tahsilat kaydı buradan silinemez", "uyari");
        }
        longPressTimer = null;
        ac.abort();
      }, LONG_PRESS_MS);

      const onMove = (ev) => {
        if (Math.abs(ev.clientX - startX) > LONG_PRESS_MOVE ||
            Math.abs(ev.clientY - startY) > LONG_PRESS_MOVE) {
          longPressMoved = true;
          longPressIptal();
          ac.abort();
        }
      };
      const bitir = () => {
        if (longPressTimer) longPressIptal();
        ac.abort();
      };
      listeEl.addEventListener("pointermove", onMove, { signal });
      listeEl.addEventListener("pointerup", bitir, { signal });
      listeEl.addEventListener("pointercancel", bitir, { signal });
    });

    listeEl.addEventListener("contextmenu", (e) => {
      if (!dokunmatikMu()) return;
      if (e.target.closest?.(".kasa-satir:not(.kasa-satir-baslik)")) {
        e.preventDefault();
      }
    });
  }

  function bagla() {
    document.querySelectorAll(".kasa-pb-btn").forEach((b) => {
      b.addEventListener("click", () => pbSec(b.dataset.pb));
    });
    document.querySelectorAll(".kasa-kalem-btn").forEach((b) => {
      b.addEventListener("click", () => kalemSec(b.dataset.kalem));
    });
    document.querySelectorAll(".kasa-yon-btn").forEach((b) => {
      b.addEventListener("click", () => yonSec(b.dataset.yon));
    });
    document.querySelectorAll(".kasa-tip-btn").forEach((b) => {
      b.addEventListener("click", () => tipSec(b.dataset.tip));
    });
    document.getElementById("kasa-harcama-kaydet")?.addEventListener("click", kayitEkle);
    document.getElementById("kasa-harcama-yontem")?.addEventListener("change", (e) => {
      yontemSeciciSenkron(e.currentTarget);
    });
    document.getElementById("kasa-duzenle-yontem")?.addEventListener("change", (e) => {
      yontemSeciciSenkron(e.currentTarget);
    });
    document.getElementById("kasa-harcama-pb")?.addEventListener("click", (e) => {
      pbToggleDegistir(e.currentTarget);
    });
    document.getElementById("kasa-duzenle-pb")?.addEventListener("click", (e) => {
      pbToggleDegistir(e.currentTarget);
    });
    document.getElementById("kasa-duzenle-close")?.addEventListener("click", modalKapat);
    document.getElementById("kasa-duzenle-iptal")?.addEventListener("click", modalKapat);
    document.getElementById("kasa-duzenle-kaydet")?.addEventListener("click", duzenleKaydet);
    document.getElementById("modal-kasa-duzenle")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-kasa-duzenle") modalKapat();
    });

    const listeEl = document.getElementById("kasa-liste");
    if (listeEl) listeBagla(listeEl);
    formSifirla();
    tarihSinirla();

    document.addEventListener("apartim:gorunum-degisti", () => {
      const tarih = document.getElementById("kasa-harcama-tarih");
      if (tarih && !tarihSeciliYilda(tarih.value)) tarih.value = bugunISO();
      tarihSinirla();
      ciz();
    });
  }

  document.addEventListener("DOMContentLoaded", bagla);

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.kasa = { ciz, pbSec, kalemSec, yonSec };
})();
