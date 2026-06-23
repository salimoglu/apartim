/* =========================================================
   APARTIM — Para birimi (TL, USD, EUR) ve kur dönüşümü
   ========================================================= */

(function () {
  "use strict";

  const VARSAYILAN = { USD: 34, EUR: 37 };
  let kurlar = Object.assign({}, VARSAYILAN);

  function paraBirimiNorm(pb) {
    const p = String(pb || "TL").toUpperCase();
    if (p === "TRY" || p === "TL") return "TL";
    if (p === "USD" || p === "EUR") return p;
    return "TL";
  }

  function simge(pb) {
    const p = paraBirimiNorm(pb);
    if (p === "USD") return "$";
    if (p === "EUR") return "€";
    return "₺";
  }

  function kurlariYukle(val) {
    kurlar = {
      USD: Number(val?.USD) > 0 ? Number(val.USD) : VARSAYILAN.USD,
      EUR: Number(val?.EUR) > 0 ? Number(val.EUR) : VARSAYILAN.EUR
    };
  }

  function kurlariGetir() {
    return { USD: kurlar.USD, EUR: kurlar.EUR };
  }

  function tlKarsiligi(miktar, pb) {
    const n = Number(miktar) || 0;
    const p = paraBirimiNorm(pb);
    if (p === "USD") return n * kurlar.USD;
    if (p === "EUR") return n * kurlar.EUR;
    return n;
  }

  function formatTutar(miktar, pb) {
    return Number(miktar || 0).toLocaleString("tr-TR") + " " + simge(pb);
  }

  function formatTutarKisa(miktar, pb) {
    const n = Number(miktar || 0);
    const s = simge(pb);
    if (n >= 1000) return Math.round(n).toLocaleString("tr-TR") + s;
    return n.toLocaleString("tr-TR") + s;
  }

  function rezParaBirimi(rez) {
    return paraBirimiNorm(rez?.paraBirimi);
  }

  function ayToplamlari(db, yil, ay) {
    const pad = (n) => String(n).padStart(2, "0");
    const ayGun = new Date(yil, ay + 1, 0).getDate();
    const ayBas = yil + "-" + pad(ay + 1) + "-01";
    const ayBit = db.gunEkleISO(yil + "-" + pad(ay + 1) + "-" + pad(ayGun), 1);
    const toplam = { TL: 0, USD: 0, EUR: 0 };

    Object.values(db.durum.rezervasyonlar || {}).forEach((rez) => {
      if (!rez) return;
      const k = db.rezAyKesisimGelir(rez, ayBas, ayBit);
      if (k.gece <= 0) return;
      const pb = rezParaBirimi(rez);
      toplam[pb] += k.gelir;
    });

    const tlToplam = toplam.TL +
      tlKarsiligi(toplam.USD, "USD") +
      tlKarsiligi(toplam.EUR, "EUR");

    return { toplam, tlToplam };
  }

  kurlariYukle(VARSAYILAN);

  window.APARTIM.para = {
    paraBirimiNorm,
    simge,
    kurlariYukle,
    kurlariGetir,
    tlKarsiligi,
    formatTutar,
    formatTutarKisa,
    rezParaBirimi,
    ayToplamlari,
    VARSAYILAN
  };
})();
