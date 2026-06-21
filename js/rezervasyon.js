/* =========================================================
   APARTIM — Rezervasyon yönetimi
   Yeni / düzenle / sil modalı, çakışma kontrolü, çıkış işlemi.
   Gecelik kademe fiyatlandırma + konak uzatma desteği.
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
    kademeler: document.getElementById("rez-kademeler"),
    fiyatOzet: document.getElementById("rez-fiyat-ozet"),
    tGece: document.getElementById("rez-toplam-gece"),
    tTutar: document.getElementById("rez-toplam-tutar"),
    btnKaydet: document.getElementById("rez-modal-kaydet"),
    btnIptal: document.getElementById("rez-modal-iptal"),
    btnSil: document.getElementById("rez-modal-sil"),
    btnClose: document.getElementById("rez-modal-close")
  });

  let mevcutRezId = null;
  let mevcutDaireId = null;
  let cikisRezId = null;

  function aralikFormatla(n) {
    return Number(n || 0).toLocaleString("tr-TR");
  }
  function bugunISO() { return window.APARTIM.db.bugunISO(); }
  function gunEkle(isoStr, ekle) {
    const db = window.APARTIM.db;
    if (db && typeof db.gunEkleISO === "function") {
      return db.gunEkleISO(isoStr, ekle);
    }
    const d = new Date(isoStr + "T00:00:00");
    d.setDate(d.getDate() + ekle);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const g = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + g;
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

  function kademeSatirOlustur(kademe) {
    const satir = document.createElement("div");
    satir.className = "rez-kademe-satir";
    satir.innerHTML =
      '<input type="number" class="field-input rez-k-bas" min="1" step="1" value="' + (kademe.basGece || 1) + '" aria-label="Başlangıç gece" />' +
      '<span class="rez-k-ayrac">–</span>' +
      '<input type="number" class="field-input rez-k-bit" min="1" step="1" placeholder="+" value="' + (kademe.bitGece != null ? kademe.bitGece : "") + '" aria-label="Bitiş gece" />' +
      '<span class="rez-k-etiket">. gece</span>' +
      '<input type="number" class="field-input rez-k-ucret" min="0" step="50" value="' + (kademe.ucret || "") + '" aria-label="Ücret" />' +
      '<span class="rez-k-tl">TL</span>' +
      '<button type="button" class="rez-k-sil" title="Kademeyi sil">×</button>';
    satir.querySelector(".rez-k-sil").addEventListener("click", () => {
      const wrap = ay().kademeler;
      if (wrap.querySelectorAll(".rez-kademe-satir").length <= 1) return;
      satir.remove();
      toplamHesapla();
    });
    satir.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", toplamHesapla);
    });
    return satir;
  }

  function kademeleriYukle(kademeler, varsayilanUcret) {
    const wrap = ay().kademeler;
    if (!wrap) return;
    wrap.innerHTML = "";
    const db = window.APARTIM.db;
    const u = Number(varsayilanUcret) || 1000;
    let liste;
    if (db && typeof db.ucretKademeleriNormalize === "function") {
      liste = db.ucretKademeleriNormalize(kademeler, u);
    } else if (Array.isArray(kademeler) && kademeler.length) {
      liste = kademeler;
    } else {
      liste = [{ basGece: 1, bitGece: null, ucret: u }];
    }
    if (!liste.length) {
      wrap.appendChild(kademeSatirOlustur({ basGece: 1, bitGece: null, ucret: u }));
      return;
    }
    liste.forEach((k) => wrap.appendChild(kademeSatirOlustur(k)));
  }

  function kademeleriOku() {
    const wrap = ay().kademeler;
    if (!wrap) return [];
    return Array.from(wrap.querySelectorAll(".rez-kademe-satir")).map((satir) => {
      const bitVal = satir.querySelector(".rez-k-bit").value.trim();
      return {
        basGece: Number(satir.querySelector(".rez-k-bas").value) || 1,
        bitGece: bitVal ? Number(bitVal) : null,
        ucret: Number(satir.querySelector(".rez-k-ucret").value) || 0
      };
    });
  }

  function fiyatOzetMetni(rez) {
    const db = window.APARTIM.db;
    const { gece, toplam, gecelik } = db.rezervasyonTutarHesapla(rez);
    if (!gece) return "";
    const parcalar = [];
    let i = 0;
    while (i < gecelik.length) {
      const u = gecelik[i].ucret;
      const bas = gecelik[i].gece;
      let bit = bas;
      while (i + 1 < gecelik.length && gecelik[i + 1].ucret === u) {
        i++;
        bit = gecelik[i].gece;
      }
      const adet = bit - bas + 1;
      const aralik = bas === bit
        ? bas + ". gece"
        : (bit === gece ? bas + "+. gece" : bas + "–" + bit + ". gece");
      parcalar.push(adet + "×" + aralikFormatla(u) + " TL");
      i++;
    }
    return parcalar.join(" · ");
  }

  function toplamHesapla() {
    const e = ay();
    const g = e.giris.value;
    const c = e.cikis.value;
    const kademeler = kademeleriOku();
    const ilkUcret = kademeler[0]?.ucret || 0;
    const rez = { giris: g, cikis: c, gunlukUcret: ilkUcret, ucretKademeleri: kademeler };
    const db = window.APARTIM.db;
    const { gece, toplam } = db.rezervasyonTutarHesapla(rez);
    e.tGece.textContent = gece + " gece";
    e.tTutar.textContent = aralikFormatla(toplam) + " TL";
    if (e.fiyatOzet) {
      e.fiyatOzet.textContent = gece > 0 ? fiyatOzetMetni(rez) : "";
    }
  }

  function cikisUzat(gun) {
    const e = ay();
    if (!e.cikis.value) return;
    e.cikis.value = gunEkle(e.cikis.value, gun);
    toplamHesapla();
  }

  function kademeEkle() {
    const wrap = ay().kademeler;
    if (!wrap) return;
    const g = ay().giris.value;
    const c = ay().cikis.value;
    const gece = window.APARTIM.db.geceSayisi(g, c);
    const mevcut = kademeleriOku();
    const son = mevcut[mevcut.length - 1];
    let basGece = 1;
    let ucret = son?.ucret || 1000;
    if (son) {
      if (son.bitGece != null) basGece = son.bitGece + 1;
      else if (gece > 0) {
        son.bitGece = gece;
        const satirlar = wrap.querySelectorAll(".rez-kademe-satir");
        const sonSatir = satirlar[satirlar.length - 1];
        if (sonSatir) sonSatir.querySelector(".rez-k-bit").value = gece;
        basGece = gece + 1;
      }
    }
    wrap.appendChild(kademeSatirOlustur({ basGece, bitGece: null, ucret }));
    toplamHesapla();
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
    kademeleriYukle(null, daire ? daire.gunlukUcret : 1000);
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
    kademeleriYukle(rez.ucretKademeleri, rez.gunlukUcret);
    e.notlar.value = rez.notlar || "";
    e.btnSil.classList.remove("hidden");
    uyariGoster("");
    toplamHesapla();
    modalAc();
  }

  function kademeleriKaydaHazirla(kademeler, gece) {
    const k = kademeler.map((x) => Object.assign({}, x));
    if (!k.length || gece <= 0) return k;
    const son = k[k.length - 1];
    if (son.bitGece != null && son.bitGece < gece) {
      son.bitGece = null;
    }
    return k;
  }

  function kademeDogrula(kademeler, gece) {
    if (!kademeler.length) return "En az bir fiyat kademesi girin.";
    for (const k of kademeler) {
      if (k.ucret <= 0) return "Tüm kademelerde ücret 0'dan büyük olmalı.";
      if (k.bitGece != null && k.bitGece < k.basGece) {
        return "Bitiş gecesi, başlangıçtan küçük olamaz.";
      }
    }
    const sirali = kademeler.slice().sort((a, b) => a.basGece - b.basGece);
    if (sirali[0].basGece !== 1) return "İlk kademe 1. geceden başlamalı.";
    for (let i = 1; i < sirali.length; i++) {
      const onceki = sirali[i - 1];
      const beklenen = onceki.bitGece != null ? onceki.bitGece + 1 : null;
      if (beklenen == null) return "Açık uçlu kademeden sonra yeni kademe ekleyemezsiniz.";
      if (sirali[i].basGece !== beklenen) {
        return "Kademeler arasında boşluk var (" + beklenen + ". gece eksik).";
      }
    }
    const son = sirali[sirali.length - 1];
    if (son.bitGece != null && son.bitGece < gece) {
      return "Son kademe " + gece + ". geceye kadar uzatılmalı (bitiş boş bırakın).";
    }
    return "";
  }

  async function kaydet() {
    const e = ay();
    const misafir = e.misafir.value.trim();
    const giris = e.giris.value;
    const cikis = e.cikis.value;
    if (!misafir) { uyariGoster("Misafir adı zorunlu."); return; }
    if (!giris || !cikis) { uyariGoster("Tarihler zorunlu."); return; }
    if (cikis <= giris) { uyariGoster("Çıkış tarihi girişten sonra olmalı."); return; }

    const gece = window.APARTIM.db.geceSayisi(giris, cikis);
    const kademeler = kademeleriKaydaHazirla(kademeleriOku(), gece);
    const kademeHata = kademeDogrula(kademeler, gece);
    if (kademeHata) { uyariGoster(kademeHata); return; }

    const kaynakId = e.kaynak?.value || "";
    if (!kaynakId) { uyariGoster("Müşteri kaynağı seçin."); return; }

    const tekKademe = kademeler.length === 1 &&
      kademeler[0].basGece === 1 &&
      kademeler[0].bitGece == null;

    const veri = {
      daireId: mevcutDaireId,
      kaynakId,
      misafirAdi: misafir,
      telefon: e.telefon.value.trim(),
      giris,
      cikis,
      gunlukUcret: kademeler[0].ucret,
      notlar: e.notlar.value.trim()
    };
    if (!tekKademe) veri.ucretKademeleri = kademeler;
    else veri.ucretKademeleri = null;

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
      const bg = bugunISO();
      const yeniCikis = bg > rez.giris ? bg : gunEkle(rez.giris, 1);
      await window.APARTIM.db.rezervasyonGuncelle(cikisRezId, { cikis: yeniCikis });
      await window.APARTIM.temizlik.durumDegistir(rez.daireId, "kirli");
      window.APARTIM.toast("Çıkış tamamlandı, daire kirli olarak işaretlendi", "basari");
      cikisKapat();
    } catch (err) {
      window.APARTIM.toast("Çıkış başarısız", "hata");
    }
  }

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
    const kademeNot = rez.ucretKademeleri && rez.ucretKademeleri.length > 1
      ? " · Kademeli fiyat"
      : "";

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
        '<span>' + (rez.toplamGece || 0) + ' gece' + kademeNot + '</span>' +
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

  document.addEventListener("DOMContentLoaded", () => {
    const e = ay();
    e.btnIptal.addEventListener("click", modalKapat);
    e.btnClose.addEventListener("click", modalKapat);
    e.btnKaydet.addEventListener("click", kaydet);
    e.btnSil.addEventListener("click", silOnay);
    [e.giris, e.cikis].forEach((inp) => inp.addEventListener("input", toplamHesapla));
    e.giris.addEventListener("change", () => {
      if (!e.cikis.value || e.cikis.value <= e.giris.value) {
        e.cikis.value = gunEkle(e.giris.value, 1);
        toplamHesapla();
      }
    });
    document.getElementById("rez-kademe-ekle")?.addEventListener("click", kademeEkle);
    document.querySelectorAll("[data-uzat]").forEach((btn) => {
      btn.addEventListener("click", () => cikisUzat(Number(btn.dataset.uzat) || 1));
    });

    document.getElementById("rez-yeni-btn")?.addEventListener("click", () => yeni({}));

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
