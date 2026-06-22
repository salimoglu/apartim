/* =========================================================
   APARTIM — Temizlik durumu
   3 durum: temiz, kirli, temizleniyor.
   Kısa tıklama: temiz ↔ kirli (temizleniyor → temiz).
   Uzun bas: temizleniyor.
   ========================================================= */

(function () {
  "use strict";

  const DURUM_METIN = {
    temiz: "Temiz",
    kirli: "Temizlenecek",
    temizleniyor: "Temizleniyor"
  };
  const DURUM_SINIF = {
    temiz: "temiz",
    kirli: "kirli",
    temizleniyor: "temizleniyor"
  };

  async function durumDegistir(daireId, yeniDurum, opts) {
    const db = window.APARTIM.db;
    const daire = db.daireGetir(daireId);
    if (!daire) return;
    const eski = daire.temizlik || "temiz";
    if (eski === yeniDurum) return;

    if (!opts?.zorla) {
      const bugun = db.daireDurumuBugun(daireId);
      if (bugun.durum === "dolu") {
        window.APARTIM.toast("Daire dolu — temizlik durumu değiştirilemez", "uyari");
        return;
      }
    }

    await db.daireGuncelle(daireId, { temizlik: yeniDurum, temizlikGuncelleme: Date.now() });
    await db.temizlikLogEkle(daireId, eski, yeniDurum);
    window.APARTIM.toast("Temizlik: " + DURUM_METIN[yeniDurum], "basari");
  }

  function dongusel(daireId) {
    const daire = window.APARTIM.db.daireGetir(daireId);
    if (!daire) return;
    const mevcut = daire.temizlik || "temiz";
    let sonra;
    if (mevcut === "temizleniyor" || mevcut === "kirli") sonra = "temiz";
    else sonra = "kirli";
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
      '<div class="temizlik-kart-ikon">' + ikon + "</div>" +
      '<div class="temizlik-kart-detay">' +
        '<div class="ust">' + (daire ? daire.ad : log.daireId) +
          " — " + (DURUM_METIN[log.eskiDurum] || log.eskiDurum) +
          ' <span style="color:var(--metin-soluk-2)">→</span> ' +
          (DURUM_METIN[log.yeniDurum] || log.yeniDurum) + "</div>" +
        '<div class="alt">' + tarihStr + "</div>" +
      "</div>";
    return div;
  }

  function odaKartOlustur(daire) {
    const db = window.APARTIM.db;
    const bugun = db.daireDurumuBugun(daire.id);
    const t = daire.temizlik || "temiz";
    const dolu = bugun.durum === "dolu";

    const div = document.createElement("div");
    div.className = "temizlik-oda-kart durum-" + (DURUM_SINIF[t] || "temiz");
    if (dolu) div.classList.add("dolu");

    const bilgi = dolu
      ? "Bugün dolu — " + (bugun.rez?.misafirAdi || "misafir")
      : DURUM_METIN[t];

    div.innerHTML =
      '<div class="temizlik-oda-ust">' +
        '<span class="temizlik-oda-ad">' + daire.ad + "</span>" +
        '<span class="temizlik-oda-durum">' + bilgi + "</span>" +
      "</div>" +
      '<div class="temizlik-oda-btns">' +
        ['temiz', 'kirli', 'temizleniyor'].map((d) =>
          '<button type="button" class="temizlik-oda-btn' +
          (t === d ? " active" : "") +
          (dolu ? " disabled" : "") +
          '" data-durum="' + d + '">' + DURUM_METIN[d] + "</button>"
        ).join("") +
      "</div>";

    if (!dolu) {
      div.querySelectorAll(".temizlik-oda-btn").forEach((btn) => {
        btn.addEventListener("click", () => durumDegistir(daire.id, btn.dataset.durum));
      });
    }
    return div;
  }

  function odaListesiRender() {
    const c = document.getElementById("temizlik-oda-liste");
    if (!c) return;
    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) {
      c.innerHTML = '<div class="rez-bos">Yükleniyor…</div>';
      return;
    }
    const daireler = db.dairelerListele();
    c.innerHTML = "";
    daireler.forEach((d) => c.appendChild(odaKartOlustur(d)));
  }

  function logListesiRender(containerId, daireId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) {
      c.innerHTML = '<div class="rez-bos">Yükleniyor…</div>';
      return;
    }
    const liste = db.temizlikLogListele(daireId);
    if (!liste.length) {
      c.innerHTML = '<div class="rez-bos">Henüz temizlik kaydı yok</div>';
      return;
    }
    c.innerHTML = "";
    liste.slice(0, daireId ? 50 : 30).forEach((l) => c.appendChild(logKartOlustur(l)));
  }

  function daireTemizlikListele(daireId) {
    logListesiRender("temizlik-liste-icerik", daireId);
  }

  function tumTemizlikListele() {
    odaListesiRender();
    logListesiRender("tum-temizlik-liste");
  }

  function uzunBasBagla(btn, daireIdFn) {
    let uzunBasZ = null;
    let uzunBasildi = false;
    let aktifPointer = null;

    function temizle() {
      if (uzunBasZ) { clearTimeout(uzunBasZ); uzunBasZ = null; }
      aktifPointer = null;
    }

    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (aktifPointer != null) return;
      aktifPointer = e.pointerId;
      uzunBasildi = false;
      uzunBasZ = setTimeout(() => {
        uzunBasildi = true;
        const id = daireIdFn();
        if (id) durumDegistir(id, "temizleniyor");
      }, 600);
    });

    btn.addEventListener("pointerup", (e) => {
      if (e.pointerId !== aktifPointer) return;
      if (uzunBasildi) { temizle(); return; }
      const id = daireIdFn();
      if (id) dongusel(id);
      temizle();
    });

    btn.addEventListener("pointercancel", temizle);
    btn.addEventListener("pointerleave", (e) => {
      if (e.pointerId !== aktifPointer) return;
      temizle();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("daire-temizlik");
    if (btn) {
      uzunBasBagla(btn, () => window.APARTIM.daire?.aktifId());
    }
  });

  document.addEventListener("apartim:veri-degisti", () => {
    const id = window.APARTIM.daire?.aktifId();
    if (id) {
      rozetGuncelle(id);
      daireTemizlikListele(id);
    }
    tumTemizlikListele();
  });

  document.addEventListener("apartim:auth-hazir", () => {
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
