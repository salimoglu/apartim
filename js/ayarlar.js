/* =========================================================
   APARTIM — Ayarlar (müşteri kaynakları, daire isimleri, tahsilat kalemleri)
   ========================================================= */

(function () {
  "use strict";

  const modalKaynak = () => document.getElementById("modal-kaynaklar");
  const modalDaire = () => document.getElementById("modal-daireler");
  const modalOdemeYontem = () => document.getElementById("modal-odeme-yontemleri");

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

  function paletSimgeleri(ek) {
    const liste = (window.APARTIM.db.KATEGORI_SIMGELER || ["🏷️"]).slice();
    if (ek && liste.indexOf(ek) < 0) liste.unshift(ek);
    return liste;
  }

  function simgePaletiDoldur(wrap, secili, onSec) {
    if (!wrap) return;
    wrap.innerHTML = "";
    paletSimgeleri(secili).forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kaynak-simge-btn" + (s === secili ? " active" : "");
      btn.textContent = s;
      btn.title = "Simge seç";
      btn.addEventListener("click", () => onSec(s, btn));
      wrap.appendChild(btn);
    });
  }

  function simgePaletiRender() {
    const wrap = document.getElementById("kaynak-simge-sec");
    simgePaletiDoldur(wrap, seciliKaynakSimge, (s) => {
      seciliKaynakSimge = s;
      simgePaletiRender();
    });
  }

  function kaynakSatirPaletKapat() {
    document.querySelectorAll("#kaynak-liste .kaynak-satir-palet").forEach((p) => {
      p.classList.add("hidden");
      p.innerHTML = "";
    });
    document.querySelectorAll("#kaynak-liste .kaynak-simge-satir").forEach((b) => {
      b.setAttribute("aria-expanded", "false");
    });
  }

  function kaynakSatirKirliMi(simgeBtn, input) {
    const simge = simgeBtn?.dataset.simge || "🏷️";
    const ad = String(input?.value || "").trim();
    return simge !== (simgeBtn?.dataset.orijinal || "🏷️") || ad !== (input?.dataset.orijinal || "");
  }

  function kaynakSatirKirliIsaretle(simgeBtn, input, kaydetBtn) {
    kaydetBtn?.classList.toggle("dirty", kaynakSatirKirliMi(simgeBtn, input));
  }

  function kaynakListeRender() {
    const ul = document.getElementById("kaynak-liste");
    if (!ul) return;
    const liste = window.APARTIM.db.musteriKaynaklariListele();
    ul.innerHTML = "";
    liste.forEach((k) => {
      const li = document.createElement("li");
      li.className = "kaynak-item" + (k.sistem ? " kaynak-item-sistem" : "");
      const simge = k.simge || "🏷️";
      const ad = k.ad || "";

      const simgeBtn = document.createElement("button");
      simgeBtn.type = "button";
      simgeBtn.className = "kaynak-simge kaynak-simge-satir";
      simgeBtn.textContent = simge;
      simgeBtn.title = "Simgeyi değiştir";
      simgeBtn.setAttribute("aria-label", ad + " simgesi");
      simgeBtn.setAttribute("aria-expanded", "false");
      simgeBtn.dataset.simge = simge;
      simgeBtn.dataset.orijinal = simge;

      const input = document.createElement("input");
      input.type = "text";
      input.className = "field-input kaynak-ad-input";
      input.value = ad;
      input.maxLength = 40;
      input.setAttribute("aria-label", ad + " adı");
      input.dataset.orijinal = ad;

      const eylem = document.createElement("div");
      eylem.className = "kaynak-eylem";
      if (k.sistem) {
        const et = document.createElement("span");
        et.className = "kaynak-etiket";
        et.textContent = "Varsayılan";
        eylem.appendChild(et);
      }
      const kaydetBtn = document.createElement("button");
      kaydetBtn.type = "button";
      kaydetBtn.className = "kaynak-kaydet-btn";
      kaydetBtn.textContent = "Kaydet";
      kaydetBtn.addEventListener("click", () => kaynakGuncelle(k.id, input, simgeBtn));
      eylem.appendChild(kaydetBtn);
      if (!k.sistem) {
        const sil = document.createElement("button");
        sil.type = "button";
        sil.className = "kaynak-sil-btn";
        sil.textContent = "Sil";
        sil.addEventListener("click", () => kaynakSil(k.id));
        eylem.appendChild(sil);
      }

      const palet = document.createElement("div");
      palet.className = "kaynak-satir-palet hidden";

      simgeBtn.addEventListener("click", () => {
        const acik = simgeBtn.getAttribute("aria-expanded") === "true";
        kaynakSatirPaletKapat();
        if (acik) return;
        simgeBtn.setAttribute("aria-expanded", "true");
        palet.classList.remove("hidden");
        simgePaletiDoldur(palet, simgeBtn.dataset.simge || "🏷️", (s) => {
          simgeBtn.dataset.simge = s;
          simgeBtn.textContent = s;
          palet.querySelectorAll(".kaynak-simge-btn").forEach((b) => {
            b.classList.toggle("active", b.textContent === s);
          });
          kaynakSatirKirliIsaretle(simgeBtn, input, kaydetBtn);
        });
      });
      input.addEventListener("input", () => kaynakSatirKirliIsaretle(simgeBtn, input, kaydetBtn));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          kaynakGuncelle(k.id, input, simgeBtn);
        }
      });

      li.appendChild(simgeBtn);
      li.appendChild(input);
      li.appendChild(eylem);
      li.appendChild(palet);
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

  async function kaynakGuncelle(id, input, simgeBtn) {
    const ad = input?.value.trim();
    const simge = simgeBtn?.dataset.simge || "🏷️";
    if (!ad) {
      uyari("kaynak-uyari", "Kategori adı boş olamaz.");
      input?.focus();
      return;
    }
    if (!kaynakSatirKirliMi(simgeBtn, input)) {
      kaynakSatirPaletKapat();
      uyari("kaynak-uyari", "");
      return;
    }
    try {
      await window.APARTIM.db.musteriKaynagiGuncelle(id, { ad, simge });
      uyari("kaynak-uyari", "");
      kaynakListeRender();
      window.APARTIM.toast("Kategori güncellendi", "basari");
    } catch (err) {
      uyari("kaynak-uyari", err.message || "Kaydedilemedi.");
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
    if (d.sira) return String(d.sira);
    return "·";
  }

  function daireEkranYenile() {
    window.APARTIM.bina?.ciz?.();
    window.APARTIM.rezOzet?.tabloCizPlanla?.();
  }

  function daireListeRender() {
    const ul = document.getElementById("daire-ayar-liste");
    if (!ul) return;
    const liste = window.APARTIM.db.dairelerListele();
    ul.innerHTML = "";
    liste.forEach((d, i) => {
      const li = document.createElement("li");
      li.className = "daire-ayar-item";
      const no = daireKatEtiket(d) || String(i + 1);
      const aria = "Oda " + no;
      li.innerHTML =
        '<span class="daire-ayar-kat" title="' + esc(aria) + '">' + esc(no) + "</span>" +
        '<input type="text" class="field-input daire-ayar-ad" data-id="' + esc(d.id) + '" ' +
        'value="' + esc(d.ad) + '" maxlength="40" aria-label="' + esc(aria) + ' adı" />' +
        '<button type="button" class="daire-sil-btn" data-id="' + esc(d.id) + '" title="Sil" aria-label="' + esc(aria) + ' sil">×</button>';
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
    const daire = window.APARTIM.db.dairelerListele().find((d) => d.id === id);
    const ad = daire?.ad || "Bu oda";
    uyari("daire-uyari", "");
    const kimlik = window.APARTIM.kimlik;
    if (!kimlik?.iste) {
      if (!confirm("\"" + ad + "\" odasını silmek istiyor musunuz?")) return;
    } else {
      const ok = await kimlik.iste({
        baslik: "Odayı sil",
        aciklama: "\"" + ad + "\" odasını silmek için hesabınızı doğrulayın. Silmeden önce Robust yedeği alınır.",
        onayMetin: "Odayı sil",
        tehlike: true,
        yerelAnahtar: "SIL"
      });
      if (!ok) return;
    }
    try {
      if (!window.APARTIM.robust?.hemen) {
        uyari("daire-uyari", "Robust yedek hazır değil. Silme iptal edildi.");
        return;
      }
      const yedek = await window.APARTIM.robust.hemen("oda-sil");
      if (!yedek?.yerel) throw new Error("Robust yedek alınamadı. Silme iptal edildi.");
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

  // ---- Tahsilat kalemleri (ad düzelt + ekle; id sabit) ----
  function odemeYontemListeRender() {
    const ul = document.getElementById("odeme-yontem-liste");
    if (!ul) return;
    const liste = window.APARTIM.db.odemeYontemleriListele();
    ul.innerHTML = "";
    liste.forEach((y, i) => {
      const li = document.createElement("li");
      li.className = "daire-ayar-item";
      const no = String(y.sira || i + 1);
      const aria = y.ad || "Kalem";
      const sil = y.sistem
        ? '<span class="odeme-yontem-sabit" title="Varsayılan"></span>'
        : '<button type="button" class="daire-sil-btn" data-id="' + esc(y.id) +
          '" title="Sil" aria-label="' + esc(aria) + ' sil">×</button>';
      li.innerHTML =
        '<span class="daire-ayar-kat" title="' + esc(aria) + '">' + esc(no) + "</span>" +
        '<input type="text" class="field-input daire-ayar-ad odeme-yontem-ad" data-id="' + esc(y.id) + '" ' +
        'value="' + esc(y.ad) + '" maxlength="32" aria-label="' + esc(aria) + ' adı" />' +
        sil;
      if (!y.sistem) {
        li.querySelector(".daire-sil-btn")?.addEventListener("click", () => odemeYontemSil(y.id));
      }
      ul.appendChild(li);
    });
  }

  function odemeYontemAc() {
    uyari("odeme-yontem-uyari", "");
    const inp = document.getElementById("odeme-yontem-yeni-ad");
    if (inp) inp.value = "";
    odemeYontemListeRender();
    modalOdemeYontem()?.classList.remove("hidden");
    modalOdemeYontem()?.querySelector(".odeme-yontem-ad")?.focus();
  }

  function odemeYontemKapat() {
    modalOdemeYontem()?.classList.add("hidden");
    uyari("odeme-yontem-uyari", "");
    const inp = document.getElementById("odeme-yontem-yeni-ad");
    if (inp) inp.value = "";
  }

  async function odemeYontemEkle() {
    const inp = document.getElementById("odeme-yontem-yeni-ad");
    const ad = inp?.value.trim();
    if (!ad) {
      uyari("odeme-yontem-uyari", "Yeni kalem adı yazın.");
      return;
    }
    uyari("odeme-yontem-uyari", "");
    try {
      await window.APARTIM.db.odemeYontemiEkle(ad);
      if (inp) inp.value = "";
      odemeYontemListeRender();
      window.APARTIM.kasa?.ciz?.();
      window.APARTIM.toast("Tahsilat kalemi eklendi", "basari");
      inp?.focus();
    } catch (err) {
      uyari("odeme-yontem-uyari", err.message || "Eklenemedi.");
    }
  }

  async function odemeYontemSil(id) {
    const kayit = window.APARTIM.db.odemeYontemiGetir(id);
    const ad = kayit?.ad || "Bu kalem";
    uyari("odeme-yontem-uyari", "");
    if (!confirm("\"" + ad + "\" kalemini silmek istiyor musunuz?")) return;
    try {
      await window.APARTIM.db.odemeYontemiSil(id);
      odemeYontemListeRender();
      window.APARTIM.kasa?.ciz?.();
      window.APARTIM.toast("Kalem silindi", "basari");
    } catch (err) {
      uyari("odeme-yontem-uyari", err.message || "Silinemedi.");
    }
  }

  async function odemeYontemKaydet() {
    const inputs = modalOdemeYontem()?.querySelectorAll(".odeme-yontem-ad");
    if (!inputs || !inputs.length) return;
    uyari("odeme-yontem-uyari", "");
    const adlar = [];
    try {
      for (const inp of inputs) {
        const id = inp.dataset.id;
        const ad = inp.value.trim();
        if (!ad) {
          uyari("odeme-yontem-uyari", "Tüm kalemlerin adı dolu olmalı.");
          return;
        }
        const ayni = adlar.find((x) => x.toLocaleLowerCase("tr") === ad.toLocaleLowerCase("tr"));
        if (ayni) {
          uyari("odeme-yontem-uyari", "Aynı isimde birden fazla kalem olamaz.");
          return;
        }
        adlar.push(ad);
        const mevcut = window.APARTIM.db.odemeYontemiGetir(id);
        if (mevcut && mevcut.ad !== ad) {
          await window.APARTIM.db.odemeYontemiGuncelle(id, { ad });
        }
      }
      window.APARTIM.kasa?.ciz?.();
      window.APARTIM.toast("Tahsilat adları kaydedildi", "basari");
      odemeYontemKapat();
    } catch (err) {
      uyari("odeme-yontem-uyari", err.message || "Kaydedilemedi.");
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

    document.getElementById("ayar-odeme-yontemleri")?.addEventListener("click", () => {
      document.getElementById("ayar-menu")?.classList.add("hidden");
      odemeYontemAc();
    });
    document.getElementById("odeme-yontemleri-close")?.addEventListener("click", odemeYontemKapat);
    document.getElementById("odeme-yontemleri-kapat")?.addEventListener("click", odemeYontemKapat);
    document.getElementById("odeme-yontemleri-kaydet")?.addEventListener("click", odemeYontemKaydet);
    document.getElementById("odeme-yontem-ekle-btn")?.addEventListener("click", odemeYontemEkle);
    document.getElementById("odeme-yontem-yeni-ad")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        odemeYontemEkle();
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
      const aktif = document.activeElement;
      const adYaziliyor = aktif && modalKaynak().contains(aktif) && aktif.classList.contains("kaynak-ad-input");
      const paletAcik = modalKaynak().querySelector(".kaynak-satir-palet:not(.hidden)");
      if (!adYaziliyor && !paletAcik) kaynakListeRender();
    }
    if (e.detail?.sebep === "daireler" && modalDaire() && !modalDaire().classList.contains("hidden")) {
      daireListeRender();
    }
    if (e.detail?.sebep === "odeme-yontemleri" && modalOdemeYontem() && !modalOdemeYontem().classList.contains("hidden")) {
      odemeYontemListeRender();
    }
  });

  window.APARTIM.ayarlar = {
    kaynakAc, kaynakKapat, daireAc, daireKapat, dovizAc, dovizKapat,
    odemeYontemAc, odemeYontemKapat
  };
})();
