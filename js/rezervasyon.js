/* =========================================================
   APARTIM — Rezervasyon yönetimi
   Yeni / düzenle / sil modalı, çakışma kontrolü, çıkış işlemi.
   Tüm rezervasyon listesi sekmesini de besler.
   ========================================================= */

(function () {
  "use strict";

  const modal = () => document.getElementById("modal-rez");
  const cikisModal = () => document.getElementById("modal-cikis");
  const onayModal = () => document.getElementById("modal-onay");

  const ay = () => ({
    title: document.getElementById("rez-modal-title"),
    uyari: document.getElementById("rez-modal-uyari"),
    misafir: document.getElementById("rez-misafir"),
    kaynak: document.getElementById("rez-kaynak"),
    telefon: document.getElementById("rez-telefon"),
    giris: document.getElementById("rez-giris"),
    cikis: document.getElementById("rez-cikis"),
    ucret: document.getElementById("rez-ucret"),
    notlar: document.getElementById("rez-notlar"),
    tGece: document.getElementById("rez-toplam-gece"),
    tTutar: document.getElementById("rez-toplam-tutar"),
    btnKaydet: document.getElementById("rez-modal-kaydet"),
    btnIptal: document.getElementById("rez-modal-iptal"),
    btnSil: document.getElementById("rez-modal-sil"),
    btnClose: document.getElementById("rez-modal-close")
  });

  let mevcutRezId = null; // düzenleme modu
  let mevcutDaireId = null;
  let cikisRezId = null;

  function aralikFormatla(n) {
    return Number(n || 0).toLocaleString("tr-TR");
  }
  function bugunISO() { return window.APARTIM.db.bugunISO(); }
  function gunEkle(isoStr, ekle) {
    const d = new Date(isoStr + "T00:00:00");
    d.setDate(d.getDate() + ekle);
    return window.APARTIM.db.tarihNormal(d);
  }

  function modalAc() {
    modal()?.classList.remove("hidden");
    setTimeout(() => ay().misafir?.focus(), 50);
  }
  function modalKapat() {
    modal()?.classList.add("hidden");
    mevcutRezId = null;
    mevcutDaireId = null;
    const e = ay();
    if (e.uyari) { e.uyari.classList.add("hidden"); e.uyari.textContent = ""; }
  }

  function toplamHesapla() {
    const e = ay();
    const g = e.giris.value;
    const c = e.cikis.value;
    const u = Number(e.ucret.value) || 0;
    const gece = window.APARTIM.db.geceSayisi(g, c);
    e.tGece.textContent = gece + " gece";
    e.tTutar.textContent = aralikFormatla(gece * u) + " TL";
  }

  function uyariGoster(msg) {
    const e = ay();
    if (!e.uyari) return;
    if (!msg) {
      e.uyari.classList.add("hidden");
      e.uyari.textContent = "";
      return;
    }
    e.uyari.classList.remove("hidden");
    e.uyari.textContent = msg;
  }

  function kaynakSelectDoldur(seciliId) {
    const sel = ay().kaynak;
    if (!sel) return;
    const liste = window.APARTIM.db.musteriKaynaklariListele();
    sel.innerHTML = '<option value="">— Seçin —</option>';
    liste.forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k.id;
      opt.textContent = (k.simge ? k.simge + " " : "") + k.ad;
      sel.appendChild(opt);
    });
    if (seciliId && liste.some((k) => k.id === seciliId)) {
      sel.value = seciliId;
    } else if (liste.length) {
      sel.value = liste[0].id;
    }
  }

  function yeni(secimler) {
    secimler = secimler || {};
    mevcutRezId = null;
    mevcutDaireId = secimler.daireId || window.APARTIM.daire?.aktifId() || null;
    if (!mevcutDaireId) {
      window.APARTIM.toast("Önce bir daire seçin", "uyari");
      return;
    }
    const daire = window.APARTIM.db.daireGetir(mevcutDaireId);
    const e = ay();
    e.title.textContent = "Yeni rezervasyon — " + (daire ? daire.ad : "");
    kaynakSelectDoldur(secimler.kaynakId || null);
    e.misafir.value = "";
    e.telefon.value = "";
    const gIso = secimler.girisOnseci || bugunISO();
    e.giris.value = gIso;
    e.cikis.value = gunEkle(gIso, 1);
    e.ucret.value = daire ? daire.gunlukUcret : 1000;
    e.notlar.value = "";
    e.btnSil.classList.add("hidden");
    uyariGoster("");
    toplamHesapla();
    modalAc();
  }

  function duzenle(rezId) {
    const rez = window.APARTIM.db.durum.rezervasyonlar[rezId];
    if (!rez) return;
    mevcutRezId = rezId;
    mevcutDaireId = rez.daireId;
    const daire = window.APARTIM.db.daireGetir(rez.daireId);
    const e = ay();
    e.title.textContent = "Rezervasyon — " + (daire ? daire.ad : "");
    kaynakSelectDoldur(rez.kaynakId || null);
    e.misafir.value = rez.misafirAdi || "";
    e.telefon.value = rez.telefon || "";
    e.giris.value = rez.giris;
    e.cikis.value = rez.cikis;
    e.ucret.value = rez.gunlukUcret;
    e.notlar.value = rez.notlar || "";
    e.btnSil.classList.remove("hidden");
    uyariGoster("");
    toplamHesapla();
    modalAc();
  }

  async function kaydet() {
    const e = ay();
    const misafir = e.misafir.value.trim();
    const giris = e.giris.value;
    const cikis = e.cikis.value;
    const ucret = Number(e.ucret.value) || 0;
    if (!misafir) { uyariGoster("Misafir adı zorunlu."); return; }
    if (!giris || !cikis) { uyariGoster("Tarihler zorunlu."); return; }
    if (cikis <= giris) { uyariGoster("Çıkış tarihi girişten sonra olmalı."); return; }
    if (ucret <= 0) { uyariGoster("Günlük ücret 0'dan büyük olmalı."); return; }

    const kaynakId = e.kaynak?.value || "";
    if (!kaynakId) { uyariGoster("Müşteri kaynağı seçin."); return; }

    const veri = {
      daireId: mevcutDaireId,
      kaynakId,
      misafirAdi: misafir,
      telefon: e.telefon.value.trim(),
      giris,
      cikis,
      gunlukUcret: ucret,
      notlar: e.notlar.value.trim()
    };

    try {
      if (mevcutRezId) {
        await window.APARTIM.db.rezervasyonGuncelle(mevcutRezId, veri);
        window.APARTIM.toast("Rezervasyon güncellendi", "basari");
      } else {
        await window.APARTIM.db.rezervasyonEkle(veri);
        window.APARTIM.toast("Rezervasyon kaydedildi", "basari");
      }
      modalKapat();
    } catch (err) {
      uyariGoster(err.message || "Kayıt başarısız.");
    }
  }

  function silOnay() {
    if (!mevcutRezId) return;
    onayAc("Bu rezervasyonu sil?", "Rezervasyon kalıcı olarak silinecek.", async () => {
      try {
        await window.APARTIM.db.rezervasyonSil(mevcutRezId);
        window.APARTIM.toast("Rezervasyon silindi", "basari");
        modalKapat();
      } catch (err) {
        window.APARTIM.toast("Silme başarısız", "hata");
      }
    });
  }

  // ---- Çıkış işlemi (misafiri çıkar, daireyi kirli yap) ----
  function cikisAc(rezId) {
    cikisRezId = rezId;
    cikisModal()?.classList.remove("hidden");
  }
  function cikisKapat() {
    cikisRezId = null;
    cikisModal()?.classList.add("hidden");
  }
  async function cikisOnayla() {
    if (!cikisRezId) return;
    const rez = window.APARTIM.db.durum.rezervasyonlar[cikisRezId];
    if (!rez) return cikisKapat();
    try {
      // Çıkışı bugüne çek
      const bg = bugunISO();
      const yeniCikis = bg > rez.giris ? bg : gunEkle(rez.giris, 1);
      await window.APARTIM.db.rezervasyonGuncelle(cikisRezId, { cikis: yeniCikis });
      // Daireyi kirli yap
      await window.APARTIM.temizlik.durumDegistir(rez.daireId, "kirli");
      window.APARTIM.toast("Çıkış tamamlandı, daire kirli olarak işaretlendi", "basari");
      cikisKapat();
    } catch (err) {
      window.APARTIM.toast("Çıkış başarısız", "hata");
    }
  }

  // ---- Onay modalı (silme vb.) ----
  function onayAc(baslik, metin, kabulFn) {
    const m = onayModal();
    if (!m) return;
    m.querySelector("#onay-title").textContent = baslik;
    m.querySelector("#onay-metin").textContent = metin;
    m.classList.remove("hidden");
    const kabul = m.querySelector("#onay-onayla");
    const iptal = m.querySelector("#onay-iptal");
    const close = m.querySelector("#onay-close");
    const kapat = () => m.classList.add("hidden");
    const _kabul = () => { kapat(); kabulFn && kabulFn(); temizle(); };
    const _iptal = () => { kapat(); temizle(); };
    function temizle() {
      kabul.removeEventListener("click", _kabul);
      iptal.removeEventListener("click", _iptal);
      close.removeEventListener("click", _iptal);
    }
    kabul.addEventListener("click", _kabul);
    iptal.addEventListener("click", _iptal);
    close.addEventListener("click", _iptal);
  }

  // ---- Rezervasyon kartı (daire & tüm liste için) ----
  function kartOlustur(rez) {
    const div = document.createElement("div");
    div.className = "rez-kart";
    const daire = window.APARTIM.db.daireGetir(rez.daireId);
    const bg = bugunISO();
    const aktif = rez.giris <= bg && bg < rez.cikis;
    const gelecek = rez.giris > bg;

    const durumEt = aktif ? "Aktif" : (gelecek ? "Yaklaşan" : "Tamamlandı");
    const kaynakAd = rez.kaynakAd || window.APARTIM.db.musteriKaynagiAd(rez.kaynakId) || "—";
    const kaynakSimge = window.APARTIM.db.musteriKaynagiSimge(rez.kaynakId);

    div.innerHTML =
      '<div class="rez-kart-ust">' +
        '<span class="rez-kart-misafir">' + esc(rez.misafirAdi || "Misafir") + '</span>' +
        '<span class="rez-kaynak-badge" title="' + esc(kaynakAd) + '">' + esc(kaynakSimge) + ' ' + esc(kaynakAd) + '</span>' +
        '<span class="rez-kart-tutar">' + aralikFormatla(rez.toplamTutar || 0) + ' TL</span>' +
      '</div>' +
      '<div class="rez-kart-orta">' +
        '<span>' + (daire ? esc(daire.ad) : esc(rez.daireId)) + '</span>' +
        '<span class="ok">•</span>' +
        '<span>' + rez.giris + ' <span class="ok">→</span> ' + rez.cikis + '</span>' +
        '<span class="ok">•</span>' +
        '<span>' + (rez.toplamGece || 0) + ' gece</span>' +
        '<span class="ok">•</span>' +
        '<span>' + durumEt + '</span>' +
      '</div>' +
      (rez.telefon ? '<div class="rez-kart-orta"><span>📞 ' + esc(rez.telefon) + '</span></div>' : "") +
      (rez.notlar ? '<div class="rez-kart-orta"><span>📝 ' + esc(rez.notlar) + '</span></div>' : "") +
      '<div class="rez-kart-alt">' +
        (aktif ? '<button class="rez-kart-btn basari" data-aksiyon="cikis">Çıkış yap</button>' : '') +
        '<button class="rez-kart-btn" data-aksiyon="duzenle">Düzenle</button>' +
        '<button class="rez-kart-btn tehlike" data-aksiyon="sil">Sil</button>' +
      '</div>';

    div.querySelector('[data-aksiyon="duzenle"]').addEventListener("click", () => duzenle(rez.id));
    const silBtn = div.querySelector('[data-aksiyon="sil"]');
    silBtn.addEventListener("click", () => {
      onayAc("Rezervasyonu sil?", "Bu işlem geri alınamaz.", async () => {
        try {
          await window.APARTIM.db.rezervasyonSil(rez.id);
          window.APARTIM.toast("Silindi", "basari");
        } catch (e) { window.APARTIM.toast("Silme başarısız", "hata"); }
      });
    });
    const cBtn = div.querySelector('[data-aksiyon="cikis"]');
    if (cBtn) cBtn.addEventListener("click", () => cikisAc(rez.id));
    return div;
  }

  function listeRender(containerId, daireId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const liste = window.APARTIM.db.rezervasyonlarListele(daireId);
    if (!liste.length) {
      c.innerHTML = '<div class="rez-bos">Henüz rezervasyon yok</div>';
      return;
    }
    c.innerHTML = "";
    // Aktif → Yaklaşan → Tamamlandı sırasıyla
    const bg = bugunISO();
    const sirali = liste.slice().sort((a, b) => {
      function skor(r) {
        if (r.giris <= bg && bg < r.cikis) return 0;
        if (r.giris > bg) return 1;
        return 2;
      }
      const sa = skor(a), sb = skor(b);
      if (sa !== sb) return sa - sb;
      return (a.giris || "").localeCompare(b.giris || "");
    });
    sirali.forEach((r) => c.appendChild(kartOlustur(r)));
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  }

  function tumRezListele() { listeRender("tum-rez-liste"); }
  function daireRezListele(daireId) { listeRender("rez-liste-icerik", daireId); }

  // ---- Bağlamalar ----
  document.addEventListener("DOMContentLoaded", () => {
    const e = ay();
    e.btnIptal.addEventListener("click", modalKapat);
    e.btnClose.addEventListener("click", modalKapat);
    e.btnKaydet.addEventListener("click", kaydet);
    e.btnSil.addEventListener("click", silOnay);
    [e.giris, e.cikis, e.ucret].forEach((inp) => inp.addEventListener("input", toplamHesapla));
    // Giriş değişince çıkış en az +1 gün olsun
    e.giris.addEventListener("change", () => {
      if (!e.cikis.value || e.cikis.value <= e.giris.value) {
        e.cikis.value = gunEkle(e.giris.value, 1);
        toplamHesapla();
      }
    });

    document.getElementById("rez-yeni-btn")?.addEventListener("click", () => yeni({}));

    // Çıkış modal
    document.getElementById("cikis-close")?.addEventListener("click", cikisKapat);
    document.getElementById("cikis-iptal")?.addEventListener("click", cikisKapat);
    document.getElementById("cikis-onayla")?.addEventListener("click", cikisOnayla);
  });

  document.addEventListener("apartim:veri-degisti", () => {
    if (window.APARTIM.daire?.aktifId()) {
      daireRezListele(window.APARTIM.daire.aktifId());
    }
    tumRezListele();
    if (modal() && !modal().classList.contains("hidden") && ay().kaynak) {
      const secili = ay().kaynak.value;
      kaynakSelectDoldur(secili || null);
    }
  });

  window.APARTIM.rezervasyon = {
    yeni,
    duzenle,
    cikisAc,
    listeRender,
    tumRezListele,
    daireRezListele,
    kartOlustur,
    onayAc
  };
})();
