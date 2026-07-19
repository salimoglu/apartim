/* =========================================================
   APARTIM — Ayarlar (müşteri kaynakları, daire isimleri)
   ========================================================= */

(function () {
  "use strict";

  const modalKaynak = () => document.getElementById("modal-kaynaklar");
  const modalDaire = () => document.getElementById("modal-daireler");

  function uyari(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!msg) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.classList.remove("hidden");
    el.textContent = msg;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  // ---- Müşteri kaynakları ----
  let seciliKaynakSimge = "🏷️";

  function simgePaletiRender() {
    const wrap = document.getElementById("kaynak-simge-sec");
    if (!wrap) return;
    const simgeler = window.APARTIM.db.KATEGORI_SIMGELER || ["🏷️"];
    wrap.innerHTML = "";
    simgeler.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kaynak-simge-btn" + (s === seciliKaynakSimge ? " active" : "");
      btn.textContent = s;
      btn.title = "Simge seç";
      btn.addEventListener("click", () => {
        seciliKaynakSimge = s;
        simgePaletiRender();
      });
      wrap.appendChild(btn);
    });
  }

  function kaynakListeRender() {
    const ul = document.getElementById("kaynak-liste");
    if (!ul) return;
    const liste = window.APARTIM.db.musteriKaynaklariListele();
    ul.innerHTML = "";
    liste.forEach((k) => {
      const li = document.createElement("li");
      li.className = "kaynak-item" + (k.sistem ? " kaynak-item-sistem" : "");
      li.innerHTML =
        '<span class="kaynak-simge">' + esc(k.simge || "🏷️") + '</span>' +
        '<span class="kaynak-ad">' + esc(k.ad) + '</span>' +
        (k.sistem ? '<span class="kaynak-etiket">Varsayılan</span>' : "") +
        (k.sistem ? "" : '<button type="button" class="kaynak-sil-btn" data-id="' + esc(k.id) + '">Sil</button>');
      if (!k.sistem) {
        li.querySelector(".kaynak-sil-btn").addEventListener("click", () => kaynakSil(k.id));
      }
      ul.appendChild(li);
    });
  }

  function kaynakAc() {
    uyari("kaynak-uyari", "");
    seciliKaynakSimge = "🏷️";
    simgePaletiRender();
    kaynakListeRender();
    modalKaynak()?.classList.remove("hidden");
    document.getElementById("kaynak-yeni-ad")?.focus();
  }

  function kaynakKapat() {
    modalKaynak()?.classList.add("hidden");
    uyari("kaynak-uyari", "");
    const inp = document.getElementById("kaynak-yeni-ad");
    if (inp) inp.value = "";
  }

  async function kaynakEkle() {
    const inp = document.getElementById("kaynak-yeni-ad");
    const ad = inp?.value.trim();
    if (!ad) {
      uyari("kaynak-uyari", "Kategori adı yazın.");
      return;
    }
    try {
      await window.APARTIM.db.musteriKaynagiEkle(ad, seciliKaynakSimge);
      if (inp) inp.value = "";
      uyari("kaynak-uyari", "");
      kaynakListeRender();
      window.APARTIM.toast("Kategori eklendi", "basari");
    } catch (err) {
      uyari("kaynak-uyari", err.message || "Eklenemedi.");
    }
  }

  async function kaynakSil(id) {
    if (!confirm("Bu kategoriyi silmek istiyor musunuz?")) return;
    try {
      await window.APARTIM.db.musteriKaynagiSil(id);
      kaynakListeRender();
      window.APARTIM.toast("Kategori silindi", "basari");
    } catch (err) {
      uyari("kaynak-uyari", err.message || "Silinemedi.");
    }
  }

  // ---- Odalar (ekle + isim değiştir) ----
  function daireKatEtiket(d) {
    if (d.sira) return "Oda " + d.sira;
    return d.id || "";
  }

  function daireEkranYenile() {
    window.APARTIM.bina?.ciz?.();
    window.APARTIM.rezOzet?.tabloCizPlanla?.();
    window.APARTIM.temizlik?.ciz?.();
  }

  function daireListeRender() {
    const ul = document.getElementById("daire-ayar-liste");
    if (!ul) return;
    const liste = window.APARTIM.db.dairelerListele();
    ul.innerHTML = "";
    liste.forEach((d) => {
      const li = document.createElement("li");
      li.className = "daire-ayar-item";
      const etiket = daireKatEtiket(d);
      li.innerHTML =
        '<span class="daire-ayar-kat">' + esc(etiket) + "</span>" +
        '<input type="text" class="field-input daire-ayar-ad" data-id="' + esc(d.id) + '" ' +
        'value="' + esc(d.ad) + '" maxlength="40" aria-label="' + esc(etiket) + ' adı" />' +
        '<button type="button" class="daire-sil-btn" data-id="' + esc(d.id) + '" title="Sil" aria-label="Sil">×</button>';
      li.querySelector(".daire-sil-btn")?.addEventListener("click", () => daireSil(d.id));
      ul.appendChild(li);
    });
  }

  function daireAc() {
    uyari("daire-uyari", "");
    const inp = document.getElementById("daire-yeni-ad");
    if (inp) inp.value = "";
    daireListeRender();
    modalDaire()?.classList.remove("hidden");
    modalDaire()?.querySelector(".daire-ayar-ad")?.focus();
  }

  function daireKapat() {
    modalDaire()?.classList.add("hidden");
    uyari("daire-uyari", "");
    const inp = document.getElementById("daire-yeni-ad");
    if (inp) inp.value = "";
  }

  async function daireEkle() {
    const inp = document.getElementById("daire-yeni-ad");
    const ad = inp?.value.trim();
    if (!ad) {
      uyari("daire-uyari", "Yeni oda adı yazın.");
      return;
    }
    uyari("daire-uyari", "");
    try {
      await window.APARTIM.db.daireEkle(ad);
      if (inp) inp.value = "";
      daireListeRender();
      daireEkranYenile();
      window.APARTIM.toast("Oda eklendi", "basari");
      inp?.focus();
    } catch (err) {
      uyari("daire-uyari", err.message || "Eklenemedi.");
    }
  }

  async function daireSil(id) {
    if (!confirm("Bu odayı silmek istiyor musunuz?")) return;
    uyari("daire-uyari", "");
    try {
      await window.APARTIM.db.daireSil(id);
      daireListeRender();
      daireEkranYenile();
      window.APARTIM.toast("Oda silindi", "basari");
    } catch (err) {
      uyari("daire-uyari", err.message || "Silinemedi.");
    }
  }

  async function daireKaydet() {
    const inputs = modalDaire()?.querySelectorAll(".daire-ayar-ad");
    if (!inputs || !inputs.length) return;
    uyari("daire-uyari", "");
    const adlar = [];
    try {
      for (const inp of inputs) {
        const id = inp.dataset.id;
        const ad = inp.value.trim();
        if (!ad) {
          uyari("daire-uyari", "Tüm odaların adı dolu olmalı.");
          return;
        }
        const ayni = adlar.find((x) => x.toLocaleLowerCase("tr") === ad.toLocaleLowerCase("tr"));
        if (ayni) {
          uyari("daire-uyari", "Aynı isimde birden fazla oda olamaz.");
          return;
        }
        adlar.push(ad);
        const mevcut = window.APARTIM.db.daireGetir(id);
        if (mevcut && mevcut.ad !== ad) {
          await window.APARTIM.db.daireGuncelle(id, { ad });
        }
      }
      daireEkranYenile();
      window.APARTIM.toast("Oda isimleri kaydedildi", "basari");
      daireKapat();
    } catch (err) {
      uyari("daire-uyari", err.message || "Kaydedilemedi.");
    }
  }

  // ---- Döviz kurları ----
  const modalDoviz = () => document.getElementById("modal-doviz");

  function dovizSonGuncellemeGoster() {
    const el = document.getElementById("doviz-son-guncelleme");
    if (!el) return;
    const meta = window.APARTIM.para?.kurMetaGetir();
    if (meta?.guncelleme) {
      el.textContent = "Son güncelleme: " + window.APARTIM.para.formatKurTarihi(meta.guncelleme);
    } else {
      el.textContent = "Kurlar uygulama açılışında otomatik güncellenir.";
    }
  }

  function dovizAc() {
    uyari("doviz-uyari", "");
    const k = window.APARTIM.para?.kurlariGetir() || { USD: 46.5 };
    const usd = document.getElementById("doviz-usd");
    if (usd) usd.value = k.USD;
    dovizSonGuncellemeGoster();
    modalDoviz()?.classList.remove("hidden");
    usd?.focus();
  }

  function dovizKapat() {
    modalDoviz()?.classList.add("hidden");
    uyari("doviz-uyari", "");
  }

  async function dovizCanliCek() {
    const btn = document.getElementById("doviz-canli");
    uyari("doviz-uyari", "");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Alınıyor…";
    }
    try {
      const live = await window.APARTIM.app?.dovizKurlariCanliGuncelle(true);
      if (!live) throw new Error("Kurlar alınamadı.");
      const usd = document.getElementById("doviz-usd");
      if (usd) usd.value = live.USD;
      dovizSonGuncellemeGoster();
      window.APARTIM.toast("Güncel kurlar yüklendi", "basari");
    } catch (err) {
      uyari("doviz-uyari", err.message || "Kurlar alınamadı.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Güncel kurları getir";
      }
    }
  }

  async function dovizKaydet() {
    const usd = Number(document.getElementById("doviz-usd")?.value);
    if (!usd || usd <= 0) {
      uyari("doviz-uyari", "Geçerli USD kuru girin.");
      return;
    }
    try {
      const mevcut = window.APARTIM.para?.kurlariGetir() || {};
      await window.APARTIM.db.dovizKurlariKaydet({
        USD: usd,
        EUR: Number(mevcut.EUR) > 0 ? Number(mevcut.EUR) : 50.5,
        guncelleme: new Date().toISOString(),
        kaynak: "manuel"
      });
      window.APARTIM.toast("Döviz kurları kaydedildi", "basari");
      dovizKapat();
      window.APARTIM.rezOzet?.tabloCizPlanla?.();
    } catch (err) {
      uyari("doviz-uyari", err.message || "Kaydedilemedi.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ayar-kaynaklar")?.addEventListener("click", () => {
      document.getElementById("ayar-menu")?.classList.add("hidden");
      kaynakAc();
    });
    document.getElementById("kaynaklar-close")?.addEventListener("click", kaynakKapat);
    document.getElementById("kaynaklar-kapat")?.addEventListener("click", kaynakKapat);
    document.getElementById("kaynak-ekle-btn")?.addEventListener("click", kaynakEkle);
    document.getElementById("kaynak-yeni-ad")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        kaynakEkle();
      }
    });

    document.getElementById("ayar-daireler")?.addEventListener("click", () => {
      document.getElementById("ayar-menu")?.classList.add("hidden");
      daireAc();
    });
    document.getElementById("daireler-close")?.addEventListener("click", daireKapat);
    document.getElementById("daireler-kapat")?.addEventListener("click", daireKapat);
    document.getElementById("daireler-kaydet")?.addEventListener("click", daireKaydet);
    document.getElementById("daire-ekle-btn")?.addEventListener("click", daireEkle);
    document.getElementById("daire-yeni-ad")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        daireEkle();
      }
    });

    document.getElementById("ayar-doviz")?.addEventListener("click", () => {
      document.getElementById("ayar-menu")?.classList.add("hidden");
      dovizAc();
    });
    document.getElementById("doviz-close")?.addEventListener("click", dovizKapat);
    document.getElementById("doviz-kapat")?.addEventListener("click", dovizKapat);
    document.getElementById("doviz-kaydet")?.addEventListener("click", dovizKaydet);
    document.getElementById("doviz-canli")?.addEventListener("click", dovizCanliCek);
  });

  document.addEventListener("apartim:veri-degisti", (e) => {
    if (e.detail?.sebep === "musteri-kaynaklari" && modalKaynak() && !modalKaynak().classList.contains("hidden")) {
      kaynakListeRender();
    }
    if (e.detail?.sebep === "daireler" && modalDaire() && !modalDaire().classList.contains("hidden")) {
      daireListeRender();
    }
  });

  window.APARTIM.ayarlar = { kaynakAc, kaynakKapat, daireAc, daireKapat, dovizAc, dovizKapat };
})();
