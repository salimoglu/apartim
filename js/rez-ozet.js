/* =========================================================
   APARTIM — Rezervasyon özet tablosu (tüm odalar)
   Tarih satırları × daire sütunları, Excel benzeri görünüm.
   ========================================================= */

(function () {
  "use strict";

  const GUN_KISA = ["PAZ", "PZT", "SAL", "ÇAR", "PER", "CUM", "CMT"];
  const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  const SEZON_BAS_AY = 5;
  const SEZON_BIT_AY = 8;
  const CHUNK_GUN = 14;

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

  function odenenHucreGoster(rez, tutar, manuel) {
    if (!manuel) return "—";
    return formatKalanKisa(rez, tutar);
  }

  function parseTutarGiris(val) {
    const s = String(val || "").trim().replace(/[^\d,.-]/g, "");
    if (!s) return null;
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  function rezOutKalanHtml(rez) {
    const db = window.APARTIM.db;
    if (!db) return "";
    const odenen = db.rezervasyonOdenenToplam(rez);
    if (odenen <= 0) return "";
    const kalan = db.rezervasyonKalanHesapla(rez);
    return '<span class="rez-ozet-out-kalan" title="Toplam − ödenen = kalan">Kln ' +
      formatKalanKisa(rez, kalan) + "</span>";
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
    const ayir = parcalar.length ? '<span class="rez-ozet-para-ayrac">|</span>' : "";
    bar.innerHTML =
      '<div class="rez-ozet-para-ic">' +
        parcalar.join('<span class="rez-ozet-para-ayrac">|</span>') +
        ayir +
        '<span class="rez-ozet-para-toplam">Sezon ≈ ' + fmt(Math.round(tlToplam)) + " ₺</span>" +
        '<span class="rez-ozet-para-kur">(1$=' + window.APARTIM.para.formatKur(k.USD) + "₺ · 1€=" +
          window.APARTIM.para.formatKur(k.EUR) + "₺" + kurTarih + ")</span>" +
      "</div>";
  }
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

  function checkinHucreler(rez, tarih) {
    const det = konakDetay(rez, tarih);
    return [
      { cls: "rez-ozet-sayi rez-ozet-giris-hucre", html: ioBadge("in", rez.id) + '<span>' + det.g + '</span>' },
      { cls: "rez-ozet-kategori", html: det.kategoriHtml },
      { cls: "rez-ozet-sayi", txt: formatHucreFiyat(rez, det.prc) },
      { type: "odn" },
      { cls: "rez-ozet-ad", txt: kisaAd(det.misafir, 11) }
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
      toplam,
      misafir: rez.misafirAdi
    };
  }

  function odnHucreTd(rez, tarih, renk, rid) {
    const db = window.APARTIM.db;
    const { tutar, manuel } = db.rezervasyonOdenenGosterim(rez, tarih);
    const td = document.createElement("td");
    td.className = "rez-ozet-sayi rez-ozet-odenen" + (manuel ? " manuel" : " bos");
    td.style.background = renk;
    if (rid) td.dataset.rezId = rid;
    td.dataset.tarih = tarih;
    td.textContent = odenenHucreGoster(rez, tutar, manuel);
    td.title = "Ödenen tutarı girmek için tıklayın";
    return td;
  }

  function hucreTdOlustur(c, rez, tarih, renk, rid, misafirBaslik) {
    if (c.type === "odn") return odnHucreTd(rez, tarih, renk, rid);
    const td = document.createElement("td");
    td.className = c.cls + " rez-ozet-tik";
    td.style.background = renk;
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

  function ilkBosDaire(tarih, daireler) {
    const db = window.APARTIM.db;
    if (!db) return null;
    for (let i = 0; i < daireler.length; i++) {
      if (db.daireGunDurumu(daireler[i].id, tarih).tip === "bos") return daireler[i].id;
    }
    return null;
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

  function odenenHucreDuzenle(hucre) {
    if (hucre.querySelector("input")) return;

    const rezId = hucre.dataset.rezId;
    const tarih = hucre.dataset.tarih;
    if (!rezId || !tarih) return;
    durum.seciliTarih = tarih;

    const db = window.APARTIM.db;
    const rez = db?.durum.rezervasyonlar[rezId];
    if (!rez) return;

    const { tutar, manuel } = db.rezervasyonOdenenGosterim(rez, tarih);
    const eski = hucre.textContent;
    const td = hucre.closest("td") || hucre;
    hucre.classList.add("duzenleniyor");
    const edit = document.createElement("span");
    edit.className = "rez-ozet-odenen-edit";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.inputMode = "decimal";
    inp.autocomplete = "off";
    inp.className = "rez-ozet-odenen-input";
    inp.placeholder = "0";
    inp.value = manuel ? String(tutar) : "";
    edit.appendChild(inp);
    hucre.textContent = "";
    hucre.appendChild(edit);
    inp.focus();
    inp.select();

    const renk = td.style.background;
    let iptal = false;
    let bitti = false;
    let enterSonraki = false;
    const temizle = () => {
      hucre.classList.remove("duzenleniyor");
      const editEl = hucre.querySelector(".rez-ozet-odenen-edit");
      if (editEl) editEl.remove();
    };
    const hucreyiGuncelle = (yeniDeger, manuelMi) => {
      temizle();
      hucre.textContent = odenenHucreGoster(rez, manuelMi ? yeniDeger : 0, manuelMi);
      hucre.classList.toggle("manuel", manuelMi);
      hucre.classList.toggle("bos", !manuelMi);
      if (renk) td.style.background = renk;
    };
    const bitir = async () => {
      if (iptal || bitti) return;
      bitti = true;
      const ham = inp.value.trim();
      const yeni = ham === "" ? null : parseTutarGiris(ham);
      if (ham !== "" && (!Number.isFinite(yeni) || yeni < 0)) {
        bitti = false;
        window.APARTIM.toast("Geçerli bir tutar girin", "uyari");
        hucreyiGuncelle(manuel ? tutar : 0, manuel);
        return;
      }
      const manuelMi = yeni != null;
      if (enterSonraki) {
        const sonraki = sonrakiOdenenHucre(hucre);
        if (sonraki) {
          durum.pendingOdenenFocus = { rezId, tarih: sonraki.dataset.tarih };
        }
        enterSonraki = false;
      }
      hucreyiGuncelle(manuelMi ? yeni : 0, manuelMi);
      try {
        await db.rezervasyonOdenenHucreKaydet(rezId, tarih, yeni);
      } catch (err) {
        durum.pendingOdenenFocus = null;
        window.APARTIM.toast(err.message || "Kaydedilemedi", "hata");
        hucreyiGuncelle(manuel ? tutar : 0, manuel);
      }
    };

    inp.addEventListener("blur", bitir);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        enterSonraki = true;
        inp.blur();
      }
      if (e.key === "Escape") {
        iptal = true;
        bitti = true;
        temizle();
        hucre.textContent = eski;
        hucre.classList.toggle("manuel", manuel);
        hucre.classList.toggle("bos", !manuel);
        if (renk) td.style.background = renk;
      }
    });
  }

  function theadOlustur(daireler) {
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

  function satirOlustur(tarih, y, m, g, daireler, harita, bugun) {
    const haftaSonu = new Date(y, m, g - 1).getDay();
    const tr = document.createElement("tr");
    tr.className = "rez-ozet-tr" +
      (tarih === bugun ? " rez-ozet-bugun" : "") +
      (haftaSonu === 0 || haftaSonu === 6 ? " rez-ozet-haftasonu" : "");
    tr.dataset.tarih = tarih;
    if (durum.seciliTarih === tarih) tr.classList.add("rez-ozet-satir-secili");

    const tdTarih = document.createElement("td");
    tdTarih.className = "rez-ozet-tarih rez-ozet-hucre-tik";
    tdTarih.dataset.tarih = tarih;
    tdTarih.title = "Boş daireye yeni rezervasyon";
    tdTarih.innerHTML =
      '<span class="rez-ozet-tarih-gun">' + tarihGoster(tarih) + '</span>' +
      '<span class="rez-ozet-gun-ad">' + gunAdi(tarih) + '</span>';
    tr.appendChild(tdTarih);

    daireler.forEach((d, di) => {
      const h = gunDurumuHarita(harita, d.id, tarih);
      const renk = daireRenk(d, di);
      if (h.tip === "turnover") {
        const td = document.createElement("td");
        td.colSpan = 5;
        td.style.background = renk;
        td.className = "rez-ozet-hucre-dolu rez-ozet-turnover-hucre";
        td.innerHTML = turnoverHtml(h.cikis, h.giris, tarih);
        tr.appendChild(td);
      } else if (h.tip === "checkin") {
        const rid = rezIdAl(h.rez);
        checkinHucreler(h.rez, tarih).forEach((c, ci) => {
          tr.appendChild(hucreTdOlustur(
            c, h.rez, tarih, renk, rid, ci === 4 ? (h.rez.misafirAdi || "") : ""
          ));
        });
      } else if (h.tip === "checkout") {
        const rid = rezIdAl(h.rez);
        const td = document.createElement("td");
        td.colSpan = 5;
        td.style.background = renk;
        td.className = "rez-ozet-hucre-dolu rez-ozet-turnover-hucre";
        if (rid) td.dataset.rezId = rid;
        td.innerHTML = checkoutHtml(h.rez);
        tr.appendChild(td);
      } else if (h.tip === "konak") {
        const det = konakDetay(h.rez, tarih);
        const rid = rezIdAl(h.rez);
        [
          { cls: "rez-ozet-sayi", txt: String(det.g) },
          { cls: "rez-ozet-kategori", html: det.kategoriHtml },
          { cls: "rez-ozet-sayi", txt: formatHucreFiyat(h.rez, det.prc) },
          { type: "odn" },
          { cls: "rez-ozet-ad", txt: kisaAd(det.misafir, 11) }
        ].forEach((c, ci) => {
          tr.appendChild(hucreTdOlustur(
            c, h.rez, tarih, renk, rid, ci === 4 ? (det.misafir || "") : ""
          ));
        });
      } else {
        for (let i = 0; i < 5; i++) {
          const td = document.createElement("td");
          td.className = "rez-ozet-bos rez-ozet-hucre-tik";
          td.style.background = renk;
          td.dataset.daireId = d.id;
          td.dataset.tarih = tarih;
          td.title = "Yeni rezervasyon";
          tr.appendChild(td);
        }
      }
    });
    return tr;
  }

  function tabloTamamla(wrap, table, daireler) {
    sonDaireler = daireler;
    stickyBaslikOlcul(table);
    scrollGeriYukleSonra(wrap, table);
  }

  function etkilesimBagla(kapsayici) {
    if (!kapsayici || kapsayici.dataset.rezOzetBagli) return;
    kapsayici.dataset.rezOzetBagli = "1";
    scrollKapsayici = kapsayici;

    kapsayici.addEventListener("click", (ev) => {
      const odenen = ev.target.closest(".rez-ozet-odenen");
      if (odenen && !odenen.classList.contains("duzenleniyor")) {
        ev.stopPropagation();
        odenenHucreDuzenle(odenen);
        return;
      }
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
      const tarihHucre = ev.target.closest(".rez-ozet-tarih");
      if (tarihHucre) {
        ev.stopPropagation();
        const tarih = tarihHucre.closest("tr")?.dataset.tarih;
        if (!tarih) return;
        const daireId = ilkBosDaire(tarih, sonDaireler);
        if (daireId) rezAcYeni(daireId, tarih);
        else window.APARTIM.toast("Bu gün tüm daireler dolu", "uyari");
      }
    });

    kapsayici.addEventListener("mouseover", (e) => {
      const tr = e.target.closest("tbody tr.rez-ozet-tr");
      if (!tr) return;
      const tbody = tr.parentElement;
      tbody.querySelectorAll(".rez-ozet-satir-hover").forEach((r) =>
        r.classList.remove("rez-ozet-satir-hover"));
      tr.classList.add("rez-ozet-satir-hover");
    });

    kapsayici.addEventListener("mouseleave", () => {
      kapsayici.querySelectorAll(".rez-ozet-satir-hover").forEach((r) =>
        r.classList.remove("rez-ozet-satir-hover"));
    });

    kapsayici.addEventListener("pointerdown", (e) => {
      const tr = e.target.closest("tbody tr.rez-ozet-tr");
      if (!tr || e.pointerType === "mouse") return;
      satirSec(tr);
    });

    kapsayici.addEventListener("click", (e) => {
      const tr = e.target.closest("tbody tr.rez-ozet-tr");
      if (!tr) return;
      if (e.target.closest(".rez-ozet-odenen")) return;
      if (e.target.closest(".rez-ozet-bos") || e.target.closest(".rez-ozet-tik")) return;
      if (e.target.closest(".rez-ozet-tarih") || tr.dataset.tarih) satirSec(tr);
    });
  }

  function satirSec(tr) {
    if (!tr?.dataset.tarih) return;
    durum.seciliTarih = tr.dataset.tarih;
    const tbody = tr.parentElement;
    tbody?.querySelectorAll(".rez-ozet-satir-secili").forEach((r) =>
      r.classList.remove("rez-ozet-satir-secili"));
    tr.classList.add("rez-ozet-satir-secili");
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
      const row = table.querySelector(".rez-ozet-bugun");
      if (row) scrollElemana(sc, row, true);
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

  function stickyBaslikOlcul(table) {
    requestAnimationFrame(() => {
      const tr1 = table.querySelector(".rez-ozet-tr-daire");
      if (!tr1) return;
      table.style.setProperty("--rez-ozet-head1-h", tr1.getBoundingClientRect().height + "px");
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
      frag.appendChild(satirOlustur(tarih, y, ay, gun, daireler, harita, bugun));
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
    if (!durum.buguneKaydir) {
      window.APARTIM.toast?.("Bugün sezon dışında (Haziran–Eylül)", "bilgi");
    }
    tabloCiz();
  }

  function rezOutKalanMetin(rez) {
    const db = window.APARTIM.db;
    if (!db) return "";
    const odenen = db.rezervasyonOdenenToplam(rez);
    if (odenen <= 0) return "";
    return "Kln " + formatKalanKisa(rez, db.rezervasyonKalanHesapla(rez));
  }

  const XL_DAIRE_COL = 6;

  function excelNotGoster(rez, tarih, tip) {
    const not = String(rez?.notlar || "").trim();
    if (!not || !rez) return "";
    if (rez.giris === tarih || tip === "checkin") return not;
    if (tip === "checkout" && rez.cikis === tarih) return not;
    return "";
  }

  function excelNotEki(rez, tarih, tip) {
    const n = excelNotGoster(rez, tarih, tip);
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
        excelNotEki(h.cikis, tarih, "checkout") +
        (outK ? " " + outK : "") + "  ·  IN " + det.kategori + " " + (det.misafir || "") +
        excelNotEki(h.giris, tarih, "checkin");
      return { birlesik: txt };
    }
    if (h.tip === "checkout") {
      const k = rezOutKalanMetin(h.rez);
      return {
        birlesik: "OUT " + kaynakSimge(h.rez) + " " + (h.rez.misafirAdi || "") +
          excelNotEki(h.rez, tarih, "checkout") + (k ? " " + k : "")
      };
    }
    if (h.tip === "checkin") {
      const det = konakDetay(h.rez, tarih);
      return {
        hucreler: [
          "IN " + det.g,
          det.kategori,
          formatHucreFiyat(h.rez, det.prc),
          odenenHucreGoster(h.rez, det.odenen, det.odenenManuel),
          det.misafir || "",
          excelNotGoster(h.rez, tarih, "checkin")
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
          odenenHucreGoster(h.rez, det.odenen, det.odenenManuel),
          det.misafir || "",
          ""
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

      let satir = xlHucre(tarihGoster(tarih) + " " + gunAdi(tarih), XL.tdTarih(hs));
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
  });

  document.addEventListener("apartim:veri-degisti", tabloCizPlanla);

  document.addEventListener("apartim:gun-degisti", tabloCizPlanla);

  window.APARTIM.rezOzet = {
    tabloCiz, tabloCizPlanla, sezonGit, buguneGit, konumKoru, excelRaporIndir,
    yatayModGuncelle, tamEkranYatay, yonKilidiAc
  };
})();
