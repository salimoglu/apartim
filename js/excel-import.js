/* =========================================================
   APARTIM — Toplu Excel içe aktarma
   Export (.xls HTML / aynı sütun düzeni) ile uyumlu.
   ========================================================= */

(function () {
  "use strict";

  const XL_DAIRE_COL = 6;
  const SUTUNLAR = ["G", "Kt", "Fyt", "Ödn", "Ad", "Not"];
  let sheetJsPromise = null;
  let onizleme = null;

  function toast(msg, tip) {
    window.APARTIM.toast?.(msg, tip || "bilgi");
  }

  function normAd(s) {
    return String(s || "")
      .trim()
      .toLocaleLowerCase("tr")
      .replace(/\s+/g, " ");
  }

  function hucreMetin(v) {
    if (v == null) return "";
    if (typeof v === "number" && Number.isFinite(v)) {
      /* Excel seri tarih olabilir — gün satırında kullanmayız */
      return String(v);
    }
    return String(v).replace(/\u00a0/g, " ").trim();
  }

  function tarihParse(metin) {
    const s = hucreMetin(metin);
    const m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (!m) return null;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }

  function paraBirimiBul(s) {
    const t = String(s || "");
    if (/\$|USD/i.test(t)) return "USD";
    if (/€|EUR/i.test(t)) return "EUR";
    return "TL";
  }

  /** Sayıyı agresif okur: 1.000,00₺ | 1000 | 1,000.00 | 1000.5 */
  function sayiParse(metin) {
    let s = hucreMetin(metin);
    if (!s || s === "—" || s === "-" || s === "–") return null;
    s = s.replace(/[₺$€]/g, " ").replace(/\b(TL|USD|EUR)\b/gi, " ").trim();
    if (!s) return null;
    /* Excel bazen sayı bırakır */
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    /* TR: 1.000,50 veya 1000,50 */
    if (/\d,\d{1,2}$/.test(s) || (s.indexOf(",") >= 0 && s.indexOf(".") >= 0)) {
      const ham = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
      const n = Number(ham);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    /* US: 1,000.50 */
    if (/\d\.\d{1,2}$/.test(s) && s.indexOf(",") >= 0) {
      const ham = s.replace(/\s/g, "").replace(/,/g, "");
      const n = Number(ham);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    /* Düz rakam kümesi */
    const m = s.match(/-?[\d.\s,]+/);
    if (!m) return null;
    let ham = m[0].replace(/\s/g, "");
    if (ham.indexOf(",") >= 0 && ham.indexOf(".") >= 0) {
      if (ham.lastIndexOf(",") > ham.lastIndexOf(".")) {
        ham = ham.replace(/\./g, "").replace(",", ".");
      } else {
        ham = ham.replace(/,/g, "");
      }
    } else if (ham.indexOf(",") >= 0) {
      ham = ham.replace(",", ".");
    }
    const n = Number(ham);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function tutarParse(metin) {
    const s = hucreMetin(metin);
    if (!s || s === "—" || s === "-") return null;
    const n = sayiParse(s);
    if (n == null || n < 0) return null;
    return { tutar: n, pb: paraBirimiBul(s) };
  }

  function fiyatParse(metin) {
    const t = tutarParse(metin);
    if (!t || !(t.tutar > 0)) return null;
    return t;
  }

  function odemeBakiyeMi(metin) {
    const s = hucreMetin(metin).toLocaleLowerCase("tr");
    if (!s || s === "—" || s === "-") return true;
    return /^(kalan|fazla|tamam|eksik)/.test(s) || /\b(kalan|fazla|eksik)\b/.test(s) || s.indexOf("✓") >= 0;
  }

  /** Ödeme okunamazsa null — import’u engellemez */
  function odemeParse(metin) {
    try {
      const s = hucreMetin(metin);
      if (!s || odemeBakiyeMi(s)) return null;

      const yontemler = window.APARTIM.db?.ODEME_YONTEMLERI || {
        kasa: "Kasa", pos: "Pos", booking: "Booking", havale: "Hesaba havale", diger: "Diğer"
      };
      let yontem = "kasa";
      const ym = s.match(/\(([^)]+)\)\s*$/);
      if (ym) {
        const etiket = ym[1].trim().toLocaleLowerCase("tr");
        const bulunan = Object.keys(yontemler).find((k) =>
          String(yontemler[k]).toLocaleLowerCase("tr") === etiket || k === etiket
        );
        if (bulunan) yontem = bulunan;
      }

      const govde = s.replace(/\([^)]*\)\s*$/, "").trim();
      const parcalar = govde.split(/\s*\+\s*/);
      let tutarTl = 0;
      let tutarUsd = 0;
      parcalar.forEach((p) => {
        const t = tutarParse(p);
        if (!t || !(t.tutar > 0)) return;
        if (t.pb === "USD") tutarUsd += t.tutar;
        else tutarTl += t.tutar;
      });
      if (tutarTl <= 0 && tutarUsd <= 0) return null;
      const kayit = { yontem };
      const kurUsd = Number(window.APARTIM.para?.kurlariGetir?.()?.USD) || 0;
      if (tutarTl > 0 && tutarUsd > 0) {
        kayit.tutarTl = tutarTl;
        kayit.tutarUsd = tutarUsd;
        if (kurUsd > 0) kayit.kurUsd = kurUsd;
      } else if (tutarUsd > 0) {
        kayit.tutar = tutarUsd;
        kayit.tutarUsd = tutarUsd;
        if (kurUsd > 0) kayit.kurUsd = kurUsd;
      } else {
        kayit.tutar = tutarTl;
        kayit.tutarTl = tutarTl;
        kayit.tutarBirim = "TL";
      }
      return kayit;
    } catch (e) {
      return null;
    }
  }

  /* Referans: Booking, Eski müşteri, Kapıdan gelen, Misafir, Albatros (+ kullanıcı kategorileri) */
  const KATEGORI_TAKMA = {
    booking: "booking",
    "eski musteri": "eski-musteri",
    "kapidan gelen": "kapi",
    kapi: "kapi",
    misafir: "misafir",
    albatros: "albatros"
  };

  function kaynakIdBul(ham) {
    const db = window.APARTIM.db;
    const liste = db.musteriKaynaklariListele();
    const varsayilan = liste[0]?.id || "booking";
    const s = hucreMetin(ham);
    if (!s || s === "—" || s === "-") return varsayilan;

    const n = normAd(s);
    /* 1) İsim birebir */
    let k = liste.find((x) => normAd(x.ad) === n);
    if (k) return k.id;
    /* 2) id birebir */
    k = liste.find((x) => normAd(x.id) === n || x.id === s);
    if (k) return k.id;
    /* 3) Bilinen takma adlar */
    const takmaId = KATEGORI_TAKMA[n];
    if (takmaId && liste.some((x) => x.id === takmaId)) return takmaId;
    /* 4) Kısmi isim */
    k = liste.find((x) => {
      const a = normAd(x.ad);
      return a.indexOf(n) >= 0 || n.indexOf(a) >= 0;
    });
    if (k) return k.id;
    /* 5) Eski Excel’ler: simge (geriye uyum) */
    k = liste.find((x) => x.simge === s);
    if (k) return k.id;
    return varsayilan;
  }

  function daireEsle(ad, daireler) {
    const n = normAd(ad);
    if (!n) return null;
    let d = daireler.find((x) => normAd(x.ad) === n || normAd(x.id) === n);
    if (d) return d;
    d = daireler.find((x) => normAd(x.ad).indexOf(n) >= 0 || n.indexOf(normAd(x.ad)) >= 0);
    return d || null;
  }

  function sheetJsYukle() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (sheetJsPromise) return sheetJsPromise;
    sheetJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.async = true;
      s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX yüklenemedi")));
      s.onerror = () => reject(new Error("Excel okuyucu yüklenemedi (ağ)"));
      document.head.appendChild(s);
    });
    return sheetJsPromise;
  }

  function htmlTablodanMatris(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table");
    if (!table) throw new Error("Excel tablosu bulunamadı. Export formatındaki .xls dosyasını kullanın.");
    const rows = Array.prototype.slice.call(table.rows || []);
    const grid = [];
    for (let r = 0; r < rows.length; r++) {
      if (!grid[r]) grid[r] = [];
      let c = 0;
      const cells = Array.prototype.slice.call(rows[r].cells || []);
      for (let i = 0; i < cells.length; i++) {
        while (grid[r][c] != null) c++;
        const cell = cells[i];
        const cs = cell.colSpan || 1;
        const rs = cell.rowSpan || 1;
        const txt = hucreMetin(cell.textContent);
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            if (!grid[r + dr]) grid[r + dr] = [];
            if (grid[r + dr][c + dc] == null) grid[r + dr][c + dc] = txt;
          }
        }
        c += cs;
      }
    }
    return grid.map((row) => {
      const out = [];
      for (let i = 0; i < row.length; i++) out.push(hucreMetin(row[i]));
      return out;
    });
  }

  function xlsxMatris(wb) {
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const aoa = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    return aoa.map((row) => (row || []).map(hucreMetin));
  }

  async function dosyadanMatris(file) {
    const ad = String(file.name || "").toLowerCase();
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    const bas = String.fromCharCode.apply(null, Array.from(u8.slice(0, 200)));
    const htmlGibi = /<html|<table|xmlns:x=/i.test(bas) || ad.endsWith(".htm") || ad.endsWith(".html");

    if (htmlGibi || (ad.endsWith(".xls") && /</.test(bas))) {
      const text = new TextDecoder("utf-8").decode(u8);
      return htmlTablodanMatris(text);
    }

    const XLSX = await sheetJsYukle();
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    return xlsxMatris(wb);
  }

  function yapiBul(matris) {
    let baslikSatir = -1;
    let altBaslik = -1;
    for (let r = 0; r < matris.length; r++) {
      const row = matris[r] || [];
      const ilk = normAd(row[0]);
      if (ilk === "tarih") {
        baslikSatir = r;
        /* alt başlık aynı satırda veya sonraki satırda */
        const ayni = SUTUNLAR.every((lbl, i) => normAd(row[1 + i]) === normAd(lbl));
        if (ayni) {
          altBaslik = r;
        } else {
          for (let r2 = r; r2 <= r + 2 && r2 < matris.length; r2++) {
            const row2 = matris[r2] || [];
            const ok = SUTUNLAR.every((lbl, i) => normAd(row2[1 + i]) === normAd(lbl));
            if (ok) { altBaslik = r2; break; }
          }
        }
        break;
      }
    }
    if (baslikSatir < 0 || altBaslik < 0) {
      throw new Error("Başlık satırı bulunamadı. Export Excel’indeki gibi Tarih + G/Kt/Fyt/Ödn/Ad/Not olmalı.");
    }

    const baslikRow = matris[baslikSatir] || [];
    const odalar = [];
    let c = 1;
    while (c < baslikRow.length) {
      const ad = hucreMetin(baslikRow[c]);
      if (!ad || normAd(ad) === "g") break;
      /* oda adı 6 sütuna yayılmış olabilir — aynı adı atla */
      let span = 1;
      while (c + span < baslikRow.length && (!baslikRow[c + span] || baslikRow[c + span] === ad)) span++;
      if (span < XL_DAIRE_COL) {
        /* alt başlıktan doğrula */
        const alt = matris[altBaslik] || [];
        const labelsOk = SUTUNLAR.every((lbl, i) => normAd(alt[c + i]) === normAd(lbl));
        if (labelsOk) span = XL_DAIRE_COL;
      }
      if (span >= XL_DAIRE_COL) {
        odalar.push({ ad, col: c });
        c += XL_DAIRE_COL;
      } else {
        c += 1;
      }
    }
    if (!odalar.length) throw new Error("Oda sütunları okunamadı.");

    const gunler = [];
    for (let r = altBaslik + 1; r < matris.length; r++) {
      const row = matris[r] || [];
      const iso = tarihParse(row[0]);
      if (!iso) continue;
      gunler.push({ r, iso, row });
    }
    if (!gunler.length) throw new Error("Tarih satırı bulunamadı.");

    return { odalar, gunler, baslikSatir, altBaslik };
  }

  function konakBloklariCikar(oda, gunler) {
    const bloklar = [];
    let aktif = null;

    const flush = () => {
      if (!aktif) return;
      bloklar.push(aktif);
      aktif = null;
    };

    gunler.forEach(({ iso, row }) => {
      const base = oda.col;
      const g = hucreMetin(row[base]);
      const kt = hucreMetin(row[base + 1]);
      const fyt = hucreMetin(row[base + 2]);
      const odn = hucreMetin(row[base + 3]);
      const ad = hucreMetin(row[base + 4]);
      const not = hucreMetin(row[base + 5]);
      const bos =
        (!ad || ad === "—") &&
        (!g || g === "—" || g === "") &&
        (!fyt || fyt === "—");

      if (bos) {
        flush();
        return;
      }
      if (!ad || ad === "—") {
        flush();
        return;
      }

      const adN = normAd(ad);
      if (!aktif || aktif.adNorm !== adN) {
        flush();
        aktif = {
          ad,
          adNorm: adN,
          kt,
          not,
          gunler: [],
          fytHam: {},
          fiyatlar: {},
          odemeler: {}
        };
      }
      aktif.gunler.push(iso);
      aktif.fytHam[iso] = fyt;
      const fiyat = fiyatParse(fyt);
      if (fiyat) aktif.fiyatlar[iso] = fiyat;
      /* Ödeme: okunamazsa atla — rezervasyonu engelleme */
      const odeme = odemeParse(odn);
      if (odeme) aktif.odemeler[iso] = odeme;
      if (kt && kt !== "—") aktif.kt = kt;
      if (not) aktif.not = not;
    });
    flush();
    /* Fiyatı ileri doldur: boş geceye önceki gece fiyatı */
    bloklar.forEach((b) => {
      let son = null;
      b.gunler.forEach((iso) => {
        if (b.fiyatlar[iso]) son = b.fiyatlar[iso];
        else if (son) b.fiyatlar[iso] = son;
        else {
          const tekrar = fiyatParse(b.fytHam[iso]);
          if (tekrar) {
            b.fiyatlar[iso] = tekrar;
            son = tekrar;
          }
        }
      });
      /* Hâlâ yoksa geriye doğru doldur */
      let sonGeri = null;
      for (let i = b.gunler.length - 1; i >= 0; i--) {
        const iso = b.gunler[i];
        if (b.fiyatlar[iso]) sonGeri = b.fiyatlar[iso];
        else if (sonGeri) b.fiyatlar[iso] = sonGeri;
      }
    });
    return bloklar;
  }

  function planOlustur(matris) {
    const db = window.APARTIM.db;
    if (!db?.durum?.yuklendi) throw new Error("Veriler henüz yüklenmedi");

    const konumSira = { sol: 0, sag: 1, tek: 2 };
    const daireler = db.dairelerListele().slice().sort((a, b) => {
      const ka = a.kat || 0;
      const kb = b.kat || 0;
      if (ka !== kb) return ka - kb;
      const diff = (konumSira[a.konum] ?? 9) - (konumSira[b.konum] ?? 9);
      if (diff) return diff;
      return (a.sira || 0) - (b.sira || 0);
    });
    const yapi = yapiBul(matris);
    const plan = { ekle: [], guncelle: [], atla: [], hatalar: [], ozet: "" };

    yapi.odalar.forEach((odaBilgi) => {
      const daire = daireEsle(odaBilgi.ad, daireler);
      if (!daire) {
        plan.hatalar.push("Oda eşleşmedi: " + odaBilgi.ad);
        return;
      }
      const bloklar = konakBloklariCikar(odaBilgi, yapi.gunler);
      bloklar.forEach((b) => {
        if (!b.gunler.length) return;
        const giris = b.gunler[0];
        const sonGece = b.gunler[b.gunler.length - 1];
        const cikis = db.gunEkleISO(sonGece, 1);
        const kaynakId = kaynakIdBul(b.kt);

        const fiyatDegerleri = Object.values(b.fiyatlar);
        if (!fiyatDegerleri.length) {
          plan.atla.push({
            etiket: (daire.ad || daire.id) + " · " + b.ad + " · " + giris,
            neden: "Fiyat (Fyt) okunamadı — satırı kontrol edin"
          });
          return;
        }

        let gunlukUcret = 0;
        let paraBirimi = "TL";
        let tarihFiyatlari = null;
        paraBirimi = fiyatDegerleri[0].pb === "USD" ? "USD" : "TL";
        const tutarlar = fiyatDegerleri.map((f) => f.tutar);
        const tek = tutarlar.every((t) => t === tutarlar[0]);
        gunlukUcret = tutarlar[0];
        if (!(gunlukUcret > 0)) {
          plan.atla.push({
            etiket: (daire.ad || daire.id) + " · " + b.ad + " · " + giris,
            neden: "Fiyat 0 veya geçersiz"
          });
          return;
        }
        if (!tek) {
          tarihFiyatlari = {};
          Object.keys(b.fiyatlar).forEach((t) => {
            const f = b.fiyatlar[t];
            if (f && f.tutar > 0) {
              tarihFiyatlari[t] = { tutar: f.tutar, pb: f.pb === "USD" ? "USD" : "TL" };
            }
          });
        }

        /* Ödeme opsiyonel — okunamazsa atlanır, rezervasyon yine oluşur */
        const odenenGunleri = Object.keys(b.odemeler).length
          ? Object.assign({}, b.odemeler)
          : null;

        const veri = {
          daireId: daire.id,
          daireAd: daire.ad || daire.id,
          kaynakId,
          misafirAdi: b.ad,
          giris,
          cikis,
          gunlukUcret,
          paraBirimi,
          notlar: b.not || "",
          tarihFiyatlari
        };
        if (odenenGunleri) veri.odenenGunleri = odenenGunleri;

        const cakis = db.dairedeCakisanRez(daire.id, giris, cikis);
        if (cakis) {
          if (normAd(cakis.misafirAdi) === b.adNorm) {
            plan.guncelle.push({ id: cakis.id, veri, etiket: (daire.ad || daire.id) + " · " + b.ad + " · " + giris + "→" + cikis });
          } else {
            plan.atla.push({
              etiket: (daire.ad || daire.id) + " · " + b.ad,
              neden: "Çakışma: " + cakis.misafirAdi
            });
          }
          return;
        }

        /* Aynı misafir + aynı giriş varsa güncelle */
        const ayni = Object.values(db.durum.rezervasyonlar || {}).find((r) =>
          r && r.daireId === daire.id && r.giris === giris && normAd(r.misafirAdi) === b.adNorm
        );
        if (ayni) {
          plan.guncelle.push({ id: ayni.id, veri, etiket: (daire.ad || daire.id) + " · " + b.ad + " · " + giris + "→" + cikis });
        } else {
          plan.ekle.push({ veri, etiket: (daire.ad || daire.id) + " · " + b.ad + " · " + giris + "→" + cikis });
        }
      });
    });

    plan.ozet =
      plan.ekle.length + " yeni, " +
      plan.guncelle.length + " güncelleme" +
      (plan.atla.length ? ", " + plan.atla.length + " atlandı" : "") +
      (plan.hatalar.length ? ", " + plan.hatalar.length + " hata" : "");
    return plan;
  }

  async function planUygula(plan) {
    const db = window.APARTIM.db;
    let ok = 0;
    let hata = 0;
    const hatalar = [];

    for (const item of plan.ekle) {
      try {
        const v = item.veri;
        const payload = {
          daireId: v.daireId,
          kaynakId: v.kaynakId,
          misafirAdi: v.misafirAdi,
          giris: v.giris,
          cikis: v.cikis,
          gunlukUcret: v.gunlukUcret,
          paraBirimi: v.paraBirimi,
          notlar: v.notlar,
          tarihFiyatlari: v.tarihFiyatlari
        };
        if (v.odenenGunleri) payload.odenenGunleri = v.odenenGunleri;
        await db.rezervasyonEkle(payload);
        ok++;
      } catch (e) {
        hata++;
        hatalar.push((item.etiket || "") + ": " + (e.message || e));
      }
    }

    for (const item of plan.guncelle) {
      try {
        const v = item.veri;
        const payload = {
          kaynakId: v.kaynakId,
          misafirAdi: v.misafirAdi,
          giris: v.giris,
          cikis: v.cikis,
          gunlukUcret: v.gunlukUcret,
          paraBirimi: v.paraBirimi,
          notlar: v.notlar,
          tarihFiyatlari: v.tarihFiyatlari
        };
        /* Ödeme okunduysa yaz; okunamadıysa mevcut tahsilatlara dokunma */
        if (v.odenenGunleri) payload.odenenGunleri = v.odenenGunleri;
        await db.rezervasyonGuncelle(item.id, payload);
        ok++;
      } catch (e) {
        hata++;
        hatalar.push((item.etiket || "") + ": " + (e.message || e));
      }
    }

    document.dispatchEvent(new CustomEvent("apartim:veri-degisti"));
    return { ok, hata, hatalar };
  }

  function modal() { return document.getElementById("modal-excel-import"); }

  function modalAc() {
    const m = modal();
    if (!m) return;
    m.classList.remove("hidden");
    window.APARTIM.app?.modalAcikGuncelle?.();
  }

  function modalKapat() {
    modal()?.classList.add("hidden");
    onizleme = null;
    const input = document.getElementById("excel-import-dosya");
    if (input) input.value = "";
    const oniz = document.getElementById("excel-import-onizleme");
    if (oniz) oniz.innerHTML = "";
    const kaydet = document.getElementById("excel-import-kaydet");
    if (kaydet) kaydet.disabled = true;
    window.APARTIM.app?.modalAcikGuncelle?.();
  }

  function onizlemeYaz(plan) {
    const el = document.getElementById("excel-import-onizleme");
    const kaydet = document.getElementById("excel-import-kaydet");
    if (!el) return;
    const satirlar = [];
    satirlar.push('<div class="excel-import-ozet"><strong>' + plan.ozet + "</strong></div>");
    if (plan.ekle.length) {
      satirlar.push('<div class="excel-import-grup">Yeni (' + plan.ekle.length + ")</div>");
      plan.ekle.slice(0, 40).forEach((x) => {
        satirlar.push('<div class="excel-import-satir ekle">+ ' + esc(x.etiket) + "</div>");
      });
      if (plan.ekle.length > 40) {
        satirlar.push('<div class="excel-import-satir">… +' + (plan.ekle.length - 40) + " daha</div>");
      }
    }
    if (plan.guncelle.length) {
      satirlar.push('<div class="excel-import-grup">Güncellenecek (' + plan.guncelle.length + ")</div>");
      plan.guncelle.slice(0, 40).forEach((x) => {
        satirlar.push('<div class="excel-import-satir guncelle">↻ ' + esc(x.etiket) + "</div>");
      });
    }
    if (plan.atla.length) {
      satirlar.push('<div class="excel-import-grup">Atlanan (' + plan.atla.length + ")</div>");
      plan.atla.slice(0, 20).forEach((x) => {
        satirlar.push('<div class="excel-import-satir atla">✕ ' + esc(x.etiket) + " — " + esc(x.neden) + "</div>");
      });
    }
    if (plan.hatalar.length) {
      satirlar.push('<div class="excel-import-grup">Hata</div>');
      plan.hatalar.forEach((h) => {
        satirlar.push('<div class="excel-import-satir hata">' + esc(h) + "</div>");
      });
    }
    el.innerHTML = satirlar.join("");
    if (kaydet) kaydet.disabled = !(plan.ekle.length || plan.guncelle.length);
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  async function dosyaSecildi(file) {
    if (!file) return;
    try {
      toast("Excel okunuyor…", "bilgi");
      const matris = await dosyadanMatris(file);
      onizleme = planOlustur(matris);
      onizlemeYaz(onizleme);
      if (!onizleme.ekle.length && !onizleme.guncelle.length) {
        toast(onizleme.hatalar[0] || "Aktarılacak rezervasyon bulunamadı", "uyari");
      } else {
        toast("Önizleme hazır: " + onizleme.ozet, "basari");
      }
    } catch (err) {
      console.error("excelImport", err);
      onizleme = null;
      onizlemeYaz({ ekle: [], guncelle: [], atla: [], hatalar: [err.message || String(err)], ozet: "Hata" });
      toast(err.message || "Excel okunamadı", "hata");
    }
  }

  async function kaydetTik() {
    if (!onizleme || (!onizleme.ekle.length && !onizleme.guncelle.length)) return;
    const btn = document.getElementById("excel-import-kaydet");
    if (btn) btn.disabled = true;
    try {
      const sonuc = await planUygula(onizleme);
      if (sonuc.hata) {
        toast(sonuc.ok + " kayıt OK, " + sonuc.hata + " hata", "uyari");
      } else {
        toast(sonuc.ok + " rezervasyon aktarıldı", "basari");
      }
      window.APARTIM.rezOzet?.tabloCizPlanla?.();
      modalKapat();
    } catch (err) {
      console.error(err);
      toast(err.message || "Aktarım başarısız", "hata");
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    document.getElementById("rez-ozet-excel-import")?.addEventListener("click", () => {
      if (!window.APARTIM.db?.durum?.yuklendi) {
        toast("Veriler henüz yüklenmedi", "uyari");
        return;
      }
      modalAc();
    });
    document.getElementById("excel-import-close")?.addEventListener("click", modalKapat);
    document.getElementById("excel-import-iptal")?.addEventListener("click", modalKapat);
    document.getElementById("excel-import-kaydet")?.addEventListener("click", kaydetTik);
    document.getElementById("excel-import-dosya")?.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) dosyaSecildi(f);
    });
    modal()?.addEventListener("click", (e) => {
      if (e.target.id === "modal-excel-import") modalKapat();
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.excelImport = { dosyaSecildi, planOlustur, planUygula, modalAc, modalKapat };
})();
