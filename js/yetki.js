/* =========================================================
   APARTIM — Otel üyeliği ve yetki
   Sahip her şeyi görür. Personelin görebilir / yapabilir
   listesi otel sahibi tarafından değiştirilir.
   ========================================================= */

(function () {
  "use strict";

  const GOREBILIR = [
    { id: "rezervasyonlar", etiket: "Rezervasyonlar", sekme: "rezervasyonlar" },
    { id: "tahsilat", etiket: "Tahsilat", sekme: "tahsilat" },
    { id: "odalar", etiket: "Odalar", sekme: "bina" },
    { id: "rapor", etiket: "Rapor", sekme: "rapor" },
    { id: "kasa", etiket: "Kasa", sekme: "kasa" }
  ];

  const YAPABILIR = [
    { id: "rezervasyonYaz", etiket: "Rezervasyon ekle, düzenle, sil", bagli: "rezervasyonlar" },
    { id: "tahsilatYaz", etiket: "Tahsilat kaydet", bagli: "tahsilat" },
    { id: "odaDuzenle", etiket: "Oda tanımı ve ücret", bagli: "odalar" },
    { id: "kasaYaz", etiket: "Kasa kaydı", bagli: "kasa" },
    { id: "kaynaklar", etiket: "Müşteri kaynakları" },
    { id: "odemeKalemleri", etiket: "Tahsilat kalemleri" },
    { id: "doviz", etiket: "Döviz kurları" }
  ];

  const KALIPLAR = [
    {
      id: "resepsiyon",
      ad: "Resepsiyon",
      gorebilir: { rezervasyonlar: true, tahsilat: true, odalar: true },
      yapabilir: { rezervasyonYaz: true, tahsilatYaz: true }
    },
    {
      id: "kasa",
      ad: "Kasa dahil",
      gorebilir: { rezervasyonlar: true, tahsilat: true, odalar: true, rapor: true, kasa: true },
      yapabilir: { rezervasyonYaz: true, tahsilatYaz: true, kasaYaz: true }
    },
    {
      id: "odalar",
      ad: "Yalnız odalar",
      gorebilir: { odalar: true },
      yapabilir: {}
    },
    {
      id: "tam",
      ad: "Tüm personel yetkileri",
      gorebilir: { rezervasyonlar: true, tahsilat: true, odalar: true, rapor: true, kasa: true },
      yapabilir: {
        rezervasyonYaz: true,
        tahsilatYaz: true,
        odaDuzenle: true,
        kasaYaz: true,
        kaynaklar: true,
        odemeKalemleri: true,
        doviz: true
      }
    }
  ];

  const SEKME_ANAHTAR = {
    rezervasyonlar: "rezervasyonlar",
    tahsilat: "tahsilat",
    bina: "odalar",
    rapor: "rapor",
    kasa: "kasa"
  };

  let model = "bekliyor";
  let sahip = false;
  let gore = {};
  let yap = {};

  function bayrakKopya(kaynak) {
    const gorebilir = {};
    const yapabilir = {};
    GOREBILIR.forEach((t) => {
      gorebilir[t.id] = !!(kaynak && kaynak.gorebilir && kaynak.gorebilir[t.id]);
    });
    YAPABILIR.forEach((t) => {
      yapabilir[t.id] = !!(kaynak && kaynak.yapabilir && kaynak.yapabilir[t.id]);
    });
    return { gorebilir, yapabilir };
  }

  function sahipKaydi(kullanici) {
    const dolu = { gorebilir: {}, yapabilir: {} };
    GOREBILIR.forEach((t) => { dolu.gorebilir[t.id] = true; });
    YAPABILIR.forEach((t) => { dolu.yapabilir[t.id] = true; });
    const ad = String((kullanici && (kullanici.ad || kullanici.kullaniciAdi)) || "Sahip").trim().slice(0, 80) || "Sahip";
    return { rol: "sahip", ad, gorebilir: dolu.gorebilir, yapabilir: dolu.yapabilir };
  }

  function acikModel() {
    return model === "yerel" || model === "eski";
  }

  function sahipMi() {
    if (acikModel()) return true;
    return sahip;
  }

  function gorebilir(anahtar) {
    if (acikModel()) return true;
    if (model !== "otel") return false;
    if (sahip) return true;
    return !!gore[anahtar];
  }

  function yazabilir(anahtar) {
    if (acikModel()) return true;
    if (model !== "otel") return false;
    if (sahip) return true;
    return !!yap[anahtar];
  }

  function sekmeAcikMi(tab) {
    const anahtar = SEKME_ANAHTAR[tab];
    if (!anahtar) return false;
    return gorebilir(anahtar);
  }

  function ilkSekme() {
    const sira = ["rezervasyonlar", "tahsilat", "bina", "rapor", "kasa"];
    for (let i = 0; i < sira.length; i++) {
      if (sekmeAcikMi(sira[i])) return sira[i];
    }
    return "";
  }

  function ozet() {
    return JSON.stringify({ model, sahip, gore, yap });
  }

  function htmlSiniflari() {
    const kok = document.documentElement;
    kok.classList.toggle("yetki-otel", model === "otel");
    kok.classList.toggle("yetki-sahip", model === "otel" && sahip);
    kok.classList.toggle("yetki-bekleniyor", model === "bekliyor");
    GOREBILIR.forEach((t) => {
      kok.classList.toggle("yetki-gore-" + t.id, gorebilir(t.id));
    });
    YAPABILIR.forEach((t) => {
      kok.classList.toggle("yetki-yaz-" + t.id, yazabilir(t.id));
    });
    kok.classList.toggle(
      "yetki-odeme-yaz",
      yazabilir("tahsilatYaz") || yazabilir("rezervasyonYaz")
    );
  }

  function ekranUygula() {
    htmlSiniflari();
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("hidden", !sekmeAcikMi(btn.dataset.tab));
    });
    const ayar = [
      ["ayar-kaynaklar", () => yazabilir("kaynaklar")],
      ["ayar-daireler", () => yazabilir("odaDuzenle")],
      ["ayar-odeme-yontemleri", () => yazabilir("odemeKalemleri")],
      ["ayar-doviz", () => yazabilir("doviz")],
      ["ayar-robust", () => sahipMi()],
      ["ayar-personel", () => model === "otel" && sahip]
    ];
    ayar.forEach((cift) => {
      const el = document.getElementById(cift[0]);
      if (el) el.classList.toggle("hidden", !cift[1]());
    });
    const ucret = document.getElementById("daire-ucret-inp");
    if (ucret) ucret.disabled = !yazabilir("odaDuzenle");
    document.dispatchEvent(new CustomEvent("apartim:yetki-degisti"));
  }

  function uygula(uye, yeniModel) {
    model = yeniModel || "otel";
    if (model === "yerel" || model === "eski") {
      sahip = true;
      gore = {};
      yap = {};
      GOREBILIR.forEach((t) => { gore[t.id] = true; });
      YAPABILIR.forEach((t) => { yap[t.id] = true; });
    } else if (!uye) {
      sahip = false;
      gore = {};
      yap = {};
    } else {
      sahip = uye.rol === "sahip";
      const kopya = bayrakKopya(uye);
      gore = kopya.gorebilir;
      yap = kopya.yapabilir;
    }
    ekranUygula();
  }

  function beklet() {
    model = "bekliyor";
    sahip = false;
    gore = {};
    yap = {};
    ekranUygula();
  }

  function sifirla() {
    model = "bekliyor";
    sahip = false;
    gore = {};
    yap = {};
    kapiGoster("gizli");
    htmlSiniflari();
    document.documentElement.classList.remove("yetki-bekleniyor");
  }

  function kapiGoster(mod, mesaj) {
    const kapi = document.getElementById("otel-kapisi");
    if (!kapi) return;
    const secim = document.getElementById("otel-kapisi-secim");
    const baslik = document.getElementById("otel-kapisi-baslik");
    const metin = document.getElementById("otel-kapisi-metin");
    const hata = document.getElementById("otel-kapisi-hata");
    if (mod === "gizli") {
      kapi.classList.add("hidden");
      if (hata) hata.textContent = "";
      return;
    }
    kapi.classList.remove("hidden");
    if (hata) hata.textContent = "";
    if (mod === "red") {
      if (secim) secim.classList.add("hidden");
      if (baslik) baslik.textContent = "Erişim yok";
      if (metin) metin.textContent = mesaj || "Bu otele erişiminiz kaldırılmış.";
      return;
    }
    if (secim) secim.classList.remove("hidden");
    if (baslik) baslik.textContent = "Otele bağlan";
    if (metin) {
      metin.textContent = "Personelseniz davet kodunu girin. Otel sahibiyseniz kendi otelinizi açın.";
    }
    if (hata && mesaj) hata.textContent = mesaj;
  }

  function kapiBagla() {
    document.getElementById("otel-kapisi-cikis")?.addEventListener("click", () => {
      window.APARTIM.cikis?.();
    });
    document.getElementById("otel-kapisi-ac")?.addEventListener("click", async () => {
      const hata = document.getElementById("otel-kapisi-hata");
      const btn = document.getElementById("otel-kapisi-ac");
      if (btn) btn.disabled = true;
      if (hata) hata.textContent = "";
      try {
        await window.APARTIM.db?.otelKendinAc?.();
      } catch (err) {
        if (hata) hata.textContent = err.message || "Otel açılamadı.";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    document.getElementById("otel-kapisi-katil")?.addEventListener("click", async () => {
      const hata = document.getElementById("otel-kapisi-hata");
      const btn = document.getElementById("otel-kapisi-katil");
      const kod = document.getElementById("otel-kapisi-kod")?.value || "";
      if (btn) btn.disabled = true;
      if (hata) hata.textContent = "";
      try {
        await window.APARTIM.db?.otelDavetle?.(kod);
      } catch (err) {
        if (hata) hata.textContent = err.message || "Otele katılınamadı.";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    document.getElementById("otel-kapisi-kod")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("otel-kapisi-katil")?.click();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kapiBagla, { once: true });
  } else {
    kapiBagla();
  }

  window.APARTIM = window.APARTIM || {};
  window.APARTIM.yetki = {
    GOREBILIR,
    YAPABILIR,
    KALIPLAR,
    bayrakKopya,
    sahipKaydi,
    sahipMi,
    gorebilir,
    yazabilir,
    sekmeAcikMi,
    ilkSekme,
    ozet,
    uygula,
    beklet,
    sifirla,
    kapiGoster,
    ekranUygula,
    model: () => model
  };
})();
