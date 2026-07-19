#!/usr/bin/env node
/* Sürüm artır: major.minor — minor 0–99; 2.99 → 3.0
   Kullanım: node tools/bump-version.cjs
             node tools/bump-version.cjs --set 3.0
   Ardından otomatik sync-version çalışır. */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const versionPath = path.join(root, "js", "version.js");

function parseApp(v) {
  const m = String(v || "").trim().match(/^(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

function formatApp(major, minor) {
  return major + "." + minor;
}

/** minor > 99 ise 100’lük dilimleri major’a taşır (2.160 → 3.60) */
function normalize(major, minor) {
  let maj = major;
  let min = minor;
  if (!Number.isFinite(maj) || !Number.isFinite(min) || maj < 0 || min < 0) {
    throw new Error("Geçersiz sürüm");
  }
  if (min > 99) {
    maj += Math.floor(min / 100);
    min = min % 100;
  }
  return { major: maj, minor: min };
}

function bump(major, minor) {
  const n = normalize(major, minor);
  let maj = n.major;
  let min = n.minor + 1;
  if (min > 99) {
    maj += 1;
    min = 0;
  }
  return { major: maj, minor: min };
}

const src = fs.readFileSync(versionPath, "utf8");
const m = src.match(/const APP = "([^"]+)"/);
if (!m) {
  console.error("js/version.js içinde APP bulunamadı");
  process.exit(1);
}

const args = process.argv.slice(2);
let nextStr;
const setIdx = args.indexOf("--set");
if (setIdx >= 0) {
  nextStr = args[setIdx + 1];
  if (!parseApp(nextStr)) {
    console.error("--set için major.minor bekleniyor (örn. 3.0)");
    process.exit(1);
  }
} else {
  const cur = parseApp(m[1]);
  if (!cur) {
    console.error("Geçersiz mevcut sürüm:", m[1]);
    process.exit(1);
  }
  const next = bump(cur.major, cur.minor);
  nextStr = formatApp(next.major, next.minor);
}

const out = src.replace(/const APP = "[^"]+"/, 'const APP = "' + nextStr + '"');
fs.writeFileSync(versionPath, out, "utf8");
console.log("Sürüm: " + m[1] + " → " + nextStr);

const sync = spawnSync(process.execPath, [path.join(__dirname, "sync-version.cjs")], {
  cwd: root,
  stdio: "inherit"
});
process.exit(sync.status || 0);
