/* =========================================================
   APARTIM — Daire detay ekranı
   Bina ekranıyla aynı sekme alanında geçiş yapar. Takvim
   ve rezervasyon listesini koordine eder.
   ========================================================= */

(function () {
  "use strict";

  let aktifDaireId = null;

  function el(id) { return document.getElementById(id); }

  function ac(daireId) {
    const db = window.APARTIM.db;
    const daire = db.daireGetir(daireId);
    if (!daire) {
      window.APARTIM.toast("Daire bulunamadı", "hata");
      return;
    }
    aktifDaireId = daireId;

    el("bina-wrap")?.classList.add("hidden");
    el("daire-wrap")?.classList.remove("hidden");

    el("daire-baslik").textContent = daire.ad;
    el("daire-altbaslik").textContent = "";
    el("daire-ucret-inp").value = daire.gunlukUcret || 0;

    panelSec("takvim");
    window.APARTIM.takvim.ayOlustur(daireId);
    window.APARTIM.rezervasyon.daireRezListele(daireId);
  }

  function kapat() {
    aktifDaireId = null;
    if (window.APARTIM.takvim?.durum) {
      window.APARTIM.takvim.durum.daireId = null;
    }
    el("daire-wrap")?.classList.add("hidden");
    el("bina-wrap")?.classList.remove("hidden");
    window.APARTIM.bina?.guncelle();
  }

  function panelSec(ad) {
    document.querySelectorAll(".daire-subnav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.panel === ad);
    });
    document.querySelectorAll(".daire-panel").forEach((p) => {
      p.classList.remove("active");
    });
    el("daire-panel-" + ad)?.classList.add("active");
  }

  function ucretKaydet() {
    if (!aktifDaireId) return;
    const inp = el("daire-ucret-inp");
    const yeni = Number(inp.value) || 0;
    if (yeni < 0) return;
    window.APARTIM.db.daireGuncelle(aktifDaireId, { gunlukUcret: yeni });
    window.APARTIM.toast("Günlük ücret güncellendi", "basari");
  }

  document.addEventListener("DOMContentLoaded", () => {
    el("daire-back")?.addEventListener("click", kapat);

    document.querySelectorAll(".daire-subnav-btn").forEach((b) => {
      b.addEventListener("click", () => panelSec(b.dataset.panel));
    });

    const ucret = el("daire-ucret-inp");
    if (ucret) {
      let zaman = null;
      ucret.addEventListener("input", () => {
        if (zaman) clearTimeout(zaman);
        zaman = setTimeout(ucretKaydet, 600);
      });
      ucret.addEventListener("change", ucretKaydet);
    }
  });

  document.addEventListener("apartim:veri-degisti", () => {
    if (aktifDaireId) {
      const daire = window.APARTIM.db.daireGetir(aktifDaireId);
      if (daire) {
        const inp = el("daire-ucret-inp");
        if (inp && document.activeElement !== inp) inp.value = daire.gunlukUcret || 0;
      }
    }
  });

  window.APARTIM.daire = {
    ac, kapat, panelSec,
    aktifId: () => aktifDaireId
  };
})();
