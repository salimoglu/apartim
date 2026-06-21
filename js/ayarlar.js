/* =========================================================
   APARTIM — Ayarlar (müşteri kaynakları, daire isimleri)
   ========================================================= */

(function () {
  "use strict";

  const modalKaynak = () => document.getElementById("modal-kaynaklar");
  const modalDaire = () => document.getElementById("modal-daireler");

  function uyari(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.classList.remove("hidden");
    el.textContent = msg;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  // ---- Müşteri kaynakları ----
  function kaynakListeRender() {
    const ul = document.getElementById("kaynak-liste");
    if (!ul) return;
    const liste = window.APARTIM.db.musteriKaynaklariListele();
    ul.innerHTML = "";
    liste.forEach((k) => {
      const li = document.createElement("li");
      li.className = "kaynak-item" + (k.sistem ? " kaynak-item-sistem" : "");
      li.innerHTML =
        '<span class="kaynak-ad">' + esc(k.ad) + '</span>' +
        (k.sistem ? '<span class="kaynak-etiket">Varsayılan</span>' : "") +
        (k.sistem ? "" : '<button type="button" class="kaynak-sil-btn" data-id="' + esc(k.id) + '">Sil</button>');
      if (!k.sistem) {
        li.querySelector(".kaynak-sil-btn").addEventListener("click", () => kaynakSil(k.id));
      }
      ul.appendChild(li);
    });
  }

  function kaynakAc() {
    uyari("kaynak-uyari", "");
    kaynakListeRender();
    modalKaynak()?.classList.remove("hidden");
    document.getElementById("kaynak-yeni-ad")?.focus();
  }

  function kaynakKapat() {
    modalKaynak()?.classList.add("hidden");
    uyari("kaynak-uyari", "");
    const inp = document.getElementById("kaynak-yeni-ad");
    if (inp) inp.value = "";
  }

  async function kaynakEkle() {
    const inp = document.getElementById("kaynak-yeni-ad");
    const ad = inp?.value.trim();
    if (!ad) {
      uyari("kaynak-uyari", "Kategori adı yazın.");
      return;
    }
    try {
      await window.APARTIM.db.musteriKaynagiEkle(ad);
      if (inp) inp.value = "";
      uyari("kaynak-uyari", "");
      kaynakListeRender();
      window.APARTIM.toast("Kategori eklendi", "basari");
    } catch (err) {
      uyari("kaynak-uyari", err.message || "Eklenemedi.");
    }
  }

  async function kaynakSil(id) {
    if (!confirm("Bu kategoriyi silmek istiyor musunuz?")) return;
    try {
      await window.APARTIM.db.musteriKaynagiSil(id);
      kaynakListeRender();
      window.APARTIM.toast("Kategori silindi", "basari");
    } catch (err) {
      uyari("kaynak-uyari", err.message || "Silinemedi.");
    }
  }

  // ---- Daire isimleri ----
  function daireKatEtiket(d) {
    const parcalar = [];
    if (d.kat) parcalar.push(d.kat + ". kat");
    if (d.konum === "sol") parcalar.push("Sol");
    else if (d.konum === "sag") parcalar.push("Sağ");
    else if (d.konum === "tek") parcalar.push("Tek daire");
    return parcalar.join(" · ") || d.id;
  }

  function daireListeRender() {
    const ul = document.getElementById("daire-ayar-liste");
    if (!ul) return;
    const liste = window.APARTIM.db.dairelerListele();
    ul.innerHTML = "";
    liste.forEach((d) => {
      const li = document.createElement("li");
      li.className = "daire-ayar-item";
      li.innerHTML =
        '<div class="daire-ayar-meta">' +
        '<span class="daire-ayar-kat">' + esc(daireKatEtiket(d)) + '</span>' +
        '</div>' +
        '<input type="text" class="field-input daire-ayar-ad" data-id="' + esc(d.id) + '" ' +
        'value="' + esc(d.ad) + '" maxlength="40" aria-label="' + esc(daireKatEtiket(d)) + ' adı" />';
      ul.appendChild(li);
    });
  }

  function daireAc() {
    uyari("daire-uyari", "");
    daireListeRender();
    modalDaire()?.classList.remove("hidden");
    modalDaire()?.querySelector(".daire-ayar-ad")?.focus();
  }

  function daireKapat() {
    modalDaire()?.classList.add("hidden");
    uyari("daire-uyari", "");
  }

  async function daireKaydet() {
    const inputs = modalDaire()?.querySelectorAll(".daire-ayar-ad");
    if (!inputs || !inputs.length) return;
    uyari("daire-uyari", "");
    try {
      for (const inp of inputs) {
        const id = inp.dataset.id;
        const ad = inp.value.trim();
        if (!ad) {
          uyari("daire-uyari", "Tüm dairelerin adı dolu olmalı.");
          return;
        }
        const mevcut = window.APARTIM.db.daireGetir(id);
        if (mevcut && mevcut.ad !== ad) {
          await window.APARTIM.db.daireGuncelle(id, { ad });
        }
      }
      window.APARTIM.toast("Daire isimleri kaydedildi", "basari");
      daireKapat();
    } catch (err) {
      uyari("daire-uyari", err.message || "Kaydedilemedi.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ayar-kaynaklar")?.addEventListener("click", () => {
      document.getElementById("ayar-menu")?.classList.add("hidden");
      kaynakAc();
    });
    document.getElementById("kaynaklar-close")?.addEventListener("click", kaynakKapat);
    document.getElementById("kaynaklar-kapat")?.addEventListener("click", kaynakKapat);
    document.getElementById("kaynak-ekle-btn")?.addEventListener("click", kaynakEkle);
    document.getElementById("kaynak-yeni-ad")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        kaynakEkle();
      }
    });

    document.getElementById("ayar-daireler")?.addEventListener("click", () => {
      document.getElementById("ayar-menu")?.classList.add("hidden");
      daireAc();
    });
    document.getElementById("daireler-close")?.addEventListener("click", daireKapat);
    document.getElementById("daireler-kapat")?.addEventListener("click", daireKapat);
    document.getElementById("daireler-kaydet")?.addEventListener("click", daireKaydet);
  });

  document.addEventListener("apartim:veri-degisti", (e) => {
    if (e.detail?.sebep === "musteri-kaynaklari" && modalKaynak() && !modalKaynak().classList.contains("hidden")) {
      kaynakListeRender();
    }
    if (e.detail?.sebep === "daireler" && modalDaire() && !modalDaire().classList.contains("hidden")) {
      daireListeRender();
    }
  });

  window.APARTIM.ayarlar = { kaynakAc, kaynakKapat, daireAc, daireKapat };
})();
