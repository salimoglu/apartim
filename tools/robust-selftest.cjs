#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const kod = fs.readFileSync(path.join(__dirname, "..", "js", "robust.js"), "utf8");

const window = {
  APARTIM: {},
  addEventListener() {},
  removeEventListener() {}
};
const document = {
  readyState: "complete",
  visibilityState: "visible",
  addEventListener() {},
  getElementById() { return null; }
};

const context = {
  window,
  document,
  console,
  crypto: globalThis.crypto,
  TextEncoder: globalThis.TextEncoder,
  Date,
  Math,
  JSON,
  Object,
  Array,
  Set,
  Map,
  Promise,
  Number,
  String,
  Error,
  parseInt,
  isNaN,
  setTimeout,
  clearTimeout,
  indexedDB: undefined,
  localStorage: {
    getItem() { return null; },
    setItem() {}
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(kod, context);

const c = window.APARTIM.robust._cekirdek;
if (!c) {
  console.error("Çekirdek yüklenmedi");
  process.exit(1);
}

let hata = 0;
function esit(ad, kosul) {
  if (!kosul) {
    hata++;
    console.error("FAIL", ad);
  }
}

function ornekVeri(n) {
  const rezervasyonlar = {};
  for (let i = 0; i < n; i++) {
    rezervasyonlar["r" + i] = {
      id: "r" + i,
      ad: "Misafir " + i,
      giris: "2026-07-01",
      cikis: "2026-07-03",
      not: null
    };
  }
  return {
    daireler: { "oda-1": { id: "oda-1", ad: "1. Oda" } },
    rezervasyonlar,
    temizlikKayit: {},
    musteriKaynaklari: { booking: { id: "booking", ad: "Booking" } },
    kasaHarcama: {},
    dovizKurlari: { USD: 40, EUR: 43 }
  };
}

(async () => {
  const a = ornekVeri(2);
  const b = ornekVeri(2);
  b.rezervasyonlar = { "r1": b.rezervasyonlar.r1, "r0": b.rezervasyonlar.r0 };
  esit("kanon sıra bağımsız", c.kanon(a) === c.kanon(b));
  esit("null alan kanonu değiştirmez", c.kanon(a) === c.kanon({
    daireler: a.daireler,
    rezervasyonlar: {
      r0: { id: "r0", ad: "Misafir 0", giris: "2026-07-01", cikis: "2026-07-03" },
      r1: { id: "r1", ad: "Misafir 1", giris: "2026-07-01", cikis: "2026-07-03" }
    },
    temizlikKayit: {},
    musteriKaynaklari: a.musteriKaynaklari,
    kasaHarcama: {},
    dovizKurlari: a.dovizKurlari
  }));

  const p1 = await c.parmakUret(a);
  const p2 = await c.parmakUret(ornekVeri(3));
  esit("parmak değişince değişir", p1.parmak !== p2.parmak && p1.algoritma === "sha256");

  const zarf = {
    format: c.FORMAT,
    surum: c.SURUM,
    algoritma: p1.algoritma,
    parmak: p1.parmak,
    veri: a
  };
  const dogru = await c.zarfDogrula(zarf);
  esit("sağlam zarf", dogru.ok === true);

  const bozuk = JSON.parse(JSON.stringify(zarf));
  bozuk.veri.rezervasyonlar.r0.ad = "Başkası";
  const bozukSonuc = await c.zarfDogrula(bozuk);
  esit("oynanmış yedek reddedilir", bozukSonuc.ok === false);

  const proto = JSON.parse(JSON.stringify(zarf));
  proto.veri.rezervasyonlar = JSON.parse(
    '{"__proto__":{"id":"x"},"r0":' + JSON.stringify(proto.veri.rezervasyonlar.r0) +
    ',"r1":' + JSON.stringify(proto.veri.rezervasyonlar.r1) + "}"
  );
  const protoParmak = await c.parmakUret(proto.veri);
  proto.parmak = protoParmak.parmak;
  proto.algoritma = protoParmak.algoritma;
  const protoSonuc = await c.zarfDogrula(proto);
  esit("proto anahtarı reddedilir", protoSonuc.ok === false && /güvenli olmayan/.test(protoSonuc.hata || ""));

  const kotuAnahtar = JSON.parse(JSON.stringify(zarf));
  kotuAnahtar.veri.daireler["oda/1"] = { id: "oda/1" };
  const kotuParmak = await c.parmakUret(kotuAnahtar.veri);
  kotuAnahtar.parmak = kotuParmak.parmak;
  kotuAnahtar.algoritma = kotuParmak.algoritma;
  const kotuSonuc = await c.zarfDogrula(kotuAnahtar);
  esit("firebase anahtarı reddedilir", kotuSonuc.ok === false && /anahtar/.test(kotuSonuc.hata || ""));

  const yabanci = await c.zarfDogrula({ format: "baska", surum: 1, veri: {} });
  esit("yabancı format", yabanci.ok === false);

  esit("küçük düşüş şüpheli değil", c.supheliMi({ rezervasyon: 10, daire: 5, kasa: 2 }, { rezervasyon: 9, daire: 5, kasa: 2 }) === false);
  esit("büyük düşüş şüpheli", c.supheliMi({ rezervasyon: 20, daire: 5, kasa: 4 }, { rezervasyon: 4, daire: 5, kasa: 4 }) === true);
  esit("oda sıfırlanırsa şüpheli", c.supheliMi({ rezervasyon: 1, daire: 5, kasa: 0 }, { rezervasyon: 1, daire: 0, kasa: 0 }) === true);
  esit("kasa erimesi şüpheli", c.supheliMi({ rezervasyon: 6, daire: 5, kasa: 10 }, { rezervasyon: 5, daire: 5, kasa: 1 }) === true);

  const simdi = Date.parse("2026-09-27T12:00:00Z");
  esit("aynı parmak atlanır", c.cekimKarari({
    sebep: "otomatik", parmak: "aaa", metaParmak: "aaa", metaZaman: simdi - 60000, simdi
  }) === "atla");
  esit("parmak değişince yazılır", c.cekimKarari({
    sebep: "otomatik", parmak: "bbb", metaParmak: "aaa", metaZaman: simdi - 60000, simdi
  }) === "yaz");
  esit("nabız yazılır", c.cekimKarari({
    sebep: "otomatik", parmak: "aaa", metaParmak: "aaa", metaZaman: simdi - 21 * 3600000, simdi
  }) === "yaz");
  esit("manuel her zaman yazılır", c.cekimKarari({
    sebep: "manuel", parmak: "aaa", metaParmak: "aaa", metaZaman: simdi, simdi
  }) === "yaz");
  esit("sezon temizliği zorlanır", c.cekimKarari({
    sebep: "sezon-temizle", parmak: "aaa", metaParmak: "aaa", metaZaman: simdi, simdi
  }) === "yaz");

  esit("şüpheli otomatik buluta gitmez", c.bulutKarari({
    sebep: "otomatik", supheli: true, parmak: "b", sonBulutParmak: "a", sonBulutZaman: 0, simdi
  }) === false);
  esit("kritik şüpheli olsa da buluta gider", c.bulutKarari({
    sebep: "sezon-temizle", supheli: true, parmak: "b", sonBulutParmak: "a", sonBulutZaman: simdi, simdi
  }) === true);
  esit("bulut kısa aralıkta kısılır", c.bulutKarari({
    sebep: "otomatik", supheli: false, parmak: "b", sonBulutParmak: "a", sonBulutZaman: simdi - 10000, simdi
  }) === false);
  esit("kapanışta yeni parmak buluta gider", c.bulutKarari({
    sebep: "gorunurluk", supheli: false, parmak: "b", sonBulutParmak: "a", sonBulutZaman: simdi - 10000, simdi
  }) === true);

  const eskiKoruma = {
    olusturulma: new Date(simdi - 86400000).toISOString(),
    ozet: { rezervasyon: 12, daire: 5, kasa: 3 },
    veri: {}
  };
  const dahaZengin = { olusturulma: new Date(simdi).toISOString(), ozet: { rezervasyon: 13, daire: 5, kasa: 3 }, veri: {} };
  const dahaFakir = { olusturulma: new Date(simdi).toISOString(), ozet: { rezervasyon: 4, daire: 5, kasa: 3 }, veri: {} };
  esit("koruma zenginle güncellenir", c.korumaGuncellenmeli(eskiKoruma, dahaZengin) === true);
  esit("koruma fakirle ezilmez", c.korumaGuncellenmeli(eskiKoruma, dahaFakir) === false);

  const kayitlar = [];
  for (let i = 0; i < 20; i++) {
    kayitlar.push({
      id: "oto-" + i,
      sebep: "otomatik",
      zaman: simdi - i * 86400000,
      supheli: i === 3
    });
  }
  kayitlar.push({ id: "eski-kritik", sebep: "sezon-temizle", zaman: simdi - 10 * 86400000 });
  kayitlar.push({ id: "cok-eski-kritik", sebep: "excel-aktar", zaman: simdi - 200 * 86400000 });
  kayitlar.push({ id: "koruma", sebep: "otomatik", zaman: simdi, korumaSlot: true });
  kayitlar.push({ id: "oto-50", sebep: "otomatik", zaman: simdi - 50 * 86400000 });
  kayitlar.push({ id: "manuel-1", sebep: "manuel", zaman: simdi - 1000 });
  const sil = new Set(c.budamaKarar(kayitlar, simdi));
  esit("koruma budanmaz", !sil.has("koruma"));
  esit("taze kritik kalır", !sil.has("eski-kritik"));
  esit("süresi geçen kritik düşer", sil.has("cok-eski-kritik"));
  esit("manuel kalır", !sil.has("manuel-1"));
  esit("en yeni otomatik kalır", !sil.has("oto-0"));
  esit("45 günü aşan otomatik düşer", sil.has("oto-50"));
  esit("19 günlük kopya kalır", !sil.has("oto-19"));

  const supheliGun = [
    { id: "iyi", sebep: "otomatik", zaman: simdi - 3600000, supheli: false },
    { id: "kotu", sebep: "otomatik", zaman: simdi, supheli: true }
  ];
  const silGun = new Set(c.budamaKarar(supheliGun, simdi));
  esit("aynı gün şüpheli de taze 12 içinde kalabilir", !silGun.has("kotu") && !silGun.has("iyi"));

  if (hata) {
    console.error(hata + " test başarısız");
    process.exit(1);
  }
  console.log("Robust self-test OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
