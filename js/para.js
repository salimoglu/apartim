/* =========================================================
   APARTIM — Para birimi (TL, USD, EUR) ve kur dönüşümü
   ========================================================= */

(function () {
  "use strict";

  const VARSAYILAN = { USD: 46.5, EUR: 50.5 };
  const CACHE_KEY = "apartim-kur-cache";
  const YENILEME_MS = 6 * 60 * 60 * 1000;

  let kurlar = Object.assign({}, VARSAYILAN);
  let kurMeta = { guncelleme: null, kaynak: null };

  function yuvarla(n) {
    return Math.round(Number(n) * 100) / 100;
  }

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

  function onbellekOku() {
    try {
      const ham = localStorage.getItem(CACHE_KEY);
      return ham ? JSON.parse(ham) : null;
    } catch (e) {
      return null;
    }
  }

  function onbellekYaz(val) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(val));
    } catch (e) { /* yoksay */ }
  }

  function kurlariYukle(val) {
    kurlar = {
      USD: Number(val?.USD) > 0 ? yuvarla(val.USD) : VARSAYILAN.USD,
      EUR: Number(val?.EUR) > 0 ? yuvarla(val.EUR) : VARSAYILAN.EUR
    };
    if (val?.guncelleme) kurMeta.guncelleme = val.guncelleme;
    if (val?.kaynak) kurMeta.kaynak = val.kaynak;
  }

  function kurlariGetir() {
    return { USD: kurlar.USD, EUR: kurlar.EUR };
  }

  function kurMetaGetir() {
    return Object.assign({}, kurMeta);
  }

  function kurTarihiYasMs(tarih) {
    if (!tarih) return Infinity;
    const t = new Date(tarih).getTime();
    return Number.isFinite(t) ? Date.now() - t : Infinity;
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

  function formatKur(miktar) {
    return yuvarla(miktar).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatKurTarihi(tarih) {
    if (!tarih) return "";
    const d = new Date(tarih);
    if (!Number.isFinite(d.getTime())) return String(tarih);
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
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

  async function fetchJson(url, ms) {
    const ctrl = new AbortController();
    const zaman = setTimeout(() => ctrl.abort(), ms || 10000);
    try {
      const yanit = await fetch(url, { signal: ctrl.signal });
      if (!yanit.ok) throw new Error("HTTP " + yanit.status);
      return await yanit.json();
    } finally {
      clearTimeout(zaman);
    }
  }

  async function kurlariErApiCek() {
    const [usd, eur] = await Promise.all([
      fetchJson("https://open.er-api.com/v6/latest/USD"),
      fetchJson("https://open.er-api.com/v6/latest/EUR")
    ]);
    const usdTry = usd?.rates?.TRY;
    const eurTry = eur?.rates?.TRY;
    if (!(usdTry > 0) || !(eurTry > 0)) throw new Error("er-api");
    return {
      USD: yuvarla(usdTry),
      EUR: yuvarla(eurTry),
      guncelleme: usd.time_last_update_utc || new Date().toISOString(),
      kaynak: "canli"
    };
  }

  async function kurlariFrankfurterCek() {
    const [usd, eur] = await Promise.all([
      fetchJson("https://api.frankfurter.app/latest?from=USD&to=TRY"),
      fetchJson("https://api.frankfurter.app/latest?from=EUR&to=TRY")
    ]);
    const usdTry = usd?.rates?.TRY;
    const eurTry = eur?.rates?.TRY;
    if (!(usdTry > 0) || !(eurTry > 0)) throw new Error("frankfurter");
    return {
      USD: yuvarla(usdTry),
      EUR: yuvarla(eurTry),
      guncelleme: usd.date ? usd.date + "T12:00:00.000Z" : new Date().toISOString(),
      kaynak: "frankfurter"
    };
  }

  async function kurlariCanliCek() {
    const hatalar = [];
    for (const fn of [kurlariErApiCek, kurlariFrankfurterCek]) {
      try {
        return await fn();
      } catch (err) {
        hatalar.push(err.message || "hata");
      }
    }
    throw new Error("Güncel kurlar alınamadı. İnternet bağlantınızı kontrol edin.");
  }

  async function kurlariOtomatikGuncelle(opts) {
    const zorla = opts?.zorla === true;
    const sonGuncelleme = opts?.sonGuncelleme || kurMeta.guncelleme;

    if (!zorla && kurTarihiYasMs(sonGuncelleme) < YENILEME_MS) {
      return Object.assign({ onbellek: true }, kurlariGetir(), kurMetaGetir());
    }

    try {
      const live = await kurlariCanliCek();
      kurlariYukle(live);
      onbellekYaz({
        USD: live.USD,
        EUR: live.EUR,
        guncelleme: live.guncelleme,
        kaynak: live.kaynak,
        ts: Date.now()
      });
      return live;
    } catch (err) {
      const cache = onbellekOku();
      if (cache?.USD > 0 && cache?.EUR > 0) {
        kurlariYukle(cache);
        return Object.assign({ onbellek: true, cevrimdisi: true }, kurlariGetir(), kurMetaGetir());
      }
      throw err;
    }
  }

  kurlariYukle(VARSAYILAN);

  window.APARTIM.para = {
    paraBirimiNorm,
    simge,
    kurlariYukle,
    kurlariGetir,
    kurMetaGetir,
    kurlariCanliCek,
    kurlariOtomatikGuncelle,
    tlKarsiligi,
    formatTutar,
    formatTutarKisa,
    formatKur,
    formatKurTarihi,
    rezParaBirimi,
    ayToplamlari,
    VARSAYILAN,
    YENILEME_MS
  };
})();
