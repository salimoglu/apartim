/* =========================================================
   APARTIM — Ayarlar (müşteri kaynak kategorileri)
   ========================================================= */

(function () {
  "use strict";

  const modal = () => document.getElementById("modal-kaynaklar");

  function uyari(msg) {
    const el = document.getElementById("kaynak-uyari");
    if (!el) return;
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.classList.remove("hidden");
    el.textContent = msg;
  }

  function listeRender() {
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
        li.querySelector(".kaynak-sil-btn").addEventListener("click", () => sil(k.id));
      }
      ul.appendChild(li);
    });
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  function ac() {
    uyari("");
    listeRender();
    modal()?.classList.remove("hidden");
    document.getElementById("kaynak-yeni-ad")?.focus();
  }

  function kapat() {
    modal()?.classList.add("hidden");
    uyari("");
    const inp = document.getElementById("kaynak-yeni-ad");
    if (inp) inp.value = "";
  }

  async function ekle() {
    const inp = document.getElementById("kaynak-yeni-ad");
    const ad = inp?.value.trim();
    if (!ad) {
      uyari("Kategori adı yazın.");
      return;
    }
    try {
      await window.APARTIM.db.musteriKaynagiEkle(ad);
      if (inp) inp.value = "";
      uyari("");
      listeRender();
      window.APARTIM.toast("Kategori eklendi", "basari");
    } catch (err) {
      uyari(err.message || "Eklenemedi.");
    }
  }

  async function sil(id) {
    if (!confirm("Bu kategoriyi silmek istiyor musunuz?")) return;
    try {
      await window.APARTIM.db.musteriKaynagiSil(id);
      listeRender();
      window.APARTIM.toast("Kategori silindi", "basari");
    } catch (err) {
      uyari(err.message || "Silinemedi.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ayar-kaynaklar")?.addEventListener("click", () => {
      document.getElementById("ayar-menu")?.classList.add("hidden");
      ac();
    });
    document.getElementById("kaynaklar-close")?.addEventListener("click", kapat);
    document.getElementById("kaynaklar-kapat")?.addEventListener("click", kapat);
    document.getElementById("kaynak-ekle-btn")?.addEventListener("click", ekle);
    document.getElementById("kaynak-yeni-ad")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        ekle();
      }
    });
  });

  document.addEventListener("apartim:veri-degisti", (e) => {
    if (e.detail?.sebep === "musteri-kaynaklari" && modal() && !modal().classList.contains("hidden")) {
      listeRender();
    }
  });

  window.APARTIM.ayarlar = { ac, kapat };
})();
