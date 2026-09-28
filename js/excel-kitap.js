/* =========================================================
   APARTIM — Çok sayfalı Excel (.xlsx) oluşturucu
   Bağımlılık yok: Office Open XML + sıkıştırmasız zip.
   Sayfa sekmeleri ss değil, workbook içindeki sheet adlarıdır.
   ========================================================= */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) {
    root.APARTIM = root.APARTIM || {};
    root.APARTIM.excelKitap = api;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function () {
  "use strict";

  const CRC_TABLO = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLO[(c ^ buf[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function utf8(s) {
    return new TextEncoder().encode(String(s == null ? "" : s));
  }

  function u16(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n & 0xffff, true);
    return b;
  }

  function u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0, true);
    return b;
  }

  function birlestir(parcalar) {
    let n = 0;
    parcalar.forEach((p) => { n += p.length; });
    const out = new Uint8Array(n);
    let o = 0;
    parcalar.forEach((p) => {
      out.set(p, o);
      o += p.length;
    });
    return out;
  }

  function xmlEsc(s) {
    return String(s == null ? "" : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renk(hex) {
    let h = String(hex || "").replace("#", "").trim().toUpperCase();
    if (h.length === 8) h = h.slice(2);
    if (!/^[0-9A-F]{6}$/.test(h)) h = "FFFFFF";
    return h;
  }

  function sutunHarf(n) {
    let s = "";
    let x = n;
    while (x > 0) {
      const m = (x - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s || "A";
  }

  function yeni() {
    return { sayfalar: [], stiller: new Map(), stilListe: [] };
  }

  function stil(kitap, opts) {
    const o = opts || {};
    const norm = {
      bg: renk(o.bg || "FFFFFF"),
      color: renk(o.color || "111827"),
      bold: !!o.bold,
      size: Number(o.size) || 10,
      align: o.align === "left" || o.align === "right" ? o.align : "center",
      valign: "center",
      wrap: !!o.wrap,
      border: o.border ? renk(o.border) : ""
    };
    const key = [
      norm.bg, norm.color, norm.bold ? 1 : 0, norm.size,
      norm.align, norm.wrap ? 1 : 0, norm.border
    ].join("|");
    if (kitap.stiller.has(key)) return kitap.stiller.get(key);
    kitap.stilListe.push(norm);
    const id = kitap.stilListe.length;
    kitap.stiller.set(key, id);
    return id;
  }

  function sayfa(kitap, tanim) {
    const t = tanim || {};
    const ad = String(t.ad || "Sayfa").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sayfa";
    kitap.sayfalar.push({
      ad,
      satirlar: t.satirlar || [],
      kolonlar: t.kolonlar || [],
      dondur: t.dondur || null,
      secili: !!t.secili,
      sekme: t.sekme ? renk(t.sekme) : ""
    });
  }

  function paneXml(dondur, secili) {
    const sel = secili ? " tabSelected=\"1\"" : "";
    const y = dondur && dondur.satir ? dondur.satir : 0;
    const x = dondur && dondur.sutun ? dondur.sutun : 0;
    if (!x && !y) {
      return "<sheetViews><sheetView workbookViewId=\"0\"" + sel + "/></sheetViews>";
    }
    const top = sutunHarf(x + 1) + (y + 1);
    let active = "bottomRight";
    if (x && !y) active = "topRight";
    else if (y && !x) active = "bottomLeft";
    let attrs = "";
    if (x) attrs += " xSplit=\"" + x + "\"";
    if (y) attrs += " ySplit=\"" + y + "\"";
    attrs += " topLeftCell=\"" + top + "\" activePane=\"" + active + "\" state=\"frozen\"";
    return "<sheetViews><sheetView workbookViewId=\"0\"" + sel + ">" +
      "<pane" + attrs + "/>" +
      "<selection pane=\"" + active + "\" activeCell=\"" + top + "\" sqref=\"" + top + "\"/>" +
      "</sheetView></sheetViews>";
  }

  function sayfaXml(s) {
    const merges = [];
    let maxSatir = 0;
    let maxSutun = s.kolonlar.length || 1;
    const rowXml = [];
    (s.satirlar || []).forEach((satir, idx) => {
      const r = idx + 1;
      if (r > maxSatir) maxSatir = r;
      let col = satir.basSutun > 1 ? satir.basSutun : 1;
      const cells = [];
      (satir.hucreler || []).forEach((h) => {
        const span = Math.max(1, Number(h.span) || 1);
        const asagi = Math.max(0, Number(h.asagi) || 0);
        const ref = sutunHarf(col) + r;
        const sid = Number(h.s) || 0;
        cells.push(
          "<c r=\"" + ref + "\" s=\"" + sid + "\" t=\"inlineStr\"><is><t xml:space=\"preserve\">" +
          xmlEsc(h.v) + "</t></is></c>"
        );
        if (span > 1 || asagi > 0) {
          const bitis = sutunHarf(col + span - 1) + (r + asagi);
          if (bitis !== ref) merges.push(ref + ":" + bitis);
        }
        const sonSutun = col + span - 1;
        if (sonSutun > maxSutun) maxSutun = sonSutun;
        const sonSatir = r + asagi;
        if (sonSatir > maxSatir) maxSatir = sonSatir;
        col += span;
      });
      const ht = satir.yukseklik ? " ht=\"" + Number(satir.yukseklik) + "\" customHeight=\"1\"" : "";
      rowXml.push("<row r=\"" + r + "\"" + ht + ">" + cells.join("") + "</row>");
    });
    if (!maxSatir) {
      maxSatir = 1;
      rowXml.push("<row r=\"1\"><c r=\"A1\" t=\"inlineStr\"><is><t></t></is></c></row>");
    }
    const dim = "A1:" + sutunHarf(maxSutun) + maxSatir;
    const cols = (s.kolonlar || []).map((w, i) =>
      "<col min=\"" + (i + 1) + "\" max=\"" + (i + 1) + "\" width=\"" + w + "\" customWidth=\"1\"/>"
    ).join("");
    const pr = s.sekme
      ? "<sheetPr><tabColor rgb=\"FF" + s.sekme + "\"/></sheetPr>"
      : "";
    const mergeXml = merges.length
      ? "<mergeCells count=\"" + merges.length + "\">" +
        merges.map((ref) => "<mergeCell ref=\"" + ref + "\"/>").join("") +
        "</mergeCells>"
      : "";
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
      pr +
      "<dimension ref=\"" + dim + "\"/>" +
      paneXml(s.dondur, s.secili) +
      "<sheetFormatPr defaultRowHeight=\"16\"/>" +
      (cols ? "<cols>" + cols + "</cols>" : "") +
      "<sheetData>" + rowXml.join("") + "</sheetData>" +
      mergeXml +
      "</worksheet>";
  }

  function stillerXml(liste) {
    const fonts = [{ bold: false, size: 11, color: "FF000000" }];
    const fontMap = new Map();
    fontMap.set("0|11|FF000000", 0);
    const fills = [{ tip: "none" }, { tip: "gray" }];
    const fillMap = new Map();
    const borders = [{ color: "" }];
    const borderMap = new Map();
    borderMap.set("", 0);

    function fontId(bold, size, color) {
      const key = (bold ? 1 : 0) + "|" + size + "|" + color;
      if (fontMap.has(key)) return fontMap.get(key);
      const id = fonts.length;
      fonts.push({ bold, size, color });
      fontMap.set(key, id);
      return id;
    }
    function fillId(bg) {
      if (fillMap.has(bg)) return fillMap.get(bg);
      const id = fills.length;
      fills.push({ tip: "solid", bg });
      fillMap.set(bg, id);
      return id;
    }
    function borderId(color) {
      if (!color) return 0;
      if (borderMap.has(color)) return borderMap.get(color);
      const id = borders.length;
      borders.push({ color });
      borderMap.set(color, id);
      return id;
    }

    const xfs = [{ font: 0, fill: 0, border: 0, o: null }];
    (liste || []).forEach((o) => {
      xfs.push({
        font: fontId(o.bold, o.size, "FF" + o.color),
        fill: fillId("FF" + o.bg),
        border: borderId(o.border ? "FF" + o.border : ""),
        o
      });
    });

    const fontXml = fonts.map((f) =>
      "<font>" + (f.bold ? "<b/>" : "") +
      "<sz val=\"" + f.size + "\"/>" +
      "<color rgb=\"" + f.color + "\"/>" +
      "<name val=\"Calibri\"/><family val=\"2\"/></font>"
    ).join("");
    const fillXml = fills.map((f) => {
      if (f.tip === "none") return "<fill><patternFill patternType=\"none\"/></fill>";
      if (f.tip === "gray") return "<fill><patternFill patternType=\"gray125\"/></fill>";
      return "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"" + f.bg + "\"/><bgColor indexed=\"64\"/></patternFill></fill>";
    }).join("");
    const borderXml = borders.map((b) => {
      if (!b.color) return "<border><left/><right/><top/><bottom/><diagonal/></border>";
      const k = "<color rgb=\"" + b.color + "\"/>";
      return "<border><left style=\"thin\">" + k + "</left><right style=\"thin\">" + k +
        "</right><top style=\"thin\">" + k + "</top><bottom style=\"thin\">" + k +
        "</bottom><diagonal/></border>";
    }).join("");
    const xfXml = xfs.map((x) => {
      if (!x.o) {
        return "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>";
      }
      const wrap = x.o.wrap ? " wrapText=\"1\"" : "";
      return "<xf numFmtId=\"49\" fontId=\"" + x.font + "\" fillId=\"" + x.fill +
        "\" borderId=\"" + x.border + "\" xfId=\"0\" applyNumberFormat=\"1\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\">" +
        "<alignment horizontal=\"" + x.o.align + "\" vertical=\"center\"" + wrap + "/></xf>";
    }).join("");

    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
      "<fonts count=\"" + fonts.length + "\">" + fontXml + "</fonts>" +
      "<fills count=\"" + fills.length + "\">" + fillXml + "</fills>" +
      "<borders count=\"" + borders.length + "\">" + borderXml + "</borders>" +
      "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
      "<cellXfs count=\"" + xfs.length + "\">" + xfXml + "</cellXfs>" +
      "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
      "</styleSheet>";
  }

  function kitapXml(sayfalar) {
    const sheets = sayfalar.map((s, i) =>
      "<sheet name=\"" + xmlEsc(s.ad) + "\" sheetId=\"" + (i + 1) + "\" r:id=\"rId" + (i + 1) + "\"/>"
    ).join("");
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
      "<bookViews><workbookView activeTab=\"0\"/></bookViews>" +
      "<sheets>" + sheets + "</sheets></workbook>";
  }

  function relsKitap(sayfaSayisi) {
    let rel = "";
    for (let i = 1; i <= sayfaSayisi; i++) {
      rel += "<Relationship Id=\"rId" + i + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet" + i + ".xml\"/>";
    }
    rel += "<Relationship Id=\"rIdStyle\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>";
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
      rel + "</Relationships>";
  }

  function icerikTurleri(sayfaSayisi) {
    let over = "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>";
    over += "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>";
    for (let i = 1; i <= sayfaSayisi; i++) {
      over += "<Override PartName=\"/xl/worksheets/sheet" + i + ".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>";
    }
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
      "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
      "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
      over + "</Types>";
  }

  function kokRels() {
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
      "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
      "</Relationships>";
  }

  function zipDepo(dosyalar) {
    const simdi = new Date();
    const time = (simdi.getHours() << 11) | (simdi.getMinutes() << 5) | (simdi.getSeconds() >> 1);
    const date = ((simdi.getFullYear() - 1980) << 9) | ((simdi.getMonth() + 1) << 5) | simdi.getDate();
    const yerel = [];
    const merkez = [];
    let offset = 0;
    dosyalar.forEach((d) => {
      const ad = utf8(d.ad);
      const veri = d.veri;
      const crc = crc32(veri);
      const yerelBas = birlestir([
        u32(0x04034b50),
        u16(20), u16(0), u16(0),
        u16(time), u16(date),
        u32(crc), u32(veri.length), u32(veri.length),
        u16(ad.length), u16(0),
        ad
      ]);
      yerel.push(yerelBas, veri);
      merkez.push(birlestir([
        u32(0x02014b50),
        u16(20), u16(20),
        u16(0), u16(0),
        u16(time), u16(date),
        u32(crc), u32(veri.length), u32(veri.length),
        u16(ad.length), u16(0), u16(0),
        u16(0), u16(0), u32(0),
        u32(offset),
        ad
      ]));
      offset += yerelBas.length + veri.length;
    });
    const merkezBlob = birlestir(merkez);
    const eocd = birlestir([
      u32(0x06054b50),
      u16(0), u16(0),
      u16(dosyalar.length), u16(dosyalar.length),
      u32(merkezBlob.length), u32(offset),
      u16(0)
    ]);
    return birlestir(yerel.concat([merkezBlob, eocd]));
  }

  function uint8(kitap) {
    const sayfalar = kitap.sayfalar.length ? kitap.sayfalar : [{
      ad: "Sayfa",
      satirlar: [],
      kolonlar: [],
      dondur: null,
      secili: true,
      sekme: ""
    }];
    if (!sayfalar.some((s) => s.secili)) sayfalar[0].secili = true;
    const dosyalar = [
      { ad: "[Content_Types].xml", veri: utf8(icerikTurleri(sayfalar.length)) },
      { ad: "_rels/.rels", veri: utf8(kokRels()) },
      { ad: "xl/workbook.xml", veri: utf8(kitapXml(sayfalar)) },
      { ad: "xl/_rels/workbook.xml.rels", veri: utf8(relsKitap(sayfalar.length)) },
      { ad: "xl/styles.xml", veri: utf8(stillerXml(kitap.stilListe)) }
    ];
    sayfalar.forEach((s, i) => {
      dosyalar.push({ ad: "xl/worksheets/sheet" + (i + 1) + ".xml", veri: utf8(sayfaXml(s)) });
    });
    return zipDepo(dosyalar);
  }

  function blob(kitap) {
    return new Blob([uint8(kitap)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  return { yeni, stil, sayfa, uint8, blob };
});
