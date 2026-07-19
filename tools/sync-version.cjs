#!/usr/bin/env node
/* js/version.js → index.html ?v= ve sw.js CACHE/ASSET senkronu */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const versionPath = path.join(root, "js", "version.js");
const indexPath = path.join(root, "index.html");
const swPath = path.join(root, "sw.js");

const versionSrc = fs.readFileSync(versionPath, "utf8");
const m = versionSrc.match(/const APP = "([^"]+)"/);
if (!m) {
  console.error("js/version.js içinde APP bulunamadı");
  process.exit(1);
}

const APP = m[1];
if (!/^\d+\.\d+$/.test(APP)) {
  console.error("APP major.minor olmalı (örn. 3.0):", APP);
  process.exit(1);
}
const CACHE = "apartim-" + APP.replace(/\./g, "-");

let indexHtml = fs.readFileSync(indexPath, "utf8");
/* Eski 2.x ve yeni 3.x+ ?v= değerlerini yakala */
indexHtml = indexHtml.replace(/\?v=\d+\.\d+/g, "?v=" + APP);
fs.writeFileSync(indexPath, indexHtml, "utf8");

let sw = fs.readFileSync(swPath, "utf8");
sw = sw.replace(/const CACHE_VERSION = "[^"]+";/, 'const CACHE_VERSION = "' + CACHE + '";');
sw = sw.replace(/const ASSET_V = "[^"]+";/, 'const ASSET_V = "' + APP + '";');
/* Açıklama satırı */
sw = sw.replace(
  /\/\* Sürüm:.*\*\//,
  "/* Sürüm: js/version.js APP ile senkron (2.99 → 3.0; minor 0–99) */"
);
fs.writeFileSync(swPath, sw, "utf8");

console.log("Senkron OK — APP " + APP + ", cache " + CACHE);
