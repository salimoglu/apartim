/* =========================================================
   APARTIM — Aylık takvim
   Belirli bir daire için ay görünümü; dolu/boş/temiz/kirli renkler.
   Hücreye tıklamak: boşsa yeni rezervasyon, doluysa detay açar.
   ========================================================= */

(function () {
  "use strict";

  const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                     "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const GUN_ADLARI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  const durum = { daireId: null, yil: null, ay: null }; // ay: 0-11

  function bugun() { return new Date(); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }

  function ayOlustur(daireId, yil, ay) {
    durum.daireId = daireId;
    if (yil == null || ay == null) {
      const b = bugun();
      durum.yil = b.getFullYear();
      durum.ay = b.getMonth();
    } else {
      durum.yil = yil;
      durum.ay = ay;
    }
    ciz();
  }

  function git(yon) {
    let y = durum.yil, m = durum.ay + yon;
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    durum.yil = y; durum.ay = m;
    ciz();
  }
  function bugunYap() {
    const b = bugun();
    durum.yil = b.getFullYear();
    durum.ay = b.getMonth();
    ciz();
  }

  function rezerveListesi() {
    const db = window.APARTIM.db;
    return db ? db.rezervasyonlarListele(durum.daireId) : [];
  }

  function gunSinifi(isoTarih, daire) {
    const gd = window.APARTIM.db.daireGunDurumu(durum.daireId, isoTarih);
    const sinif = [];

    if (gd.tip === "turnover") {
      sinif.push("dolu", "turnover", "cikis", "giris");
      return { sinif: sinif.join(" "), gd, rez: gd.giris };
    }
    if (gd.tip === "checkin") {
      sinif.push("dolu", "giris");
      return { sinif: sinif.join(" "), gd, rez: gd.rez };
    }
    if (gd.tip === "checkout") {
      sinif.push("cikis");
      if (daire && daire.temizlik === "kirli") sinif.push("bos-kirli");
      return { sinif: sinif.join(" "), gd, rez: gd.rez };
    }
    if (gd.tip === "konak") {
      sinif.push("dolu");
      return { sinif: sinif.join(" "), gd, rez: gd.rez };
    }
    if (daire && daire.temizlik === "kirli") sinif.push("bos-kirli");
    return { sinif: sinif.join(" "), gd, rez: null };
  }

  function ciz() {
    const baslikEl = document.getElementById("takvim-ay-baslik");
    const grid = document.getElementById("takvim-grid");
    if (!baslikEl || !grid) return;
    baslikEl.textContent = AY_ADLARI[durum.ay] + " " + durum.yil;
    grid.innerHTML = "";

    // Gün başlıkları
    GUN_ADLARI.forEach((g) => {
      const h = document.createElement("div");
      h.className = "takvim-gun-basligi";
      h.textContent = g;
      grid.appendChild(h);
    });

    const ilk = new Date(durum.yil, durum.ay, 1);
    const sonGun = new Date(durum.yil, durum.ay + 1, 0).getDate();
    let hafGun = ilk.getDay() - 1;
    if (hafGun < 0) hafGun = 6;

    // Önceki ay padding (disabled)
    const oncekiSonGun = new Date(durum.yil, durum.ay, 0).getDate();
    for (let i = hafGun - 1; i >= 0; i--) {
      const h = document.createElement("div");
      h.className = "takvim-hucre disabled";
      const no = document.createElement("span");
      no.className = "takvim-gun-no";
      no.textContent = oncekiSonGun - i;
      h.appendChild(no);
      grid.appendChild(h);
    }

    const db = window.APARTIM.db;
    const daire = db ? db.daireGetir(durum.daireId) : null;
    const bg = db ? db.bugunISO() : "";

    for (let d = 1; d <= sonGun; d++) {
      const isoT = iso(durum.yil, durum.ay, d);
      const { sinif, gd, rez } = gunSinifi(isoT, daire);
      const h = document.createElement("div");
      h.className = "takvim-hucre " + sinif;
      if (isoT === bg) h.classList.add("bugun");
      h.dataset.tarih = isoT;

      const no = document.createElement("span");
      no.className = "takvim-gun-no";
      no.textContent = d;
      h.appendChild(no);

      if (gd.tip === "turnover") {
        const info = document.createElement("span");
        info.className = "takvim-gun-bilgi";
        info.textContent = "↗ " + (gd.cikis.misafirAdi || "Çıkış") + " · ↘ " + (gd.giris.misafirAdi || "Giriş");
        info.title = "CHECK OUT: " + gd.cikis.misafirAdi + " → CHECK IN: " + gd.giris.misafirAdi;
        h.appendChild(info);
      } else if (rez) {
        const info = document.createElement("span");
        info.className = "takvim-gun-bilgi";
        info.textContent = rez.misafirAdi || "Misafir";
        info.title = (rez.misafirAdi || "Misafir") + " • " + rez.giris + " → " + rez.cikis;
        h.appendChild(info);
      } else if (daire && daire.temizlik === "kirli") {
        const info = document.createElement("span");
        info.className = "takvim-gun-bilgi";
        info.textContent = "Temizlenecek";
        h.appendChild(info);
      }

      h.addEventListener("click", () => {
        const rezervasyon = window.APARTIM.rezervasyon;
        if (!rezervasyon) {
          window.APARTIM.toast("Rezervasyon modülü yüklenemedi", "hata");
          return;
        }
        if (gd.tip === "turnover") {
          const sec = confirm(
            "CHECK OUT: " + (gd.cikis.misafirAdi || "—") + "\nCHECK IN: " + (gd.giris.misafirAdi || "—") +
            "\n\nGiriş rezervasyonunu düzenlemek için Tamam, çıkış için İptal'e basın."
          );
          const id = rezervasyon.rezIdAl(sec ? gd.giris : gd.cikis);
          if (id) rezervasyon.duzenle(id);
          return;
        }
        if (rez) {
          const id = rezervasyon.rezIdAl(rez);
          if (id) rezervasyon.duzenle(id);
        } else {
          rezervasyon.yeni({
            daireId: durum.daireId,
            girisOnseci: isoT
          });
        }
      });
      grid.appendChild(h);
    }

    // Sonraki ay padding
    const toplam = grid.children.length - 7; // başlıklar hariç
    const eksik = (7 - (toplam % 7)) % 7;
    for (let i = 1; i <= eksik; i++) {
      const h = document.createElement("div");
      h.className = "takvim-hucre disabled";
      const no = document.createElement("span");
      no.className = "takvim-gun-no";
      no.textContent = i;
      h.appendChild(no);
      grid.appendChild(h);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("takvim-prev")?.addEventListener("click", () => git(-1));
    document.getElementById("takvim-next")?.addEventListener("click", () => git(1));
    document.getElementById("takvim-bugun")?.addEventListener("click", bugunYap);
  });
  document.addEventListener("apartim:veri-degisti", () => {
    if (durum.daireId) ciz();
  });

  window.APARTIM.takvim = {
    ayOlustur,
    yenidenCiz: ciz,
    durum
  };
})();
