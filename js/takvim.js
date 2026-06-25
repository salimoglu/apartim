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

  function fmt(n) { return Number(n || 0).toLocaleString("tr-TR"); }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  function kisaAd(ad, maxLen) {
    const s = String(ad || "");
    const m = maxLen || 10;
    return s.length > m ? s.slice(0, m - 1) + "…" : s;
  }

  /** Özet tablo ile uyumlu: gece no, kategori, o gecenin ücreti */
  function konakBilgi(rez, tarih, hucreTip) {
    const db = window.APARTIM.db;
    if (!db || !rez) return null;
    const toplamGece = db.geceSayisi(rez.giris, rez.cikis);
    let geceNo = db.geceSayisi(rez.giris, tarih) + 1;
    let geceEtiket = "";

    if (hucreTip === "checkout") {
      geceNo = Math.max(1, toplamGece);
      geceEtiket = toplamGece + " gece";
    } else if (hucreTip === "checkin") {
      geceNo = 1;
      geceEtiket = "1/" + toplamGece;
    } else {
      geceNo = Math.min(Math.max(1, geceNo), Math.max(1, toplamGece));
      geceEtiket = geceNo + "/" + toplamGece;
    }

    return {
      ad: kisaAd(rez.misafirAdi || "Misafir", 12),
      geceEtiket,
      simge: db.musteriKaynagiSimge(rez.kaynakId),
      ucret: db.rezervasyonGeceUcreti(rez, geceNo),
      title: (rez.misafirAdi || "Misafir") + " • " + rez.giris + " → " + rez.cikis +
        " • " + geceEtiket + " • " + fmt(db.rezervasyonGeceUcreti(rez, geceNo)) + " TL"
    };
  }

  function rezBilgiHtml(bilgi) {
    if (!bilgi) return "";
    return (
      '<div class="takvim-rez">' +
        '<div class="takvim-rez-ad">' + esc(bilgi.ad) + '</div>' +
        '<div class="takvim-rez-meta">' +
          '<span class="takvim-rez-gece">' + esc(bilgi.geceEtiket) + '</span>' +
          '<span class="takvim-rez-kat" title="Kaynak">' + esc(bilgi.simge) + '</span>' +
          '<span class="takvim-rez-ucret">' + fmt(bilgi.ucret) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  const UZUN_BAS_MS = 450;

  function rezDetayHtml(rez, isoT, hucreTip, baslikEtiket) {
    const db = window.APARTIM.db;
    if (!db || !rez) return "";
    const bilgi = konakBilgi(rez, isoT, hucreTip);
    if (!bilgi) return "";
    const ozet = db.rezervasyonOzeti(rez);
    const kaynak = db.musteriKaynagiAd(rez.kaynakId) || "—";
    const odenen = db.rezervasyonOdenenToplam(rez);
    const kalan = db.rezervasyonKalanHesapla(rez);
    const fazla = db.rezervasyonFazlaOdenen(rez);
    const pb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    const fmtPb = (n) => window.APARTIM.para
      ? window.APARTIM.para.formatTutar(n, pb)
      : fmt(n) + " TL";

    return (
      '<div class="takvim-detay-blok">' +
        (baslikEtiket
          ? '<div class="takvim-detay-etiket">' + esc(baslikEtiket) + "</div>"
          : "") +
        '<div class="takvim-detay-ad">' + esc(rez.misafirAdi || "Misafir") + "</div>" +
        '<div class="takvim-detay-satir"><span>Giriş – Çıkış</span><strong>' +
          esc(rez.giris) + " → " + esc(rez.cikis) + "</strong></div>" +
        '<div class="takvim-detay-satir"><span>Gece</span><strong>' +
          esc(bilgi.geceEtiket) + " / " + ozet.toplamGece + "</strong></div>" +
        '<div class="takvim-detay-satir"><span>Kaynak</span><strong>' +
          esc(bilgi.simge + " " + kaynak) + "</strong></div>" +
        '<div class="takvim-detay-satir"><span>Bu gece</span><strong>' +
          fmt(bilgi.ucret) + " TL</strong></div>" +
        '<div class="takvim-detay-satir"><span>Toplam</span><strong>' +
          fmtPb(ozet.toplamTutar) + "</strong></div>" +
        (odenen > 0
          ? '<div class="takvim-detay-satir"><span>Ödenen</span><strong>' +
            fmtPb(odenen) + "</strong></div>"
          : "") +
        (fazla > 0
          ? '<div class="takvim-detay-satir"><span>Fazla ödeme</span><strong>' +
            fmtPb(fazla) + "</strong></div>"
          : (kalan > 0
            ? '<div class="takvim-detay-satir"><span>Kalan</span><strong>' +
              fmtPb(kalan) + "</strong></div>"
            : (odenen > 0
              ? '<div class="takvim-detay-satir"><span>Durum</span><strong>Kapalı</strong></div>'
              : ""))) +
      "</div>"
    );
  }

  function turnoverDetayHtml(isoT, cikis, giris) {
    return (
      rezDetayHtml(cikis, isoT, "checkout", "CHECK OUT") +
      rezDetayHtml(giris, isoT, "checkin", "CHECK IN")
    );
  }

  function takvimDetayGoster(html, tarih) {
    if (!html) return;
    let pop = document.getElementById("takvim-detay-pop");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "takvim-detay-pop";
      pop.className = "takvim-detay-pop hidden";
      pop.innerHTML =
        '<div class="takvim-detay-kutu" role="dialog" aria-modal="true">' +
          '<div class="takvim-detay-baslik">' +
            '<span class="takvim-detay-tarih"></span>' +
            '<button type="button" class="takvim-detay-kapat" aria-label="Kapat">×</button>' +
          "</div>" +
          '<div class="takvim-detay-icerik"></div>' +
          '<p class="takvim-detay-ipucu">Düzenlemek için kısa dokunuş</p>' +
        "</div>";
      document.body.appendChild(pop);
      pop.addEventListener("click", (e) => {
        if (e.target === pop || e.target.closest(".takvim-detay-kapat")) {
          pop.classList.add("hidden");
        }
      });
      pop.querySelector(".takvim-detay-kutu").addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }
    pop.querySelector(".takvim-detay-tarih").textContent = tarih || "";
    pop.querySelector(".takvim-detay-icerik").innerHTML = html;
    pop.classList.remove("hidden");
  }

  function hucreTiklamaBagla(h, onKisa, onUzun) {
    let timer = null;
    let uzunBasildi = false;
    let baslangic = null;

    function temizle() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    h.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      uzunBasildi = false;
      if (!onUzun) return;
      baslangic = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => {
        uzunBasildi = true;
        temizle();
        try { navigator.vibrate?.(12); } catch (_) { /* yoksay */ }
        onUzun();
      }, UZUN_BAS_MS);
    });

    h.addEventListener("pointermove", (e) => {
      if (!timer || !baslangic) return;
      const dx = e.clientX - baslangic.x;
      const dy = e.clientY - baslangic.y;
      if (dx * dx + dy * dy > 144) temizle();
    });

    h.addEventListener("pointerup", temizle);
    h.addEventListener("pointercancel", temizle);
    h.addEventListener("pointerleave", temizle);

    h.addEventListener("click", (e) => {
      if (uzunBasildi) {
        e.preventDefault();
        e.stopPropagation();
        uzunBasildi = false;
        return;
      }
      onKisa();
    });

    h.addEventListener("contextmenu", (e) => {
      if (onUzun) e.preventDefault();
    });
  }

  function turnoverBilgiHtml(isoT, cikis, giris) {
    const bOut = konakBilgi(cikis, isoT, "checkout");
    const bIn = konakBilgi(giris, isoT, "checkin");
    const satir = (etiket, b) => b ? (
      '<div class="takvim-turnover-satir">' +
        '<span class="takvim-io ' + etiket + '">' + (etiket === "out" ? "OUT" : "IN") + '</span>' +
        '<span class="takvim-turnover-ad">' + esc(b.ad) + '</span>' +
        '<span class="takvim-rez-gece">' + esc(b.geceEtiket) + '</span>' +
        '<span class="takvim-rez-kat">' + esc(b.simge) + '</span>' +
        '<span class="takvim-rez-ucret">' + fmt(b.ucret) + '</span>' +
      '</div>'
    ) : "";
    return '<div class="takvim-turnover-stack">' + satir("out", bOut) + satir("in", bIn) + '</div>';
  }

  function hucreBilgiEkle(h, gd, rez, isoT) {
    if (gd.tip === "turnover") {
      const info = document.createElement("div");
      info.className = "takvim-gun-bilgi takvim-gun-bilgi-dolu";
      info.innerHTML = turnoverBilgiHtml(isoT, gd.cikis, gd.giris);
      info.title = "OUT: " + (gd.cikis.misafirAdi || "—") + " → IN: " + (gd.giris.misafirAdi || "—");
      h.appendChild(info);
      return;
    }
    if (!rez) return;

    let hucreTip = "konak";
    if (gd.tip === "checkin") hucreTip = "checkin";
    else if (gd.tip === "checkout") hucreTip = "checkout";

    const bilgi = konakBilgi(rez, isoT, hucreTip);
    if (!bilgi) return;

    const info = document.createElement("div");
    info.className = "takvim-gun-bilgi takvim-gun-bilgi-dolu";
    info.innerHTML = rezBilgiHtml(bilgi);
    info.title = bilgi.title;
    h.appendChild(info);
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
      return { sinif: sinif.join(" "), gd, rez: gd.rez };
    }
    if (gd.tip === "konak") {
      sinif.push("dolu");
      return { sinif: sinif.join(" "), gd, rez: gd.rez };
    }
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
        hucreBilgiEkle(h, gd, rez, isoT);
      } else if (rez) {
        hucreBilgiEkle(h, gd, rez, isoT);
      }

      const kisaTik = () => {
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
      };

      const uzunBas = () => {
        if (gd.tip === "turnover") {
          takvimDetayGoster(turnoverDetayHtml(isoT, gd.cikis, gd.giris), isoT);
          return;
        }
        if (!rez) return;
        let hucreTip = "konak";
        if (gd.tip === "checkin") hucreTip = "checkin";
        else if (gd.tip === "checkout") hucreTip = "checkout";
        takvimDetayGoster(rezDetayHtml(rez, isoT, hucreTip, null), isoT);
      };

      if (gd.tip === "turnover" || rez) {
        hucreTiklamaBagla(h, kisaTik, uzunBas);
      } else {
        h.addEventListener("click", kisaTik);
      }
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
