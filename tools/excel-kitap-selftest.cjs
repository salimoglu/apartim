#!/usr/bin/env node
/* Çok sayfalı xlsx: sayfa adları, birleşik hücre ve Rezervasyon başlığı */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const kitap = require("../js/excel-kitap.js");

const k = kitap.yeni();
const banner = kitap.stil(k, { bg: "15202B", color: "FFFFFF", bold: true, size: 14, align: "left", border: "6B7280" });
const kose = kitap.stil(k, { bg: "1E2D3D", color: "FFFFFF", bold: true, size: 10, align: "center", border: "6B7280" });
const oda = kitap.stil(k, { bg: "FFCDD2", color: "111827", bold: true, size: 10, align: "center", border: "6B7280" });
const mini = kitap.stil(k, { bg: "FFCDD2", color: "111827", bold: true, size: 9, align: "center", border: "6B7280" });
const h = (v, s, span, asagi) => ({ v, s, span: span || 1, asagi: asagi || 0 });

function sayfa(ad, satirlar) {
  kitap.sayfa(k, { ad, satirlar, kolonlar: [18, 8, 8, 8, 8, 8, 8], sekme: "1E2D3D", secili: ad === "Rezervasyon" });
}

kitap.sayfa(k, {
  ad: "Rezervasyon",
  secili: true,
  dondur: { satir: 4, sutun: 1 },
  sekme: "1E2D3D",
  kolonlar: [18, 8, 8, 8, 8, 8, 8],
  satirlar: [
    { hucreler: [h("APARTIM — Rezervasyon", banner, 7)], yukseklik: 22 },
    { hucreler: [h("özet", banner, 7)], yukseklik: 18 },
    { hucreler: [h("Tarih", kose, 1, 1), h("1. Oda", oda, 6)], yukseklik: 18 },
    { hucreler: ["G", "Kt", "Fyt", "Ödn", "Ad", "Not"].map((lbl) => h(lbl, mini)), yukseklik: 16, basSutun: 2 },
    { hucreler: [h("Haziran 2026", banner, 7)], yukseklik: 18 },
    { hucreler: [h("01.06.2026 PZT", mini), h("1", mini), h("Booking", mini), h("100₺", mini), h("—", mini), h("Ali", mini), h("not", mini)] }
  ]
});
sayfa("Tahsilat", [{ hucreler: [h("APARTIM — Tahsilat", banner, 2)] }]);
sayfa("Rapor", [{ hucreler: [h("APARTIM — Rapor", banner, 2)] }]);
sayfa("Kasa", [{ hucreler: [h("APARTIM — Kasa", banner, 2)] }]);

const bytes = kitap.uint8(k);
const dosya = path.join(os.tmpdir(), "apartim-excel-selftest.xlsx");
fs.writeFileSync(dosya, bytes);

const py = `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
names = z.namelist()
need = [
  "[Content_Types].xml",
  "xl/workbook.xml",
  "xl/styles.xml",
  "xl/worksheets/sheet1.xml",
  "xl/worksheets/sheet2.xml",
  "xl/worksheets/sheet3.xml",
  "xl/worksheets/sheet4.xml",
]
missing = [n for n in need if n not in names]
if missing:
  raise SystemExit("eksik: " + ",".join(missing))
wb = z.read("xl/workbook.xml").decode("utf-8")
for ad in ["Rezervasyon", "Tahsilat", "Rapor", "Kasa"]:
  if 'name="%s"' % ad not in wb:
    raise SystemExit("sayfa yok: " + ad)
s1 = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
for metin in ["Tarih", "1. Oda", "G", "Kt", "Fyt", "Ödn", "Ad", "Not", "01.06.2026 PZT"]:
  if metin not in s1:
    raise SystemExit("hucre yok: " + metin)
if 'mergeCell ref="A3:A4"' not in s1 or 'mergeCell ref="B3:G3"' not in s1:
  raise SystemExit("birlesim yok")
if "<tabColor" not in s1:
  raise SystemExit("sekme rengi yok")
if 'ySplit="4"' not in s1 or 'xSplit="1"' not in s1 or 'state="frozen"' not in s1:
  raise SystemExit("dondurulmus baslik yok")
print("ok", len(names), "parca")
`;
execFileSync("python3", ["-c", py, dosya], { stdio: "inherit" });
console.log("yazildi", dosya, bytes.length, "bayt");
