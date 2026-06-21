/* =========================================================
   APARTIM — Rezervasyon özet tablosu (tüm odalar)
   Tarih satırları × daire sütunları, Excel benzeri görünüm.
   ========================================================= */

(function () {
  "use strict";

  const GUN_KISA = ["PAZ", "PZT", "SAL", "ÇAR", "PER", "CUM", "CMT"];
  const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  const DAIRE_RENK = {
    "ust": "#ffcdd2",
    "orta-sol": "#c8e6c9",
    "orta-sag": "#bbdefb",
    "alt-sol": "#fff9c4",
    "alt-sag": "#e1bee7"
  };
  const DAIRE_RENK_YEDEK = ["#ffcdd2", "#c8e6c9", "#bbdefb", "#fff9c4", "#e1bee7", "#ffe0b2", "#b2dfdb"];

  const durum = {
    yil: new Date().getFullYear(),
    ay: new Date().getMonth(),
    seciliTarih: null
  };

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function fmt(n) { return Number(n || 0).toLocaleString("tr-TR"); }
  function ayinGunSayisi(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function tarihGoster(isoStr) {
    const p = isoStr.split("-");
    return p[2] + "." + p[1] + "." + p[0];
  }

  function gunAdi(isoStr) {
    const d = new Date(isoStr + "T12:00:00");
    return GUN_KISA[d.getDay()];
  }

  function kaynakSimge(rez) {
    if (!rez || !rez.kaynakId) return "—";
    return window.APARTIM.db.musteriKaynagiSimge(rez.kaynakId);
  }

  function kaynakBaslik(rez) {
    if (!rez) return "";
    return rez.kaynakAd || window.APARTIM.db.musteriKaynagiAd(rez.kaynakId) || "";
  }

  function kaynakSimgeHtml(rez) {
    const baslik = kaynakBaslik(rez);
    return '<span class="rez-ozet-kategori-simge" title="' + esc(baslik) + '">' +
      esc(kaynakSimge(rez)) + '</span>';
  }

  function daireBaslik(d) {
    return d.ad || d.id;
  }

  /** Özet tablo: alt kattan üste (kat 1 → 3) */
  function dairelerOzetSirasi(db) {
    const konumSira = { sol: 0, sag: 1, tek: 2 };
    return db.dairelerListele().slice().sort((a, b) => {
      const ka = a.kat || 0;
      const kb = b.kat || 0;
      if (ka !== kb) return ka - kb;
      const diff = (konumSira[a.konum] ?? 9) - (konumSira[b.konum] ?? 9);
      if (diff) return diff;
      return (a.sira || 0) - (b.sira || 0);
    });
  }

  function daireRenk(d, i) {
    return DAIRE_RENK[d.id] || DAIRE_RENK_YEDEK[i % DAIRE_RENK_YEDEK.length];
  }

  /** Gün durumu — db.daireGunDurumu kullanır */
  function gunDurumu(daireId, tarih) {
    return window.APARTIM.db.daireGunDurumu(daireId, tarih);
  }

  function turnoverHtml(cikis, giris, tarih) {
    const det = konakDetay(giris, tarih);
    return (
      '<div class="rez-ozet-turnover-stack">' +
      '<div class="rez-ozet-turnover-bolum">' +
      '<div class="rez-ozet-check checkout rez-ozet-tik" data-rez-id="' + esc(cikis.id) + '">CHECK OUT</div>' +
      '<div class="rez-ozet-ad-alt">' + esc(cikis.misafirAdi) + '</div></div>' +
      '<div class="rez-ozet-turnover-ayrac" aria-hidden="true"></div>' +
      '<div class="rez-ozet-turnover-bolum">' +
      '<div class="rez-ozet-check checkin rez-ozet-tik" data-rez-id="' + esc(giris.id) + '">CHECK IN</div>' +
      '<div class="rez-ozet-detay">' +
      '<span>' + det.g + '</span><span>' + det.kategoriHtml + '</span><span>' + fmt(det.prc) + '</span>' +
      '<span>' + fmt(det.toplam) + '</span><span class="rez-ozet-ad">' + esc(det.misafir) + '</span></div></div></div>'
    );
  }

  function konakDetay(rez, tarih) {
    const db = window.APARTIM.db;
    const g = db.geceSayisi(rez.giris, tarih) + 1;
    const kalanGece = db.geceSayisi(tarih, rez.cikis);
    const toplam = rez.toplamTutar != null
      ? rez.toplamTutar
      : db.geceSayisi(rez.giris, rez.cikis) * (Number(rez.gunlukUcret) || 0);
    return {
      g,
      kategori: kaynakSimge(rez),
      kategoriHtml: kaynakSimgeHtml(rez),
      prc: rez.gunlukUcret,
      rmnd: kalanGece * (Number(rez.gunlukUcret) || 0),
      toplam,
      misafir: rez.misafirAdi
    };
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  function tikBagla(wrap) {
    wrap.querySelectorAll(".rez-ozet-tik").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = el.dataset.rezId || el.getAttribute("data-rez-id");
        if (id && window.APARTIM.rezervasyon) window.APARTIM.rezervasyon.duzenle(id);
      });
    });
  }

  function tabloCiz() {
    const wrap = document.getElementById("rez-ozet-tablo");
    const baslik = document.getElementById("rez-ozet-ay-baslik");
    if (!wrap) return;

    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) {
      wrap.innerHTML = '<div class="rez-bos">Yükleniyor...</div>';
      return;
    }

    const y = durum.yil;
    const m = durum.ay;
    if (baslik) baslik.textContent = AY_ADLARI[m] + " " + y;

    const daireler = dairelerOzetSirasi(db);
    const gunSay = ayinGunSayisi(y, m);
    const bugun = db.bugunISO();

    const table = document.createElement("table");
    table.className = "rez-ozet-table";

    const thead = document.createElement("thead");
    const tr1 = document.createElement("tr");
    tr1.className = "rez-ozet-tr-daire";
    const kose = document.createElement("th");
    kose.className = "rez-ozet-tarih-kose";
    kose.rowSpan = 2;
    kose.textContent = "Tarih";
    tr1.appendChild(kose);

    daireler.forEach((d, i) => {
      const th = document.createElement("th");
      th.className = "rez-ozet-daire-baslik";
      th.colSpan = 5;
      th.style.background = daireRenk(d, i);
      th.textContent = daireBaslik(d);
      tr1.appendChild(th);
    });
    thead.appendChild(tr1);

    const tr2 = document.createElement("tr");
    tr2.className = "rez-ozet-tr-alt";
    daireler.forEach((d, i) => {
      const renk = daireRenk(d, i);
      ["G", "Kategori", "PRC", "RMND", "Misafir"].forEach((lbl) => {
        const th = document.createElement("th");
        th.className = lbl === "Misafir"
          ? "rez-ozet-misafir-baslik"
          : (lbl === "Kategori" ? "rez-ozet-kategori-baslik" : "rez-ozet-mini");
        th.style.background = renk;
        th.textContent = lbl;
        tr2.appendChild(th);
      });
    });
    thead.appendChild(tr2);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let g = 1; g <= gunSay; g++) {
      const tarih = iso(y, m, g);
      const haftaSonu = new Date(y, m, g).getDay();
      const tr = document.createElement("tr");
      tr.className = "rez-ozet-tr" +
        (tarih === bugun ? " rez-ozet-bugun" : "") +
        (haftaSonu === 0 || haftaSonu === 6 ? " rez-ozet-haftasonu" : "");
      tr.dataset.tarih = tarih;
      if (durum.seciliTarih === tarih) {
        tr.classList.add("rez-ozet-satir-secili");
      }

      const tdTarih = document.createElement("td");
      tdTarih.className = "rez-ozet-tarih";
      tdTarih.innerHTML =
        '<span class="rez-ozet-tarih-gun">' + tarihGoster(tarih) + '</span>' +
        '<span class="rez-ozet-gun-ad">' + gunAdi(tarih) + '</span>';
      tr.appendChild(tdTarih);

      daireler.forEach((d, di) => {
        const h = gunDurumu(d.id, tarih);
        const renk = daireRenk(d, di);

        if (h.tip === "turnover") {
          const td = document.createElement("td");
          td.colSpan = 5;
          td.style.background = renk;
          td.className = "rez-ozet-hucre-dolu rez-ozet-turnover-hucre";
          td.innerHTML = turnoverHtml(h.cikis, h.giris, tarih);
          tr.appendChild(td);
        } else if (h.tip === "checkin") {
          const det = konakDetay(h.rez, tarih);
          const td = document.createElement("td");
          td.colSpan = 5;
          td.style.background = renk;
          td.className = "rez-ozet-hucre-dolu rez-ozet-tik";
          td.dataset.rezId = h.rez.id;
          td.innerHTML =
            '<div class="rez-ozet-check checkin">CHECK IN</div>' +
            '<div class="rez-ozet-detay">' +
            '<span>' + det.g + '</span><span>' + det.kategoriHtml + '</span><span>' + fmt(det.prc) + '</span>' +
            '<span>' + fmt(det.toplam) + '</span><span class="rez-ozet-ad">' + esc(det.misafir) + '</span></div>';
          tr.appendChild(td);
        } else if (h.tip === "checkout") {
          const td = document.createElement("td");
          td.colSpan = 5;
          td.style.background = renk;
          td.className = "rez-ozet-hucre-dolu rez-ozet-tik";
          td.dataset.rezId = h.rez.id;
          td.innerHTML =
            '<div class="rez-ozet-check checkout">CHECK OUT</div>' +
            '<div class="rez-ozet-ad-alt">' + esc(h.rez.misafirAdi) + '</div>';
          tr.appendChild(td);
        } else if (h.tip === "konak") {
          const det = konakDetay(h.rez, tarih);
          const hucreler = [
            { cls: "rez-ozet-sayi", txt: String(det.g) },
            { cls: "rez-ozet-kategori", html: det.kategoriHtml },
            { cls: "rez-ozet-sayi", txt: fmt(det.prc) },
            { cls: "rez-ozet-sayi", txt: fmt(det.rmnd) },
            { cls: "rez-ozet-ad", txt: det.misafir }
          ];
          hucreler.forEach((c) => {
            const td = document.createElement("td");
            td.className = c.cls + " rez-ozet-tik";
            td.style.background = renk;
            td.dataset.rezId = h.rez.id;
            if (c.html) td.innerHTML = c.html;
            else td.textContent = c.txt;
            tr.appendChild(td);
          });
        } else {
          for (let i = 0; i < 5; i++) {
            const td = document.createElement("td");
            td.className = "rez-ozet-bos";
            td.style.background = renk;
            tr.appendChild(td);
          }
        }
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.innerHTML = "";
    wrap.appendChild(table);
    satirVurguBagla(table);
    tikBagla(wrap);
  }

  function satirVurguBagla(table) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    function satirBul(e) {
      const tr = e.target.closest("tr");
      if (!tr || tr.parentElement !== tbody) return null;
      return tr;
    }

    function hoverKaldir() {
      tbody.querySelectorAll(".rez-ozet-satir-hover").forEach((r) =>
        r.classList.remove("rez-ozet-satir-hover"));
    }

    function satirSec(tr) {
      if (!tr) return;
      durum.seciliTarih = tr.dataset.tarih || null;
      tbody.querySelectorAll(".rez-ozet-satir-secili").forEach((r) =>
        r.classList.remove("rez-ozet-satir-secili"));
      tr.classList.add("rez-ozet-satir-secili");
    }

    tbody.addEventListener("mouseover", (e) => {
      const tr = satirBul(e);
      if (!tr) return;
      hoverKaldir();
      tr.classList.add("rez-ozet-satir-hover");
    });

    tbody.addEventListener("mouseleave", hoverKaldir);

    tbody.addEventListener("pointerdown", (e) => {
      const tr = satirBul(e);
      if (!tr || e.pointerType === "mouse") return;
      satirSec(tr);
    });

    tbody.addEventListener("click", (e) => {
      const tr = satirBul(e);
      if (!tr) return;
      if (e.target.closest(".rez-ozet-tik") && tr.dataset.tarih) {
        satirSec(tr);
        return;
      }
      if (e.target.closest(".rez-ozet-tarih") || !e.target.closest(".rez-ozet-tik")) {
        satirSec(tr);
      }
    });
  }

  function git(yon) {
    let y = durum.yil;
    let m = durum.ay + yon;
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    durum.yil = y;
    durum.ay = m;
    tabloCiz();
  }

  function buguneGit() {
    const n = new Date();
    durum.yil = n.getFullYear();
    durum.ay = n.getMonth();
    tabloCiz();
  }

  function yatayModMu() {
    const mq = window.matchMedia("(orientation: landscape)");
    const kisaKenar = Math.min(
      window.screen.width || 0,
      window.screen.height || 0,
      window.visualViewport?.width || window.innerWidth,
      window.visualViewport?.height || window.innerHeight
    );
    return mq.matches && kisaKenar > 0 && kisaKenar <= 520;
  }

  function yatayModGuncelle() {
    const yatay = yatayModMu() || !!document.fullscreenElement;
    document.body.classList.toggle("rez-yatay-mod", yatay);
  }

  async function yonKilidiAc() {
    try {
      if (screen.orientation && typeof screen.orientation.unlock === "function") {
        screen.orientation.unlock();
      }
    } catch (e) { /* tarayıcı izin vermeyebilir */ }
  }

  async function tamEkranYatay() {
    const wrap = document.querySelector("#tab-rezervasyonlar .rez-ozet-wrap");
    if (!wrap) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        yatayModGuncelle();
        return;
      }

      await yonKilidiAc();

      if (wrap.requestFullscreen) {
        await wrap.requestFullscreen();
      } else if (wrap.webkitRequestFullscreen) {
        await wrap.webkitRequestFullscreen();
      }

      try {
        if (screen.orientation && typeof screen.orientation.lock === "function") {
          await screen.orientation.lock("landscape");
        }
      } catch (e) { /* iOS / bazı PWA'larda desteklenmez */ }

      yatayModGuncelle();
      window.APARTIM.toast?.("Tam ekran — çıkmak için Yatay'a tekrar dokunun", "bilgi");
    } catch (err) {
      window.APARTIM.toast?.("Tam ekran açılamadı; telefonu yan çevirin", "uyari");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("rez-ozet-prev")?.addEventListener("click", () => git(-1));
    document.getElementById("rez-ozet-next")?.addEventListener("click", () => git(1));
    document.getElementById("rez-ozet-bugun")?.addEventListener("click", buguneGit);
    document.getElementById("rez-ozet-tam")?.addEventListener("click", tamEkranYatay);
    yatayModGuncelle();
    yonKilidiAc();
    window.addEventListener("resize", yatayModGuncelle);
    window.visualViewport?.addEventListener("resize", yatayModGuncelle);
    window.addEventListener("orientationchange", () => {
      setTimeout(yatayModGuncelle, 200);
    });
    document.addEventListener("fullscreenchange", yatayModGuncelle);
  });

  document.addEventListener("apartim:veri-degisti", tabloCiz);

  document.addEventListener("apartim:gun-degisti", tabloCiz);

  window.APARTIM.rezOzet = { tabloCiz, git, buguneGit, yatayModGuncelle, tamEkranYatay, yonKilidiAc };
})();
