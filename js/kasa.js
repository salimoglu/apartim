/* =========================================================
   APARTIM — Kasa modülü
   Tahsilatta "Kasa" ödemeleri + manuel gelir/gider
   ========================================================= */

(function () {
  "use strict";

  let aktifPb = "tumu";
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

  function bugunISO() {
    return window.APARTIM.db?.tarihNormal?.(new Date()) ||
      new Date().toISOString().slice(0, 10);
  }

  function telefonMu() {
    return window.matchMedia("(max-width: 720px)").matches;
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
      if (h.tip === "harcama") {
        if (h.pb === "USD") ozet.harcamaUsd += t;
        else ozet.harcamaTl += t;
      } else {
        if (h.pb === "USD") ozet.gelirUsd += t;
        else ozet.gelirTl += t;
      }
    });
    return ozet;
  }

  function pbNavGuncelle() {
    document.querySelectorAll(".kasa-pb-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.pb === aktifPb);
    });
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
      el.innerHTML = '<div class="kasa-bos">Bu görünümde kasa kaydı yok.</div>';
      return;
    }
    const baslik =
      '<div class="kasa-satir kasa-satir-baslik" aria-hidden="true">' +
        '<span class="kasa-tarih">Tarih</span>' +
        '<span class="kasa-musteri">Müşteri</span>' +
        '<span class="kasa-not">Not</span>' +
        '<span class="kasa-miktar">Miktar</span>' +
        '<span class="kasa-aksiyon-slot"></span>' +
        '<span class="kasa-sil-slot"></span>' +
      "</div>";
    const satirlar = liste.map((h) => {
      hareketMap[h.id] = h;
      const harcamaMi = h.tip === "harcama";
      const miktarSinif = harcamaMi ? "eksi" : "arti";
      const miktarOn = harcamaMi ? "−" : "+";
      const duzenleBtn =
        '<button type="button" class="kasa-duzenle-btn" data-hid="' +
          esc(h.id) + '" title="Düzenle" aria-label="Düzenle">✎</button>';
      const silBtn = h.harcamaId
        ? '<button type="button" class="kasa-sil-btn" data-id="' +
            esc(h.harcamaId) + '" title="Sil" aria-label="Kaydı sil">&#10005;</button>'
        : '<span class="kasa-sil-slot" aria-hidden="true"></span>';
      return (
        '<div class="kasa-satir ' + (harcamaMi ? "harcama" : "gelir") +
          '" data-hid="' + esc(h.id) + '">' +
          '<span class="kasa-tarih">' + esc(tarihGoster(h.tarih)) + "</span>" +
          '<span class="kasa-musteri">' + esc(h.musteri || "—") + "</span>" +
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
    const liste = db.kasaHareketListele(aktifPb) || [];
    ozetCiz(ozetHesapla(liste));
    listeCiz(liste);
  }

  function pbSec(pb) {
    aktifPb = pb === "TL" || pb === "USD" ? pb : "tumu";
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
    if (kaydet) {
      const etiket = aktifTip === "gelir" ? "Gelir ekle" : "Gider ekle";
      kaydet.title = etiket;
      kaydet.setAttribute("aria-label", etiket);
      kaydet.classList.toggle("gelir", aktifTip === "gelir");
      kaydet.classList.toggle("gider", aktifTip === "gider");
    }
  }

  function tipSec(tip) {
    aktifTip = tip === "gelir" ? "gelir" : "gider";
    tipNavGuncelle();
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
    tipNavGuncelle();
  }

  async function kayitEkle() {
    const db = window.APARTIM.db;
    const tarih = document.getElementById("kasa-harcama-tarih")?.value || "";
    const not = document.getElementById("kasa-harcama-not")?.value || "";
    const tutar = Number(document.getElementById("kasa-harcama-tutar")?.value);
    const pb = pbNorm(document.getElementById("kasa-harcama-pb")?.dataset.pb || "TL");
    const tip = aktifTip === "gelir" ? "gelir" : "gider";
    if (!tarih) {
      window.APARTIM.toast?.("Tarih gerekli", "uyari");
      return;
    }
    if (!Number.isFinite(tutar) || tutar <= 0) {
      window.APARTIM.toast?.("Geçerli bir miktar girin", "uyari");
      return;
    }
    try {
      await db.kasaHarcamaEkle({ tarih, not, tutar, pb, tip });
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
        musteriEl.textContent = h.musteri || "—";
        musteriEl.classList.remove("hidden");
      } else {
        musteriEl.textContent = "";
        musteriEl.classList.add("hidden");
      }
    }
    const tarih = document.getElementById("kasa-duzenle-tarih");
    const not = document.getElementById("kasa-duzenle-not");
    const tutar = document.getElementById("kasa-duzenle-tutar");
    if (tarih) tarih.value = h.tarih || bugunISO();
    if (not) not.value = h.not || "";
    if (tutar) tutar.value = String(h.tutar ?? "");
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
    if (!Number.isFinite(tutar) || tutar <= 0) {
      window.APARTIM.toast?.("Geçerli bir miktar girin", "uyari");
      return;
    }
    try {
      if (duzenlenen.harcamaId) {
        const tip = duzenlenen.tip === "gelir" ? "gelir" : "gider";
        await db.kasaHarcamaGuncelle(duzenlenen.harcamaId, { tarih, not, tutar, pb, tip });
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

    listeEl.addEventListener("pointerdown", (e) => {
      if (!telefonMu()) return;
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
        try { longPressSatir.setPointerCapture?.(e.pointerId); } catch (err) { /* yoksay */ }
        if (navigator.vibrate) {
          try { navigator.vibrate(18); } catch (err) { /* yoksay */ }
        }
        longPressSatir.classList.add("kasa-satir-basili");
        setTimeout(() => longPressSatir?.classList.remove("kasa-satir-basili"), 220);
        duzenleAc(hid);
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
      if (!telefonMu()) return;
      if (e.target.closest?.(".kasa-satir:not(.kasa-satir-baslik)")) {
        e.preventDefault();
      }
    });
  }

  function bagla() {
    document.querySelectorAll(".kasa-pb-btn").forEach((b) => {
      b.addEventListener("click", () => pbSec(b.dataset.pb));
    });
    document.querySelectorAll(".kasa-tip-btn").forEach((b) => {
      b.addEventListener("click", () => tipSec(b.dataset.tip));
    });
    document.getElementById("kasa-harcama-kaydet")?.addEventListener("click", kayitEkle);
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
  }

  document.addEventListener("DOMContentLoaded", bagla);

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.kasa = { ciz, pbSec };
})();
