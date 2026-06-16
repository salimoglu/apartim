/* =========================================================
   APARTIM — Temizlik durumu
   3 durum: temiz, kirli, temizleniyor.
   Tıklama: temiz↔kirli toggle (uzun bas: temizleniyor).
   Her değişim temizlik-kayit log'una düşer.
   ========================================================= */

(function () {
  "use strict";

  const DURUM_METIN = {
    temiz: "Temiz",
    kirli: "Kirli",
    temizleniyor: "Temizleniyor"
  };
  const SIRA = ["temiz", "kirli", "temizleniyor"];

  async function durumDegistir(daireId, yeniDurum) {
    const db = window.APARTIM.db;
    const daire = db.daireGetir(daireId);
    if (!daire) return;
    const eski = daire.temizlik || "temiz";
    if (eski === yeniDurum) return;
    await db.daireGuncelle(daireId, { temizlik: yeniDurum, temizlikGuncelleme: Date.now() });
    await db.temizlikLogEkle(daireId, eski, yeniDurum);
    window.APARTIM.toast("Temizlik: " + DURUM_METIN[yeniDurum], "basari");
  }

  function dongusel(daireId) {
    const daire = window.APARTIM.db.daireGetir(daireId);
    if (!daire) return;
    const mevcut = daire.temizlik || "temiz";
    const i = SIRA.indexOf(mevcut);
    const sonra = SIRA[(i + 1) % SIRA.length];
    durumDegistir(daireId, sonra);
  }

  function rozetGuncelle(daireId) {
    const btn = document.getElementById("daire-temizlik");
    const metin = document.getElementById("daire-temizlik-metin");
    const daire = window.APARTIM.db.daireGetir(daireId);
    if (!btn || !daire) return;
    const d = daire.temizlik || "temiz";
    btn.dataset.durum = d;
    if (metin) metin.textContent = DURUM_METIN[d];
  }

  function logKartOlustur(log) {
    const daire = window.APARTIM.db.daireGetir(log.daireId);
    const tarih = new Date(log.zaman || Date.now());
    const tarihStr = tarih.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
    const ikon = log.yeniDurum === "temiz" ? "✨"
              : log.yeniDurum === "kirli" ? "🧺"
              : "🧹";
    const div = document.createElement("div");
    div.className = "temizlik-kart";
    div.innerHTML =
      '<div class="temizlik-kart-ikon">' + ikon + '</div>' +
      '<div class="temizlik-kart-detay">' +
        '<div class="ust">' + (daire ? daire.ad : log.daireId) +
          ' — ' + (DURUM_METIN[log.eskiDurum] || log.eskiDurum) +
          ' <span style="color:var(--metin-soluk-2)">→</span> ' +
          (DURUM_METIN[log.yeniDurum] || log.yeniDurum) + '</div>' +
        '<div class="alt">' + tarihStr + '</div>' +
      '</div>';
    return div;
  }

  function listeRender(containerId, daireId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const liste = window.APARTIM.db.temizlikLogListele(daireId);
    if (!liste.length) {
      c.innerHTML = '<div class="rez-bos">Henüz temizlik kaydı yok</div>';
      return;
    }
    c.innerHTML = "";
    liste.forEach((l) => c.appendChild(logKartOlustur(l)));
  }

  function daireTemizlikListele(daireId) { listeRender("temizlik-liste-icerik", daireId); }
  function tumTemizlikListele() { listeRender("tum-temizlik-liste"); }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("daire-temizlik");
    if (!btn) return;

    // Kısa tıklama: dongüsel ilerleme
    let basildi = 0;
    let uzunBasildi = false;
    let bekleyenZ = null;
    function basla() {
      basildi = Date.now();
      uzunBasildi = false;
      bekleyenZ = setTimeout(() => {
        uzunBasildi = true;
        // Uzun bas: direkt "temizleniyor"
        const id = window.APARTIM.daire?.aktifId();
        if (id) durumDegistir(id, "temizleniyor");
      }, 600);
    }
    function bitir() {
      if (bekleyenZ) { clearTimeout(bekleyenZ); bekleyenZ = null; }
      if (uzunBasildi) return;
      const id = window.APARTIM.daire?.aktifId();
      if (id) dongusel(id);
    }
    btn.addEventListener("mousedown", basla);
    btn.addEventListener("mouseup", bitir);
    btn.addEventListener("mouseleave", () => {
      if (bekleyenZ) { clearTimeout(bekleyenZ); bekleyenZ = null; }
    });
    btn.addEventListener("touchstart", (e) => { basla(); }, { passive: true });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); bitir(); });
  });

  document.addEventListener("apartim:veri-degisti", () => {
    const id = window.APARTIM.daire?.aktifId();
    if (id) {
      rozetGuncelle(id);
      daireTemizlikListele(id);
    }
    tumTemizlikListele();
  });

  window.APARTIM.temizlik = {
    durumDegistir,
    dongusel,
    rozetGuncelle,
    daireTemizlikListele,
    tumTemizlikListele,
    DURUM_METIN
  };
})();
