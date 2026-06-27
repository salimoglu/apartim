#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ICONS = path.join(ROOT, "icons");
const SRC = path.join(ICONS, "app-icon.svg");
const SIZES = [48, 180, 192, 256, 512];

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.error("sharp yüklü değil. Çalıştırın: npm install --prefix tools sharp");
    process.exit(1);
  }

  if (!fs.existsSync(SRC)) {
    console.error("Kaynak bulunamadı:", SRC);
    process.exit(1);
  }

  const svg = fs.readFileSync(SRC);

  for (const size of SIZES) {
    const out = path.join(ICONS, size === 48 ? "favicon-48.png" : `icon-${size}.png`);
    await sharp(svg, { density: Math.max(192, size * 2) })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log("OK", path.basename(out), size + "x" + size);
  }

  fs.copyFileSync(path.join(ICONS, "icon-512.png"), path.join(ICONS, "logo-ev.png"));
  fs.copyFileSync(path.join(ICONS, "favicon-48.png"), path.join(ICONS, "favicon.ico"));
  console.log("logo-ev.png ve favicon.ico güncellendi.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
