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
    seciliTarih: null,
    pendingOdenenFocus: null
  };

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

  function paraOzetCiz(y, m) {
    const bar = document.getElementById("rez-ozet-para-bar");
    if (!bar || !window.APARTIM.para) return;
    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) {
      bar.innerHTML = "";
      return;
    }
    const { toplam, tlToplam } = window.APARTIM.para.ayToplamlari(db, y, m);
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
        '<span class="rez-ozet-para-toplam">Toplam ≈ ' + fmt(Math.round(tlToplam)) + " ₺</span>" +
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

  /** Gün durumu — db.daireGunDurumu kullanır */
  function gunDurumu(daireId, tarih) {
    return window.APARTIM.db.daireGunDurumu(daireId, tarih);
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

  function turnoverYarim(tip, inner) {
    return (
      '<div class="rez-ozet-turnover-yarim ' + tip + '">' +
      (inner || '<span class="rez-ozet-turnover-bos">—</span>') +
      "</div>"
    );
  }

  function turnoverAdSpan(rez, ad, maxLen) {
    const rid = rezIdAl(rez);
    return (
      '<span class="rez-ozet-turnover-ad rez-ozet-tik" data-rez-id="' + esc(rid) +
      '" title="' + esc(ad || "") + '">' + esc(kisaAd(ad, maxLen || 13)) + "</span>"
    );
  }

  function turnoverHucreler(cikis, giris, tarih) {
    const gDet = konakDetay(giris, tarih);
    const cikisRid = rezIdAl(cikis);
    const girisRid = rezIdAl(giris);
    const cikisKalan = rezOutKalanHtml(cikis);
    const klnOut = cikisKalan
      ? '<span class="rez-ozet-tik" data-rez-id="' + esc(cikisRid) + '">' + cikisKalan + "</span>"
      : "";

    return [
      {
        cls: "rez-ozet-turnover-cift rez-ozet-sayi",
        html: turnoverYarim("out", ioBadge("out", cikisRid)) +
          turnoverYarim("in", ioBadge("in", girisRid) + '<span class="rez-ozet-g-no">' + gDet.g + "</span>")
      },
      {
        cls: "rez-ozet-turnover-cift rez-ozet-kategori",
        html: turnoverYarim("out", "") + turnoverYarim("in", gDet.kategoriHtml)
      },
      {
        cls: "rez-ozet-turnover-cift rez-ozet-sayi",
        html: turnoverYarim("out", "") +
          turnoverYarim("in", "<span>" + esc(formatHucreFiyat(giris, gDet.prc)) + "</span>")
      },
      { type: "turnover-odn", cikis, giris, tarih, cikisRid, girisRid, klnOut },
      {
        cls: "rez-ozet-turnover-cift rez-ozet-ad",
        html: turnoverYarim("out", turnoverAdSpan(cikis, cikis.misafirAdi, 13)) +
          turnoverYarim("in", turnoverAdSpan(giris, gDet.misafir, 13))
      }
    ];
  }

  function turnoverOdnTd(cikis, giris, tarih, renk, cikisRid, girisRid, klnOut) {
    const db = window.APARTIM.db;
    const { tutar, manuel } = db.rezervasyonOdenenGosterim(giris, tarih);

    const td = document.createElement("td");
    td.className = "rez-ozet-turnover-cift rez-ozet-turnover-odn rez-ozet-hucre-dolu";
    td.style.background = renk;

    const outDiv = document.createElement("div");
    outDiv.className = "rez-ozet-turnover-yarim out rez-ozet-sayi";
    outDiv.innerHTML = klnOut || '<span class="rez-ozet-turnover-bos">—</span>';

    const inDiv = document.createElement("div");
    inDiv.className = "rez-ozet-turnover-yarim in rez-ozet-sayi rez-ozet-odenen" +
      (manuel ? " manuel" : " bos");
    inDiv.dataset.rezId = girisRid;
    inDiv.dataset.tarih = tarih;
    inDiv.textContent = odenenHucreGoster(giris, tutar, manuel);
    inDiv.title = "Ödenen tutarı girmek için tıklayın";

    td.appendChild(outDiv);
    td.appendChild(inDiv);
    return td;
  }

  function turnoverHucreTdOlustur(c, cikis, giris, tarih, renk) {
    if (c.type === "turnover-odn") {
      return turnoverOdnTd(c.cikis, c.giris, tarih, renk, c.cikisRid, c.girisRid, c.klnOut);
    }
    const td = document.createElement("td");
    td.className = c.cls + " rez-ozet-hucre-dolu";
    td.style.background = renk;
    td.innerHTML = c.html;
    return td;
  }

  function checkoutHucreler(rez) {
    const rid = rezIdAl(rez);
    const kalan = rezOutKalanHtml(rez);
    const klnInner = kalan
      ? '<span class="rez-ozet-tik" data-rez-id="' + esc(rid) + '">' + kalan + "</span>"
      : "";
    return [
      { cls: "rez-ozet-sayi", html: ioBadge("out", rid) },
      { cls: "rez-ozet-kategori", txt: "" },
      { cls: "rez-ozet-sayi", txt: "" },
      { cls: "rez-ozet-sayi rez-ozet-checkout-kln", html: klnInner || "—" },
      {
        cls: "rez-ozet-ad",
        html: '<span class="rez-ozet-tik" data-rez-id="' + esc(rid) + '" title="' +
          esc(rez.misafirAdi || "") + '">' + esc(kisaAd(rez.misafirAdi, 14)) + "</span>"
      }
    ];
  }

  function checkoutHucreTdOlustur(c, renk) {
    const td = document.createElement("td");
    td.className = c.cls + " rez-ozet-hucre-dolu";
    td.style.background = renk;
    if (c.html) td.innerHTML = c.html;
    else td.textContent = c.txt || "";
    return td;
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
  }

  function ilkBosDaire(tarih, daireler) {
    for (let i = 0; i < daireler.length; i++) {
      if (gunDurumu(daireler[i].id, tarih).tip === "bos") return daireler[i].id;
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

  function odenenHucreBagla(wrap) {
    wrap.querySelectorAll(".rez-ozet-odenen").forEach((td) => {
      td.addEventListener("click", (ev) => {
        ev.stopPropagation();
        odenenHucreDuzenle(td);
      });
    });
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

  function bosHucreTikBagla(wrap, daireler) {
    wrap.querySelectorAll(".rez-ozet-bos").forEach((td) => {
      td.classList.add("rez-ozet-hucre-tik");
      td.title = "Yeni rezervasyon";
      td.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const daireId = td.dataset.daireId;
        const tarih = td.dataset.tarih;
        if (daireId && tarih) rezAcYeni(daireId, tarih);
      });
    });

    wrap.querySelectorAll(".rez-ozet-tarih").forEach((td) => {
      td.classList.add("rez-ozet-hucre-tik");
      td.title = "Boş daireye yeni rezervasyon";
      td.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const tarih = td.closest("tr")?.dataset.tarih;
        if (!tarih) return;
        const daireId = ilkBosDaire(tarih, daireler);
        if (daireId) rezAcYeni(daireId, tarih);
        else window.APARTIM.toast("Bu gün tüm daireler dolu", "uyari");
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
      tdTarih.dataset.tarih = tarih;
      tdTarih.innerHTML =
        '<span class="rez-ozet-tarih-gun">' + tarihGoster(tarih) + '</span>' +
        '<span class="rez-ozet-gun-ad">' + gunAdi(tarih) + '</span>';
      tr.appendChild(tdTarih);

      daireler.forEach((d, di) => {
        const h = gunDurumu(d.id, tarih);
        const renk = daireRenk(d, di);

        if (h.tip === "turnover") {
          turnoverHucreler(h.cikis, h.giris, tarih).forEach((c) => {
            tr.appendChild(turnoverHucreTdOlustur(c, h.cikis, h.giris, tarih, renk));
          });
        } else if (h.tip === "checkin") {
          const rid = rezIdAl(h.rez);
          checkinHucreler(h.rez, tarih).forEach((c, ci) => {
            tr.appendChild(hucreTdOlustur(
              c, h.rez, tarih, renk, rid, ci === 4 ? (h.rez.misafirAdi || "") : ""
            ));
          });
        } else if (h.tip === "checkout") {
          checkoutHucreler(h.rez).forEach((c) => {
            tr.appendChild(checkoutHucreTdOlustur(c, renk));
          });
        } else if (h.tip === "konak") {
          const det = konakDetay(h.rez, tarih);
          const rid = rezIdAl(h.rez);
          const hucreler = [
            { cls: "rez-ozet-sayi", txt: String(det.g) },
            { cls: "rez-ozet-kategori", html: det.kategoriHtml },
            { cls: "rez-ozet-sayi", txt: formatHucreFiyat(h.rez, det.prc) },
            { type: "odn" },
            { cls: "rez-ozet-ad", txt: kisaAd(det.misafir, 11) }
          ];
          hucreler.forEach((c, ci) => {
            tr.appendChild(hucreTdOlustur(
              c, h.rez, tarih, renk, rid, ci === 4 ? (det.misafir || "") : ""
            ));
          });
        } else {
          for (let i = 0; i < 5; i++) {
            const td = document.createElement("td");
            td.className = "rez-ozet-bos";
            td.style.background = renk;
            td.dataset.daireId = d.id;
            td.dataset.tarih = tarih;
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
    odenenHucreBagla(wrap);
    bosHucreTikBagla(wrap, daireler);
    paraOzetCiz(y, m);

    if (durum.pendingOdenenFocus) {
      const pf = durum.pendingOdenenFocus;
      requestAnimationFrame(() => {
        const hucre = wrap.querySelector(
          '.rez-ozet-odenen[data-rez-id="' + pf.rezId + '"][data-tarih="' + pf.tarih + '"]'
        );
        if (hucre) {
          durum.pendingOdenenFocus = null;
          odenenHucreDuzenle(hucre);
        }
      });
    }
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
      if (e.target.closest(".rez-ozet-odenen")) return;
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
    document.getElementById("rez-ozet-prev")?.addEventListener("click", () => git(-1));
    document.getElementById("rez-ozet-next")?.addEventListener("click", () => git(1));
    document.getElementById("rez-ozet-bugun")?.addEventListener("click", buguneGit);
    document.getElementById("rez-ozet-tam")?.addEventListener("click", tamEkranYatay);
  });

  document.addEventListener("apartim:veri-degisti", tabloCiz);

  document.addEventListener("apartim:gun-degisti", tabloCiz);

  window.APARTIM.rezOzet = { tabloCiz, git, buguneGit, yatayModGuncelle, tamEkranYatay, yonKilidiAc };
})();
