#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ICONS = path.join(ROOT, "icons");
const SRC = path.join(ICONS, "app-icon-source.png");
const SIZES = [48, 180, 192, 256, 512];
const CROP_PAD = 28;

async function loadSharp() {
  try {
    return require(path.join(__dirname, "node_modules", "sharp"));
  } catch {
    return require("sharp");
  }
}

/** Mavi ev piksellerinden kare kırpma alanı hesapla */
async function cropRegion(sharp, srcPath) {
  const { data, info } = await sharp(srcPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (b > r + 15 && b > g + 10 && b > 100) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error("Ev pikselleri bulunamadı; kaynak görseli kontrol edin.");
  }

  const size = Math.max(maxX - minX + CROP_PAD * 2, maxY - minY + CROP_PAD * 2);
  const left = Math.max(0, Math.round((minX + maxX) / 2 - size / 2));
  const top = Math.max(0, Math.round((minY + maxY) / 2 - size / 2));
  const cropSize = Math.min(size, width - left, height - top);

  return { left, top, size: cropSize };
}

async function main() {
  let sharp;
  try {
    sharp = await loadSharp();
  } catch {
    console.error("sharp yüklü değil. Çalıştırın: npm install --prefix tools sharp");
    process.exit(1);
  }

  if (!fs.existsSync(SRC)) {
    console.error("Kaynak bulunamadı:", SRC);
    console.error("app-icon-source.png dosyasını icons/ klasörüne koyun.");
    process.exit(1);
  }

  const crop = await cropRegion(sharp, SRC);
  console.log("Kırpma:", crop);

  const base = sharp(SRC).extract({
    left: crop.left,
    top: crop.top,
    width: crop.size,
    height: crop.size
  });

  for (const size of SIZES) {
    const out = path.join(ICONS, size === 48 ? "favicon-48.png" : `icon-${size}.png`);
    await base
      .clone()
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
