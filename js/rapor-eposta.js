/* Apartım — Haftalık Pazar rapor e-postası ayarları */
(function () {
  "use strict";

  const modal = () => document.getElementById("modal-rapor-eposta");

  function uyari(msg) {
    const el = document.getElementById("rapor-eposta-uyari");
    if (!el) return;
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.classList.remove("hidden");
    el.textContent = msg;
  }

  function epostaGecerliMi(ep) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(ep || "").trim());
  }

  function varsayilanEposta() {
    const k = window.APARTIM.kullanici;
    if (k?.eposta && !k.eposta.endsWith("@users.apartim.app")) return k.eposta;
    return "";
  }

  async function formDoldur() {
    const inp = document.getElementById("rapor-eposta-adres");
    const chk = document.getElementById("rapor-eposta-aktif");
    if (!inp || !chk) return;
    uyari("");
    const db = window.APARTIM.db;
    let ayar = { raporEposta: "", raporPazarAktif: true };
    if (db?.profilRaporAyarOku) {
      ayar = await db.profilRaporAyarOku();
    }
    inp.value = ayar.raporEposta || varsayilanEposta();
    chk.checked = ayar.raporPazarAktif !== false;
  }

  function ac() {
    document.getElementById("ayar-menu")?.classList.add("hidden");
    formDoldur();
    modal()?.classList.remove("hidden");
    document.getElementById("rapor-eposta-adres")?.focus();
  }

  function kapat() {
    modal()?.classList.add("hidden");
    uyari("");
  }

  async function kaydet() {
    const inp = document.getElementById("rapor-eposta-adres");
    const chk = document.getElementById("rapor-eposta-aktif");
    const eposta = String(inp?.value || "").trim();
    const aktif = !!chk?.checked;

    if (aktif && !epostaGecerliMi(eposta)) {
      uyari("Geçerli bir e-posta adresi girin.");
      return;
    }

    const db = window.APARTIM.db;
    if (!db?.profilRaporAyarKaydet) {
      uyari("Bulut bağlantısı yok — ayar kaydedilemedi.");
      return;
    }

    try {
      await db.profilRaporAyarKaydet(eposta, aktif);
      window.APARTIM.toast?.("Rapor e-posta ayarı kaydedildi", "basari");
      kapat();
    } catch (err) {
      uyari("Kaydedilemedi. Tekrar deneyin.");
    }
  }

  async function testGonder() {
    const inp = document.getElementById("rapor-eposta-adres");
    const eposta = String(inp?.value || "").trim();
    if (!epostaGecerliMi(eposta)) {
      uyari("Önce geçerli bir e-posta adresi girin ve kaydedin.");
      return;
    }

    const fn = window.APARTIM.fbFunctions;
    if (!fn) {
      uyari("Bulut fonksiyonu hazır değil — sayfayı yenileyin.");
      return;
    }

    const btn = document.getElementById("rapor-eposta-test");
    if (btn) btn.disabled = true;
    uyari("Test raporu gönderiliyor…");

    try {
      await dbKaydetOnce(eposta);
      const callable = fn.httpsCallable("raporTestGonder");
      const sonuc = await callable({});
      window.APARTIM.toast?.(sonuc.data?.mesaj || "Test raporu gönderildi", "basari");
      uyari("");
    } catch (err) {
      const msg = err?.message || err?.details || "E-posta gönderilemedi";
      uyari(msg);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function dbKaydetOnce(eposta) {
    const chk = document.getElementById("rapor-eposta-aktif");
    await window.APARTIM.db.profilRaporAyarKaydet(eposta, !!chk?.checked);
  }

  function bagla() {
    document.getElementById("ayar-rapor-eposta")?.addEventListener("click", ac);
    document.getElementById("rapor-eposta-kapat")?.addEventListener("click", kapat);
    document.getElementById("rapor-eposta-iptal")?.addEventListener("click", kapat);
    document.getElementById("rapor-eposta-kaydet")?.addEventListener("click", kaydet);
    document.getElementById("rapor-eposta-test")?.addEventListener("click", testGonder);
  }

  document.addEventListener("DOMContentLoaded", bagla);
})();
