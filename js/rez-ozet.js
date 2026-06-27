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

  const IO_HUCRE_RENK = "#e6a817";

  const DAIRE_RENK = {
    "ust": "#ffcdd2",
    "orta-sol": "#c8e6c9",
    "orta-sag": "#bbdefb",
    "alt-sol": "#fff9c4",
    "alt-sag": "#e1bee7"
  };
  const DAIRE_RENK_YEDEK = ["#ffcdd2", "#c8e6c9", "#bbdefb", "#fff9c4", "#e1bee7", "#ffe0b2", "#b2dfdb"];

  const durum = {
    sezonYil: new Date().getFullYear(),
    seciliTarih: null,
    pendingOdenenFocus: null,
    buguneKaydir: false
  };

  let renderToken = 0;
  let tabloTimer = null;
  let sonDaireler = [];
  let scrollKapsayici = null;
  let korunanScroll = null;

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function fmt(n) { return Number(n || 0).toLocaleString("tr-TR"); }

  function formatHucreFiyat(rez, miktar) {
    const pb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    if (window.APARTIM.para) return window.APARTIM.para.formatTutarKisa(miktar, pb);
    return fmt(miktar);
  }

  function formatKalanKisa(rez, miktar) {
    const pb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    if (window.APARTIM.para) return window.APARTIM.para.formatTutarKisa(miktar, pb);
    return fmt(miktar);
  }

  const ODEME_YONTEM_KISA = { elden: "Elden", havale: "Havale", booking: "Booking", diger: "Diğer" };

  function formatOdemeTutar(rez, miktar) {
    const pb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    if (window.APARTIM.para) return window.APARTIM.para.formatTutarKisa(miktar, pb);
    return fmt(miktar);
  }

  function odenenHucreGoster(rez, info) {
    if (!info || !info.manuel || !info.tutar) return "—";
    return formatOdemeTutar(rez, info.tutar);
  }

  function odenenHucreBaslik(rez, info) {
    if (!info || !info.manuel || !info.tutar) return "Ödeme girmek için tıklayın";
    const yontem = window.APARTIM.db?.ODEME_YONTEMLERI?.[info.yontem] ||
      ODEME_YONTEM_KISA[info.yontem] || "Elden";
    const pb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    const tam = window.APARTIM.para
      ? window.APARTIM.para.formatTutar(info.tutar, pb)
      : fmt(info.tutar);
    return yontem + " · " + tam;
  }

  function rezervasyonBakiyeMetin(rez) {
    const db = window.APARTIM.db;
    if (!db) return "";
    const toplam = db.rezervasyonToplamTutar(rez);
    if (toplam <= 0) return "";
    const kalan = db.rezervasyonKalanHesapla(rez);
    if (kalan < 0) return "Fazla " + formatKalanKisa(rez, -kalan);
    if (kalan > 0) return "Kln " + formatKalanKisa(rez, kalan);
    if (db.rezervasyonOdenenToplam(rez) > 0) return "Kapalı";
    return "";
  }

  function parseTutarGiris(val) {
    const s = String(val || "").trim().replace(/[^\d,.-]/g, "");
    if (!s) return null;
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  function rezOutKalanHtml(rez) {
    const metin = rezervasyonBakiyeMetin(rez);
    if (!metin) return "";
    const cls = metin.indexOf("Fazla") === 0 ? " rez-ozet-out-fazla" : "";
    return '<span class="rez-ozet-out-kalan' + cls + '" title="Toplam − ödenen">' + esc(metin) + "</span>";
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
    return new Date().getFullYear();
  }

  function tabloSekmesiAcikMi() {
    return document.getElementById("tab-rezervasyonlar")?.classList.contains("active");
  }

  function tabloCizPlanla() {
    if (!tabloSekmesiAcikMi()) return;
    clearTimeout(tabloTimer);
    tabloTimer = setTimeout(tabloCiz, 80);
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

  function paraOzetCiz(y) {
    const bar = document.getElementById("rez-ozet-para-bar");
    if (!bar || !window.APARTIM.para) return;
    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) {
      bar.innerHTML = "";
      return;
    }
    const { bas, bitHaric } = sezonBasBit(y);
    const { toplam, tlToplam } = window.APARTIM.para.aralikToplamlari(db, bas, bitHaric);
    const k = window.APARTIM.para.kurlariGetir();
    const meta = window.APARTIM.para.kurMetaGetir();
    const kurTarih = meta.guncelleme
      ? " · " + window.APARTIM.para.formatKurTarihi(meta.guncelleme)
      : "";
    const parcalar = [];
    if (toplam.TL > 0) parcalar.push('<span class="rez-ozet-para-item tl">' + window.APARTIM.para.formatTutar(toplam.TL, "TL") + "</span>");
    if (toplam.USD > 0) parcalar.push('<span class="rez-ozet-para-item usd">' + window.APARTIM.para.formatTutar(toplam.USD, "USD") + "</span>");
    if (toplam.EUR > 0) parcalar.push('<span class="rez-ozet-para-item eur">' + window.APARTIM.para.formatTutar(toplam.EUR, "EUR") + "</span>");
    bar.innerHTML =
      '<div class="rez-ozet-para-ic">' +
        '<div class="rez-ozet-para-tutarlar">' +
          parcalar.join('<span class="rez-ozet-para-ayrac">|</span>') +
        "</div>" +
        '<span class="rez-ozet-para-toplam">Sezon ≈ ' + fmt(Math.round(tlToplam)) + " ₺</span>" +
        '<span class="rez-ozet-para-kur">1$=' + window.APARTIM.para.formatKur(k.USD) + "₺ · 1€=" +
          window.APARTIM.para.formatKur(k.EUR) + "₺" + kurTarih + "</span>" +
      "</div>";
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

  function ioBadge(tip, rezId) {
    const lbl = tip === "in" ? "IN" : "OUT";
    return '<span class="rez-ozet-io ' + tip + ' rez-ozet-tik" data-rez-id="' + esc(rezId) + '">' + lbl + '</span>';
  }

  function turnoverHtml(cikis, giris, tarih) {
    const det = konakDetay(giris, tarih);
    const cikisRid = rezIdAl(cikis);
    const girisRid = rezIdAl(giris);
    const cikisKalan = rezOutKalanHtml(cikis);
    return (
      '<div class="rez-ozet-turnover-kompakt">' +
        '<span class="rez-ozet-turnover-grup out-grup">' +
          ioBadge("out", cikisRid) +
          kaynakSimgeHtml(cikis) +
          '<span class="rez-ozet-io-ad rez-ozet-tik" data-rez-id="' + esc(cikisRid) +
          '" title="' + esc(cikis.misafirAdi) + '">' + esc(kisaAd(cikis.misafirAdi, 14)) + "</span>" +
          (cikisKalan || "") +
        "</span>" +
        '<span class="rez-ozet-io-sep">·</span>' +
        '<span class="rez-ozet-turnover-grup in-grup">' +
          ioBadge("in", girisRid) +
          det.kategoriHtml +
          '<span class="rez-ozet-io-ad rez-ozet-tik" data-rez-id="' + esc(girisRid) +
          '" title="' + esc(det.misafir) + '">' + esc(kisaAd(det.misafir, 14)) + "</span>" +
        "</span>" +
      "</div>"
    );
  }

  function checkoutHtml(rez) {
    const rid = rezIdAl(rez);
    const kalan = rezOutKalanHtml(rez);
    return (
      '<div class="rez-ozet-io-satir">' +
        '<span class="rez-ozet-turnover-grup out-grup">' +
          ioBadge("out", rid) +
          kaynakSimgeHtml(rez) +
          '<span class="rez-ozet-io-ad rez-ozet-tik" data-rez-id="' + esc(rid) +
          '" title="' + esc(rez.misafirAdi) + '">' + esc(kisaAd(rez.misafirAdi, 16)) + "</span>" +
        "</span>" +
        (kalan ? '<span class="rez-ozet-turnover-grup sag-grup">' + kalan + "</span>" : "") +
      "</div>"
    );
  }

  function checkoutHucreleriEkle(tr, rez, tarih, renk, ioVurgu, rowspan) {
    const rid = rezIdAl(rez);
    const bg = hucreBg(renk, ioVurgu);
    const rs = rowspan > 1 ? rowspan : undefined;
    const tdG = document.createElement("td");
    tdG.className = "rez-ozet-sayi rez-ozet-io-rozet rez-ozet-tik" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdG.style.background = bg;
    if (rid) tdG.dataset.rezId = rid;
    tdG.innerHTML = ioBadge("out", rid);
    if (rs) tdG.rowSpan = rs;
    tr.appendChild(tdG);

    const tdKt = document.createElement("td");
    tdKt.className = "rez-ozet-kategori rez-ozet-tik" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdKt.style.background = bg;
    if (rid) tdKt.dataset.rezId = rid;
    tdKt.innerHTML = kaynakSimgeHtml(rez);
    if (rs) tdKt.rowSpan = rs;
    tr.appendChild(tdKt);

    const tdF = document.createElement("td");
    tdF.className = "rez-ozet-sayi" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdF.style.background = bg;
    tdF.textContent = "—";
    if (rs) tdF.rowSpan = rs;
    tr.appendChild(tdF);

    const tdO = document.createElement("td");
    tdO.className = "rez-ozet-sayi rez-ozet-odenen rez-ozet-out-kalan-hucre" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdO.style.background = bg;
    if (rid) tdO.dataset.rezId = rid;
    tdO.textContent = rezOutKalanMetin(rez) || "—";
    if (rs) tdO.rowSpan = rs;
    tr.appendChild(tdO);

    const tdA = document.createElement("td");
    tdA.className = "rez-ozet-ad rez-ozet-tik" + (ioVurgu ? " rez-ozet-io-hucre" : "");
    tdA.style.background = bg;
    if (rid) tdA.dataset.rezId = rid;
    tdA.textContent = rez.misafirAdi || "";
    tdA.title = rez.misafirAdi || "";
    if (rs) tdA.rowSpan = rs;
    tr.appendChild(tdA);
  }

  function checkinHucreleriEkle(tr, rez, tarih, renk, ioVurgu, rowspan) {
    const rid = rezIdAl(rez);
    const bg = hucreBg(renk, ioVurgu);
    checkinHucreler(rez, tarih).forEach((c, ci) => {
      const td = hucreTdOlustur(
        c, rez, tarih, bg, rid, ci === 4 ? (rez.misafirAdi || "") : "", ioVurgu
      );
      if (rowspan > 1) td.rowSpan = rowspan;
      tr.appendChild(td);
    });
  }

  function konakHucreleriEkle(tr, rez, tarih, renk, rowspan) {
    const det = konakDetay(rez, tarih);
    const rid = rezIdAl(rez);
    [
      { cls: "rez-ozet-sayi", txt: String(det.g) },
      { cls: "rez-ozet-kategori", html: det.kategoriHtml },
      { cls: "rez-ozet-sayi", txt: formatHucreFiyat(rez, det.prc) },
      { type: "odn" },
      { cls: "rez-ozet-ad", txt: det.misafir || "" }
    ].forEach((c, ci) => {
      const td = hucreTdOlustur(
        c, rez, tarih, renk, rid, ci === 4 ? (det.misafir || "") : ""
      );
      if (rowspan > 1) td.rowSpan = rowspan;
      tr.appendChild(td);
    });
  }

  function bosHucreleriEkle(tr, daireId, tarih, renk, rowspan) {
    for (let i = 0; i < 5; i++) {
      const td = document.createElement("td");
      td.className = "rez-ozet-bos rez-ozet-hucre-tik";
      td.style.background = renk;
      td.dataset.daireId = daireId;
      td.dataset.tarih = tarih;
      td.title = "Yeni rezervasyon";
      if (rowspan > 1) td.rowSpan = rowspan;
      tr.appendChild(td);
    }
  }

  function altBosHucreleriEkle(tr, renk) {
    for (let i = 0; i < 5; i++) {
      const td = document.createElement("td");
      td.className = "rez-ozet-alt-bos";
      td.style.background = renk;
      td.innerHTML = "&#8203;";
      tr.appendChild(td);
    }
  }

  function hucreBg(renk, ioVurgu) {
    return ioVurgu ? IO_HUCRE_RENK : renk;
  }

  function gunTurnoverVarMi(harita, daireler, tarih) {
    return daireler.some((d) => gunDurumuHarita(harita, d.id, tarih).tip === "turnover");
  }

  function satirSiniflari(tarih, bugun, haftaSonu, ioGun) {
    let cls = "rez-ozet-tr";
    if (tarih === bugun) cls += " rez-ozet-bugun";
    if (haftaSonu === 0 || haftaSonu === 6) cls += " rez-ozet-haftasonu";
    if (ioGun) cls += " rez-ozet-io-gun";
    return cls;
  }

  function tarihTdOlustur(tarih, rowspan) {
    const tdTarih = document.createElement("td");
    tdTarih.className = "rez-ozet-tarih";
    tdTarih.dataset.tarih = tarih;
    tdTarih.innerHTML =
      '<span class="rez-ozet-tarih-gun">' + tarihGosterKisa(tarih) + "</span>" +
      '<span class="rez-ozet-gun-ad">' + gunAdiTablo(tarih) + "</span>";
    if (rowspan > 1) tdTarih.rowSpan = rowspan;
    return tdTarih;
  }

  function daireHucreleriTekSatir(tr, d, h, tarih, renk) {
    if (h.tip === "checkin") {
      checkinHucreleriEkle(tr, h.rez, tarih, renk, true);
      return;
    }
    if (h.tip === "checkout") {
      checkoutHucreleriEkle(tr, h.rez, tarih, renk, true);
      return;
    }
    if (h.tip === "konak") {
      konakHucreleriEkle(tr, h.rez, tarih, renk, 1);
      return;
    }
    bosHucreleriEkle(tr, d.id, tarih, renk, 1);
  }

  function daireHucreleriCiftSatir(trOut, trIn, d, h, tarih, renk) {
    if (h.tip === "turnover") {
      checkinHucreleriEkle(trOut, h.giris, tarih, renk, true);
      checkoutHucreleriEkle(trIn, h.cikis, tarih, renk, true);
      return;
    }
    if (h.tip === "checkout") {
      checkoutHucreleriEkle(trOut, h.rez, tarih, renk, true, 2);
      return;
    }
    if (h.tip === "checkin") {
      checkinHucreleriEkle(trOut, h.rez, tarih, renk, true, 2);
      return;
    }
    if (h.tip === "konak") {
      konakHucreleriEkle(trOut, h.rez, tarih, renk, 2);
      return;
    }
    bosHucreleriEkle(trOut, d.id, tarih, renk, 2);
  }

  function satirlarOlustur(tarih, y, m, g, daireler, harita, bugun) {
    const haftaSonu = new Date(y, m, g - 1).getDay();
    const ciftSatir = gunTurnoverVarMi(harita, daireler, tarih);
    const ioGun = ciftSatir || daireler.some((d) => {
      const tip = gunDurumuHarita(harita, d.id, tarih).tip;
      return tip === "checkout" || tip === "checkin";
    });
    const sinif = satirSiniflari(tarih, bugun, haftaSonu, ioGun);
    const secili = durum.seciliTarih === tarih;

    if (!ciftSatir) {
      const tr = document.createElement("tr");
      tr.className = sinif;
      tr.dataset.tarih = tarih;
      if (secili) tr.classList.add("rez-ozet-satir-secili");
      tr.appendChild(tarihTdOlustur(tarih, 1));
      daireler.forEach((d, di) => {
        const h = gunDurumuHarita(harita, d.id, tarih);
        daireHucreleriTekSatir(tr, d, h, tarih, daireRenk(d, di));
      });
      return [tr];
    }

    const trOut = document.createElement("tr");
    trOut.className = sinif + " rez-ozet-tr-turnover-out";
    trOut.dataset.tarih = tarih;
    if (secili) trOut.classList.add("rez-ozet-satir-secili");

    const trIn = document.createElement("tr");
    trIn.className = sinif + " rez-ozet-tr-turnover-in";
    trIn.dataset.tarih = tarih;
    if (secili) trIn.classList.add("rez-ozet-satir-secili");

    trOut.appendChild(tarihTdOlustur(tarih, 2));
    daireler.forEach((d, di) => {
      const h = gunDurumuHarita(harita, d.id, tarih);
      daireHucreleriCiftSatir(trOut, trIn, d, h, tarih, daireRenk(d, di));
    });
    return [trOut, trIn];
  }

  function checkinHucreler(rez, tarih) {
    const det = konakDetay(rez, tarih);
    return [
      { cls: "rez-ozet-sayi rez-ozet-io-rozet", html: ioBadge("in", rez.id) },
      { cls: "rez-ozet-kategori", html: det.kategoriHtml },
      { cls: "rez-ozet-sayi", txt: formatHucreFiyat(rez, det.prc) },
      { type: "odn" },
      { cls: "rez-ozet-ad", txt: det.misafir || "" }
    ];
  }

  function konakDetay(rez, tarih) {
    const db = window.APARTIM.db;
    const g = db.geceSayisi(rez.giris, tarih) + 1;
    const prc = db.rezervasyonGeceUcreti(rez, g);
    const odenenInfo = db.rezervasyonOdenenGosterim(rez, tarih);
    const toplam = rez.toplamTutar != null
      ? rez.toplamTutar
      : db.rezervasyonTutarHesapla(rez).toplam;
    return {
      g,
      kategori: kaynakSimge(rez),
      kategoriHtml: kaynakSimgeHtml(rez),
      prc,
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
    const td = document.createElement("td");
    td.className = "rez-ozet-sayi rez-ozet-odenen" + (info.manuel ? " manuel" : " bos") +
      (ioVurgu ? " rez-ozet-io-hucre" : "");
    td.style.background = hucreBg(renk, ioVurgu);
    if (rid) td.dataset.rezId = rid;
    td.dataset.tarih = tarih;
    if (info.manuel) td.dataset.yontem = info.yontem;
    if (info.manuel) {
      td.textContent = odenenHucreGoster(rez, info);
      td.title = odenenHucreBaslik(rez, info);
    } else {
      const kln = rezervasyonBakiyeMetin(rez);
      td.textContent = kln || "—";
      td.title = kln ? "Toplam kalan · ödeme girmek için tıklayın" : "Ödeme girmek için tıklayın";
      if (kln) td.classList.add("rez-ozet-kalan-ipucu");
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
      td.textContent = c.txt;
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
    return modal;
  }

  function odemeModalKapat() {
    odemeModal()?.classList.add("hidden");
    odemeDuzenleDurum = null;
  }

  function odenenHucreyiYenile(hucre, rez) {
    const db = window.APARTIM.db;
    const tarih = hucre.dataset.tarih;
    if (!db || !tarih) return;
    const info = db.rezervasyonOdenenGosterim(rez, tarih);
    hucre.textContent = odenenHucreGoster(rez, info);
    hucre.title = odenenHucreBaslik(rez, info);
    hucre.classList.toggle("manuel", info.manuel);
    hucre.classList.toggle("bos", !info.manuel);
    if (info.manuel) hucre.dataset.yontem = info.yontem;
    else delete hucre.dataset.yontem;
  }

  function odenenHucreDuzenle(hucre) {
    const rezId = hucre.dataset.rezId;
    const tarih = hucre.dataset.tarih;
    if (!rezId || !tarih) {
      window.APARTIM.toast?.("Ödeme hücresi tanınmadı", "uyari");
      return;
    }
    durum.seciliTarih = tarih;

    const db = window.APARTIM.db;
    const rez = db?.durum.rezervasyonlar[rezId];
    if (!rez) {
      window.APARTIM.toast?.("Rezervasyon bulunamadı", "uyari");
      return;
    }

    const info = db.rezervasyonOdenenGosterim(rez, tarih);
    const modal = odemeModalAc();
    if (!modal) {
      window.APARTIM.toast?.("Ödeme formu yüklenemedi", "hata");
      return;
    }

    odemeDuzenleDurum = { rezId, tarih, hucre };

    const baslik = document.getElementById("odeme-modal-baslik");
    const aciklama = document.getElementById("odeme-modal-aciklama");
    const inp = document.getElementById("odeme-tutar");
    const sel = document.getElementById("odeme-yontem");
    if (baslik) {
      baslik.textContent = "Ödeme — " + (rez.misafirAdi || "Misafir") + " · " + tarihGoster(tarih);
    }
    if (aciklama) {
      const pb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
      const geceUcret = db.rezervasyonTarihUcreti(rez, tarih);
      const geceMetin = window.APARTIM.para
        ? window.APARTIM.para.formatTutar(geceUcret, pb)
        : fmt(geceUcret) + " " + pb;
      aciklama.textContent = "Bu gece ücreti: " + geceMetin;
    }
    if (inp) {
      inp.value = info.manuel ? String(info.tutar) : "";
    }
    if (sel) sel.value = info.yontem || "elden";

    setTimeout(() => {
      inp?.focus({ preventScroll: true });
      inp?.select?.();
    }, 80);
  }

  async function odemeModalKaydet(temizle) {
    const ctx = odemeDuzenleDurum;
    if (!ctx) return;
    const db = window.APARTIM.db;
    const rez = db?.durum.rezervasyonlar[ctx.rezId];
    if (!db || !rez) return odemeModalKapat();

    let kayit = null;
    if (!temizle) {
      const inp = document.getElementById("odeme-tutar");
      const sel = document.getElementById("odeme-yontem");
      const ham = inp?.value?.trim() || "";
      const tutar = ham === "" ? null : parseTutarGiris(ham);
      if (ham !== "" && (!Number.isFinite(tutar) || tutar < 0)) {
        window.APARTIM.toast("Geçerli bir tutar girin", "uyari");
        return;
      }
      if (tutar == null || tutar <= 0) {
        window.APARTIM.toast("Tutar girin veya Temizle kullanın", "uyari");
        return;
      }
      kayit = { tutar, yontem: sel?.value || "elden" };
    }

    try {
      await db.rezervasyonOdenenHucreKaydet(ctx.rezId, ctx.tarih, kayit);
      odenenHucreyiYenile(ctx.hucre, rez);
      odemeModalKapat();
    } catch (err) {
      window.APARTIM.toast(err.message || "Kaydedilemedi", "hata");
    }
  }

  function odemeModalBagla() {
    document.getElementById("odeme-modal-kaydet")?.addEventListener("click", () => odemeModalKaydet(false));
    document.getElementById("odeme-modal-temizle")?.addEventListener("click", () => odemeModalKaydet(true));
    document.getElementById("odeme-modal-iptal")?.addEventListener("click", odemeModalKapat);
    document.getElementById("odeme-modal-close")?.addEventListener("click", odemeModalKapat);
    document.getElementById("odeme-tutar")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        odemeModalKaydet(false);
      }
      if (e.key === "Escape") odemeModalKapat();
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
    const ro = new ResizeObserver(() => stickyBaslikOlcul(table));
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
    requestAnimationFrame(() => {
      scrollGeriYukle(wrap, table);
      requestAnimationFrame(() => scrollGeriYukle(wrap, table));
      setTimeout(() => {
        scrollGeriYukle(wrap, table);
        korunanScroll = null;
      }, 0);
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
    map.forEach(([cls, val, varName]) => {
      const birim = pct.birim;
      const w = val + birim;
      table.querySelectorAll("col." + cls).forEach((c) => { c.style.width = w; });
      table.style.setProperty(varName, w);
    });
  }

  function tabloSutunOlcul(table, daireler) {
    const n = Math.max((daireler || sonDaireler || []).length, 1);
    const scroll = table.closest(".rez-ozet-scroll");
    const panel = document.getElementById("tab-rezervasyonlar");
    const wrap = document.getElementById("rez-ozet-tablo");
    if (wrap) wrap.style.width = "100%";

    let genislik = scroll?.clientWidth || 0;
    if (genislik < 200 && panel) genislik = panel.clientWidth;
    if (genislik < 200) {
      genislik = document.querySelector(".content")?.clientWidth || window.innerWidth;
    }

    const mobilYatay = document.body.classList.contains("mobil-yatay-mod");
    const telefon = mobilYatay || genislik < 640;

    if (telefon) {
      const px = { birim: "px", tarih: 36, g: 16, kt: 16, fyt: 26, odn: 26, ad: 40 };
      applyColGenislik(table, px);
      table.style.width = "100%";
      table.style.minWidth = (px.tarih + n * (px.g + px.kt + px.fyt + px.odn + px.ad)) + "px";
      table.style.fontSize = mobilYatay ? "9px" : "10px";
      return;
    }

    const tarihPct = genislik < 960 ? 4.2 : 3.2;
    const odaPct = (100 - tarihPct) / n;
    const oran = { g: 8.5, kt: 8.5, fyt: 19, odn: 19, ad: 45 };
    applyColGenislik(table, {
      birim: "%",
      tarih: tarihPct,
      g: odaPct * oran.g / 100,
      kt: odaPct * oran.kt / 100,
      fyt: odaPct * oran.fyt / 100,
      odn: odaPct * oran.odn / 100,
      ad: odaPct * oran.ad / 100
    });
    table.style.width = "100%";
    table.style.minWidth = "100%";
    table.style.fontSize = genislik >= 1200 ? "12px" : "11px";
  }

  function sutunOlculYenile() {
    const table = document.querySelector("#rez-ozet-tablo .rez-ozet-table");
    if (table) tabloSutunOlcul(table, sonDaireler);
  }

  function scheduleSutunOlcul(table, daireler) {
    const run = () => tabloSutunOlcul(table, daireler);
    run();
    requestAnimationFrame(run);
    setTimeout(run, 60);
    setTimeout(run, 250);
  }

  function stickyBaslikOlcul(table) {
    requestAnimationFrame(() => {
      const tr1 = table.querySelector(".rez-ozet-tr-daire");
      if (!tr1) return;
      table.style.setProperty("--rez-ozet-head1-h", tr1.getBoundingClientRect().height + "px");
      tabloSutunOlcul(table, sonDaireler);
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

    const y = durum.sezonYil;
    const myToken = ++renderToken;
    if (baslik) baslik.textContent = "Haziran – Eylül " + y;

    scrollKonumKoru(false);
    const ilkYukleme = !wrap.querySelector(".rez-ozet-table");

    const daireler = dairelerOzetSirasi(db);
    const gunler = sezonGunleri(y);
    if (!gunler.length) return;

    const { bas, bit } = sezonBasBit(y);
    const bugun = db.bugunISO();
    const colSpan = 1 + daireler.length * 5;

    paraOzetCiz(y);

    const harita = gunHaritasiOlustur(db, daireler, bas, bit);
    if (myToken !== renderToken) return;

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
    durum.sezonYil += yon;
    korunanScroll = null;
    tabloCiz();
  }

  function buguneGit() {
    const n = new Date();
    durum.sezonYil = varsayilanSezonYil();
    const { bas, bit } = sezonBasBit(durum.sezonYil);
    const bugun = window.APARTIM.db?.bugunISO?.() || iso(n.getFullYear(), n.getMonth(), n.getDate());
    korunanScroll = null;
    durum.buguneKaydir = bugun >= bas && bugun <= bit;
    if (durum.buguneKaydir) {
      durum.seciliTarih = bugun;
    } else {
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
      const outK = rezOutKalanMetin(h.cikis);
      const txt = "OUT " + kaynakSimge(h.cikis) + " " + (h.cikis.misafirAdi || "") +
        excelNotEki(h.cikis) +
        (outK ? " " + outK : "") + "  ·  IN " + det.kategori + " " + (det.misafir || "") +
        excelNotEki(h.giris);
      return { birlesik: txt };
    }
    if (h.tip === "checkout") {
      const k = rezOutKalanMetin(h.rez);
      return {
        birlesik: "OUT " + kaynakSimge(h.rez) + " " + (h.rez.misafirAdi || "") +
          excelNotEki(h.rez) + (k ? " " + k : "")
      };
    }
    if (h.tip === "checkin") {
      const det = konakDetay(h.rez, tarih);
      return {
        hucreler: [
          "IN " + det.g,
          det.kategori,
          formatHucreFiyat(h.rez, det.prc),
          excelOdemeGoster(h.rez, det.odenenInfo),
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
          formatHucreFiyat(h.rez, det.prc),
          excelOdemeGoster(h.rez, det.odenenInfo),
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
    if (toplam.EUR > 0) parcalar.push(window.APARTIM.para.formatTutar(toplam.EUR, "EUR"));
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

  function excelRaporIndir() {
    const db = window.APARTIM.db;
    if (!db?.durum.yuklendi) {
      window.APARTIM.toast?.("Veriler henüz yüklenmedi", "uyari");
      return;
    }

    try {
      const y = durum.sezonYil;
      const daireler = dairelerOzetSirasi(db);
      const gunler = sezonGunleri(y);
      const { bas, bit } = sezonBasBit(y);
      const bugun = db.bugunISO();
      const harita = gunHaritasiOlustur(db, daireler, bas, bit);

      const tabloGovde = excelRaporHtml(y, daireler, gunler, harita, bugun);
      const html =
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
        "<head><meta charset=\"UTF-8\"/>" +
        "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
        "<x:Name>Rezervasyon</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>" +
        "</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
        "<style>table{border-collapse:collapse;}td,th{mso-number-format:\"\\@\";}</style></head><body>" +
        '<table border="0" cellspacing="0" cellpadding="0">' + tabloGovde + "</table></body></html>";

      const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Apartim-Rezervasyon-" + y + "-Haziran-Eylul.xls";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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

  const TAM_EKRAN_MODAL_IDLER = ["modal-odeme", "modal-rez"];

  function tamEkranWrap() {
    return document.querySelector("#tab-rezervasyonlar .rez-ozet-wrap");
  }

  function tamEkranAcikMi() {
    const wrap = tamEkranWrap();
    if (!wrap) return false;
    return document.fullscreenElement === wrap || wrap.classList.contains("rez-ozet-tam-ekran");
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
      window.APARTIM.toast?.("Tam ekran — çıkmak için Yatay'a tekrar dokunun", "bilgi");
    } catch (err) {
      await tamEkranKapat();
      window.APARTIM.toast?.("Tam ekran açılamadı; telefonu yan çevirin", "uyari");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
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
      if (document.fullscreenElement) return;
      const wrap = tamEkranWrap();
      if (wrap?.classList.contains("rez-ozet-tam-ekran")) {
        tamEkranKapat();
      } else {
        tamEkranaModallariTasi(false);
      }
    });
  });

  document.addEventListener("apartim:veri-degisti", tabloCizPlanla);

  document.addEventListener("apartim:gun-degisti", tabloCizPlanla);

  window.APARTIM.rezOzet = {
    tabloCiz, tabloCizPlanla, sezonGit, buguneGit, konumKoru, excelRaporIndir,
    yatayModGuncelle, tamEkranYatay, tamEkranKapat, tamEkranAcikMi,
    tamEkranaModallariTasi, yonKilidiAc, sutunOlculYenile
  };
})();
