/* =========================================================
   APARTIM — Tahsilat tablosu
   Rezervasyon özeti gibi: solda tarih, üstte odalar.
   Her odanın altında kişiler giriş tarihine göre sıralanır.
   Tahsilatı tamamlanan satır yeşil, açık olan kırmızı.
   Eksik kalsa da tamamlananlar "Kırıntı" filtresinde;
   bu kırıntıların toplamı üst barda.
   ========================================================= */

(function () {
  "use strict";

  const GUN_KISA = ["PAZ", "PZT", "SAL", "ÇAR", "PER", "CUM", "CMT"];

  const durum = {
    buguneKaydir: false,
    filtre: "tumu"
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

  /** Konaklama para biriminde gerçek kalan. Kur farkı borç sayılmaz. */
  function kirintiBilgi(rez) {
    if (!rez || !rez.tahsilatTamamlandi) return null;
    const db = window.APARTIM.db;
    if (!db) return null;
    const bakiye = db.rezervasyonBakiye?.(rez);
    const pb = bakiye?.fiyatPb || db.rezervasyonGosterimPb?.(rez) || "TL";
    const kalan = bakiye ? Number(bakiye.kalan) || 0 : Number(db.rezervasyonKalanHesapla?.(rez)) || 0;
    const toplam = bakiye ? Number(bakiye.toplam) || 0 : Number(db.rezervasyonToplamTl?.(rez)) || 0;
    if (!(toplam > 0)) return null;
    const esik = pb === "USD" ? 0.01 : 0.5;
    if (!(kalan > esik)) return null;
    return { kalan, pb };
  }

  function tutarYaz(miktar, pb) {
    const para = window.APARTIM.para;
    if (para?.formatTutar) return para.formatTutar(miktar, pb);
    const n = Math.round((Number(miktar) || 0) * 100) / 100;
    return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (pb || "TL");
  }

  function kurusTopla(a, b) {
    return Math.round(((Number(a) || 0) + (Number(b) || 0)) * 100) / 100;
  }

  function kirintiTopla(map) {
    const parca = Object.create(null);
    let adet = 0;
    Object.keys(map || {}).forEach((id) => {
      (map[id] || []).forEach((rez) => {
        const k = kirintiBilgi(rez);
        if (!k) return;
        adet += 1;
        parca[k.pb] = kurusTopla(parca[k.pb], k.kalan);
      });
    });
    return { adet, parca };
  }

  function kirintiMetin(ozet) {
    const sira = { TL: 0, USD: 1, EUR: 2 };
    const pbs = Object.keys(ozet.parca || {}).sort((a, b) => {
      const ia = sira[a] == null ? 9 : sira[a];
      const ib = sira[b] == null ? 9 : sira[b];
      return ia - ib || a.localeCompare(b);
    });
    const tutarlar = pbs.map((pb) => tutarYaz(ozet.parca[pb], pb));
    return "Kırıntı " + ozet.adet + " · " + tutarlar.join(" + ");
  }

  function filtreUygun(rez, filtre) {
    const f = filtre || durum.filtre;
    if (f === "kalan") return !rez.tahsilatTamamlandi;
    if (f === "gerceklesen") return !!rez.tahsilatTamamlandi;
    if (f === "kirinti") return !!kirintiBilgi(rez);
    return true;
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
  function odaListeleri(daireler, rezervasyonlar, bas, bitHaric, filtre) {
    const map = Object.create(null);
    daireler.forEach((d) => { map[d.id] = []; });
    (rezervasyonlar || []).forEach((rez) => {
      if (!rez || !map[rez.daireId]) return;
      if (!sezonIcinde(rez, bas, bitHaric)) return;
      if (!filtreUygun(rez, filtre)) return;
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
      const kose = document.createElement("th");
      kose.className = "tahsilat-tarih-bas" + (i === 0 ? " tahsilat-yapiskan" : "");
      kose.rowSpan = 2;
      kose.textContent = "Tarih";
      tr1.appendChild(kose);

      const oda = document.createElement("th");
      oda.className = "tahsilat-oda-bas";
      oda.colSpan = 2;
      oda.textContent = d.ad || d.id;
      tr1.appendChild(oda);

      [["Kategori", "tahsilat-kt-bas"], ["Ad", "tahsilat-ad-bas"]].forEach(([lbl, cls]) => {
        const th = document.createElement("th");
        th.className = cls;
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
        const kirinti = kirintiBilgi(rez);
        const renkCls = tamam ? "tahsilat-tamam" : "tahsilat-acik";
        const ad = rez.misafirAdi || "—";
        const kat = kategoriAd(rez);
        const giris = tarihKisa(rez.giris);
        const cikis = tarihKisa(rez.cikis);
        const kirintiYazi = kirinti ? tutarYaz(kirinti.kalan, kirinti.pb) : "";
        const baslik = tarihUzun(rez.giris) + " → " + tarihUzun(rez.cikis) +
          " · " + kat + " · " + ad +
          (kirinti ? " · kırıntı " + kirintiYazi : (tamam ? " · tahsilat tamam" : " · tahsilat açık"));

        const tdT = document.createElement("td");
        tdT.className = "tahsilat-tarih " + renkCls + yapiskan;
        tdT.title = baslik;
        tdT.innerHTML =
          '<span class="tahsilat-tarih-gun">' + esc(giris) + "</span>" +
          '<span class="tahsilat-gun-ad">' + esc(gunAdi(rez.giris)) + "</span>";
        tr.appendChild(tdT);

        const tdK = document.createElement("td");
        tdK.className = "tahsilat-tik tahsilat-kt " + renkCls;
        tdK.dataset.rezId = rez.id || "";
        hucreDoldur(tdK, tdK.className, kat, "Tahsilat ekranını aç · " + baslik);
        tr.appendChild(tdK);

        const tdA = document.createElement("td");
        tdA.className = "tahsilat-tik tahsilat-ad " + renkCls + (kirinti ? " tahsilat-ad-kirinti" : "");
        tdA.dataset.rezId = rez.id || "";
        tdA.title = "Tahsilat ekranını aç · " + baslik;
        if (kirinti) {
          tdA.innerHTML =
            '<span class="tahsilat-ad-metin">' + esc(ad) + "</span>" +
            '<span class="tahsilat-kirinti-tutar">' + esc(kirintiYazi) + "</span>";
        } else {
          hucreDoldur(tdA, tdA.className, ad, tdA.title);
        }
        tr.appendChild(tdA);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  function ozetYaz(tamam, acik, kirinti) {
    const el = document.getElementById("tahsilat-ozet");
    const kirintiEl = document.getElementById("tahsilat-kirinti-ozet");
    if (!el) return;
    if (!tamam && !acik) {
      el.textContent = "Bu sezonda rezervasyon yok";
      if (kirintiEl) kirintiEl.hidden = true;
      return;
    }
    el.textContent = tamam + " tamam · " + acik + " açık";
    if (!kirintiEl) return;
    if (!kirinti || !kirinti.adet) {
      kirintiEl.hidden = true;
      kirintiEl.textContent = "";
      kirintiEl.classList.remove("aktif");
      return;
    }
    kirintiEl.hidden = false;
    kirintiEl.textContent = kirintiMetin(kirinti);
    kirintiEl.classList.toggle("aktif", durum.filtre === "kirinti");
    kirintiEl.setAttribute("aria-pressed", durum.filtre === "kirinti" ? "true" : "false");
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
    const tumu = odaListeleri(daireler, rezervasyonlar, bas, bitHaric, "tumu");
    const liste = durum.filtre === "tumu"
      ? tumu
      : odaListeleri(daireler, rezervasyonlar, bas, bitHaric, durum.filtre);
    ozetYaz(tumu.tamam, tumu.acik, kirintiTopla(tumu.map));

    if (!daireler.length) {
      wrap.innerHTML = '<div class="tahsilat-bos-mesaj">Oda yok</div>';
      return;
    }
    if (!tumu.max) {
      wrap.innerHTML = '<div class="tahsilat-bos-mesaj">Bu sezonda rezervasyon yok</div>';
      return;
    }
    if (!liste.max) {
      wrap.innerHTML = '<div class="tahsilat-bos-mesaj">Bu filtrede rezervasyon yok</div>';
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

  function tahsilatTarihi(rez) {
    const db = window.APARTIM.db;
    const bugun = window.APARTIM.gorunum?.bugunISO?.() || db?.bugunISO?.() || "";
    if (bugun && rez.giris && rez.cikis && bugun >= rez.giris && bugun < rez.cikis) return bugun;
    if (db?.gunEkleISO && rez.cikis) {
      const son = db.gunEkleISO(rez.cikis, -1);
      if (son && (!rez.giris || son >= rez.giris)) return son;
    }
    return rez.giris || bugun;
  }

  function tahsilatEkraniAc(rez) {
    if (!rez?.id) return;
    if (!window.APARTIM.rezOzet?.tahsilatAc) {
      window.APARTIM.toast?.("Tahsilat ekranı yüklenemedi", "hata");
      return;
    }
    window.APARTIM.rezOzet.tahsilatAc(rez.id, tahsilatTarihi(rez));
  }

  function filtreSec(ad) {
    const sonraki = ad === "kalan" || ad === "gerceklesen" || ad === "kirinti" ? ad : "tumu";
    if (durum.filtre === sonraki) return;
    durum.filtre = sonraki;
    document.querySelectorAll(".tahsilat-filtre-btn").forEach((b) => {
      const aktif = b.dataset.filtre === sonraki;
      b.classList.toggle("active", aktif);
      b.setAttribute("aria-selected", aktif ? "true" : "false");
    });
    ciz();
    const sc = document.getElementById("tahsilat-scroll");
    if (sc) sc.scrollTop = 0;
  }

  function bagla() {
    const sc = document.getElementById("tahsilat-scroll");
    if (sc && !sc.dataset.tahsilatBagli) {
      sc.dataset.tahsilatBagli = "1";
      sc.addEventListener("click", hucreTik);
    }
    const filtre = document.querySelector(".tahsilat-filtre");
    if (filtre && !filtre.dataset.tahsilatBagli) {
      filtre.dataset.tahsilatBagli = "1";
      filtre.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".tahsilat-filtre-btn");
        if (!btn) return;
        filtreSec(btn.dataset.filtre);
      });
    }
    const kirintiBtn = document.getElementById("tahsilat-kirinti-ozet");
    if (kirintiBtn && !kirintiBtn.dataset.tahsilatBagli) {
      kirintiBtn.dataset.tahsilatBagli = "1";
      kirintiBtn.addEventListener("click", () => filtreSec("kirinti"));
    }
  }

  function hucreTik(ev) {
    const hucre = ev.target.closest("td.tahsilat-tik");
    if (!hucre) return;
    const id = hucre.dataset.rezId;
    const rez = id && window.APARTIM.db?.durum?.rezervasyonlar?.[id];
    if (!rez) return;
    ev.preventDefault();
    tahsilatEkraniAc(rez);
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
    sezonIcinde,
    kirintiBilgi,
    kirintiTopla
  };
})();
