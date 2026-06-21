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
    ucret: document.getElementById("rez-ucret"),
    kademeGrup: document.getElementById("rez-kademe-grup"),
    kademeToggle: document.getElementById("rez-kademe-toggle"),
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
  let kademeModu = false;

  function varsayilanUcret() {
    const daire = mevcutDaireId ? window.APARTIM.db?.daireGetir(mevcutDaireId) : null;
    return Number(daire?.gunlukUcret) || 1000;
  }

  function kademeModuGoster(acik) {
    kademeModu = !!acik;
    const e = ay();
    e.kademeGrup?.classList.toggle("hidden", !kademeModu);
    if (e.kademeToggle) {
      e.kademeToggle.textContent = kademeModu
        ? "Basit günlük ücrete dön"
        : "Gecelik farklı fiyat kullan";
    }
    if (kademeModu && e.kademeler && !e.kademeler.querySelector(".rez-kademe-satir")) {
      kademeleriYukle(null, Number(e.ucret?.value) || varsayilanUcret());
    }
    toplamHesapla();
  }

  function tutarHesapla(rez) {
    const db = window.APARTIM.db;
    if (db && typeof db.rezervasyonTutarHesapla === "function") {
      return db.rezervasyonTutarHesapla(rez);
    }
    const gece = db ? db.geceSayisi(rez.giris, rez.cikis) : 0;
    const u = Number(rez.gunlukUcret) || 0;
    return { gece, toplam: gece * u, gecelik: [] };
  }

  function aralikFormatla(n) {
    return Number(n || 0).toLocaleString("tr-TR");
  }
  function bugunISO() {
    const db = window.APARTIM.db;
    if (db && typeof db.bugunISO === "function") return db.bugunISO();
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function alanYaz(inp, val) { if (inp) inp.value = val; }

  function rezBul(rezId) {
    const db = window.APARTIM.db;
    if (!db?.durum?.rezervasyonlar) return null;
    if (rezId && db.durum.rezervasyonlar[rezId]) return db.durum.rezervasyonlar[rezId];
    return null;
  }

  function rezIdAl(rez) {
    if (!rez) return "";
    if (rez.id) return rez.id;
    const db = window.APARTIM.db;
    if (!db?.durum?.rezervasyonlar) return "";
    for (const [id, r] of Object.entries(db.durum.rezervasyonlar)) {
      if (r === rez) return id;
    }
    return "";
  }

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
    if (!kademeModu) {
      const u = Number(ay().ucret?.value) || varsayilanUcret();
      return [{ basGece: 1, bitGece: null, ucret: u }];
    }
    const wrap = ay().kademeler;
    if (!wrap) {
      const u = Number(ay().ucret?.value) || varsayilanUcret();
      return [{ basGece: 1, bitGece: null, ucret: u }];
    }
    const satirlar = Array.from(wrap.querySelectorAll(".rez-kademe-satir"));
    if (!satirlar.length) {
      const u = Number(ay().ucret?.value) || varsayilanUcret();
      return [{ basGece: 1, bitGece: null, ucret: u }];
    }
    return satirlar.map((satir) => {
      const bitVal = satir.querySelector(".rez-k-bit").value.trim();
      return {
        basGece: Number(satir.querySelector(".rez-k-bas").value) || 1,
        bitGece: bitVal ? Number(bitVal) : null,
        ucret: Number(satir.querySelector(".rez-k-ucret").value) || 0
      };
    });
  }

  function fiyatOzetMetni(rez) {
    const { gece, gecelik } = tutarHesapla(rez);
    if (!gece || !gecelik.length) return "";
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
    try {
      const e = ay();
      const g = e.giris?.value;
      const c = e.cikis?.value;
      const kademeler = kademeleriOku();
      const ilkUcret = kademeler[0]?.ucret || Number(e.ucret?.value) || varsayilanUcret();
      if (!kademeModu && e.ucret && Number(e.ucret.value) !== ilkUcret) {
        e.ucret.value = ilkUcret;
      }
      const rez = { giris: g, cikis: c, gunlukUcret: ilkUcret, ucretKademeleri: kademeModu ? kademeler : null };
      const { gece, toplam } = tutarHesapla(rez);
      if (e.tGece) e.tGece.textContent = gece + " gece";
      if (e.tTutar) e.tTutar.textContent = aralikFormatla(toplam) + " TL";
      if (e.fiyatOzet) {
        e.fiyatOzet.textContent = kademeModu && gece > 0 ? fiyatOzetMetni(rez) : "";
      }
    } catch (err) {
      console.warn("toplamHesapla:", err);
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
    try {
      secimler = secimler || {};
      mevcutRezId = null;
      mevcutDaireId = secimler.daireId || window.APARTIM.daire?.aktifId() || null;
      if (!mevcutDaireId) {
        window.APARTIM.toast("Önce bir daire seçin", "uyari");
        return;
      }
      const db = window.APARTIM.db;
      if (!db) {
        window.APARTIM.toast("Veri henüz yüklenmedi", "uyari");
        return;
      }
      const daire = db.daireGetir(mevcutDaireId);
      const e = ay();
      if (e.title) e.title.textContent = "Yeni rezervasyon — " + (daire ? daire.ad : "");
      kaynakSelectDoldur(secimler.kaynakId || null);
      alanYaz(e.misafir, "");
      alanYaz(e.telefon, "");
      const gIso = secimler.girisOnseci || bugunISO();
      alanYaz(e.giris, gIso);
      alanYaz(e.cikis, gunEkle(gIso, 1));
      const u = daire ? daire.gunlukUcret : 1000;
      alanYaz(e.ucret, u);
      kademeModuGoster(false);
      kademeleriYukle(null, u);
      alanYaz(e.notlar, "");
      e.btnSil?.classList.add("hidden");
      uyariGoster("");
      toplamHesapla();
      modalAc();
    } catch (err) {
      console.error("rezervasyon.yeni", err);
      window.APARTIM.toast("Kayıt formu açılamadı", "hata");
    }
  }

  function duzenle(rezId) {
    try {
      let rez = rezBul(rezId);
      if (!rez && rezId) {
        const db = window.APARTIM.db;
        rez = Object.values(db?.durum?.rezervasyonlar || {}).find((r) => r && r.id === rezId) || null;
      }
      if (!rez) {
        window.APARTIM.toast("Rezervasyon bulunamadı", "uyari");
        return;
      }
      rezId = rez.id || rezIdAl(rez) || rezId;
      mevcutRezId = rezId;
      mevcutDaireId = rez.daireId;
      const daire = window.APARTIM.db.daireGetir(rez.daireId);
      const e = ay();
      if (e.title) e.title.textContent = "Rezervasyon — " + (daire ? daire.ad : "");
      kaynakSelectDoldur(rez.kaynakId || null);
      alanYaz(e.misafir, rez.misafirAdi || "");
      alanYaz(e.telefon, rez.telefon || "");
      alanYaz(e.giris, rez.giris);
      alanYaz(e.cikis, rez.cikis);
      const liste = window.APARTIM.db.ucretKademeleriNormalize(rez.ucretKademeleri, rez.gunlukUcret);
      const coklu = liste.length > 1 ||
        (liste[0] && (liste[0].bitGece != null || liste[0].basGece !== 1));
      alanYaz(e.ucret, rez.gunlukUcret || varsayilanUcret());
      kademeleriYukle(rez.ucretKademeleri, rez.gunlukUcret);
      kademeModuGoster(coklu);
      alanYaz(e.notlar, rez.notlar || "");
      e.btnSil?.classList.remove("hidden");
      uyariGoster("");
      toplamHesapla();
      modalAc();
    } catch (err) {
      console.error("rezervasyon.duzenle", err);
      window.APARTIM.toast("Rezervasyon açılamadı", "hata");
    }
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
    if (!kademeModu) {
      const u = Number(ay().ucret?.value) || 0;
      return u > 0 ? "" : "Günlük ücret 0'dan büyük olmalı.";
    }
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
    let kademeler = kademeModu
      ? kademeleriKaydaHazirla(kademeleriOku(), gece)
      : [{ basGece: 1, bitGece: null, ucret: Number(e.ucret?.value) || 0 }];
    const kademeHata = kademeDogrula(kademeler, gece);
    if (kademeHata) { uyariGoster(kademeHata); return; }

    const kaynakId = e.kaynak?.value || "";
    if (!kaynakId) { uyariGoster("Müşteri kaynağı seçin."); return; }

    const tekKademe = !kademeModu || (
      kademeler.length === 1 &&
      kademeler[0].basGece === 1 &&
      kademeler[0].bitGece == null
    );

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

    if (!mevcutDaireId) { uyariGoster("Daire seçilemedi. Modalı kapatıp tekrar deneyin."); return; }

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

  function bagla() {
    const e = ay();
    e.btnIptal?.addEventListener("click", modalKapat);
    e.btnClose?.addEventListener("click", modalKapat);
    e.btnKaydet?.addEventListener("click", kaydet);
    e.btnSil?.addEventListener("click", silOnay);
    e.giris?.addEventListener("input", toplamHesapla);
    e.cikis?.addEventListener("input", toplamHesapla);
    e.ucret?.addEventListener("input", toplamHesapla);
    e.giris?.addEventListener("change", () => {
      if (!e.cikis?.value || e.cikis.value <= e.giris.value) {
        e.cikis.value = gunEkle(e.giris.value, 1);
        toplamHesapla();
      }
    });
    document.getElementById("rez-kademe-ekle")?.addEventListener("click", kademeEkle);
    document.getElementById("rez-kademe-toggle")?.addEventListener("click", () => {
      kademeModuGoster(!kademeModu);
      if (kademeModu) {
        kademeleriYukle(null, Number(e.ucret?.value) || varsayilanUcret());
      }
    });
    document.querySelectorAll("[data-uzat]").forEach((btn) => {
      btn.addEventListener("click", () => cikisUzat(Number(btn.dataset.uzat) || 1));
    });
    document.getElementById("rez-yeni-btn")?.addEventListener("click", () => yeni({}));
    document.getElementById("cikis-close")?.addEventListener("click", cikisKapat);
    document.getElementById("cikis-iptal")?.addEventListener("click", cikisKapat);
    document.getElementById("cikis-onayla")?.addEventListener("click", cikisOnayla);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bagla);
  } else {
    bagla();
  }

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
    rezIdAl,
    cikisAc,
    listeRender,
    tumRezListele,
    daireRezListele,
    kartOlustur,
    onayAc
  };
})();
