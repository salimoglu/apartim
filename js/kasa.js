/* =========================================================
   APARTIM — Kasa modülü
   Tahsilatta "Kasa" yöntemiyle girilen ödemeler + manuel harcama
   ========================================================= */

(function () {
  "use strict";

  let aktifPb = "tumu";

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
    return d + "." + m + "." + y;
  }

  function bugunISO() {
    return window.APARTIM.db?.tarihNormal?.(new Date()) ||
      new Date().toISOString().slice(0, 10);
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
        '<span class="kasa-sil-slot"></span>' +
      "</div>";
    const satirlar = liste.map((h) => {
      const harcamaMi = h.tip === "harcama";
      const miktarSinif = harcamaMi ? "eksi" : "arti";
      const miktarOn = harcamaMi ? "−" : "+";
      const silBtn = harcamaMi
        ? '<button type="button" class="kasa-sil-btn" data-id="' +
            esc(h.harcamaId) + '" title="Sil" aria-label="Harcama sil">&#10005;</button>'
        : '<span class="kasa-sil-slot"></span>';
      return (
        '<div class="kasa-satir ' + (harcamaMi ? "harcama" : "gelir") + '">' +
          '<span class="kasa-tarih">' + esc(tarihGoster(h.tarih)) + "</span>" +
          '<span class="kasa-musteri">' + esc(h.musteri || "—") + "</span>" +
          '<span class="kasa-not' + (h.not ? "" : " soluk") + '">' +
            esc(h.not || "—") +
          "</span>" +
          '<span class="kasa-miktar ' + miktarSinif + '">' +
            miktarOn + formatTutar(h.tutar, h.pb) +
          "</span>" +
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
      "Harcama para birimi: " + sonraki + ". Tıklayınca TL / USD değişir."
    );
  }

  function pbToggleDegistir(btn) {
    if (!btn) return;
    pbToggleAyarla(btn, pbNorm(btn.dataset.pb) === "USD" ? "TL" : "USD");
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
  }

  async function harcamaKaydet() {
    const db = window.APARTIM.db;
    const tarih = document.getElementById("kasa-harcama-tarih")?.value || "";
    const not = document.getElementById("kasa-harcama-not")?.value || "";
    const tutar = Number(document.getElementById("kasa-harcama-tutar")?.value);
    const pb = pbNorm(document.getElementById("kasa-harcama-pb")?.dataset.pb || "TL");
    if (!tarih) {
      window.APARTIM.toast?.("Tarih gerekli", "uyari");
      return;
    }
    if (!Number.isFinite(tutar) || tutar <= 0) {
      window.APARTIM.toast?.("Geçerli bir miktar girin", "uyari");
      return;
    }
    try {
      await db.kasaHarcamaEkle({ tarih, not, tutar, pb });
      window.APARTIM.toast?.("Harcama eklendi", "basari");
      formSifirla();
      ciz();
    } catch (e) {
      window.APARTIM.toast?.(e?.message || "Harcama kaydedilemedi", "hata");
    }
  }

  async function harcamaSil(id) {
    if (!id) return;
    try {
      await window.APARTIM.db.kasaHarcamaSil(id);
      window.APARTIM.toast?.("Harcama silindi", "basari");
      ciz();
    } catch (e) {
      window.APARTIM.toast?.("Silinemedi", "hata");
    }
  }

  function bagla() {
    document.querySelectorAll(".kasa-pb-btn").forEach((b) => {
      b.addEventListener("click", () => pbSec(b.dataset.pb));
    });
    document.getElementById("kasa-harcama-kaydet")?.addEventListener("click", harcamaKaydet);
    document.getElementById("kasa-harcama-pb")?.addEventListener("click", (e) => {
      pbToggleDegistir(e.currentTarget);
    });
    document.getElementById("kasa-liste")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.(".kasa-sil-btn");
      if (!btn) return;
      harcamaSil(btn.dataset.id);
    });
    formSifirla();
  }

  document.addEventListener("DOMContentLoaded", bagla);

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.kasa = { ciz, pbSec };
})();
