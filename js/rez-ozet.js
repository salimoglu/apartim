/* =========================================================
   APARTIM — Rezervasyon özet tablosu (tüm odalar)
   Tarih satırları × daire sütunları, Excel benzeri görünüm.
   ========================================================= */

(function () {
  "use strict";

  const GUN_KISA = ["PAZ", "PZT", "SAL", "ÇAR", "PER", "CUM", "CMT"];
  const GUN_UZUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  const SEZON_BAS_AY = 5;
  const SEZON_BIT_AY = 8;
  const CHUNK_GUN = 14;

  const IO_HUCRE_RENK = "#ffeb3b";

  const DAIRE_RENK = {
    "ust": "#ffcdd2",
    "orta-sol": "#c8e6c9",
    "orta-sag": "#bbdefb",
    "alt-sol": "#fff9c4",
    "alt-sag": "#e1bee7"
  };
  const DAIRE_RENK_YEDEK = ["#ffcdd2", "#c8e6c9", "#bbdefb", "#fff9c4", "#e1bee7", "#ffe0b2", "#b2dfdb"];

  const durum = {
    seciliTarih: null,
    pendingOdenenFocus: null,
    buguneKaydir: false,
    ayKaydir: null
  };

  function sezonYil() {
    return window.APARTIM.gorunum?.seciliYil?.() ?? new Date().getFullYear();
  }

  let renderToken = 0;
  let tabloTimer = null;
  let sonDaireler = [];
  let scrollKapsayici = null;
  let korunanScroll = null;

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function fmt(n) {
    return Number(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatHucreFiyat(rez, miktar, pbOverride) {
    const pb = pbOverride ||
      window.APARTIM.db?.rezervasyonGosterimPb?.(rez) ||
      window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    if (window.APARTIM.para) return window.APARTIM.para.formatTutarKisa(miktar, pb);
    return fmt(miktar);
  }

  function rezPb(rez) {
    return window.APARTIM.db?.rezervasyonGosterimPb?.(rez) ||
      window.APARTIM.para?.rezParaBirimi(rez) || "TL";
  }

  function formatPb(rez, miktar) {
    const pb = rezPb(rez);
    if (window.APARTIM.para) return window.APARTIM.para.formatTutar(miktar, pb);
    return fmt(miktar) + " " + pb;
  }

  function formatPbKisa(rez, miktar) {
    const pb = rezPb(rez);
    if (window.APARTIM.para) return window.APARTIM.para.formatTutarKisa(miktar, pb);
    return fmt(miktar) + (pb === "USD" ? "$" : "₺");
  }

  function formatTlKisa(miktar) {
    if (window.APARTIM.para) return window.APARTIM.para.formatTutarKisa(miktar, "TL");
    return fmt(miktar) + "₺";
  }

  const ODEME_YONTEM_KISA = {
    kasa: "Kasa",
    elden: "Kasa",
    pos: "Pos",
    havale: "Havale",
    booking: "Booking",
    diger: "Diğer"
  };

  function odenenYontemAd(yontem) {
    const y = String(yontem || "").toLowerCase() === "elden" ? "kasa" : yontem;
    return window.APARTIM.db?.ODEME_YONTEMLERI?.[y] ||
      ODEME_YONTEM_KISA[y] || "Kasa";
  }

  function odenenHucreGoster(rez, info) {
    if (!info || !info.manuel) return "—";
    const para = window.APARTIM.para;
    const hasTl = (Number(info.tutarTl) || 0) > 0;
    const hasUsd = (Number(info.tutarUsd) || 0) > 0;
    /* Girilen tutarlar olduğu gibi: TL / USD / ikisi birden */
    if (hasTl || hasUsd) {
      const parcalar = [];
      if (hasTl) parcalar.push(formatTlKisa(info.tutarTl));
      if (hasUsd) {
        parcalar.push(para
          ? para.formatTutarKisa(info.tutarUsd, "USD")
          : (fmt(info.tutarUsd) + "$"));
      }
      return parcalar.join("+");
    }
    if (info.tutar) {
      const pb = info.tutarBirim === "TL" ? "TL" : rezPb(rez);
      if (para) return para.formatTutarKisa(info.tutar, pb);
      return formatPbKisa(rez, info.tutar);
    }
    return "—";
  }

  function odenenHucreBaslik(rez, info) {
    if (!info || !info.manuel) return "Tahsilat girmek için tıklayın";
    const adet = Number(info.adet) || 1;
    const bas = adet > 1 ? (adet + " tahsilat") : odenenYontemAd(info.yontem);
    return bas + " · " + odenenHucreGoster(rez, info);
  }

  function kalanEsik(rez) {
    return rezPb(rez) === "USD" ? 0.01 : 0.5;
  }

  function rezervasyonBakiyeMetin(rez) {
    const db = window.APARTIM.db;
    if (!db) return "";
    const toplam = db.rezervasyonToplamTl
      ? db.rezervasyonToplamTl(rez)
      : db.rezervasyonToplamTutar(rez);
    if (toplam <= 0) return "";
    const kalan = db.rezervasyonKalanHesapla(rez);
    const esik = kalanEsik(rez);
    const tamam = !!rez.tahsilatTamamlandi;
    const ok = tamam ? " ✓" : "";
    if (kalan < -esik) return "Fazla " + formatPbKisa(rez, -kalan) + ok;
    if (kalan > esik) {
      return tamam
        ? formatPbKisa(rez, kalan) + " eksik ✓"
        : "Kalan " + formatPbKisa(rez, kalan);
    }
    return tamam ? "Tamam ✓" : "Kalan " + formatPbKisa(rez, 0);
  }

  function rezOutKalanParca(rez) {
    const db = window.APARTIM.db;
    if (!db) return null;
    const toplam = db.rezervasyonToplamTl
      ? db.rezervasyonToplamTl(rez)
      : db.rezervasyonToplamTutar(rez);
    if (toplam <= 0) return null;
    const kalan = db.rezervasyonKalanHesapla(rez);
    const esik = kalanEsik(rez);
    const tamam = !!rez.tahsilatTamamlandi;
    if (kalan < -esik) {
      return { etiket: "Fazla", tutar: formatPbKisa(rez, -kalan), fazla: true, tamam };
    }
    if (kalan > esik) {
      return {
        etiket: tamam ? "Eksik" : "Kalan",
        tutar: formatPbKisa(rez, kalan),
        fazla: false,
        tamam
      };
    }
    return {
      etiket: tamam ? "Tamam" : "Kalan",
      tutar: tamam ? "" : formatPbKisa(rez, 0),
      fazla: false,
      tamam
    };
  }

  function rezOutKalanStackHtml(rez) {
    const p = rezOutKalanParca(rez);
    if (!p) return "";
    let cls = p.fazla ? " rez-ozet-out-fazla" : "";
    if (p.tamam) cls += " rez-ozet-tahsilat-tamam";
    const ok = p.tamam
      ? '<span class="rez-ozet-tahsilat-ok" aria-hidden="true">✓</span>'
      : "";
    return (
      '<span class="rez-ozet-out-kalan-stack' + cls + '" title="Toplam − tahsilat">' +
        '<span class="rez-ozet-out-kalan-etiket">' + esc(p.etiket) + "</span>" +
        '<span class="rez-ozet-out-kalan-tutar">' +
          (p.tutar ? '<span class="rez-ozet-out-kalan-rakam">' + esc(p.tutar) + "</span>" : "") +
          ok +
        "</span>" +
      "</span>"
    );
  }

  function rezOutKalanHucreIcerik(rez) {
    return rezOutKalanStackHtml(rez) || "—";
  }

  function parseTutarGiris(val) {
    const s = String(val || "").trim().replace(/[^\d,.-]/g, "");
    if (!s) return null;
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  function rezOutKalanHtml(rez) {
    return rezOutKalanStackHtml(rez);
  }

  function rezSonGeceMi(rez, tarih) {
    const db = window.APARTIM.db;
    if (!db || !rez?.cikis || !tarih) return false;
    return tarih === db.gunEkleISO(rez.cikis, -1);
  }

  function excelOdnHucre(rez, tarih, odenenInfo) {
    /* Son gece her zaman kalan */
    if (rezSonGeceMi(rez, tarih)) {
      return rezOutKalanMetin(rez) || "";
    }
    return excelOdemeGoster(rez, odenenInfo);
  }

  function sezonBasBit(y) {
    return {
      bas: iso(y, SEZON_BAS_AY, 1),
      bit: iso(y, SEZON_BIT_AY, ayinGunSayisi(y, SEZON_BIT_AY)),
      bitHaric: iso(y, SEZON_BIT_AY + 1, 1)
    };
  }

  function sezonGunleri(y) {
    const liste = [];
    for (let m = SEZON_BAS_AY; m <= SEZON_BIT_AY; m++) {
      const gunSay = ayinGunSayisi(y, m);
      for (let g = 1; g <= gunSay; g++) {
        liste.push({ tarih: iso(y, m, g), ay: m });
      }
    }
    return liste;
  }

  function varsayilanSezonYil() {
    return window.APARTIM.gorunum?.gercekYil?.() ?? new Date().getFullYear();
  }

  /** Sezon içindeyse o ay, değilse ilk ay (Haziran). */
  function aktifAyaHedefAy() {
    const gor = window.APARTIM.gorunum;
    if (gor?.arsivModu?.()) {
      const bugun = gor.bugunISO();
      return Number(bugun.slice(5, 7)) - 1;
    }
    const ay = new Date().getMonth();
    if (ay >= SEZON_BAS_AY && ay <= SEZON_BIT_AY) return ay;
    return SEZON_BAS_AY;
  }

  function buguneOrtalaAyarla() {
    window.APARTIM.gorunum?.yilSec?.(varsayilanSezonYil());
    const y = sezonYil();
    const { bas, bit } = sezonBasBit(y);
    const bugun = window.APARTIM.gorunum?.bugunISO?.() ||
      window.APARTIM.db?.bugunISO?.() ||
      iso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    korunanScroll = null;
    durum.ayKaydir = null;
    durum.buguneKaydir = bugun >= bas && bugun <= bit;
    if (durum.buguneKaydir) {
      durum.seciliTarih = bugun;
    } else {
      durum.ayKaydir = aktifAyaHedefAy();
    }
    return durum.buguneKaydir;
  }

  function rezSekmeAc() {
    buguneOrtalaAyarla();
    const ciz = () => tabloCiz();
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(ciz, { timeout: 600 });
    } else {
      setTimeout(ciz, 0);
    }
  }

  function tabloSekmesiAcikMi() {
    return document.getElementById("tab-rezervasyonlar")?.classList.contains("active");
  }

  let tabloIlkCizim = true;
  let sayfaIlkOrtala = true;

  function tabloCizPlanla() {
    if (!tabloSekmesiAcikMi()) return;
    clearTimeout(tabloTimer);
    if (tabloIlkCizim) {
      tabloIlkCizim = false;
      tabloCiz();
      return;
    }
    tabloTimer = setTimeout(tabloCiz, 50);
  }

  /** Daire × gün durum haritası — tablo çiziminde tekrarlı db sorgusunu önler */
  function daireGunHaritasi(db, daireId, basISO, bitISO) {
    const liste = db.rezervasyonlarListele(daireId);
    const cikisMap = Object.create(null);
    const girisMap = Object.create(null);
    liste.forEach((r) => {
      if (r.cikis >= basISO && r.cikis <= bitISO) {
        if (!cikisMap[r.cikis]) cikisMap[r.cikis] = [];
        cikisMap[r.cikis].push(r);
      }
      if (r.giris >= basISO && r.giris <= bitISO) {
        if (!girisMap[r.giris]) girisMap[r.giris] = [];
        girisMap[r.giris].push(r);
      }
    });
    const harita = Object.create(null);
    let t = basISO;
    while (t <= bitISO) {
      const cikisList = cikisMap[t] || [];
      const girisList = girisMap[t] || [];
      let sonuc = null;
      outer: for (let ci = 0; ci < cikisList.length; ci++) {
        for (let gi = 0; gi < girisList.length; gi++) {
          if (cikisList[ci].id !== girisList[gi].id) {
            sonuc = { tip: "turnover", cikis: cikisList[ci], giris: girisList[gi], rez: girisList[gi] };
            break outer;
          }
        }
      }
      if (!sonuc && cikisList.length) {
        sonuc = { tip: "checkout", rez: cikisList[0] };
      } else if (!sonuc && girisList.length) {
        sonuc = { tip: "checkin", rez: girisList[0] };
      } else if (!sonuc) {
        const konak = liste.find((r) => r.giris <= t && t < r.cikis);
        sonuc = konak ? { tip: "konak", rez: konak } : { tip: "bos", rez: null };
      }
      harita[t] = sonuc;
      t = db.gunEkleISO(t, 1);
    }
    return harita;
  }

  function gunHaritasiOlustur(db, daireler, basISO, bitISO) {
    const all = Object.create(null);
    daireler.forEach((d) => {
      all[d.id] = daireGunHaritasi(db, d.id, basISO, bitISO);
    });
    return all;
  }

  function ayinGunSayisi(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function tarihGoster(isoStr) {
    const p = isoStr.split("-");
    return p[2] + "." + p[1] + "." + p[0];
  }

  function tarihGosterKisa(isoStr) {
    const p = isoStr.split("-");
    return p[2].padStart(2, "0") + "." + p[1].padStart(2, "0");
  }

  function gunAdiTablo(isoStr) {
    return GUN_KISA[new Date(isoStr + "T12:00:00").getDay()];
  }

  function gunAdi(isoStr, kisa) {
    const d = new Date(isoStr + "T12:00:00");
    return (kisa ? GUN_KISA : GUN_UZUN)[d.getDay()];
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

  /** Önceden hesaplanmış haritadan gün durumu */
  function gunDurumuHarita(harita, daireId, tarih) {
    return harita[daireId]?.[tarih] || { tip: "bos", rez: null };
  }

  function ayAyiriciTr(y, m, colSpan) {
    const tr = document.createElement("tr");
    tr.className = "rez-ozet-ay-ayrac";
    tr.dataset.ay = String(m);
    const td = document.createElement("td");
    td.colSpan = colSpan;
    td.textContent = AY_ADLARI[m] + " " + y;
    td.style.background = "#1a2633";
    td.style.color = "#ffffff";
    td.style.fontWeight = "300";
    tr.appendChild(td);
    return tr;
  }

  function kisaAd(ad, maxLen) {
    const s = String(ad || "");
    const m = maxLen || 9;
    return s.length > m ? s.slice(0, m - 1) + "…" : s;
  }

  function telefonTabloMu() {
    return !!tabloGorunum().kompakt;
  }

  /** Telefon / tablet / masaüstü — ekrana sığan oda sayısı genişliğe göre */
  function tabloGorunum(scrollGenislik) {
    const w = window.visualViewport?.width || window.innerWidth;
    const h = window.visualViewport?.height || window.innerHeight;
    const kisa = Math.min(w, h);
    const yatay =
      w > h ||
      window.matchMedia("(orientation: landscape)").matches ||
      (document.body.classList.contains("mobil-yatay-mod") && kisa <= 520);
    const dokunmatik =
      window.matchMedia("(pointer: coarse)").matches ||
      (navigator.maxTouchPoints || 0) > 1;

    let cihaz = "masaustu";
    if (kisa <= 520 || w < 720) cihaz = "telefon";
    else if (dokunmatik && kisa <= 900) cihaz = "tablet";

    if (cihaz === "masaustu") {
      return { cihaz, kompakt: false, yatay, odaHedef: 5, tarihPx: w >= 1200 ? 42 : 38 };
    }

    const tarihPx = cihaz === "tablet" ? 36 : 32;
    const genislik = Math.max(200, scrollGenislik || w);
    const kullanilabilir = Math.max(80, genislik - tarihPx);

    /* Sabit oda bloğu: G/Kt/Fyt/Odn değişmez; Ad isim kadar (tavanlı) */
    const minBlok = ODA_BLOK_KOMPAKT;
    const tavan = cihaz === "telefon" ? (yatay ? 3 : 2) : (yatay ? 5 : 3);

    let odaHedef = Math.floor(kullanilabilir / minBlok);
    if (odaHedef < 1) odaHedef = 1;
    if (odaHedef > tavan) odaHedef = tavan;

    return { cihaz, kompakt: true, yatay, odaHedef, tarihPx, minBlok };
  }

  function misafirTabloGoster(ad) {
    return String(ad || "");
  }

  function gSayiHtml(g) {
    const n = Number(g) || 0;
    const cls = "rez-ozet-g-sayi" + (n === 1 ? " rez-ozet-g-ilk" : "");
    return '<span class="' + cls + '">' + esc(String(n)) + "</span>";
  }

  /* Kompakt sütunlar sabit — ekran genişleyince Ad şişmesin */
  const GK_KOMPAKT = 18;  /* 15 → %20 (telefon/tablet); fark Ad'den */
  const FO_KOMPAKT = 58;   /* 10.000,00₺ */
  const AD_KOMPAKT = 104;  /* 110 − 2×3 (G+Kt büyütmesi) */
  const ODA_BLOK_KOMPAKT = 2 * GK_KOMPAKT + 2 * FO_KOMPAKT + AD_KOMPAKT; /* 256 */

  /** Oda bloğu: kompaktta G/Kt/Fyt/Odn/Ad sabit px (diğerlerine karışılmaz) */
  function odaSutunPaylari(odaBlokPx, kompakt) {
    if (kompakt) {
      return {
        g: GK_KOMPAKT,
        kt: GK_KOMPAKT,
        fyt: FO_KOMPAKT,
        odn: FO_KOMPAKT,
        ad: AD_KOMPAKT
      };
    }

    const blok = Math.max(50, Math.floor(Number(odaBlokPx) || 0));
    let gk = Math.max(11, Math.floor(blok * 0.11));
    let fo = Math.max(16, Math.floor(blok * 0.17));
    let ad = blok - 2 * gk - 2 * fo;
    if (ad <= fo) {
      fo = Math.max(12, Math.floor((blok - 2 * gk) / 3));
      ad = blok - 2 * gk - 2 * fo;
    }
    if (ad < 0) {
      gk = Math.max(8, Math.floor(blok / 8));
      fo = Math.max(10, Math.floor(blok / 5));
      ad = Math.max(0, blok - 2 * gk - 2 * fo);
    }
    return { g: gk, kt: gk, fyt: fo, odn: fo, ad };
  }

  function checkoutHucreleriEkle(tr, rez, tarih, renk, ioVurgu) {
    const rid = rezIdAl(rez);
    const bg = hucreBg(renk, ioVurgu);
    const tdG = document.createElement("td");
    tdG.className = "rez-ozet-sayi rez-ozet-out-gun" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdG.style.background = bg;
    tdG.title = "Çıkış" + (rez?.misafirAdi ? ": " + rez.misafirAdi : "");
    tdG.textContent = "—";
    tr.appendChild(tdG);

    const tdKt = document.createElement("td");
    tdKt.className = "rez-ozet-kategori" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdKt.style.background = bg;
    tdKt.textContent = "—";
    tr.appendChild(tdKt);

    const tdF = document.createElement("td");
    tdF.className = "rez-ozet-sayi" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdF.style.background = bg;
    tdF.textContent = "—";
    tr.appendChild(tdF);

    const tdO = document.createElement("td");
    tdO.className = "rez-ozet-sayi" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdO.style.background = bg;
    tdO.textContent = "—";
    tr.appendChild(tdO);

    const tdA = document.createElement("td");
    tdA.className = "rez-ozet-ad" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdA.style.background = bg;
    tdA.textContent = "—";
    tr.appendChild(tdA);
  }

  /** Çakışan gün: yalnızca sarı vurgu — i/o simgesi yok, sütunlar korunur */
  function turnoverHucreleriEkle(tr, cikis, giris, tarih, renk) {
    const girisRid = rezIdAl(giris);
    const bg = hucreBg(renk, true);
    const det = konakDetay(giris, tarih);
    const fiyat = formatHucreFiyat(giris, det.prc, det.prcPb);
    const ad = misafirTabloGoster(det.misafir);
    const cikisAd = (cikis && cikis.misafirAdi) || "—";
    const girisAd = (giris && giris.misafirAdi) || "—";

    const tdG = document.createElement("td");
    tdG.className =
      "rez-ozet-sayi rez-ozet-turnover-hucre rez-ozet-turnover-bas rez-ozet-io-hucre";
    tdG.style.background = bg;
    tdG.title = "Çıkış: " + cikisAd + " → Giriş: " + girisAd;
    tdG.innerHTML = gSayiHtml(1);
    tr.appendChild(tdG);

    const tdKt = document.createElement("td");
    tdKt.className = "rez-ozet-kategori rez-ozet-turnover-hucre rez-ozet-tik rez-ozet-io-hucre";
    tdKt.style.background = bg;
    if (girisRid) tdKt.dataset.rezId = girisRid;
    tdKt.innerHTML = det.kategoriHtml;
    tr.appendChild(tdKt);

    const tdF = document.createElement("td");
    tdF.className = "rez-ozet-sayi rez-ozet-turnover-hucre rez-ozet-io-hucre";
    tdF.style.background = bg;
    tdF.textContent = fiyat;
    tr.appendChild(tdF);

    /* Giren misafirin Ödn hücresi — tek gecelik / son gece ödemesi burada girilir */
    const tdO = odnHucreTd(giris, tarih, renk, girisRid, true);
    tdO.classList.add("rez-ozet-turnover-hucre");
    tr.appendChild(tdO);

    const tdA = document.createElement("td");
    tdA.className =
      "rez-ozet-ad rez-ozet-turnover-hucre rez-ozet-turnover-son rez-ozet-tik rez-ozet-io-hucre";
    tdA.style.background = bg;
    if (girisRid) tdA.dataset.rezId = girisRid;
    tdA.textContent = ad;
    if (det.misafir) tdA.title = det.misafir;
    tr.appendChild(tdA);
  }

  function satirSiniflari(tarih, bugun, haftaSonu, ioGun) {
    let cls = "rez-ozet-tr";
    if (tarih === bugun) cls += " rez-ozet-bugun";
    if (haftaSonu === 0 || haftaSonu === 6) cls += " rez-ozet-haftasonu";
    if (ioGun) cls += " rez-ozet-io-gun";
    return cls;
  }

  function checkinHucreleriEkle(tr, rez, tarih, renk, ioVurgu) {
    const rid = rezIdAl(rez);
    const bg = hucreBg(renk, ioVurgu);
    checkinHucreler(rez, tarih).forEach((c, ci) => {
      const td = hucreTdOlustur(
        c, rez, tarih, bg, rid, ci === 4 ? (rez.misafirAdi || "") : "", ioVurgu
      );
      tr.appendChild(td);
    });
  }

  function konakHucreleriEkle(tr, rez, tarih, renk) {
    const det = konakDetay(rez, tarih);
    const rid = rezIdAl(rez);
    [
      { cls: "rez-ozet-sayi", html: gSayiHtml(det.g) },
      { cls: "rez-ozet-kategori", html: det.kategoriHtml },
      { cls: "rez-ozet-sayi", txt: formatHucreFiyat(rez, det.prc, det.prcPb) },
      { type: "odn" },
      { cls: "rez-ozet-ad", txt: det.misafir || "" }
    ].forEach((c, ci) => {
      const td = hucreTdOlustur(
        c, rez, tarih, renk, rid, ci === 4 ? (det.misafir || "") : ""
      );
      tr.appendChild(td);
    });
  }

  function bosHucreleriEkle(tr, daireId, tarih, renk) {
    for (let i = 0; i < 5; i++) {
      const td = document.createElement("td");
      td.style.background = renk;
      if (i === 0) {
        /* G sütunu: tıklayınca rezervasyon açılmaz */
        td.className = "rez-ozet-bos rez-ozet-bos-gun";
      } else {
        td.className = "rez-ozet-bos rez-ozet-hucre-tik";
        td.dataset.daireId = daireId;
        td.dataset.tarih = tarih;
        td.title = "Yeni rezervasyon";
      }
      tr.appendChild(td);
    }
  }

  function hucreBg(renk, ioVurgu) {
    return ioVurgu ? IO_HUCRE_RENK : renk;
  }

  function tarihTdOlustur(tarih) {
    const tdTarih = document.createElement("td");
    tdTarih.className = "rez-ozet-tarih";
    tdTarih.dataset.tarih = tarih;
    tdTarih.innerHTML =
      '<span class="rez-ozet-tarih-gun">' + tarihGosterKisa(tarih) + "</span>" +
      '<span class="rez-ozet-gun-ad">' + gunAdiTablo(tarih) + "</span>";
    return tdTarih;
  }

  function daireHucreleriTekSatir(tr, d, h, tarih, renk) {
    if (h.tip === "turnover") {
      turnoverHucreleriEkle(tr, h.cikis, h.giris, tarih, renk);
      return;
    }
    if (h.tip === "checkin") {
      checkinHucreleriEkle(tr, h.rez, tarih, renk, true);
      return;
    }
    if (h.tip === "checkout") {
      checkoutHucreleriEkle(tr, h.rez, tarih, renk, true);
      return;
    }
    if (h.tip === "konak") {
      konakHucreleriEkle(tr, h.rez, tarih, renk);
      return;
    }
    bosHucreleriEkle(tr, d.id, tarih, renk);
  }

  function satirlarOlustur(tarih, y, m, g, daireler, harita, bugun) {
    const haftaSonu = new Date(y, m, g - 1).getDay();
    const ioGun = daireler.some((d) => {
      const tip = gunDurumuHarita(harita, d.id, tarih).tip;
      return tip === "checkout" || tip === "checkin" || tip === "turnover";
    });
    const sinif = satirSiniflari(tarih, bugun, haftaSonu, ioGun);
    const secili = durum.seciliTarih === tarih;

    const tr = document.createElement("tr");
    tr.className = sinif;
    tr.dataset.tarih = tarih;
    if (secili) tr.classList.add("rez-ozet-satir-secili");
    tr.appendChild(tarihTdOlustur(tarih));
    daireler.forEach((d, di) => {
      const h = gunDurumuHarita(harita, d.id, tarih);
      daireHucreleriTekSatir(tr, d, h, tarih, daireRenk(d, di));
    });
    return [tr];
  }

  function checkinHucreler(rez, tarih) {
    const det = konakDetay(rez, tarih);
    return [
      { cls: "rez-ozet-sayi", html: gSayiHtml(1) },
      { cls: "rez-ozet-kategori", html: det.kategoriHtml },
      { cls: "rez-ozet-sayi", txt: formatHucreFiyat(rez, det.prc, det.prcPb) },
      { type: "odn" },
      { cls: "rez-ozet-ad", txt: det.misafir || "" }
    ];
  }

  function konakDetay(rez, tarih) {
    const db = window.APARTIM.db;
    const g = db.geceSayisi(rez.giris, tarih) + 1;
    const geceKayit = db.rezervasyonGeceKaydi
      ? db.rezervasyonGeceKaydi(rez, g)
      : { tutar: db.rezervasyonGeceUcreti(rez, g), pb: rezPb(rez) };
    const prc = geceKayit.tutar;
    const prcPb = geceKayit.pb || rezPb(rez);
    const odenenInfo = db.rezervasyonOdenenGosterim(rez, tarih);
    const toplam = db.rezervasyonToplamGosterim
      ? db.rezervasyonToplamGosterim(rez)
      : (rez.toplamTutar != null
        ? rez.toplamTutar
        : db.rezervasyonTutarHesapla(rez).toplam);
    return {
      g,
      kategori: kaynakSimge(rez),
      kategoriHtml: kaynakSimgeHtml(rez),
      prc,
      prcPb,
      odenen: odenenInfo.tutar,
      odenenManuel: odenenInfo.manuel,
      odenenYontem: odenenInfo.yontem,
      odenenInfo,
      toplam,
      misafir: rez.misafirAdi
    };
  }

  function odnHucreTd(rez, tarih, renk, rid, ioVurgu) {
    const db = window.APARTIM.db;
    const info = db.rezervasyonOdenenGosterim(rez, tarih);
    const sonGece = rezSonGeceMi(rez, tarih);
    const td = document.createElement("td");
    td.className = "rez-ozet-sayi rez-ozet-odenen" +
      (sonGece || !info.manuel ? " bos" : " manuel") +
      (sonGece ? " rez-ozet-out-kalan-hucre" : "") +
      (ioVurgu ? " rez-ozet-io-hucre" : "");
    td.style.background = hucreBg(renk, ioVurgu);
    if (rid) td.dataset.rezId = rid;
    td.dataset.tarih = tarih;
    /* Son gece: her zaman kalan (o güne tahsilat yazılsa bile) */
    if (sonGece) {
      td.innerHTML = rezOutKalanHucreIcerik(rez);
      td.title = "Toplam − tahsilat · Tahsilat girmek için tıklayın";
      if (rez.tahsilatTamamlandi) td.classList.add("rez-ozet-tahsilat-tamam-hucre");
      if (info.manuel) td.dataset.yontem = info.yontem;
    } else if (info.manuel) {
      td.dataset.yontem = info.yontem;
      td.textContent = odenenHucreGoster(rez, info);
      td.title = odenenHucreBaslik(rez, info);
    } else {
      td.textContent = "—";
      td.title = "Tahsilat girmek için tıklayın";
    }
    return td;
  }

  function hucreTiklenebilirMi(c) {
    if (!c || c.type === "odn") return false;
    const cls = c.cls || "";
    return cls.indexOf("rez-ozet-ad") >= 0 || cls.indexOf("rez-ozet-kategori") >= 0;
  }

  function hucreTdOlustur(c, rez, tarih, renk, rid, misafirBaslik, ioVurgu) {
    if (c.type === "odn") return odnHucreTd(rez, tarih, renk, rid, ioVurgu);
    const td = document.createElement("td");
    td.className = c.cls + (hucreTiklenebilirMi(c) ? " rez-ozet-tik" : "") +
      (ioVurgu ? " rez-ozet-io-hucre" : "");
    td.style.background = hucreBg(renk, ioVurgu);
    if (rid) td.dataset.rezId = rid;
    if (c.html) td.innerHTML = c.html;
    else {
      const goster = (c.cls && c.cls.indexOf("rez-ozet-ad") >= 0)
        ? misafirTabloGoster(c.txt) : c.txt;
      td.textContent = goster;
      if (misafirBaslik) td.title = misafirBaslik;
    }
    return td;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  function rezIdAl(rez) {
    if (window.APARTIM.rezervasyon?.rezIdAl) {
      return window.APARTIM.rezervasyon.rezIdAl(rez);
    }
    return rez?.id || "";
  }

  function rezAcYeni(daireId, tarih) {
    if (!window.APARTIM.rezervasyon) {
      window.APARTIM.toast("Rezervasyon modülü yüklenemedi", "hata");
      return;
    }
    window.APARTIM.rezervasyon.yeni({ daireId, girisOnseci: tarih });
    durum.seciliTarih = tarih;
  }

  function sonrakiOdenenHucre(td) {
    const rezId = td.dataset.rezId;
    if (!rezId) return null;
    const tbody = td.closest("tbody");
    if (!tbody) return null;
    let tr = td.closest("tr")?.nextElementSibling;
    while (tr && tr.parentElement === tbody) {
      const hucre = tr.querySelector('.rez-ozet-odenen[data-rez-id="' + rezId + '"]');
      if (hucre) return hucre;
      tr = tr.nextElementSibling;
    }
    return null;
  }

  let odemeDuzenleDurum = null;

  function odemeModal() { return document.getElementById("modal-odeme"); }

  function odemeModalAc() {
    tamEkranaModallariTasi(tamEkranAcikMi());
    document.getElementById("modal-rez")?.classList.add("hidden");
    const modal = odemeModal();
    if (!modal) return null;
    modal.classList.remove("hidden");
    window.APARTIM.app?.modalAcikGuncelle?.();
    return modal;
  }

  function odemeModalKapat() {
    odemeModal()?.classList.add("hidden");
    odemeDuzenleDurum = null;
    window.APARTIM.app?.modalAcikGuncelle?.();
  }

  function rezCikisKalanHucreleriYenile(rezId, rez) {
    if (!rezId || !rez) return;
    document.querySelectorAll('td.rez-ozet-out-kalan-hucre[data-rez-id="' + rezId + '"]')
      .forEach((td) => {
        td.innerHTML = rezOutKalanHucreIcerik(rez);
        td.classList.toggle("rez-ozet-tahsilat-tamam-hucre", !!rez.tahsilatTamamlandi);
      });
  }

  function odenenHucreyiYenile(hucre, rez) {
    const db = window.APARTIM.db;
    const tarih = hucre.dataset.tarih;
    if (!db || !tarih) return;
    const info = db.rezervasyonOdenenGosterim(rez, tarih);
    const sonGece = rezSonGeceMi(rez, tarih);
    hucre.classList.toggle("manuel", !!(info.manuel && !sonGece));
    hucre.classList.toggle("bos", !info.manuel || sonGece);
    hucre.classList.toggle("rez-ozet-out-kalan-hucre", sonGece);
    hucre.classList.toggle("rez-ozet-tahsilat-tamam-hucre", !!(rez.tahsilatTamamlandi && sonGece));
    if (sonGece) {
      hucre.innerHTML = rezOutKalanHucreIcerik(rez);
      hucre.title = "Toplam − tahsilat · Tahsilat girmek için tıklayın";
      if (info.manuel) hucre.dataset.yontem = info.yontem;
      else delete hucre.dataset.yontem;
    } else if (info.manuel) {
      hucre.textContent = odenenHucreGoster(rez, info);
      hucre.title = odenenHucreBaslik(rez, info);
      hucre.dataset.yontem = info.yontem;
    } else {
      hucre.textContent = "—";
      hucre.title = "Tahsilat girmek için tıklayın";
      delete hucre.dataset.yontem;
    }
  }

  function tahsilatKurUsd() {
    return window.APARTIM.para?.kurlariGetir()?.USD || 0;
  }

  function tahsilatSeciliTarih() {
    const t = document.getElementById("odeme-tarih")?.value || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
  }

  let tahsilatCeviriciKilit = false;

  function tahsilatCeviriciTemizle() {
    const tl = document.getElementById("odeme-cevir-tl");
    const usd = document.getElementById("odeme-cevir-usd");
    if (tl) tl.value = "";
    if (usd) usd.value = "";
  }

  function tahsilatCeviriciYuvarla(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function tahsilatCeviriciYaz(el, n) {
    if (!el) return;
    if (!Number.isFinite(n) || n <= 0) {
      el.value = "";
      return;
    }
    el.value = String(tahsilatCeviriciYuvarla(n)).replace(".", ",");
  }

  function tahsilatCeviriciGuncelle(kaynak) {
    if (tahsilatCeviriciKilit) return;
    const kur = tahsilatKurUsd();
    if (!(kur > 0)) return;
    const tlEl = document.getElementById("odeme-cevir-tl");
    const usdEl = document.getElementById("odeme-cevir-usd");
    if (!tlEl || !usdEl) return;
    tahsilatCeviriciKilit = true;
    try {
      if (kaynak === "tl") {
        const ham = tlEl.value.trim();
        if (ham === "") {
          usdEl.value = "";
          return;
        }
        const tl = parseTutarGiris(ham);
        if (!Number.isFinite(tl) || tl < 0) return;
        tahsilatCeviriciYaz(usdEl, tl / kur);
      } else if (kaynak === "usd") {
        const ham = usdEl.value.trim();
        if (ham === "") {
          tlEl.value = "";
          return;
        }
        const usd = parseTutarGiris(ham);
        if (!Number.isFinite(usd) || usd < 0) return;
        tahsilatCeviriciYaz(tlEl, usd * kur);
      }
    } finally {
      tahsilatCeviriciKilit = false;
    }
  }

  function tahsilatCeviriciTakas() {
    const tlEl = document.getElementById("odeme-cevir-tl");
    const usdEl = document.getElementById("odeme-cevir-usd");
    if (!tlEl || !usdEl) return;
    const a = tlEl.value;
    tlEl.value = usdEl.value;
    usdEl.value = a;
    /* Takas sonrası TL kaynağı varsay: USD'yi kur ile yeniden hesapla */
    if (tlEl.value.trim() !== "") tahsilatCeviriciGuncelle("tl");
    else if (usdEl.value.trim() !== "") tahsilatCeviriciGuncelle("usd");
  }

  function tahsilatGirisOku() {
    const tlHam = document.getElementById("odeme-tutar-tl")?.value?.trim() || "";
    const usdHam = document.getElementById("odeme-tutar-usd")?.value?.trim() || "";
    const tl = tlHam === "" ? 0 : parseTutarGiris(tlHam);
    const usd = usdHam === "" ? 0 : parseTutarGiris(usdHam);
    return { tlHam, usdHam, tl, usd };
  }

  function tahsilatKayitTl(kayit, rez) {
    const para = window.APARTIM.para;
    if (!kayit) return 0;
    if ((kayit.tutarTl || 0) > 0 || (kayit.tutarUsd || 0) > 0) {
      return para
        ? para.tahsilatTlToplam(kayit.tutarTl, kayit.tutarUsd, kayit.kurUsd)
        : (kayit.tutarTl || 0);
    }
    if ((kayit.tutar || 0) > 0) {
      return para ? para.tlKarsiligi(kayit.tutar, rezPb(rez)) : kayit.tutar;
    }
    return 0;
  }

  function tahsilatOzetCiz(rez) {
    const db = window.APARTIM.db;
    const para = window.APARTIM.para;
    const ozet = document.getElementById("odeme-modal-ozet");
    if (!db || !rez || !ozet) return;
    const toplamTl = db.rezervasyonToplamTl(rez);
    const odenenTl = db.rezervasyonOdenenToplamTl(rez);
    /* Tamamlandı olsa bile gerçek kalan/fazla göster (0'a zorlama) */
    const bakiyeTl = db.rezervasyonKalanTl(rez);
    const fazlaMi = bakiyeTl < -0.009;
    const bakiyeEtiket = fazlaMi ? "Fazla" : "Kalan";
    const bakiyeAbsTl = Math.abs(bakiyeTl);
    const kur = db.rezervasyonKurCift ? db.rezervasyonKurCift(rez) : null;
    const tlDenUsd = (tl) =>
      para ? para.tlDenPb(tl, "USD", kur) : tl;
    const yazUsd = (m) => para ? para.formatTutar(m, "USD") : (fmt(m) + " $");
    const yazTl = (m) => para ? para.formatTutar(m, "TL") : (fmt(m) + " ₺");
    /* Tek grid: Toplam/Ödenen/Kalan|Fazla etiketleri USD–TL satırlarında aynı kolonda alt alta */
    const hucre = (etiket, tutar, tlMi, ekstraCls) => {
      const cls = [tlMi ? "tl" : "", ekstraCls || ""].filter(Boolean).join(" ");
      const attr = cls ? ' class="' + cls + '"' : "";
      return "<b" + attr + ">" + esc(etiket) + "</b>" +
        "<span" + attr + ">" + esc(tutar) + "</span>";
    };
    const bakiyeCls = fazlaMi ? "tahsilat-ozet-fazla" : "";
    ozet.innerHTML =
      '<div class="tahsilat-ozet-grid">' +
        hucre("Toplam", yazUsd(tlDenUsd(toplamTl)), false) +
        hucre("Ödenen", yazUsd(tlDenUsd(odenenTl)), false) +
        hucre(bakiyeEtiket, yazUsd(tlDenUsd(bakiyeAbsTl)), false, bakiyeCls) +
        hucre("Toplam", yazTl(toplamTl), true) +
        hucre("Ödenen", yazTl(odenenTl), true) +
        hucre(bakiyeEtiket, yazTl(bakiyeAbsTl), true, bakiyeCls) +
      "</div>";
  }

  function tahsilatGecmisCiz(rez) {
    const wrap = document.getElementById("odeme-gecmis");
    if (!wrap) return;
    const db = window.APARTIM.db;
    const liste = db?.rezervasyonOdenenListe?.(rez) || [];
    const seciliId = odemeDuzenleDurum?.odemeId || "";
    if (!liste.length) {
      wrap.innerHTML = '<div class="tahsilat-gecmis-bos">Henüz tahsilat yok</div>';
      return;
    }
    wrap.innerHTML = liste.map((k) => {
      const tutar = odenenHucreGoster(rez, Object.assign({ manuel: true }, k));
      const aktif = k.id && k.id === seciliId ? " aktif" : "";
      const not = String(k.not || "").trim();
      const orta =
        esc(odenenYontemAd(k.yontem)) +
        (not ? ' <span class="tahsilat-gecmis-not">· ' + esc(not) + "</span>" : "");
      return (
        '<button type="button" class="tahsilat-gecmis-satir' + aktif +
          '" data-tahsilat-tarih="' + esc(k.tarih) +
          '" data-tahsilat-id="' + esc(k.id || "") + '"' +
          (not ? ' title="' + esc(odenenYontemAd(k.yontem) + " · " + not) + '"' : "") + ">" +
          '<span class="tahsilat-gecmis-tarih">' + esc(tarihGoster(k.tarih)) + "</span>" +
          '<span class="tahsilat-gecmis-orta">' + orta + "</span>" +
          '<span class="tahsilat-gecmis-tutar">' + esc(tutar) + "</span>" +
        "</button>"
      );
    }).join("");
  }

  function tahsilatFormaYukle(rez, tarih, odemeId) {
    const db = window.APARTIM.db;
    if (!db || !rez || !tarih) return;
    const kayit = odemeId ? db.rezervasyonOdenenKayitGetir?.(rez, odemeId) : null;
    const info = kayit || { manuel: false };
    const pb = rezPb(rez);
    const inpTl = document.getElementById("odeme-tutar-tl");
    const inpUsd = document.getElementById("odeme-tutar-usd");
    const sel = document.getElementById("odeme-yontem");
    const tarihInp = document.getElementById("odeme-tarih");
    if (tarihInp) tarihInp.value = kayit?.tarih || tarih;
    if (odemeDuzenleDurum) {
      odemeDuzenleDurum.tarih = kayit?.tarih || tarih;
      odemeDuzenleDurum.odemeId = kayit?.id || null;
    }

    let tlVal = "";
    let usdVal = "";
    if (info.manuel || kayit) {
      if ((info.tutarTl || 0) > 0 || (info.tutarUsd || 0) > 0) {
        if ((info.tutarTl || 0) > 0) tlVal = String(info.tutarTl);
        if ((info.tutarUsd || 0) > 0) usdVal = String(info.tutarUsd);
      } else if (info.tutar > 0) {
        if (info.tutarBirim === "TL" || pb === "TL") tlVal = String(info.tutar);
        else if (pb === "USD") usdVal = String(info.tutar);
        else tlVal = String(info.tutar);
      }
    }
    if (inpTl) inpTl.value = tlVal;
    if (inpUsd) inpUsd.value = usdVal;
    if (sel) {
      const y = info.yontem === "elden" ? "kasa" : (info.yontem || "kasa");
      sel.value = y;
    }
    const notInp = document.getElementById("odeme-not");
    if (notInp) notInp.value = info.not || "";
    tahsilatOzetCiz(rez);
    tahsilatGecmisCiz(rez);
    tahsilatKalanOnizle();
  }

  function tahsilatFormuTemizleYeni(rez, tarihZorla) {
    const bugun = window.APARTIM.db?.bugunISO?.() || "";
    const tarihInp = document.getElementById("odeme-tarih");
    const hedef = tarihZorla || bugun || (rez?.giris || "");
    if (tarihInp) tarihInp.value = hedef;
    if (odemeDuzenleDurum) {
      odemeDuzenleDurum.tarih = hedef;
      odemeDuzenleDurum.odemeId = null;
    }
    document.getElementById("odeme-tutar-tl").value = "";
    document.getElementById("odeme-tutar-usd").value = "";
    document.getElementById("odeme-yontem").value = "kasa";
    const notInp = document.getElementById("odeme-not");
    if (notInp) notInp.value = "";
    tahsilatCeviriciTemizle();
    tahsilatOzetCiz(rez);
    tahsilatGecmisCiz(rez);
    tahsilatKalanOnizle();
  }

  function tahsilatKalanOnizle() {
    const ctx = odemeDuzenleDurum;
    const el = document.getElementById("odeme-modal-kalan");
    if (!ctx || !el) return;
    const db = window.APARTIM.db;
    const rez = db?.durum.rezervasyonlar[ctx.rezId];
    if (!db || !rez) return;

    const para = window.APARTIM.para;
    const kur = tahsilatKurUsd();
    const tarih = tahsilatSeciliTarih() || ctx.tarih;
    const { tl, usd } = tahsilatGirisOku();
    const tlSafe = Number.isFinite(tl) && tl > 0 ? tl : 0;
    const usdSafe = Number.isFinite(usd) && usd > 0 ? usd : 0;
    const buGunTl = para ? para.tahsilatTlToplam(tlSafe, usdSafe, kur) : tlSafe;

    /* Düzenlenen kayıt varsa onu çıkar; yeni kayıtta mevcutlara ekle */
    let mevcutKayitTl = 0;
    if (ctx.odemeId && db.rezervasyonOdenenKayitGetir) {
      const eski = db.rezervasyonOdenenKayitGetir(rez, ctx.odemeId);
      if (eski) mevcutKayitTl = tahsilatKayitTl(eski, rez);
    }

    const toplamTl = db.rezervasyonToplamTl(rez);
    const odenenTl = db.rezervasyonOdenenToplamTl(rez) - mevcutKayitTl + buGunTl;
    const kalanTl = toplamTl - odenenTl;

    /* Canlı giriş de gösterim PB'sine dahil (TL+USD → USD) */
    const pbAdaylari = [rezPb(rez)];
    if (tlSafe > 0) pbAdaylari.push("TL");
    if (usdSafe > 0) pbAdaylari.push("USD");
    const uniq = [...new Set(pbAdaylari)];
    let pb = uniq[0] || "TL";
    if (uniq.length > 1) {
      pb = uniq.includes("USD") ? "USD" : (uniq.find((p) => p !== "TL") || "TL");
    }

    const kurCift = db.rezervasyonKurCift ? db.rezervasyonKurCift(rez) : { USD: kur };
    kurCift.USD = kur;
    const kalanPb = para && pb !== "TL" ? para.tlDenPb(kalanTl, pb, kurCift) : kalanTl;
    const esik = pb === "USD" ? 0.01 : 0.5;
    const tamam = !!document.getElementById("tahsilat-tamamla")?.checked;
    const ok = ' <span class="rez-ozet-tahsilat-ok" aria-hidden="true">✓</span>';
    const yaz = (m) => para ? para.formatTutar(m, pb) : (fmt(m) + " " + pb);
    const yazTl = (m) => para ? para.formatTutar(Math.abs(m), "TL") : (fmt(Math.abs(m)) + " ₺");
    const tlParantez = (mPb, mTl) =>
      pb !== "TL" ? ' <span class="tahsilat-kalan-tl">(' + esc(yazTl(mTl)) + ")</span>" : "";

    /* Tamamlandı işaretli olsa bile kalan/fazla tutarı her zaman yazılır */
    if (kalanPb < -esik) {
      el.innerHTML = "Fazla " + esc(yaz(-kalanPb)) + tlParantez(-kalanPb, -kalanTl) + (tamam ? ok : "");
      el.className = "tahsilat-kalan tahsilat-kalan-fazla";
      el.title = tamam ? "Fazla ödeme · tahsilat tamamlandı" : "Fazla ödeme";
    } else if (kalanPb > esik) {
      el.innerHTML =
        esc(yaz(kalanPb) + (tamam ? " eksik" : "")) +
        tlParantez(kalanPb, kalanTl) +
        (tamam ? ok : "");
      el.className = "tahsilat-kalan" + (tamam ? " tahsilat-kalan-tamam" : "");
      el.title = tamam
        ? "Eksik kalsa bile tahsilat tamamlandı sayılacak"
        : "Kalan";
    } else {
      el.innerHTML = esc(yaz(0)) + tlParantez(0, 0) + (tamam ? ok : "");
      el.className = "tahsilat-kalan tahsilat-kalan-tamam";
      el.title = tamam ? "Tahsilat tamam" : "Kalan";
    }
  }

  function odenenHucreDuzenle(hucre) {
    const rezId = hucre.dataset.rezId;
    const tarih = hucre.dataset.tarih;
    if (!rezId || !tarih) {
      window.APARTIM.toast?.("Tahsilat hücresi tanınmadı", "uyari");
      return;
    }
    durum.seciliTarih = tarih;

    const db = window.APARTIM.db;
    const rez = db?.durum.rezervasyonlar[rezId];
    if (!rez) {
      window.APARTIM.toast?.("Rezervasyon bulunamadı", "uyari");
      return;
    }

    const modal = odemeModalAc();
    if (!modal) {
      window.APARTIM.toast?.("Tahsilat formu yüklenemedi", "hata");
      return;
    }

    odemeDuzenleDurum = { rezId, tarih, hucre, odemeId: null };

    const para = window.APARTIM.para;
    const pb = rezPb(rez);
    const kur = tahsilatKurUsd();
    const baslik = document.getElementById("odeme-modal-baslik");
    const aciklama = document.getElementById("odeme-modal-aciklama");
    const kurEl = document.getElementById("odeme-kur-bilgi");
    const chk = document.getElementById("tahsilat-tamamla");

    if (baslik) {
      baslik.textContent = "Tahsilat — " + (rez.misafirAdi || "Misafir");
    }
    if (aciklama) {
      const toplamG = db.rezervasyonToplamGosterim
        ? db.rezervasyonToplamGosterim(rez)
        : db.rezervasyonToplamTutar(rez);
      aciklama.textContent = "Konaklama: " + formatPb(rez, toplamG) +
        " · Para birimi: " + pb;
    }
    if (kurEl) {
      kurEl.textContent = "1$ = " +
        (para ? para.formatKur(kur) : String(kur)) + "₺";
    }
    if (chk) chk.checked = !!rez.tahsilatTamamlandi;
    tahsilatCeviriciTemizle();

    /* Hücreden açılış: yeni tahsilat (aynı güne ekleme); düzeltme geçmişten */
    tahsilatFormuTemizleYeni(rez, tarih);
    setTimeout(() => {
      const hedef = document.getElementById("odeme-tutar-tl") ||
        document.getElementById("odeme-tutar-usd");
      hedef?.focus({ preventScroll: true });
      hedef?.select?.();
    }, 80);
  }

  async function odemeModalKaydet(temizle) {
    const ctx = odemeDuzenleDurum;
    if (!ctx) return;
    const db = window.APARTIM.db;
    const rez = db?.durum.rezervasyonlar[ctx.rezId];
    if (!db || !rez) return odemeModalKapat();

    const tarih = tahsilatSeciliTarih();
    if (!tarih) {
      window.APARTIM.toast("Tarih seçin", "uyari");
      return;
    }
    ctx.tarih = tarih;

    const tamamla = !!document.getElementById("tahsilat-tamamla")?.checked;
    const oncekiTamam = !!rez.tahsilatTamamlandi;
    let kayit = null;

    if (!temizle) {
      const { tlHam, usdHam, tl, usd } = tahsilatGirisOku();
      if (tlHam !== "" && (!Number.isFinite(tl) || tl < 0)) {
        window.APARTIM.toast("Geçerli bir TL tutarı girin", "uyari");
        return;
      }
      if (usdHam !== "" && (!Number.isFinite(usd) || usd < 0)) {
        window.APARTIM.toast("Geçerli bir USD tutarı girin", "uyari");
        return;
      }
      const tlSafe = Number.isFinite(tl) && tl > 0 ? tl : 0;
      const usdSafe = Number.isFinite(usd) && usd > 0 ? usd : 0;
      /* Tutar yoksa: yalnızca tamamla tiki değiştiyse kaydet (kaldırma dahil) */
      if (tlSafe <= 0 && usdSafe <= 0 && tamamla === oncekiTamam) {
        window.APARTIM.toast("Tutar girin, tamamla seçin veya Temizle kullanın", "uyari");
        return;
      }
      if (tlSafe > 0 || usdSafe > 0) {
        const not = String(document.getElementById("odeme-not")?.value || "")
          .trim()
          .slice(0, 200);
        kayit = {
          tutarTl: tlSafe > 0 ? tlSafe : undefined,
          tutarUsd: usdSafe > 0 ? usdSafe : undefined,
          kurUsd: tahsilatKurUsd(),
          yontem: document.getElementById("odeme-yontem")?.value || "kasa"
        };
        if (not) kayit.not = not;
      }
    }

    try {
      const ekstra = {
        tahsilatTamamlandi: temizle ? false : tamamla,
        odemeId: ctx.odemeId || undefined
      };
      if (temizle) {
        if (!ctx.odemeId) {
          window.APARTIM.toast("Silmek için geçmişten bir tahsilat seçin", "uyari");
          return;
        }
        await db.rezervasyonOdenenHucreKaydet(ctx.rezId, tarih, null, ekstra);
      } else if (kayit) {
        await db.rezervasyonOdenenHucreKaydet(ctx.rezId, tarih, kayit, ekstra);
      } else {
        await db.rezervasyonGuncelle(ctx.rezId, { tahsilatTamamlandi: tamamla });
      }
      const guncel = db.durum.rezervasyonlar[ctx.rezId] || rez;
      if (ctx.hucre) odenenHucreyiYenile(ctx.hucre, guncel);
      document.querySelectorAll('.rez-ozet-odenen[data-rez-id="' + ctx.rezId + '"]').forEach((td) => {
        odenenHucreyiYenile(td, guncel);
      });
      rezCikisKalanHucreleriYenile(ctx.rezId, guncel);

      /* Kayıt sonrası aynı güne yeni tahsilat için formu temizle */
      tahsilatFormuTemizleYeni(guncel, tarih);
      document.getElementById("tahsilat-tamamla").checked = !!guncel.tahsilatTamamlandi;
      if (temizle) {
        window.APARTIM.toast?.("Tahsilat silindi", "basari");
      } else {
        window.APARTIM.toast?.(
          tamamla ? "Tahsilat tamamlandı" : "Tahsilat kaydedildi",
          "basari"
        );
      }
    } catch (err) {
      window.APARTIM.toast(err.message || "Kaydedilemedi", "hata");
    }
  }

  function odemeModalBagla() {
    document.getElementById("odeme-modal-kaydet")?.addEventListener("click", () => odemeModalKaydet(false));
    document.getElementById("odeme-modal-temizle")?.addEventListener("click", () => odemeModalKaydet(true));
    document.getElementById("odeme-modal-iptal")?.addEventListener("click", odemeModalKapat);
    document.getElementById("odeme-modal-close")?.addEventListener("click", odemeModalKapat);
    odemeModal()?.addEventListener("click", (ev) => {
      /* Yalnızca doğrudan karartmaya tıklanınca kapat (içerik yeniden çizilince bubble ile kapanmasın) */
      if (ev.target !== ev.currentTarget) return;
      odemeModalKapat();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      const m = odemeModal();
      if (m && !m.classList.contains("hidden")) odemeModalKapat();
    });
    ["odeme-tutar-tl", "odeme-tutar-usd"].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", tahsilatKalanOnizle);
      el?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          odemeModalKaydet(false);
        }
      });
    });
    document.getElementById("odeme-cevir-tl")?.addEventListener("input", () => {
      tahsilatCeviriciGuncelle("tl");
    });
    document.getElementById("odeme-cevir-usd")?.addEventListener("input", () => {
      tahsilatCeviriciGuncelle("usd");
    });
    document.getElementById("odeme-cevir-yon")?.addEventListener("click", tahsilatCeviriciTakas);
    document.getElementById("tahsilat-tamamla")?.addEventListener("change", tahsilatKalanOnizle);
    document.getElementById("odeme-tarih")?.addEventListener("change", () => {
      const ctx = odemeDuzenleDurum;
      if (!ctx) return;
      const t = tahsilatSeciliTarih();
      if (t) ctx.tarih = t;
      tahsilatKalanOnizle();
    });
    document.getElementById("odeme-gecmis")?.addEventListener("click", (e) => {
      const btn = e.target.closest?.("[data-tahsilat-id]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const ctx = odemeDuzenleDurum;
      if (!ctx) return;
      const db = window.APARTIM.db;
      const rez = db?.durum.rezervasyonlar[ctx.rezId];
      const t = btn.dataset.tahsilatTarih;
      const id = btn.dataset.tahsilatId;
      if (rez && t && id) {
        tahsilatFormaYukle(rez, t, id);
        document.getElementById("odeme-tutar-tl")?.focus({ preventScroll: true });
      }
    });
  }

  function colgroupOlustur(daireler) {
    const cg = document.createElement("colgroup");
    const tarihCol = document.createElement("col");
    tarihCol.className = "rez-ozet-col-tarih";
    cg.appendChild(tarihCol);
    daireler.forEach(() => {
      ["g", "kt", "fyt", "odn", "ad"].forEach((tip) => {
        const col = document.createElement("col");
        col.className = "rez-ozet-col-" + tip;
        cg.appendChild(col);
      });
    });
    return cg;
  }

  function theadOlustur(daireler) {
    const table = document.createElement("table");
    table.className = "rez-ozet-table";
    table.appendChild(colgroupOlustur(daireler));
    const thead = document.createElement("thead");
    const tr1 = document.createElement("tr");
    tr1.className = "rez-ozet-tr-daire";
    const kose = document.createElement("th");
    kose.className = "rez-ozet-tarih-kose";
    kose.rowSpan = 2;
    kose.textContent = "G";
    kose.title = "Tarih";
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
      ["G", "Kt", "Fyt", "Ödn", "Ad"].forEach((lbl) => {
        const th = document.createElement("th");
        th.className = lbl === "Ad"
          ? "rez-ozet-misafir-baslik"
          : (lbl === "Kt" ? "rez-ozet-kategori-baslik" : "rez-ozet-mini");
        th.style.background = renk;
        th.textContent = lbl;
        tr2.appendChild(th);
      });
    });
    thead.appendChild(tr2);
    table.appendChild(thead);
    return table;
  }

  function tabloTamamla(wrap, table, daireler) {
    sonDaireler = daireler;
    stickyBaslikOlcul(table);
    scheduleSutunOlcul(table, daireler);
    tabloScrollGozlem(table);
    scrollGeriYukleSonra(wrap, table);
  }

  function tabloScrollGozlem(table) {
    if (typeof ResizeObserver === "undefined") return;
    const scroll = table.closest(".rez-ozet-scroll");
    if (!scroll || scroll.dataset.rezOzetRo) return;
    scroll.dataset.rezOzetRo = "1";
    const ro = new ResizeObserver(() => sutunOlculPlanla(table));
    ro.observe(scroll);
  }

  function satirSecTiklenebilirMi(target) {
    if (target.closest(".rez-ozet-odenen, .rez-ozet-tik, .rez-ozet-bos, .rez-ozet-hucre-tik")) return null;
    const tr = target.closest("tbody tr.rez-ozet-tr");
    if (!tr?.dataset.tarih) return null;
    if (target.closest(".rez-ozet-tarih") || tr.dataset.tarih) return tr;
    return null;
  }

  function etkilesimBagla(kapsayici) {
    if (!kapsayici || kapsayici.dataset.rezOzetBagli) return;
    kapsayici.dataset.rezOzetBagli = "1";
    scrollKapsayici = kapsayici;
    let satirSecDokunmaYapildi = false;

    kapsayici.addEventListener("click", (ev) => {
      const odenen = ev.target.closest(".rez-ozet-odenen");
      if (odenen && !odenen.classList.contains("duzenleniyor")) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        odenenHucreDuzenle(odenen);
      }
    }, true);

    kapsayici.addEventListener("click", (ev) => {
      if (ev.target.closest(".rez-ozet-odenen")) return;
      const tik = ev.target.closest(".rez-ozet-tik");
      if (tik) {
        ev.stopPropagation();
        const id = tik.dataset.rezId || tik.getAttribute("data-rez-id");
        if (id && window.APARTIM.rezervasyon) window.APARTIM.rezervasyon.duzenle(id);
        return;
      }
      const bos = ev.target.closest(".rez-ozet-bos");
      if (bos) {
        ev.stopPropagation();
        const daireId = bos.dataset.daireId;
        const tarih = bos.dataset.tarih;
        if (daireId && tarih) rezAcYeni(daireId, tarih);
        return;
      }
    });

    kapsayici.addEventListener("mouseover", (e) => {
      const tr = e.target.closest("tbody tr.rez-ozet-tr");
      if (!tr) return;
      const tbody = tr.parentElement;
      tbody.querySelectorAll(".rez-ozet-satir-hover").forEach((r) =>
        r.classList.remove("rez-ozet-satir-hover"));
      const tarih = tr.dataset.tarih;
      if (tarih) {
        tbody.querySelectorAll('tr.rez-ozet-tr[data-tarih="' + tarih + '"]').forEach((r) =>
          r.classList.add("rez-ozet-satir-hover"));
      } else {
        tr.classList.add("rez-ozet-satir-hover");
      }
    });

    kapsayici.addEventListener("mouseleave", () => {
      kapsayici.querySelectorAll(".rez-ozet-satir-hover").forEach((r) =>
        r.classList.remove("rez-ozet-satir-hover"));
    });

    kapsayici.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      if (document.querySelector(
        ".modal-overlay:not(.hidden), .lock-screen:not(.hidden)"
      )) return;
      const tr = satirSecTiklenebilirMi(e.target);
      if (!tr) return;
      satirSec(tr);
      satirSecDokunmaYapildi = true;
    }, { passive: true });

    kapsayici.addEventListener("click", (e) => {
      if (satirSecDokunmaYapildi) {
        satirSecDokunmaYapildi = false;
        return;
      }
      const tr = satirSecTiklenebilirMi(e.target);
      if (tr) satirSec(tr);
    });
  }

  function satirSec(tr) {
    if (!tr?.dataset.tarih) return;
    const tarih = tr.dataset.tarih;
    const tbody = tr.parentElement;
    if (durum.seciliTarih === tarih) {
      durum.seciliTarih = null;
      tbody?.querySelectorAll(".rez-ozet-satir-secili").forEach((r) =>
        r.classList.remove("rez-ozet-satir-secili"));
      return;
    }
    durum.seciliTarih = tarih;
    tbody?.querySelectorAll(".rez-ozet-satir-secili").forEach((r) =>
      r.classList.remove("rez-ozet-satir-secili"));
    tbody?.querySelectorAll('tr.rez-ozet-tr[data-tarih="' + tarih + '"]').forEach((r) =>
      r.classList.add("rez-ozet-satir-secili"));
  }

  function scrollKonumAl() {
    const sc = scrollKapsayici || document.querySelector(".rez-ozet-scroll");
    return sc ? sc.scrollTop : 0;
  }

  function scrollKonumKoru(zorla) {
    if (durum.buguneKaydir) return;
    if (zorla || korunanScroll == null) korunanScroll = scrollKonumAl();
  }

  /** Modal kayıt / düzenleme öncesi scroll ve tarih konumunu koru */
  function konumKoru(tarih) {
    if (tarih) durum.seciliTarih = tarih;
    scrollKonumKoru(true);
  }

  function scrollElemana(sc, el, ortala) {
    if (!sc || !el) return;
    const scRect = sc.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (ortala) {
      sc.scrollTop += elRect.top - scRect.top - (sc.clientHeight - elRect.height) / 2;
      return;
    }
    if (elRect.top < scRect.top + 4) {
      sc.scrollTop += elRect.top - scRect.top - 40;
    } else if (elRect.bottom > scRect.bottom - 4) {
      sc.scrollTop += elRect.bottom - scRect.bottom + 40;
    }
  }

  function scrollGeriYukle(wrap, table) {
    const sc = scrollKapsayici || document.querySelector(".rez-ozet-scroll");
    if (!sc) return;

    if (durum.pendingOdenenFocus) {
      const pf = durum.pendingOdenenFocus;
      const hucre = wrap.querySelector(
        '.rez-ozet-odenen[data-rez-id="' + pf.rezId + '"][data-tarih="' + pf.tarih + '"]'
      );
      if (hucre) {
        scrollElemana(sc, hucre, true);
        durum.pendingOdenenFocus = null;
        odenenHucreDuzenle(hucre);
        return;
      }
      durum.pendingOdenenFocus = null;
    }

    if (durum.buguneKaydir) {
      durum.buguneKaydir = false;
      const bugun = window.APARTIM.db?.bugunISO?.();
      if (bugun) {
        durum.seciliTarih = bugun;
        table.querySelectorAll(".rez-ozet-satir-secili").forEach((r) =>
          r.classList.remove("rez-ozet-satir-secili"));
        const rows = table.querySelectorAll('tr.rez-ozet-tr[data-tarih="' + bugun + '"]');
        rows.forEach((r) => r.classList.add("rez-ozet-satir-secili"));
        if (rows[0]) scrollElemana(sc, rows[0], true);
      }
      korunanScroll = null;
      return;
    }

    if (durum.ayKaydir != null) {
      const hedefAy = durum.ayKaydir;
      const aySatir = table.querySelector('tr.rez-ozet-ay-ayrac[data-ay="' + hedefAy + '"]');
      if (aySatir) {
        durum.ayKaydir = null;
        scrollElemana(sc, aySatir, false);
        korunanScroll = null;
        return;
      }
    }

    if (korunanScroll != null && korunanScroll > 0) {
      sc.scrollTop = korunanScroll;
      return;
    }

    if (durum.seciliTarih) {
      const row = table.querySelector('tr.rez-ozet-tr[data-tarih="' + durum.seciliTarih + '"]');
      if (row) scrollElemana(sc, row, true);
    }
  }

  function scrollGeriYukleSonra(wrap, table) {
    const hedefTarih = durum.seciliTarih;
    requestAnimationFrame(() => {
      scrollGeriYukle(wrap, table);
      requestAnimationFrame(() => scrollGeriYukle(wrap, table));
      setTimeout(() => {
        scrollGeriYukle(wrap, table);
        korunanScroll = null;
      }, 0);
      setTimeout(() => {
        if (!hedefTarih) return;
        const sc = scrollKapsayici || document.querySelector(".rez-ozet-scroll");
        const row = table.querySelector('tr.rez-ozet-tr[data-tarih="' + hedefTarih + '"]');
        if (sc && row) scrollElemana(sc, row, true);
      }, 120);
    });
  }

  function applyColGenislik(table, pct) {
    const map = [
      ["rez-ozet-col-tarih", pct.tarih, "--rez-col-tarih"],
      ["rez-ozet-col-g", pct.g, "--rez-col-g"],
      ["rez-ozet-col-kt", pct.kt, "--rez-col-kt"],
      ["rez-ozet-col-fyt", pct.fyt, "--rez-col-fyt"],
      ["rez-ozet-col-odn", pct.odn, "--rez-col-odn"],
      ["rez-ozet-col-ad", pct.ad, "--rez-col-ad"]
    ];
    const sabitPx = pct.birim === "px";
    map.forEach(([cls, val, varName]) => {
      const w = val + pct.birim;
      table.querySelectorAll("col." + cls).forEach((c) => {
        c.style.width = w;
        if (sabitPx) {
          c.style.minWidth = w;
          c.style.maxWidth = w;
        } else {
          c.style.minWidth = "";
          c.style.maxWidth = "";
        }
      });
      table.style.setProperty(varName, w);
    });
  }

  let sonOlculGenislik = 0;

  function tabloSutunOlcul(table, daireler) {
    const n = Math.max((daireler || sonDaireler || []).length, 1);
    const scroll = table.closest(".rez-ozet-scroll");
    const panel = document.getElementById("tab-rezervasyonlar");
    const wrap = document.getElementById("rez-ozet-tablo");

    let genislik = scroll?.clientWidth || 0;
    if (genislik < 200 && panel) genislik = panel.clientWidth;
    if (genislik < 200) {
      genislik = document.querySelector(".content")?.clientWidth || window.innerWidth;
    }
    const gorunum = tabloGorunum(genislik);
    const ayniGenislik = Math.abs(genislik - sonOlculGenislik) < 2;
    if (
      ayniGenislik &&
      table.dataset.sutunOlculdu === "1" &&
      table.dataset.odaHedef === String(gorunum.odaHedef)
    ) {
      return;
    }
    sonOlculGenislik = genislik;
    table.dataset.sutunOlculdu = "1";

    const kompakt = gorunum.kompakt;
    const mobilYatay = document.body.classList.contains("mobil-yatay-mod");

    if (wrap) wrap.style.width = "100%";
    table.classList.toggle("rez-ozet-tablo-telefon", kompakt);
    table.classList.toggle("rez-ozet-tablo-masaustu", !kompakt);
    table.classList.toggle("rez-ozet-tablo-tablet", gorunum.cihaz === "tablet");
    table.dataset.odaHedef = String(gorunum.odaHedef);

    if (kompakt) {
      /* Sabit oda genişliği — Ad şişmesin, diğer sütunlar aynı kalsın */
      const tarihPx = gorunum.tarihPx || 32;
      const odaBlokPx = ODA_BLOK_KOMPAKT;
      const pay = odaSutunPaylari(odaBlokPx, true);
      const tabloW = tarihPx + n * odaBlokPx;

      applyColGenislik(table, {
        birim: "px",
        tarih: tarihPx,
        g: pay.g,
        kt: pay.kt,
        fyt: pay.fyt,
        odn: pay.odn,
        ad: pay.ad
      });
      if (wrap) {
        wrap.style.width = tabloW + "px";
        wrap.style.minWidth = tabloW + "px";
        wrap.style.maxWidth = tabloW + "px";
      }
      table.style.width = tabloW + "px";
      table.style.minWidth = tabloW + "px";
      table.style.maxWidth = tabloW + "px";
      table.style.fontSize = mobilYatay || gorunum.yatay ? "10px" : "11px";
      return;
    }

    const MASAUSTU_ODA_HEDEF = gorunum.odaHedef;
    const tarihPx = gorunum.tarihPx || (genislik >= 1200 ? 42 : 38);
    const masaGorunen = Math.max(1, Math.min(n, MASAUSTU_ODA_HEDEF));
    const odaBlokPx = Math.max(76, (genislik - tarihPx) / masaGorunen);
    const pay = odaSutunPaylari(odaBlokPx, false);
    const tabloW = tarihPx + n * odaBlokPx;

    applyColGenislik(table, {
      birim: "px",
      tarih: tarihPx,
      g: pay.g,
      kt: pay.kt,
      fyt: pay.fyt,
      odn: pay.odn,
      ad: pay.ad
    });
    if (wrap) {
      wrap.style.width = tabloW + "px";
      wrap.style.minWidth = tabloW + "px";
      wrap.style.maxWidth = tabloW + "px";
    }
    table.style.width = tabloW + "px";
    table.style.minWidth = tabloW + "px";
    table.style.maxWidth = tabloW + "px";
    table.style.fontSize = genislik >= 1200 ? "12px" : "11px";
  }

  function sutunOlculYenile() {
    const table = document.querySelector("#rez-ozet-tablo .rez-ozet-table");
    if (table) tabloSutunOlcul(table, sonDaireler);
  }

  function scheduleSutunOlcul(table, daireler) {
    requestAnimationFrame(() => tabloSutunOlcul(table, daireler));
  }

  function stickyBaslikOlcul(table) {
    requestAnimationFrame(() => {
      const tr1 = table.querySelector(".rez-ozet-tr-daire");
      if (!tr1) return;
      const h = tr1.getBoundingClientRect().height;
      table.style.setProperty("--rez-ozet-head1-h", h + "px");
    });
  }

  function sutunOlculPlanla(table) {
    if (!table) return;
    clearTimeout(sutunOlculTimer);
    sutunOlculTimer = setTimeout(() => tabloSutunOlcul(table, sonDaireler), 80);
  }

  let sutunOlculTimer = null;

  function tabloCiz() {
    const wrap = document.getElementById("rez-ozet-tablo");
    const baslik = document.getElementById("rez-ozet-ay-baslik");
    if (!wrap) return;

    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) {
      wrap.innerHTML = '<div class="rez-bos">Yükleniyor...</div>';
      return;
    }

    const y = sezonYil();
    const myToken = ++renderToken;
    if (baslik) baslik.textContent = "Haziran – Eylül " + y;

    sonOlculGenislik = 0;
    scrollKonumKoru(false);
    const ilkYukleme = !wrap.querySelector(".rez-ozet-table");

    const daireler = dairelerOzetSirasi(db);
    const gunler = sezonGunleri(y);
    if (!gunler.length) return;

    const { bas, bit } = sezonBasBit(y);
    const bugun = window.APARTIM.gorunum?.bugunISO?.() || db.bugunISO();
    const colSpan = 1 + daireler.length * 5;

    const harita = gunHaritasiOlustur(db, daireler, bas, bit);
    if (myToken !== renderToken) return;

    if (sayfaIlkOrtala && tabloSekmesiAcikMi()) {
      sayfaIlkOrtala = false;
      if (!durum.buguneKaydir) buguneOrtalaAyarla();
    }

    const table = theadOlustur(daireler);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    satirlariEkle(tbody, 0, y, gunler, daireler, harita, bugun, colSpan);

    if (ilkYukleme) {
      wrap.innerHTML = "";
      wrap.appendChild(table);
    } else {
      const eski = wrap.querySelector(".rez-ozet-table");
      if (eski) wrap.replaceChild(table, eski);
      else wrap.appendChild(table);
    }

    tabloTamamla(wrap, table, daireler);
  }

  function satirlariEkle(hedef, basIdx, y, gunler, daireler, harita, bugun, colSpan) {
    let i = basIdx;
    let oncekiAy = basIdx > 0 ? gunler[basIdx - 1].ay : -1;
    const frag = document.createDocumentFragment();
    while (i < gunler.length) {
      const { tarih, ay } = gunler[i];
      const gun = Number(tarih.slice(8, 10));
      if (ay !== oncekiAy) {
        frag.appendChild(ayAyiriciTr(y, ay, colSpan));
        oncekiAy = ay;
      }
      const satirlar = satirlarOlustur(tarih, y, ay, gun, daireler, harita, bugun);
      satirlar.forEach((tr) => frag.appendChild(tr));
      i++;
    }
    hedef.appendChild(frag);
  }

  function sezonGit(yon) {
    const y = sezonYil() + yon;
    window.APARTIM.gorunum?.yilSec?.(y);
    korunanScroll = null;
    tabloCiz();
  }

  function buguneGit() {
    const ortalandi = buguneOrtalaAyarla();
    if (!ortalandi) {
      window.APARTIM.toast?.("Bugün sezon dışında (Haziran–Eylül)", "bilgi");
    }
    tabloCiz();
  }

  function rezOutKalanMetin(rez) {
    return rezervasyonBakiyeMetin(rez);
  }

  function excelOdemeGoster(rez, info) {
    if (!info || !info.manuel || !info.tutar) return "—";
    const yontem = window.APARTIM.db?.ODEME_YONTEMLERI?.[info.yontem] || info.yontem || "";
    return odenenHucreGoster(rez, info) + (yontem ? " (" + yontem + ")" : "");
  }

  const XL_DAIRE_COL = 6;

  function rezNotMetni(rez) {
    if (!rez) return "";
    return String(rez.notlar || rez.not || "").trim();
  }

  function excelNotEki(rez) {
    const n = rezNotMetni(rez);
    return n ? " · Not: " + n : "";
  }

  const XL = {
    cizgi: "#6b7280",
    tarihBg: "#1e2d3d",
    tarihHaftaSonu: "#243446",
    hucreYazi: "#111827",
    ayAyiriciBg: "#1a2633",
    ayAyiriciYazi: "#ffffff",
    thKose: "padding:3px 6px;background:#1e2d3d;color:#ffffff;font-weight:800;font-size:10px;border:1px solid #6b7280;text-align:center;white-space:nowrap;",
    thDaire: (bg) => "padding:3px 6px;background:" + bg + ";font-weight:800;font-size:10px;color:#111827;text-align:center;border:1px solid #6b7280;white-space:nowrap;",
    thMini: (bg) => "padding:2px 3px;background:" + bg + ";font-size:9px;font-weight:700;color:#111827;border:1px solid #6b7280;text-align:center;",
    tdTarih: (haftaSonu) => "padding:2px 4px;background:" + (haftaSonu ? "#243446" : "#1e2d3d") +
      ";color:#ffffff;font-size:10px;border:1px solid #6b7280;vertical-align:middle;white-space:nowrap;",
    tdHucre: (bg) => "padding:1px 3px;background:" + bg + ";color:#111827;font-size:10px;border:1px solid #6b7280;vertical-align:middle;text-align:center;white-space:nowrap;",
    tdAyAyirici: "padding:5px 8px;background:#1a2633;color:#ffffff;font-weight:300;font-size:11px;letter-spacing:1px;text-align:center;border:1px solid #6b7280;",
    tdBirlesik: (bg) => "padding:2px 4px;background:" + bg + ";color:#111827;font-size:10px;border:1px solid #6b7280;vertical-align:middle;text-align:left;white-space:nowrap;",
    tdNot: (bg) => "padding:2px 4px;background:" + bg + ";color:#374151;font-size:9px;border:1px solid #6b7280;vertical-align:middle;text-align:left;white-space:normal;min-width:80px;"
  };

  function xlHucre(metin, stil, colspan) {
    const cs = colspan ? ' colspan="' + colspan + '"' : "";
    return '<td' + cs + ' style="' + stil + '">' + esc(metin) + "</td>";
  }

  function excelDaireHucreleri(h, tarih) {
    if (h.tip === "turnover") {
      const det = konakDetay(h.giris, tarih);
      return {
        hucreler: [
          "1",
          det.kategori,
          formatHucreFiyat(h.giris, det.prc, det.prcPb),
          excelOdnHucre(h.giris, tarih, det.odenenInfo),
          det.misafir || "",
          rezNotMetni(h.giris)
        ]
      };
    }
    if (h.tip === "checkout") {
      return {
        hucreler: [
          "—",
          "—",
          "—",
          "",
          "—",
          rezNotMetni(h.rez)
        ]
      };
    }
    if (h.tip === "checkin") {
      const det = konakDetay(h.rez, tarih);
      return {
        hucreler: [
          "1",
          det.kategori,
          formatHucreFiyat(h.rez, det.prc, det.prcPb),
          excelOdnHucre(h.rez, tarih, det.odenenInfo),
          det.misafir || "",
          rezNotMetni(h.rez)
        ]
      };
    }
    if (h.tip === "konak") {
      const det = konakDetay(h.rez, tarih);
      return {
        hucreler: [
          String(det.g),
          det.kategori,
          formatHucreFiyat(h.rez, det.prc, det.prcPb),
          excelOdnHucre(h.rez, tarih, det.odenenInfo),
          det.misafir || "",
          rezNotMetni(h.rez)
        ]
      };
    }
    return { hucreler: ["", "", "", "", "", ""] };
  }

  function excelSezonOzetMetni(y) {
    const db = window.APARTIM.db;
    if (!db || !window.APARTIM.para) return "";
    const { bas, bitHaric } = sezonBasBit(y);
    const { toplam, tlToplam } = window.APARTIM.para.aralikToplamlari(db, bas, bitHaric);
    const parcalar = [];
    if (toplam.TL > 0) parcalar.push(window.APARTIM.para.formatTutar(toplam.TL, "TL"));
    if (toplam.USD > 0) parcalar.push(window.APARTIM.para.formatTutar(toplam.USD, "USD"));
    if (toplam.EUR > 0) {
      parcalar.push(window.APARTIM.para.formatTutar(
        window.APARTIM.para.tlKarsiligi(toplam.EUR, "EUR"), "TL"
      ));
    }
    const gelir = parcalar.length ? parcalar.join("  |  ") : "0 ₺";
    return gelir + "  —  Sezon toplam ≈ " + fmt(Math.round(tlToplam)) + " ₺";
  }

  function excelRaporHtml(y, daireler, gunler, harita, bugun) {
    const colSpan = 1 + daireler.length * XL_DAIRE_COL;
    const satirlar = [];

    satirlar.push(
      '<tr><td colspan="' + colSpan + '" style="padding:8px 10px;background:#15202b;color:#ffffff;font-size:14px;font-weight:800;border:1px solid #6b7280;">' +
        esc("APARTIM — Rezervasyon Özeti · Haziran – Eylül " + y) + "</td></tr>"
    );
    satirlar.push(
      '<tr><td colspan="' + colSpan + '" style="padding:6px 10px;background:#1e2d3d;color:#ffffff;font-size:11px;border:1px solid #6b7280;">' +
        esc(excelSezonOzetMetni(y)) + "</td></tr>"
    );

    let h1 = '<td rowspan="2" style="' + XL.thKose + '">Tarih</td>';
    daireler.forEach((d, i) => {
      h1 += xlHucre(daireBaslik(d), XL.thDaire(daireRenk(d, i)), XL_DAIRE_COL);
    });
    satirlar.push("<tr>" + h1 + "</tr>");

    let h2 = "";
    daireler.forEach((d, i) => {
      const renk = daireRenk(d, i);
      ["G", "Kt", "Fyt", "Ödn", "Ad", "Not"].forEach((lbl) => {
        h2 += xlHucre(lbl, XL.thMini(renk));
      });
    });
    satirlar.push("<tr>" + h2 + "</tr>");

    let oncekiAy = -1;
    gunler.forEach(({ tarih, ay }) => {
      const gun = Number(tarih.slice(8, 10));
      const haftaSonu = new Date(y, ay, gun - 1).getDay();
      const hs = haftaSonu === 0 || haftaSonu === 6;

      if (ay !== oncekiAy) {
        satirlar.push("<tr>" + xlHucre(AY_ADLARI[ay] + " " + y, XL.tdAyAyirici, colSpan) + "</tr>");
        oncekiAy = ay;
      }

      let satir = xlHucre(tarihGoster(tarih) + " " + gunAdi(tarih, true), XL.tdTarih(hs));
      daireler.forEach((d, di) => {
        const h = gunDurumuHarita(harita, d.id, tarih);
        const renk = daireRenk(d, di);
        const hucre = excelDaireHucreleri(h, tarih);
        if (hucre.birlesik) {
          satir += xlHucre(hucre.birlesik, XL.tdBirlesik(renk), XL_DAIRE_COL);
        } else {
          hucre.hucreler.forEach((txt, ci) => {
            const stil = ci === 5 ? XL.tdNot(renk) : XL.tdHucre(renk);
            satir += xlHucre(txt, stil);
          });
        }
      });
      satirlar.push("<tr>" + satir + "</tr>");
    });

    return satirlar.join("");
  }

  async function excelRaporIndir() {
    const db = window.APARTIM.db;
    if (!db?.durum.yuklendi) {
      window.APARTIM.toast?.("Veriler henüz yüklenmedi", "uyari");
      return;
    }

    try {
      const y = sezonYil();
      const daireler = dairelerOzetSirasi(db);
      const gunler = sezonGunleri(y);
      const { bas, bit } = sezonBasBit(y);
      const bugun = window.APARTIM.gorunum?.bugunISO?.() || db.bugunISO();
      const harita = gunHaritasiOlustur(db, daireler, bas, bit);

      const tabloGovde = excelRaporHtml(y, daireler, gunler, harita, bugun);
      const html =
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
        "<head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>" +
        "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
        "<x:Name>Rezervasyon</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>" +
        "</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
        "<style>table{border-collapse:collapse;width:100%;}td,th{mso-number-format:\"\\@\";font-size:11px;padding:2px 4px;border:1px solid #ccc;}</style></head><body>" +
        '<table border="0" cellspacing="0" cellpadding="0">' + tabloGovde + "</table></body></html>";

      const dosyaAdi = "Apartim-Rezervasyon-" + y + "-Haziran-Eylul.xls";
      const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });

      if (window.APARTIM.dosyaIndir) {
        await window.APARTIM.dosyaIndir(blob, dosyaAdi, {
          baslik: "Apartım rezervasyon raporu",
          basariMesaj: "Excel raporu indirildi",
          mobilPaylasMesaj: "Excel veya Numbers seçin — düzenleyebilirsiniz",
          mobilIndirMesaj: "Excel dosyası indirildi — Dosyalar'dan açın"
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dosyaAdi;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      window.APARTIM.toast?.("Excel raporu indirildi", "basari");
    } catch (err) {
      console.error("excelRaporIndir", err);
      window.APARTIM.toast?.("Rapor oluşturulamadı", "hata");
    }
  }

  function yatayModGuncelle() {
    window.APARTIM.app?.yatayModGuncelle?.();
  }

  async function yonKilidiAc() {
    return window.APARTIM.app?.yonKilidiAc?.();
  }

  const TAM_EKRAN_MODAL_IDLER = ["modal-odeme"];

  function tamEkranWrap() {
    return document.querySelector("#tab-rezervasyonlar .rez-ozet-wrap");
  }

  function tamEkranAcikMi() {
    const wrap = tamEkranWrap();
    if (!wrap) return false;
    return document.fullscreenElement === wrap || wrap.classList.contains("rez-ozet-tam-ekran");
  }

  function modalRezBodyeAl() {
    const el = document.getElementById("modal-rez");
    if (!el) return;
    const host = modalHost();
    const tamEkran = tamEkranAcikMi();

    if (tamEkran && host) {
      if (!el._rezModalKaynak) {
        el._rezModalKaynak = { parent: el.parentElement, next: el.nextSibling };
      }
      host.setAttribute("aria-hidden", "false");
      if (el.parentElement !== host) host.appendChild(el);
      return;
    }

    if (el.parentElement?.id === "rez-ozet-modal-host") {
      document.body.appendChild(el);
    } else if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
    host?.setAttribute("aria-hidden", "true");
  }

  function modalHost() {
    return document.getElementById("rez-ozet-modal-host");
  }

  function tamEkranaModallariTasi(tasi) {
    const host = modalHost();
    if (!host) return;
    TAM_EKRAN_MODAL_IDLER.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (tasi) {
        if (!el._tamEkranKaynak) {
          el._tamEkranKaynak = { parent: el.parentElement, next: el.nextSibling };
        }
        host.appendChild(el);
      } else if (el._tamEkranKaynak) {
        const k = el._tamEkranKaynak;
        k.parent.insertBefore(el, k.next);
        delete el._tamEkranKaynak;
      }
    });
    host.setAttribute("aria-hidden", tasi ? "false" : "true");
  }

  async function tamEkranKapat() {
    const wrap = tamEkranWrap();
    if (!wrap) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (e) { /* yoksay */ }
    wrap.classList.remove("rez-ozet-tam-ekran");
    document.body.classList.remove("rez-ozet-tam-ekran");
    tamEkranaModallariTasi(false);
    try {
      if (screen.orientation && typeof screen.orientation.unlock === "function") {
        screen.orientation.unlock();
      }
    } catch (e) { /* yoksay */ }
    yatayModGuncelle();
    modalRezBodyeAl();
  }

  async function tamEkranYatay() {
    const wrap = tamEkranWrap();
    if (!wrap) return;

    if (tamEkranAcikMi()) {
      await tamEkranKapat();
      return;
    }

    try {
      tamEkranaModallariTasi(true);
      await yonKilidiAc();

      if (wrap.requestFullscreen) {
        await wrap.requestFullscreen();
      } else if (wrap.webkitRequestFullscreen) {
        wrap.webkitRequestFullscreen();
      } else {
        wrap.classList.add("rez-ozet-tam-ekran");
        document.body.classList.add("rez-ozet-tam-ekran");
      }

      try {
        if (screen.orientation && typeof screen.orientation.lock === "function") {
          await screen.orientation.lock("landscape");
        }
      } catch (e) { /* yoksay */ }

      yatayModGuncelle();
      modalRezBodyeAl();
      window.APARTIM.toast?.("Tam ekran — çıkmak için Yatay'a tekrar dokunun", "bilgi");
    } catch (err) {
      await tamEkranKapat();
      window.APARTIM.toast?.("Tam ekran açılamadı; telefonu yan çevirin", "uyari");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    modalRezBodyeAl();
    tamEkranaModallariTasi(false);
    odemeModalBagla();
    etkilesimBagla(document.querySelector("#tab-rezervasyonlar .rez-ozet-scroll"));
    document.getElementById("rez-ozet-yil-prev")?.addEventListener("click", () => sezonGit(-1));
    document.getElementById("rez-ozet-yil-next")?.addEventListener("click", () => sezonGit(1));
    document.getElementById("rez-ozet-bugun")?.addEventListener("click", buguneGit);
    document.getElementById("rez-ozet-tam")?.addEventListener("click", tamEkranYatay);
    document.getElementById("rez-ozet-rapor")?.addEventListener("click", excelRaporIndir);
    window.addEventListener("resize", () => {
      const table = document.querySelector("#rez-ozet-tablo .rez-ozet-table");
      if (table) stickyBaslikOlcul(table);
    });
    document.addEventListener("fullscreenchange", () => {
      modalRezBodyeAl();
      if (document.fullscreenElement) return;
      const wrap = tamEkranWrap();
      if (wrap?.classList.contains("rez-ozet-tam-ekran")) {
        tamEkranKapat();
      } else {
        tamEkranaModallariTasi(false);
      }
    });
  });

  document.addEventListener("apartim:gorunum-degisti", tabloCizPlanla);

  document.addEventListener("apartim:veri-degisti", tabloCizPlanla);

  document.addEventListener("apartim:gun-degisti", tabloCizPlanla);

  window.APARTIM.rezOzet = {
    tabloCiz, tabloCizPlanla, rezSekmeAc, sezonGit, buguneGit, konumKoru, excelRaporIndir,
    yatayModGuncelle, tamEkranYatay, tamEkranKapat, tamEkranAcikMi,
    tamEkranaModallariTasi, modalRezBodyeAl, yonKilidiAc, sutunOlculYenile
  };
})();
