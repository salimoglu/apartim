/* =========================================================
   APARTIM — Tahsilat tablosu
   Rezervasyon özeti gibi: solda tarih, üstte odalar.
   Her odanın altında kişiler giriş tarihine göre sıralanır.
   Tahsilatı tamamlanan satır yeşil, açık olan kırmızı.
   ========================================================= */

(function () {
  "use strict";

  const GUN_KISA = ["PAZ", "PZT", "SAL", "ÇAR", "PER", "CUM", "CMT"];
  const DAIRE_RENK = {
    "ust": "#ffcdd2",
    "orta-sol": "#c8e6c9",
    "orta-sag": "#bbdefb",
    "alt-sol": "#fff9c4",
    "alt-sag": "#e1bee7"
  };
  const DAIRE_RENK_YEDEK = ["#ffcdd2", "#c8e6c9", "#bbdefb", "#fff9c4", "#e1bee7", "#ffe0b2", "#b2dfdb"];

  const durum = {
    buguneKaydir: false
  };

  function pad(n) { return String(n).padStart(2, "0"); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sezonYil() {
    return window.APARTIM.gorunum?.seciliYil?.() ?? new Date().getFullYear();
  }

  function sezonAralik(y) {
    const gor = window.APARTIM.gorunum;
    if (gor?.sezonBasBit) return gor.sezonBasBit(y);
    return {
      bas: y + "-06-01",
      bit: y + "-09-30",
      bitHaric: y + "-10-01"
    };
  }

  function daireRenk(d, i) {
    return DAIRE_RENK[d.id] || DAIRE_RENK_YEDEK[i % DAIRE_RENK_YEDEK.length];
  }

  /** Rezervasyon tablosuyla aynı oda sırası: alt kattan üste */
  function daireSirasi(db) {
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

  function tarihKisa(isoStr) {
    const p = String(isoStr || "").split("-");
    if (p.length < 3) return "";
    return p[2] + "." + p[1];
  }

  function tarihUzun(isoStr) {
    const p = String(isoStr || "").split("-");
    if (p.length < 3) return "";
    return p[2] + "." + p[1] + "." + p[0];
  }

  function gunAdi(isoStr) {
    const d = new Date(isoStr + "T12:00:00");
    if (Number.isNaN(d.getTime())) return "";
    return GUN_KISA[d.getDay()];
  }

  function kategoriAd(rez) {
    if (!rez) return "";
    return rez.kaynakAd || window.APARTIM.db?.musteriKaynagiAd?.(rez.kaynakId) || "—";
  }

  function sezonIcinde(rez, bas, bitHaric) {
    return !!(rez && rez.giris && rez.cikis && rez.giris < bitHaric && rez.cikis > bas);
  }

  function rezSirala(a, b) {
    const g = String(a.giris || "").localeCompare(String(b.giris || ""));
    if (g) return g;
    const c = String(a.cikis || "").localeCompare(String(b.cikis || ""));
    if (c) return c;
    return String(a.misafirAdi || "").localeCompare(String(b.misafirAdi || ""), "tr");
  }

  /**
   * Her oda için sezondaki rezervasyonlar, giriş tarihine göre.
   * Satır sayısı en dolu odanın kişi sayısıdır; odalar kendi listesini alta dizer.
   */
  function odaListeleri(daireler, rezervasyonlar, bas, bitHaric) {
    const map = Object.create(null);
    daireler.forEach((d) => { map[d.id] = []; });
    (rezervasyonlar || []).forEach((rez) => {
      if (!rez || !map[rez.daireId]) return;
      if (!sezonIcinde(rez, bas, bitHaric)) return;
      map[rez.daireId].push(rez);
    });
    let max = 0;
    let tamam = 0;
    let acik = 0;
    daireler.forEach((d) => {
      map[d.id].sort(rezSirala);
      max = Math.max(max, map[d.id].length);
      map[d.id].forEach((rez) => {
        if (rez.tahsilatTamamlandi) tamam += 1;
        else acik += 1;
      });
    });
    return { map, max, tamam, acik };
  }

  function buguneYakinSatir(daireler, map, bugun) {
    let hedef = null;
    daireler.forEach((d) => {
      (map[d.id] || []).forEach((rez, i) => {
        if (!rez.giris || rez.giris < bugun) return;
        if (!hedef || rez.giris < hedef.tarih || (rez.giris === hedef.tarih && i < hedef.index)) {
          hedef = { index: i, tarih: rez.giris };
        }
      });
    });
    return hedef;
  }

  function hucreDoldur(td, cls, metin, title) {
    td.className = cls;
    td.textContent = metin;
    if (title) td.title = title;
  }

  function tabloOlustur(daireler, liste) {
    const table = document.createElement("table");
    table.className = "tahsilat-table";
    const cg = document.createElement("colgroup");
    daireler.forEach(() => {
      ["tarih", "kt", "ad"].forEach((tip) => {
        const col = document.createElement("col");
        col.className = "tahsilat-col-" + tip;
        cg.appendChild(col);
      });
    });
    table.appendChild(cg);

    const thead = document.createElement("thead");
    const tr1 = document.createElement("tr");
    tr1.className = "tahsilat-tr-oda";
    const tr2 = document.createElement("tr");
    tr2.className = "tahsilat-tr-alt";
    daireler.forEach((d, i) => {
      const renk = daireRenk(d, i);
      const kose = document.createElement("th");
      kose.className = "tahsilat-tarih-bas" + (i === 0 ? " tahsilat-yapiskan" : "");
      kose.rowSpan = 2;
      kose.textContent = "Tarih";
      tr1.appendChild(kose);

      const oda = document.createElement("th");
      oda.className = "tahsilat-oda-bas";
      oda.colSpan = 2;
      oda.style.background = renk;
      oda.textContent = d.ad || d.id;
      tr1.appendChild(oda);

      [["Kategori", "tahsilat-kt-bas"], ["Ad", "tahsilat-ad-bas"]].forEach(([lbl, cls]) => {
        const th = document.createElement("th");
        th.className = cls;
        th.style.background = renk;
        th.textContent = lbl;
        tr2.appendChild(th);
      });
    });
    thead.appendChild(tr1);
    thead.appendChild(tr2);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let i = 0; i < liste.max; i++) {
      const tr = document.createElement("tr");
      tr.className = "tahsilat-tr";
      tr.dataset.index = String(i);
      daireler.forEach((d, di) => {
        const rez = liste.map[d.id][i];
        const yapiskan = di === 0 ? " tahsilat-yapiskan" : "";
        if (!rez) {
          ["tarih", "kt", "ad"].forEach((tip, ti) => {
            const td = document.createElement("td");
            td.className = "tahsilat-bos tahsilat-" + tip + (ti === 0 ? yapiskan : "");
            tr.appendChild(td);
          });
          return;
        }
        const tamam = !!rez.tahsilatTamamlandi;
        const renkCls = tamam ? "tahsilat-tamam" : "tahsilat-acik";
        const ad = rez.misafirAdi || "—";
        const kat = kategoriAd(rez);
        const giris = tarihKisa(rez.giris);
        const cikis = tarihKisa(rez.cikis);
        const baslik = tarihUzun(rez.giris) + " → " + tarihUzun(rez.cikis) +
          " · " + kat + " · " + ad +
          (tamam ? " · tahsilat tamam" : " · tahsilat açık");

        const tdT = document.createElement("td");
        tdT.className = "tahsilat-hucre tahsilat-tarih " + renkCls + yapiskan;
        tdT.dataset.rezId = rez.id || "";
        tdT.title = baslik;
        tdT.innerHTML =
          '<span class="tahsilat-tarih-gun">' + esc(giris) + "</span>" +
          '<span class="tahsilat-gun-ad">' + esc(gunAdi(rez.giris)) + "</span>";
        tr.appendChild(tdT);

        const tdK = document.createElement("td");
        tdK.className = "tahsilat-hucre tahsilat-kt " + renkCls;
        tdK.dataset.rezId = rez.id || "";
        hucreDoldur(tdK, tdK.className, kat, baslik);
        tr.appendChild(tdK);

        const tdA = document.createElement("td");
        tdA.className = "tahsilat-hucre tahsilat-ad " + renkCls;
        tdA.dataset.rezId = rez.id || "";
        hucreDoldur(tdA, tdA.className, ad, baslik);
        tr.appendChild(tdA);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  function ozetYaz(tamam, acik) {
    const el = document.getElementById("tahsilat-ozet");
    if (!el) return;
    if (!tamam && !acik) {
      el.textContent = "Bu sezonda rezervasyon yok";
      return;
    }
    el.textContent = tamam + " tamam · " + acik + " açık";
  }

  function baslikYukseklik(table) {
    const tr1 = table.querySelector(".tahsilat-tr-oda");
    if (!tr1) return;
    const h = tr1.getBoundingClientRect().height;
    if (h > 0) table.style.setProperty("--tahsilat-head1-h", h + "px");
  }

  function scrollHedefe(sc, table) {
    const row = table.querySelector('tr.tahsilat-tr[data-yakin="1"]');
    if (!sc || !row) return;
    const scRect = sc.getBoundingClientRect();
    const elRect = row.getBoundingClientRect();
    sc.scrollTop += elRect.top - scRect.top - (sc.clientHeight - elRect.height) / 2;
  }

  function ciz() {
    const wrap = document.getElementById("tahsilat-tablo");
    const sc = document.getElementById("tahsilat-scroll");
    if (!wrap) return;

    const db = window.APARTIM.db;
    if (!db || !db.durum?.yuklendi) {
      wrap.innerHTML = '<div class="tahsilat-bos-mesaj">Yükleniyor...</div>';
      return;
    }

    const once = sc ? { top: sc.scrollTop, left: sc.scrollLeft } : null;
    const y = sezonYil();
    const { bas, bitHaric } = sezonAralik(y);
    const daireler = daireSirasi(db);
    const rezervasyonlar = db.rezervasyonlarListele ? db.rezervasyonlarListele() : [];
    const liste = odaListeleri(daireler, rezervasyonlar, bas, bitHaric);
    ozetYaz(liste.tamam, liste.acik);

    if (!daireler.length) {
      wrap.innerHTML = '<div class="tahsilat-bos-mesaj">Oda yok</div>';
      return;
    }
    if (!liste.max) {
      wrap.innerHTML = '<div class="tahsilat-bos-mesaj">Bu sezonda rezervasyon yok</div>';
      return;
    }

    const bugun = window.APARTIM.gorunum?.bugunISO?.() || db.bugunISO?.() || "";
    const yakin = buguneYakinSatir(daireler, liste.map, bugun);
    const table = tabloOlustur(daireler, liste);
    if (yakin) {
      const row = table.querySelector('tr.tahsilat-tr[data-index="' + yakin.index + '"]');
      if (row) row.dataset.yakin = "1";
    }
    wrap.innerHTML = "";
    wrap.appendChild(table);
    requestAnimationFrame(() => baslikYukseklik(table));

    if (!sc) return;
    if (durum.buguneKaydir) {
      durum.buguneKaydir = false;
      requestAnimationFrame(() => scrollHedefe(sc, table));
      return;
    }
    if (once) {
      sc.scrollTop = once.top;
      sc.scrollLeft = once.left;
    }
  }

  function sekmeAcikMi() {
    return document.getElementById("tab-tahsilat")?.classList.contains("active");
  }

  function sekmeAc() {
    durum.buguneKaydir = true;
    ciz();
  }

  function cizPlanla() {
    if (!sekmeAcikMi()) return;
    ciz();
  }

  function rezAc(id) {
    if (!id || !window.APARTIM.rezervasyon?.duzenle) return;
    window.APARTIM.rezervasyon.duzenle(id);
  }

  function bagla() {
    const sc = document.getElementById("tahsilat-scroll");
    if (!sc || sc.dataset.tahsilatBagli) return;
    sc.dataset.tahsilatBagli = "1";
    sc.addEventListener("click", (ev) => {
      const hucre = ev.target.closest("td.tahsilat-hucre");
      if (!hucre) return;
      const id = hucre.dataset.rezId;
      if (!id) return;
      ev.preventDefault();
      rezAc(id);
    });
  }

  function baslat() {
    bagla();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", baslat);
  } else {
    baslat();
  }

  document.addEventListener("apartim:gorunum-degisti", cizPlanla);
  document.addEventListener("apartim:veri-degisti", (ev) => {
    const sebep = ev.detail?.sebep;
    if (sebep === "kasa-harcama" || sebep === "temizlik-kayit" || sebep === "doviz-kurlari") return;
    cizPlanla();
  });

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.tahsilat = {
    ciz,
    sekmeAc,
    odaListeleri,
    sezonIcinde
  };
})();
