"use strict";

const GUN_UZUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];
const SEZON_BAS_AY = 5;
const SEZON_BIT_AY = 8;
const XL_DAIRE_COL = 6;

const SABIT_DAIRELER = [
  { id: "oda-1", ad: "1. Oda", kat: 0, konum: "tek", sira: 1 },
  { id: "oda-2", ad: "2. Oda", kat: 0, konum: "tek", sira: 2 },
  { id: "oda-3", ad: "3. Oda", kat: 0, konum: "tek", sira: 3 },
  { id: "oda-4", ad: "4. Oda", kat: 0, konum: "tek", sira: 4 },
  { id: "oda-5", ad: "5. Oda", kat: 0, konum: "tek", sira: 5 }
];

const DAIRE_RENK = {
  "oda-1": "#ffcdd2",
  "oda-2": "#c8e6c9",
  "oda-3": "#bbdefb",
  "oda-4": "#fff9c4",
  "oda-5": "#e1bee7"
};
const DAIRE_RENK_YEDEK = ["#ffcdd2", "#c8e6c9", "#bbdefb", "#fff9c4", "#e1bee7"];

const ODEME_YONTEMLERI = {
  elden: "Elden",
  havale: "Hesaba havale",
  booking: "Booking",
  diger: "Diğer"
};

const VARSAYILAN_KAYNAKLAR = {
  booking: { simge: "🌐" },
  "eski-musteri": { simge: "⭐" },
  kapi: { simge: "🚪" },
  misafir: { simge: "👋" },
  albatros: { simge: "🦅" }
};

function pad(n) { return String(n).padStart(2, "0"); }
function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
function fmt(n) { return Number(n || 0).toLocaleString("tr-TR"); }

