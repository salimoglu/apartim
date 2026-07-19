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
    if (p === "USD") return "USD";
    /* EUR artık seçilmez; eski kayıtlar için dönüşümde tanınır */
    if (p === "EUR") return "EUR";
    return "TL";
  }

  /** Kullanıcı seçiminde yalnızca TL / USD */
  function paraBirimiSecimNorm(pb) {
    const p = paraBirimiNorm(pb);
    return p === "USD" ? "USD" : "TL";
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

  /** kurOverride: sayı (USD kuru) veya { USD, EUR } */
  function kurCift(kurOverride) {
    if (kurOverride && typeof kurOverride === "object") {
      return {
        USD: Number(kurOverride.USD) > 0 ? Number(kurOverride.USD) : kurlar.USD,
        EUR: Number(kurOverride.EUR) > 0 ? Number(kurOverride.EUR) : kurlar.EUR
      };
    }
    const usd = Number(kurOverride) > 0 ? Number(kurOverride) : kurlar.USD;
    return { USD: usd, EUR: kurlar.EUR };
  }

  function tlKarsiligi(miktar, pb, kurOverride) {
    const n = Number(miktar) || 0;
    const p = paraBirimiNorm(pb);
    if (p === "TL") return n;
    const k = kurCift(kurOverride);
    if (p === "USD") return n * k.USD;
    if (p === "EUR") return n * k.EUR;
    return n;
  }

  /** TL tutarını para birimine çevir (kurOverride: sayı veya { USD, EUR }) */
  function tlDenPb(miktarTl, pb, kurOverride) {
    const n = Number(miktarTl) || 0;
    const p = paraBirimiNorm(pb);
    if (p === "TL") return n;
    const k = kurCift(kurOverride);
    if (p === "USD") return k.USD > 0 ? n / k.USD : 0;
    if (p === "EUR") return k.EUR > 0 ? n / k.EUR : 0;
    return n;
  }

  /** Tahsilat satırı: TL + USD → TL toplam (kayıtlı kur varsa onu kullanır) */
  function tahsilatTlToplam(tutarTl, tutarUsd, kurUsdOverride) {
    const tl = Number(tutarTl) || 0;
    const usd = Number(tutarUsd) || 0;
    const kur = Number(kurUsdOverride) > 0 ? Number(kurUsdOverride) : kurlar.USD;
    return yuvarla(tl + usd * kur);
  }

  /** Para tutarları: virgülden sonra her zaman 2 basamak */
  function formatSayi(miktar) {
    return yuvarla(miktar || 0).toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatTutar(miktar, pb) {
    return formatSayi(miktar) + " " + simge(pb);
  }

  function formatTutarKisa(miktar, pb) {
    return formatSayi(miktar) + simge(pb);
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

  /** basISO dahil, bitISO hariç */
  function aralikToplamlari(db, basISO, bitISO) {
    const toplam = { TL: 0, USD: 0, EUR: 0 };
    let tlToplam = 0;

    Object.values(db.durum.rezervasyonlar || {}).forEach((rez) => {
      if (!rez) return;
      const k = db.rezAyKesisimGelir(rez, basISO, bitISO);
      if (k.gece <= 0) return;
      if (k.gelirPb) {
        toplam.TL += k.gelirPb.TL || 0;
        toplam.USD += k.gelirPb.USD || 0;
        toplam.EUR += k.gelirPb.EUR || 0;
        tlToplam += k.gelirTl != null ? k.gelirTl : k.gelir;
      } else {
        const pb = rezParaBirimi(rez);
        toplam[pb] += k.gelir;
        tlToplam += tlKarsiligi(k.gelir, pb);
      }
    });

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
    paraBirimiSecimNorm,
    simge,
    kurlariYukle,
    kurlariGetir,
    kurMetaGetir,
    kurlariOtomatikGuncelle,
    tlKarsiligi,
    tlDenPb,
    tahsilatTlToplam,
    formatTutar,
    formatTutarKisa,
    formatKur,
    formatKurTarihi,
    rezParaBirimi,
    aralikToplamlari,
    VARSAYILAN,
    YENILEME_MS
  };
})();