function esc(s) {
  return String(s || "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
}

function bugunISO(d = new Date()) {
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}

function gunEkleISO(isoStr, ekle) {
  const d = new Date(isoStr + "T00:00:00");
  d.setDate(d.getDate() + ekle);
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}

function geceSayisi(giris, cikis) {
  if (!giris || !cikis) return 0;
  const fark = Math.round((new Date(cikis + "T00:00:00") - new Date(giris + "T00:00:00")) / 86400000);
  return Math.max(0, fark);
}

function geceTarihleri(giris, cikis) {
  const n = geceSayisi(giris, cikis);
  const liste = [];
  for (let i = 0; i < n; i++) liste.push(gunEkleISO(giris, i));
  return liste;
}

function tarihFiyatlariToObject(fiyatlar) {
  if (!fiyatlar || typeof fiyatlar !== "object" || Array.isArray(fiyatlar)) return null;
  const out = {};
  Object.keys(fiyatlar).forEach((k) => {
    const u = Number(fiyatlar[k]);
    if (u > 0) out[k] = u;
  });
  return Object.keys(out).length ? out : null;
}

function ucretKademeleriToArray(kademeler) {
  if (!kademeler) return null;
  if (Array.isArray(kademeler)) return kademeler.slice();
  if (typeof kademeler === "object") {
    return Object.keys(kademeler).sort((a, b) => Number(a) - Number(b)).map((k) => kademeler[k]).filter(Boolean);
  }
  return null;
}

function ucretKademeleriNormalize(kademeler, varsayilanUcret) {
  const dizi = ucretKademeleriToArray(kademeler);
  if (!dizi || !dizi.length) {
    const u = Number(varsayilanUcret) || 0;
    return u > 0 ? [{ basGece: 1, bitGece: null, ucret: u }] : [];
  }
  return dizi
    .map((k) => ({
      basGece: Math.max(1, Number(k.basGece) || 1),
      bitGece: k.bitGece != null && k.bitGece !== "" ? Number(k.bitGece) : null,
      ucret: Number(k.ucret) || 0
    }))
    .filter((k) => k.ucret > 0)
    .sort((a, b) => a.basGece - b.basGece);
}

function geceUcretiBul(kademeler, geceNo, varsayilanUcret) {
  const liste = ucretKademeleriNormalize(kademeler, varsayilanUcret);
  if (!liste.length) return Number(varsayilanUcret) || 0;
  for (let i = liste.length - 1; i >= 0; i--) {
    const k = liste[i];
    if (geceNo >= k.basGece && (k.bitGece == null || geceNo <= k.bitGece)) return k.ucret;
  }
  return liste[0].ucret;
}

function createDbAdapter(raw) {
  const daireler = raw.daireler || {};
  const rezervasyonlar = normalizeRez(raw.rezervasyonlar || {});
  const musteriKaynaklari = raw.musteriKaynaklari || {};
  const kurlar = {
    USD: Number(raw.dovizKurlari?.USD) > 0 ? Number(raw.dovizKurlari.USD) : 46.5,
    EUR: Number(raw.dovizKurlari?.EUR) > 0 ? Number(raw.dovizKurlari.EUR) : 50.5
  };

  function rezervasyonGeceUcreti(rez, geceNo) {
    const fallback = Number(rez.gunlukUcret) || 0;
    const tarih = gunEkleISO(rez.giris, geceNo - 1);
    const tf = tarihFiyatlariToObject(rez.tarihFiyatlari);
    if (tf && tf[tarih] != null) return Number(tf[tarih]) || fallback;
    const kademeler = ucretKademeleriToArray(rez.ucretKademeleri);
    if (kademeler && kademeler.length) return geceUcretiBul(kademeler, geceNo, fallback);
    return fallback;
  }

  function rezervasyonToplamTutar(rez) {
    if (rez.toplamTutar != null) return Number(rez.toplamTutar) || 0;
    const gece = geceSayisi(rez.giris, rez.cikis);
    let toplam = 0;
    for (let i = 1; i <= gece; i++) toplam += rezervasyonGeceUcreti(rez, i);
    return toplam;
  }

  function odenenGunKaydiNorm(deger) {
    if (deger == null || deger === "") return null;
    if (typeof deger === "number" || typeof deger === "string") {
      const tutar = Number(deger);
      if (!Number.isFinite(tutar) || tutar < 0) return null;
      return { tutar, yontem: "elden" };
    }
    if (typeof deger === "object") {
      const tutar = Number(deger.tutar);
      if (!Number.isFinite(tutar) || tutar < 0) return null;
      const y = String(deger.yontem || "elden").toLowerCase();
      return { tutar, yontem: ODEME_YONTEMLERI[y] ? y : "elden" };
    }
    return null;
  }

  function rezervasyonOdenenToplam(rez) {
    const og = rez.odenenGunleri;
    if (!og) return 0;
    return Object.values(og).reduce((s, v) => {
      const kayit = odenenGunKaydiNorm(v);
      return s + (kayit ? kayit.tutar : 0);
    }, 0);
  }

  function rezervasyonKalanHesapla(rez) {
    return rezervasyonToplamTutar(rez) - rezervasyonOdenenToplam(rez);
  }

  function rezervasyonOdenenGosterim(rez, tarih) {
    const og = rez.odenenGunleri;
    if (og && Object.prototype.hasOwnProperty.call(og, tarih)) {
      const kayit = odenenGunKaydiNorm(og[tarih]);
      if (kayit) return { tutar: kayit.tutar, manuel: true, yontem: kayit.yontem };
    }
    return { tutar: 0, manuel: false, yontem: "elden" };
  }

  function rezParaBirimi(rez) {
    const pb = String(rez?.paraBirimi || "TL").toUpperCase();
    return pb === "USD" || pb === "EUR" ? pb : "TL";
  }

  function simge(pb) {
    return pb === "USD" ? "$" : pb === "EUR" ? "€" : "₺";
  }

  function formatTutarKisa(miktar, pb) {
    const n = Number(miktar || 0);
    const s = simge(pb);
    if (n >= 1000) return Math.round(n).toLocaleString("tr-TR") + s;
    return n.toLocaleString("tr-TR") + s;
  }

  function formatTutar(miktar, pb) {
    return Number(miktar || 0).toLocaleString("tr-TR") + " " + simge(pb);
  }

  function tlKarsiligi(miktar, pb) {
    const n = Number(miktar) || 0;
    if (pb === "USD") return n * kurlar.USD;
    if (pb === "EUR") return n * kurlar.EUR;
    return n;
  }

  function rezAyKesisimGelir(rez, ayBas, ayBit) {
    const tarihler = geceTarihleri(rez.giris, rez.cikis);
    let gece = 0;
    let gelir = 0;
    tarihler.forEach((t, idx) => {
      if (t >= ayBas && t < ayBit) {
        gece++;
        gelir += rezervasyonGeceUcreti(rez, idx + 1);
      }
    });
    return { gece, gelir };
  }

  function aralikToplamlari(basISO, bitISO) {
    const toplam = { TL: 0, USD: 0, EUR: 0 };
    Object.values(rezervasyonlar).forEach((rez) => {
      if (!rez) return;
      const k = rezAyKesisimGelir(rez, basISO, bitISO);
      if (k.gece <= 0) return;
      toplam[rezParaBirimi(rez)] += k.gelir;
    });
    const tlToplam = toplam.TL + tlKarsiligi(toplam.USD, "USD") + tlKarsiligi(toplam.EUR, "EUR");
    return { toplam, tlToplam };
  }

  function dairelerListele() {
    return SABIT_DAIRELER
      .map((t) => daireler[t.id])
      .filter(Boolean)
      .sort((a, b) => (a.sira || 0) - (b.sira || 0));
  }

  function dairelerOzetSirasi() {
    const konumSira = { sol: 0, sag: 1, tek: 2 };
    return dairelerListele().slice().sort((a, b) => {
      const ka = a.kat || 0;
      const kb = b.kat || 0;
      if (ka !== kb) return ka - kb;
      const diff = (konumSira[a.konum] ?? 9) - (konumSira[b.konum] ?? 9);
      if (diff) return diff;
      return (a.sira || 0) - (b.sira || 0);
    });
  }

  function rezervasyonlarListele(daireId) {
    const liste = Object.values(rezervasyonlar);
    return (daireId ? liste.filter((r) => r.daireId === daireId) : liste)
      .sort((a, b) => (a.giris || "").localeCompare(b.giris || ""));
  }

  function musteriKaynagiSimge(id) {
    const k = musteriKaynaklari[id] || VARSAYILAN_KAYNAKLAR[id];
    return k?.simge || "🏷️";
  }

  return {
    gunEkleISO,
    rezervasyonGeceUcreti,
    rezervasyonToplamTutar,
    rezervasyonKalanHesapla,
    rezervasyonOdenenGosterim,
    geceSayisi,
    dairelerOzetSirasi,
    rezervasyonlarListele,
    musteriKaynagiSimge,
    aralikToplamlari,
    formatTutar,
    formatTutarKisa,
    rezParaBirimi
  };
}

function normalizeRez(obj) {
  const out = {};
  Object.keys(obj).forEach((key) => {
    const r = obj[key];
    if (r && typeof r === "object") {
      out[key] = Object.assign({}, r, { id: r.id || key, paraBirimi: r.paraBirimi || "TL" });
    }
  });
  return out;
}

function sezonBasBit(y) {
  const bitGun = new Date(y, SEZON_BIT_AY + 1, 0).getDate();
  return {
    bas: iso(y, SEZON_BAS_AY, 1),
    bit: iso(y, SEZON_BIT_AY, bitGun),
    bitHaric: iso(y, SEZON_BIT_AY + 1, 1)
  };
}

function sezonGunleri(y) {
  const liste = [];
  for (let m = SEZON_BAS_AY; m <= SEZON_BIT_AY; m++) {
    const gunSay = new Date(y, m + 1, 0).getDate();
    for (let g = 1; g <= gunSay; g++) liste.push({ tarih: iso(y, m, g), ay: m });
  }
  return liste;
}

function sezonIcindeMi(tarihISO) {
  const m = Number(tarihISO.slice(5, 7)) - 1;
  return m >= SEZON_BAS_AY && m <= SEZON_BIT_AY;
}

function daireRenk(d, i) {
  return DAIRE_RENK[d.id] || DAIRE_RENK_YEDEK[i % DAIRE_RENK_YEDEK.length];
}

function tarihGoster(isoStr) {
  const p = isoStr.split("-");
  return p[2] + "." + p[1] + "." + p[0];
}

function gunAdi(isoStr) {
  return GUN_UZUN[new Date(isoStr + "T12:00:00").getDay()];
}

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
    if (!sonuc && cikisList.length) sonuc = { tip: "checkout", rez: cikisList[0] };
    else if (!sonuc && girisList.length) sonuc = { tip: "checkin", rez: girisList[0] };
    else if (!sonuc) {
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
  daireler.forEach((d) => { all[d.id] = daireGunHaritasi(db, d.id, basISO, bitISO); });
  return all;
}

function gunDurumuHarita(harita, daireId, tarih) {
  return harita[daireId]?.[tarih] || { tip: "bos", rez: null };
}

function buildRaporHtml(db, y) {
  const XL = {
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
    return "<td" + cs + ' style="' + stil + '">' + esc(metin) + "</td>";
  }

  function rezNotMetni(rez) {
    if (!rez) return "";
    return String(rez.notlar || rez.not || "").trim();
  }

  function excelNotEki(rez) {
    const n = rezNotMetni(rez);
    return n ? " · Not: " + n : "";
  }

  function rezOutKalanMetin(rez) {
    const toplam = db.rezervasyonToplamTutar(rez);
    if (toplam <= 0) return "";
    const kalan = db.rezervasyonKalanHesapla(rez);
    const pb = db.rezParaBirimi(rez);
    if (kalan < 0) return "Fazla " + db.formatTutarKisa(-kalan, pb);
    if (kalan > 0) return "Kalan " + db.formatTutarKisa(kalan, pb);
    return "Kalan " + db.formatTutarKisa(0, pb);
  }

  function excelOdemeGoster(rez, info) {
    if (!info || !info.manuel || !info.tutar) return "—";
    const yontem = ODEME_YONTEMLERI[info.yontem] || info.yontem || "";
    const pb = db.rezParaBirimi(rez);
    return db.formatTutarKisa(info.tutar, pb) + (yontem ? " (" + yontem + ")" : "");
  }

  function konakDetay(rez, tarih) {
    const g = db.geceSayisi(rez.giris, tarih) + 1;
    const prc = db.rezervasyonGeceUcreti(rez, g);
    const odenenInfo = db.rezervasyonOdenenGosterim(rez, tarih);
    return {
      g,
      kategori: db.musteriKaynagiSimge(rez.kaynakId),
      prc,
      odenenInfo,
      misafir: rez.misafirAdi
    };
  }

  function excelDaireHucreleri(h, tarih) {
    if (h.tip === "turnover") {
      const det = konakDetay(h.giris, tarih);
      const outK = rezOutKalanMetin(h.cikis);
      const txt = "OUT " + db.musteriKaynagiSimge(h.cikis.kaynakId) + " " + (h.cikis.misafirAdi || "") +
        excelNotEki(h.cikis) + (outK ? " " + outK : "") + "  ·  IN " + det.kategori + " " + (det.misafir || "") +
        excelNotEki(h.giris);
      return { birlesik: txt };
    }
    if (h.tip === "checkout") {
      const k = rezOutKalanMetin(h.rez);
      return {
        birlesik: "OUT " + db.musteriKaynagiSimge(h.rez.kaynakId) + " " + (h.rez.misafirAdi || "") +
          excelNotEki(h.rez) + (k ? " " + k : "")
      };
    }
    if (h.tip === "checkin") {
      const det = konakDetay(h.rez, tarih);
      return {
        hucreler: [
          "IN " + det.g, det.kategori, db.formatTutarKisa(det.prc, db.rezParaBirimi(h.rez)),
          excelOdemeGoster(h.rez, det.odenenInfo), det.misafir || "", rezNotMetni(h.rez)
        ]
      };
    }
    if (h.tip === "konak") {
      const det = konakDetay(h.rez, tarih);
      return {
        hucreler: [
          String(det.g), det.kategori, db.formatTutarKisa(det.prc, db.rezParaBirimi(h.rez)),
          excelOdemeGoster(h.rez, det.odenenInfo), det.misafir || "", rezNotMetni(h.rez)
        ]
      };
    }
    return { hucreler: ["", "", "", "", "", ""] };
  }

  const { bas, bit, bitHaric } = sezonBasBit(y);
  const { toplam, tlToplam } = db.aralikToplamlari(bas, bitHaric);
  const parcalar = [];
  if (toplam.TL > 0) parcalar.push(db.formatTutar(toplam.TL, "TL"));
  if (toplam.USD > 0) parcalar.push(db.formatTutar(toplam.USD, "USD"));
  if (toplam.EUR > 0) parcalar.push(db.formatTutar(toplam.EUR, "EUR"));
  const ozetMetni = (parcalar.length ? parcalar.join("  |  ") : "0 ₺") +
    "  —  Sezon toplam ≈ " + fmt(Math.round(tlToplam)) + " ₺";

  const daireler = db.dairelerOzetSirasi();
  const gunler = sezonGunleri(y);
  const harita = gunHaritasiOlustur(db, daireler, bas, bit);
  const colSpan = 1 + daireler.length * XL_DAIRE_COL;
  const satirlar = [];

  satirlar.push(
    '<tr><td colspan="' + colSpan + '" style="padding:8px 10px;background:#15202b;color:#ffffff;font-size:14px;font-weight:800;border:1px solid #6b7280;">' +
      esc("APARTIM — Rezervasyon Özeti · Haziran – Eylül " + y) + "</td></tr>"
  );
  satirlar.push(
    '<tr><td colspan="' + colSpan + '" style="padding:6px 10px;background:#1e2d3d;color:#ffffff;font-size:11px;border:1px solid #6b7280;">' +
      esc(ozetMetni) + "</td></tr>"
  );

  let h1 = '<td rowspan="2" style="' + XL.thKose + '">Tarih</td>';
  daireler.forEach((d, i) => {
    h1 += xlHucre(d.ad || d.id, XL.thDaire(daireRenk(d, i)), XL_DAIRE_COL);
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

function buildRaporXls(userData, y) {
  const db = createDbAdapter(userData);
  const tabloGovde = buildRaporHtml(db, y);
  return (
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="UTF-8"/>' +
    "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
    "<x:Name>Rezervasyon</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>" +
    "</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
    '<style>table{border-collapse:collapse;width:100%;}td,th{mso-number-format:"\\@";font-size:11px;padding:2px 4px;border:1px solid #ccc;}</style></head><body>' +
    '<table border="0" cellspacing="0" cellpadding="0">' + tabloGovde + "</table></body></html>"
  );
}

function tarihBaslikMetni(d = new Date()) {
  const gun = d.getDate();
  const ay = AY_ADLARI[d.getMonth()];
  const yil = d.getFullYear();
  return gun + " " + ay + " " + yil + " " + GUN_UZUN[d.getDay()];
}

module.exports = {
  buildRaporXls,
  sezonIcindeMi,
  bugunISO,
  tarihBaslikMetni,
  AY_ADLARI,
  GUN_UZUN
};
