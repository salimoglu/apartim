/* =========================================================
   APARTIM — Rezervasyon yönetimi
   Yeni / düzenle / sil modalı, çakışma kontrolü, çıkış işlemi.
   Tarih bazlı gecelik fiyat.
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
    ucretLabel: document.getElementById("rez-ucret-label"),
    paraBirimi: document.getElementById("rez-para-birimi"),
    ucretGrup: document.getElementById("rez-ucret-grup"),
    toplamAnlasma: document.getElementById("rez-toplam-anlasma"),
    toplamAnlasmaLabel: document.getElementById("rez-toplam-anlasma-label"),
    topluBolOzet: document.getElementById("rez-toplu-bol-ozet"),
    tarihFiyatGrup: document.getElementById("rez-tarih-fiyat-grup"),
    tarihFiyatListe: document.getElementById("rez-tarih-fiyat-liste"),
    fiyatOzet: document.getElementById("rez-fiyat-ozet"),
    tGece: document.getElementById("rez-toplam-gece"),
    tTutar: document.getElementById("rez-toplam-tutar"),
    notlar: document.getElementById("rez-notlar"),
    btnKaydet: document.getElementById("rez-modal-kaydet"),
    btnIptal: document.getElementById("rez-modal-iptal"),
    btnSil: document.getElementById("rez-modal-sil"),
    btnClose: document.getElementById("rez-modal-close")
  });

  let mevcutRezId = null;
  let mevcutDaireId = null;
  let cikisRezId = null;
  let fiyatModu = "tek";

  const TARIH_AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const TARIH_AYLAR_UZUN = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const TARIH_GUNLER = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const TAKVIM_GUN_BAS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  let takvimGorYil = null;
  let takvimGorAy = null;

  function varsayilanUcret() {
    const daire = mevcutDaireId ? window.APARTIM.db?.daireGetir(mevcutDaireId) : null;
    return Number(daire?.gunlukUcret) || 1000;
  }

  function seciliParaBirimi() {
    return window.APARTIM.para?.paraBirimiNorm(ay().paraBirimi?.value) || "TL";
  }

  function paraSimge() {
    return window.APARTIM.para?.simge(seciliParaBirimi()) || "₺";
  }

  function ucretEtiketGuncelle() {
    const lbl = ay().ucretLabel;
    if (lbl) lbl.textContent = "Gecelik ücret *";
    const anlasmaLbl = ay().toplamAnlasmaLabel;
    if (anlasmaLbl) anlasmaLbl.textContent = "Toplam tutar *";
    document.querySelectorAll(".rez-tarih-pb").forEach((el) => {
      el.textContent = paraSimge();
    });
  }

  let anlasmaBolTimer = null;

  function toplamAnlasmaOtomatik() {
    clearTimeout(anlasmaBolTimer);
    anlasmaBolTimer = setTimeout(() => toplamAnlasmaUygula({ sessiz: true }), 350);
  }

  function fiyatYuvarla(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  /** Toplam tutarı gece sayısına eşit böler; kuruş farkı son gecelere eklenir. */
  function toplamGeceyeBol(toplam, adet) {
    const kurus = Math.round(Number(toplam) * 100);
    if (!Number.isFinite(kurus) || kurus <= 0 || adet <= 0) return null;
    const baz = Math.floor(kurus / adet);
    const fazla = kurus % adet;
    const out = [];
    for (let i = 0; i < adet; i++) {
      const ek = i >= adet - fazla ? 1 : 0;
      out.push((baz + ek) / 100);
    }
    return out;
  }

  function toplamAnlasmaSenkron(rez) {
    const inp = ay().toplamAnlasma;
    if (!inp) return;
    if (rez) {
      const { toplam } = tutarHesapla(rez);
      if (toplam > 0) alanYaz(inp, fiyatYuvarla(toplam));
      else alanYaz(inp, "");
    } else {
      alanYaz(inp, "");
    }
  }

  function toplamAnlasmaUygula(opts) {
    const sessiz = opts?.sessiz;
    if (fiyatModu !== "toplu") return;
    const e = ay();
    const raw = e.toplamAnlasma?.value;
    if (raw === "" || raw == null) {
      topluBolOzetGuncelle();
      if (!sessiz) uyariGoster("");
      toplamHesapla();
      return;
    }
    const toplam = Number(raw);
    const tarihler = geceTarihleriAl();
    if (!tarihler.length) {
      if (!sessiz) uyariGoster("Önce giriş ve çıkış tarihi seçin.");
      topluBolOzetGuncelle();
      return;
    }
    if (!Number.isFinite(toplam) || toplam <= 0) {
      if (!sessiz) uyariGoster("Geçerli bir toplam tutar girin.");
      topluBolOzetGuncelle();
      return;
    }
    uyariGoster("");
    topluBolOzetGuncelle();
    toplamHesapla();
  }

  function topluBolOzetGuncelle() {
    const el = ay().topluBolOzet;
    if (!el) return;
    const tarihler = geceTarihleriAl();
    const toplam = Number(ay().toplamAnlasma?.value);
    if (!tarihler.length || !Number.isFinite(toplam) || toplam <= 0) {
      el.textContent = tarihler.length
        ? "Toplam tutarı girin; gece fiyatları otomatik hesaplanır."
        : "Önce konaklama tarihlerini seçin.";
      return;
    }
    const parcalar = toplamGeceyeBol(toplam, tarihler.length);
    if (!parcalar) {
      el.textContent = "";
      return;
    }
    const pb = paraSimge();
    el.textContent =
      "Gece başına: " +
      parcalar.map((v) => aralikFormatla(v)).join(" · ") + " " + pb;
  }

  function fiyatModuPanelleriGuncelle() {
    document.getElementById("rez-panel-tek")?.classList.toggle("hidden", fiyatModu !== "tek");
    document.getElementById("rez-panel-ayri")?.classList.toggle("hidden", fiyatModu !== "ayri");
    document.getElementById("rez-panel-ayri-ust")?.classList.toggle("hidden", fiyatModu !== "ayri");
    document.getElementById("rez-panel-toplu")?.classList.toggle("hidden", fiyatModu !== "toplu");
    document.getElementById("rez-toplu-bol-wrap")?.classList.toggle("hidden", fiyatModu !== "toplu");
    document.querySelectorAll('input[name="rez-fiyat-mod"]').forEach((r) => {
      r.checked = r.value === fiyatModu;
    });
  }

  function tarihFiyatlariHamOku() {
    const u = Number(ay().ucret?.value) || varsayilanUcret();
    const tarihler = geceTarihleriAl();
    const out = {};
    if (!tarihler.length) return out;

    if (fiyatModu === "ayri") {
      const wrap = ay().tarihFiyatListe;
      if (wrap) {
        wrap.querySelectorAll(".rez-gece-fiyat-satir").forEach((satir) => {
          const t = satir.dataset.tarih;
          const inp = satir.querySelector(".rez-tarih-ucret");
          out[t] = Number(inp?.value) || u;
        });
      }
      tarihler.forEach((t) => {
        if (out[t] == null) out[t] = u;
      });
      return out;
    }

    if (fiyatModu === "toplu") {
      const toplam = Number(ay().toplamAnlasma?.value);
      if (Number.isFinite(toplam) && toplam > 0) {
        const parcalar = toplamGeceyeBol(toplam, tarihler.length);
        if (parcalar) {
          tarihler.forEach((t, i) => { out[t] = parcalar[i]; });
          return out;
        }
      }
    }

    tarihler.forEach((t) => { out[t] = u; });
    return out;
  }

  function fiyatModuAyarla(mod) {
    const onceki = fiyatModu;
    const mevcut = tarihFiyatlariHamOku();
    fiyatModu = mod === "ayri" || mod === "toplu" ? mod : "tek";
    fiyatModuPanelleriGuncelle();

    if (fiyatModu === "ayri") {
      tarihFiyatListeCiz(mevcut);
    } else if (fiyatModu === "toplu") {
      if (onceki !== "toplu") {
        const tarihler = geceTarihleriAl();
        const toplam = tarihler.reduce((s, t) => s + (Number(mevcut[t]) || 0), 0);
        if (toplam > 0) alanYaz(ay().toplamAnlasma, fiyatYuvarla(toplam));
      }
      topluBolOzetGuncelle();
    } else {
      const vals = Object.values(mevcut);
      if (vals.length) alanYaz(ay().ucret, vals[0]);
    }
    toplamHesapla();
  }

  function tarihGoster(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.getDate() + " " + TARIH_AYLAR[d.getMonth()] + " " + TARIH_GUNLER[d.getDay()];
  }

  function geceTarihleriAl() {
    const e = ay();
    const db = window.APARTIM.db;
    if (!db || !e.giris?.value || !e.cikis?.value) return [];
    if (e.cikis.value <= e.giris.value) return [];
    return db.geceTarihleri(e.giris.value, e.cikis.value);
  }

  function tekFiyatKayitMi(tf, giris, cikis, varsayilan) {
    if (fiyatModu === "tek") return true;
    const db = window.APARTIM.db;
    if (!tf || !db) return fiyatModu === "tek";
    return db.tarihFiyatlariTekMi(giris, cikis, tf, varsayilan);
  }

  function tarihFiyatlariOku() {
    return tarihFiyatlariHamOku();
  }

  function tarihFiyatListeCiz(fiyatlar) {
    const e = ay();
    const wrap = e.tarihFiyatListe;
    if (!wrap) return;
    const tarihler = geceTarihleriAl();
    const u = Number(e.ucret?.value) || varsayilanUcret();
    const mevcut = fiyatlar || tarihFiyatlariOku();
    wrap.innerHTML = "";
    if (!tarihler.length) {
      wrap.innerHTML = '<p class="rez-fiyat-ipucu">Önce giriş ve çıkış tarihi seçin.</p>';
      return;
    }
    tarihler.forEach((t) => {
      const satir = document.createElement("div");
      satir.className = "rez-gece-fiyat-satir";
      satir.dataset.tarih = t;
      satir.innerHTML =
        '<span class="rez-tarih-etiket">' + esc(tarihGoster(t)) + "</span>" +
        '<input type="number" class="field-input rez-tarih-ucret" min="0" step="0.01" inputmode="decimal" value="' +
        (mevcut[t] != null ? mevcut[t] : u) + '" aria-label="' + esc(tarihGoster(t)) + ' fiyat" />' +
        '<span class="rez-tarih-pb">' + paraSimge() + "</span>";
      satir.querySelector("input").addEventListener("input", toplamHesapla);
      wrap.appendChild(satir);
    });
  }

  function fiyatFormYukle(rez) {
    const db = window.APARTIM.db;
    const varsayilan = Number(rez.gunlukUcret) || varsayilanUcret();

    let tf = db?.tarihFiyatlariToObject?.(rez.tarihFiyatlari);
    if (!tf && rez.ucretKademeleri) {
      tf = {};
      const tarihler = db.geceTarihleri(rez.giris, rez.cikis);
      tarihler.forEach((t, i) => {
        tf[t] = db.rezervasyonGeceUcreti(rez, i + 1);
      });
    }

    const hepsiAyni = !tf || db.tarihFiyatlariTekMi(rez.giris, rez.cikis, tf, varsayilan);
    let u = varsayilan;
    if (hepsiAyni && tf) {
      const tarihler = db.geceTarihleri(rez.giris, rez.cikis);
      if (tarihler.length && tf[tarihler[0]] != null) {
        u = Number(tf[tarihler[0]]) || varsayilan;
      }
    }

    alanYaz(ay().ucret, u);
    fiyatModu = hepsiAyni ? "tek" : "ayri";
    fiyatModuPanelleriGuncelle();
    if (!hepsiAyni) tarihFiyatListeCiz(tf);
    else if (ay().tarihFiyatListe) ay().tarihFiyatListe.innerHTML = "";
    toplamAnlasmaSenkron({
      giris: rez.giris,
      cikis: rez.cikis,
      gunlukUcret: u,
      tarihFiyatlari: hepsiAyni ? null : tf
    });
    topluBolOzetGuncelle();
  }

  function tarihDegisti() {
    const e = ay();
    const giris = e.giris?.value || "";
    const cikis = e.cikis?.value || "";
    if (!giris || !cikis) {
      tarihAralikOzetGuncelle();
      toplamHesapla();
      return;
    }
    if (cikis <= giris) {
      e.cikis.value = gunEkle(giris, 1);
    }
    if (fiyatModu === "ayri") {
      tarihFiyatListeCiz(tarihFiyatlariOku());
    }
    if (fiyatModu === "toplu") {
      if (ay().toplamAnlasma?.value) toplamAnlasmaUygula({ sessiz: true });
      else {
        topluBolOzetGuncelle();
        toplamHesapla();
      }
    } else {
      toplamHesapla();
    }
    tarihAralikOzetGuncelle();
    tarihAralikTakvimCiz();
  }

  function isoOlustur(y, m, g) {
    return y + "-" + String(m).padStart(2, "0") + "-" + String(g).padStart(2, "0");
  }

  function isoParcala(iso) {
    const p = String(iso || "").split("-");
    return { y: Number(p[0]), m: Number(p[1]), g: Number(p[2]) };
  }

  function takvimAyAyarla(iso) {
    const ref = iso || ay().giris?.value || bugunISO();
    const { y, m } = isoParcala(ref);
    if (y && m) {
      takvimGorYil = y;
      takvimGorAy = m;
    }
  }

  function tarihAralikOzetGuncelle() {
    const el = document.getElementById("rez-tarih-aralik-ozet");
    if (!el) return;
    const giris = ay().giris?.value || "";
    const cikis = ay().cikis?.value || "";
    el.classList.remove("rez-tarih-kismi");
    if (!giris) {
      el.textContent = "Giriş gününü, ardından çıkış gününü seçin";
      el.classList.add("rez-tarih-kismi");
      return;
    }
    if (!cikis || cikis <= giris) {
      el.textContent = tarihGoster(giris) + " — çıkış gününü seçin";
      el.classList.add("rez-tarih-kismi");
      return;
    }
    const gece = window.APARTIM.db?.geceSayisi(giris, cikis) || 0;
    el.textContent =
      tarihGoster(giris) + " → " + tarihGoster(cikis) +
      " (" + gece + " gece)";
  }

  function tarihAralikKismiSec(giris) {
    alanYaz(ay().giris, giris);
    alanYaz(ay().cikis, "");
    tarihAralikOzetGuncelle();
    tarihAralikTakvimCiz();
    toplamHesapla();
  }

  function tarihAralikTamamla(giris, cikis) {
    alanYaz(ay().giris, giris);
    alanYaz(ay().cikis, cikis);
    tarihDegisti();
  }

  function tarihAralikGunTik(iso) {
    const giris = ay().giris?.value || "";
    const cikis = ay().cikis?.value || "";
    const tamSecili = giris && cikis && cikis > giris;
    if (!giris || tamSecili) {
      tarihAralikKismiSec(iso);
      return;
    }
    if (iso <= giris) {
      tarihAralikKismiSec(iso);
      return;
    }
    tarihAralikTamamla(giris, iso);
  }

  function tarihAralikHucreSinif(iso, giris, cikis, bugun) {
    let cls = "mini-takvim-hucre";
    if (iso === bugun) cls += " bugun";
    if (giris && cikis && cikis > giris) {
      if (iso === giris) cls += " aralik-bas";
      else if (iso === cikis) cls += " aralik-bit";
      else if (iso > giris && iso < cikis) cls += " aralik-ic";
    } else if (giris && iso === giris) {
      cls += " aralik-bas";
    }
    return cls;
  }

  function tarihAralikTakvimCiz() {
    const wrap = document.getElementById("rez-tarih-aralik-takvim");
    if (!wrap) return;
    if (takvimGorYil == null || takvimGorAy == null) takvimAyAyarla();
    const y = takvimGorYil;
    const m = takvimGorAy;
    const bugun = bugunISO();
    const giris = ay().giris?.value || "";
    const cikis = ay().cikis?.value || "";
    const ilkGun = new Date(y, m - 1, 1);
    const gunSay = new Date(y, m, 0).getDate();
    let basInd = ilkGun.getDay() - 1;
    if (basInd < 0) basInd = 6;

    let html =
      '<div class="rez-tarih-aralik-nav">' +
      '<button type="button" class="rez-tarih-aralik-nav-btn" data-rez-ay="-1" aria-label="Önceki ay">‹</button>' +
      '<span class="rez-tarih-aralik-ay">' + TARIH_AYLAR_UZUN[m - 1] + " " + y + "</span>" +
      '<button type="button" class="rez-tarih-aralik-nav-btn" data-rez-ay="1" aria-label="Sonraki ay">›</button>' +
      "</div>" +
      '<div class="mini-takvim"><div class="mini-takvim-baslik">';
    TAKVIM_GUN_BAS.forEach((g) => { html += "<span>" + g + "</span>"; });
    html += '</div><div class="mini-takvim-grid">';

    for (let i = 0; i < basInd; i++) {
      html += '<div class="mini-takvim-hucre disabled" aria-hidden="true"></div>';
    }
    for (let g = 1; g <= gunSay; g++) {
      const iso = isoOlustur(y, m, g);
      const cls = tarihAralikHucreSinif(iso, giris, cikis, bugun);
      let etiket = "";
      if (iso === giris) etiket = '<span class="rez-tarih-aralik-etiket">GİRİŞ</span>';
      else if (cikis && iso === cikis) etiket = '<span class="rez-tarih-aralik-etiket">ÇIKIŞ</span>';
      html +=
        '<button type="button" class="' + cls + '" data-rez-gun="' + iso + '" aria-label="' +
        esc(tarihGoster(iso)) + '">' +
        '<span class="mini-takvim-gun">' + g + "</span>" + etiket + "</button>";
    }
    html += "</div></div>";
    wrap.innerHTML = html;

    wrap.querySelectorAll("[data-rez-gun]").forEach((btn) => {
      btn.addEventListener("click", () => tarihAralikGunTik(btn.dataset.rezGun));
    });

    wrap.querySelector("[data-rez-ay='-1']")?.addEventListener("click", () => {
      takvimGorAy -= 1;
      if (takvimGorAy < 1) { takvimGorAy = 12; takvimGorYil -= 1; }
      tarihAralikTakvimCiz();
    });
    wrap.querySelector("[data-rez-ay='1']")?.addEventListener("click", () => {
      takvimGorAy += 1;
      if (takvimGorAy > 12) { takvimGorAy = 1; takvimGorYil += 1; }
      tarihAralikTakvimCiz();
    });
  }

  function tarihAralikFormSenkron() {
    takvimAyAyarla(ay().giris?.value || bugunISO());
    tarihAralikOzetGuncelle();
    tarihAralikTakvimCiz();
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
    const gor = window.APARTIM.gorunum;
    if (gor?.bugunISO) return gor.bugunISO();
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

  function modalAcikGuncelle() {
    window.APARTIM.app?.modalAcikGuncelle?.();
  }

  function modalBodyeSabitle() {
    const el = modal();
    if (!el) return;
    window.APARTIM.rezOzet?.modalRezBodyeAl?.();
    document.getElementById("rez-ozet-modal-host")?.setAttribute("aria-hidden", "true");
    document.getElementById("takvim-detay-pop")?.classList.add("hidden");
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    } else if (el !== document.body.lastElementChild) {
      document.body.appendChild(el);
    }
  }

  function modalAc() {
    modalBodyeSabitle();
    modal()?.classList.remove("hidden");
    modalAcikGuncelle();
    window.APARTIM.modalKlavye?.viewportGuncelle?.();
    const dokunmatik = window.APARTIM.modalKlavye?.mobilFormMu?.() ||
      window.matchMedia("(pointer: coarse)").matches;
    if (!dokunmatik) {
      setTimeout(() => ay().misafir?.focus({ preventScroll: true }), 80);
    }
  }
  function modalKapat() {
    modal()?.classList.add("hidden");
    window.APARTIM.modalKlavye?.viewportTemizle?.();
    mevcutRezId = null;
    mevcutDaireId = null;
    modalAcikGuncelle();
    const e = ay();
    if (e.uyari) { e.uyari.classList.add("hidden"); e.uyari.textContent = ""; }
  }

  function fiyatOzetMetni(rez) {
    const { gece, gecelik } = tutarHesapla(rez);
    if (!gece || !gecelik.length) return "";
    const parcalar = [];
    let i = 0;
    while (i < gecelik.length) {
      const u = gecelik[i].ucret;
      const basTarih = gecelik[i].tarih;
      let bitTarih = basTarih;
      while (i + 1 < gecelik.length && gecelik[i + 1].ucret === u) {
        i++;
        bitTarih = gecelik[i].tarih;
      }
      const aralik = basTarih === bitTarih
        ? tarihGoster(basTarih)
        : tarihGoster(basTarih) + "–" + tarihGoster(bitTarih);
      parcalar.push(aralik + " " + aralikFormatla(u) + " " + paraSimge());
      i++;
    }
    return parcalar.join(" · ");
  }

  function toplamHesapla() {
    try {
      const e = ay();
      const g = e.giris?.value;
      const c = e.cikis?.value;
      const u = Number(e.ucret?.value) || varsayilanUcret();
      const tf = tarihFiyatlariOku();
      const tekKayit = tekFiyatKayitMi(tf, g, c, u);
      const rez = {
        giris: g,
        cikis: c,
        gunlukUcret: u,
        tarihFiyatlari: tekKayit ? null : tf
      };
      const { gece, toplam } = tutarHesapla(rez);
      if (e.tGece) e.tGece.textContent = gece + " gece";
      if (e.tTutar) {
        e.tTutar.textContent = window.APARTIM.para
          ? window.APARTIM.para.formatTutar(toplam, seciliParaBirimi())
          : aralikFormatla(toplam) + " TL";
      }
      if (e.fiyatOzet) {
        e.fiyatOzet.textContent =
          fiyatModu !== "tek" && gece > 0 ? fiyatOzetMetni(rez) : "";
      }
    } catch (err) {
      console.warn("toplamHesapla:", err);
    }
  }

  function uyariGoster(msg) {
    const e = ay();
    if (!e.uyari) {
      if (msg) window.APARTIM.toast(msg, "uyari");
      return;
    }
    if (!msg) {
      e.uyari.classList.add("hidden");
      e.uyari.textContent = "";
      return;
    }
    e.uyari.classList.remove("hidden");
    e.uyari.textContent = msg;
  }

  function kaydetHata(msg) {
    uyariGoster(msg);
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
      takvimAyAyarla(gIso);
      const u = daire ? daire.gunlukUcret : 1000;
      alanYaz(e.ucret, u);
      if (e.paraBirimi) e.paraBirimi.value = "TL";
      ucretEtiketGuncelle();
      fiyatModuAyarla("tek");
      alanYaz(e.toplamAnlasma, "");
      alanYaz(e.notlar, "");
      e.btnSil?.classList.add("hidden");
      uyariGoster("");
      toplamHesapla();
      tarihAralikFormSenkron();
      window.APARTIM.rezOzet?.konumKoru?.(gIso);
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
      fiyatFormYukle(rez);
      if (e.paraBirimi) {
        e.paraBirimi.value = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
      }
      ucretEtiketGuncelle();
      alanYaz(e.notlar, rez.notlar || "");
      e.btnSil?.classList.remove("hidden");
      uyariGoster("");
      toplamHesapla();
      tarihAralikFormSenkron();
      toplamAnlasmaSenkron({
        giris: e.giris.value,
        cikis: e.cikis.value,
        gunlukUcret: Number(e.ucret?.value) || varsayilanUcret(),
        tarihFiyatlari: fiyatModu === "tek" ? null : tarihFiyatlariOku()
      });
      window.APARTIM.rezOzet?.konumKoru?.(rez.giris);
      modalAc();
    } catch (err) {
      console.error("rezervasyon.duzenle", err);
      window.APARTIM.toast("Rezervasyon açılamadı", "hata");
    }
  }

  function tarihFiyatDogrula(tf) {
    if (fiyatModu === "tek") return "";
    const tarihler = geceTarihleriAl();
    if (!tarihler.length) return "Geçerli tarih aralığı seçin.";
    if (fiyatModu === "toplu") {
      const toplam = Number(ay().toplamAnlasma?.value);
      if (!Number.isFinite(toplam) || toplam <= 0) return "Toplam tutar 0'dan büyük olmalı.";
      return "";
    }
    for (const t of tarihler) {
      const f = Number(tf[t]) || 0;
      if (f <= 0) return tarihGoster(t) + " için fiyat 0'dan büyük olmalı.";
    }
    return "";
  }

  async function kaydet() {
    const e = ay();
    let kaydediliyor = false;
    try {
      if (!window.APARTIM.db?.rezervasyonEkle) {
        kaydetHata("Veri katmanı yüklenemedi. Sayfayı yenileyin.");
        return;
      }
      if (!window.APARTIM.db.durum?.yuklendi) {
        kaydetHata("Veriler henüz yüklenmedi. Birkaç saniye bekleyin.");
        return;
      }

      const misafir = (e.misafir?.value || "").trim();
      const giris = e.giris?.value || "";
      const cikis = e.cikis?.value || "";
      const tfHam = tarihFiyatlariOku();
      const ucretTek = Number(e.ucret?.value) || varsayilanUcret() || 1000;
      const ucretDeger = fiyatModu === "tek"
        ? ucretTek
        : (Object.values(tfHam)[0] || varsayilanUcret());
      const tekKayit = tekFiyatKayitMi(tfHam, giris, cikis, ucretTek);

      if (!misafir) { kaydetHata("Misafir adı zorunlu."); return; }
      if (!giris || !cikis) { kaydetHata("Tarihler zorunlu."); return; }
      if (cikis <= giris) { kaydetHata("Çıkış tarihi girişten sonra olmalı."); return; }
      if (fiyatModu === "tek" && ucretTek <= 0) { kaydetHata("Gecelik ücret 0'dan büyük olmalı."); return; }

      const tf = tekKayit ? null : tfHam;
      const fiyatHata = tarihFiyatDogrula(tfHam || {});
      if (fiyatHata) { kaydetHata(fiyatHata); return; }

      kaynakSelectDoldur(e.kaynak?.value || null);
      const kaynakId = e.kaynak?.value || "";
      if (!kaynakId) { kaydetHata("Müşteri kaynağı seçin."); return; }

      if (!mevcutDaireId) { kaydetHata("Daire seçilemedi. Modalı kapatıp tekrar deneyin."); return; }

      const veri = {
        daireId: mevcutDaireId,
        kaynakId,
        misafirAdi: misafir,
        telefon: (e.telefon?.value || "").trim(),
        giris,
        cikis,
        gunlukUcret: ucretDeger,
        paraBirimi: seciliParaBirimi(),
        notlar: (e.notlar?.value || "").trim(),
        tarihFiyatlari: tf,
        ucretKademeleri: null
      };

      kaydediliyor = true;
      if (e.btnKaydet) {
        e.btnKaydet.disabled = true;
        e.btnKaydet.textContent = "Kaydediliyor…";
      }

      window.APARTIM.rezOzet?.konumKoru?.(giris);

      if (mevcutRezId) {
        await window.APARTIM.db.rezervasyonGuncelle(mevcutRezId, veri);
        window.APARTIM.toast("Rezervasyon güncellendi", "basari");
      } else {
        await window.APARTIM.db.rezervasyonEkle(veri);
        window.APARTIM.toast("Rezervasyon kaydedildi", "basari");
      }
      modalKapat();
      window.APARTIM.takvim?.yenidenCiz();
    } catch (err) {
      console.error("rezervasyon.kaydet", err);
      kaydetHata(err?.message || "Kayıt başarısız.");
    } finally {
      if (kaydediliyor && e.btnKaydet) {
        e.btnKaydet.disabled = false;
        e.btnKaydet.textContent = "Kaydet";
      }
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
      const bg = window.APARTIM.db.bugunISO();
      const yeniCikis = bg > rez.giris ? bg : gunEkle(rez.giris, 1);
      await window.APARTIM.db.rezervasyonGuncelle(cikisRezId, { cikis: yeniCikis });
      window.APARTIM.toast("Çıkış tamamlandı", "basari");
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
    const db = window.APARTIM.db;
    const fiyatNot = db?.tarihFiyatlariToObject?.(rez.tarihFiyatlari) &&
      !db.tarihFiyatlariTekMi(rez.giris, rez.cikis, rez.tarihFiyatlari, rez.gunlukUcret)
      ? " · Tarihli fiyat"
      : (rez.ucretKademeleri ? " · Kademeli fiyat" : "");
    const pb = window.APARTIM.para?.rezParaBirimi(rez) || "TL";
    const tutarMetin = window.APARTIM.para
      ? window.APARTIM.para.formatTutar(rez.toplamTutar || 0, pb)
      : aralikFormatla(rez.toplamTutar || 0) + " TL";

    div.innerHTML =
      '<div class="rez-kart-ust">' +
        '<span class="rez-kart-misafir">' + esc(rez.misafirAdi || "Misafir") + '</span>' +
        '<span class="rez-kaynak-badge" title="' + esc(kaynakAd) + '">' + esc(kaynakSimge) + ' ' + esc(kaynakAd) + '</span>' +
        '<span class="rez-kart-tutar">' + tutarMetin + '</span>' +
      '</div>' +
      '<div class="rez-kart-orta">' +
        '<span>' + (daire ? esc(daire.ad) : esc(rez.daireId)) + '</span>' +
        '<span class="ok">•</span>' +
        '<span>' + rez.giris + ' <span class="ok">→</span> ' + rez.cikis + '</span>' +
        '<span class="ok">•</span>' +
        '<span>' + (rez.toplamGece || 0) + ' gece' + fiyatNot + '</span>' +
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

  function daireRezListele(daireId) { listeRender("rez-liste-icerik", daireId); }

  function rezModalTikIslem(btn) {
    if (!btn?.id) return false;
    if (btn.id === "rez-modal-iptal" || btn.id === "rez-modal-close") {
      modalKapat();
      return true;
    }
    if (btn.id === "rez-modal-kaydet") {
      kaydet();
      return true;
    }
    if (btn.id === "rez-modal-sil") {
      silOnay();
      return true;
    }
    return false;
  }

  function rezModalTiklamaBagla() {
    const ov = modal();
    if (!ov || ov.dataset.rezTikBagli) return;
    ov.dataset.rezTikBagli = "1";

    ov.addEventListener("click", (e) => {
      const btn = e.target.closest?.(
        "#rez-modal-iptal, #rez-modal-close, #rez-modal-kaydet, #rez-modal-sil"
      );
      if (btn && ov.contains(btn)) {
        e.preventDefault();
        rezModalTikIslem(btn);
        return;
      }
      if (e.target === ov) modalKapat();
    });

    if (window._rezModalDocTikBagli) return;
    window._rezModalDocTikBagli = true;

    document.addEventListener("pointerup", (e) => {
      const el = modal();
      if (!el || el.classList.contains("hidden")) return;
      const btn = e.target.closest?.(
        "#rez-modal-iptal, #rez-modal-close, #rez-modal-kaydet, #rez-modal-sil"
      );
      if (btn && el.contains(btn)) {
        e.preventDefault();
        e.stopPropagation();
        rezModalTikIslem(btn);
        return;
      }
      if (e.target === el) {
        e.preventDefault();
        e.stopPropagation();
        modalKapat();
      }
    }, true);
  }

  function bagla() {
    const e = ay();
    rezModalTiklamaBagla();
    e.btnIptal?.addEventListener("click", modalKapat);
    e.btnClose?.addEventListener("click", modalKapat);
    e.btnKaydet?.addEventListener("click", kaydet);
    e.btnSil?.addEventListener("click", silOnay);
    e.ucret?.addEventListener("input", toplamHesapla);
    e.paraBirimi?.addEventListener("change", () => {
      ucretEtiketGuncelle();
      if (fiyatModu === "ayri") tarihFiyatListeCiz(tarihFiyatlariOku());
      if (fiyatModu === "toplu") topluBolOzetGuncelle();
      toplamHesapla();
    });
    document.querySelectorAll('input[name="rez-fiyat-mod"]').forEach((r) => {
      r.addEventListener("change", () => {
        if (r.checked) fiyatModuAyarla(r.value);
      });
    });
    e.toplamAnlasma?.addEventListener("input", toplamAnlasmaOtomatik);
    e.toplamAnlasma?.addEventListener("change", () => toplamAnlasmaUygula({ sessiz: true }));
    document.getElementById("rez-yeni-btn")?.addEventListener("click", () => yeni({}));
    document.getElementById("cikis-close")?.addEventListener("click", cikisKapat);
    document.getElementById("cikis-iptal")?.addEventListener("click", cikisKapat);
    document.getElementById("cikis-onayla")?.addEventListener("click", cikisOnayla);
    document.addEventListener("keydown", (e) => {
      const el = modal();
      if (!el || el.classList.contains("hidden")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        modalKapat();
      }
    });
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
    if (modal() && !modal().classList.contains("hidden") && ay().kaynak) {
      const secili = ay().kaynak.value;
      kaynakSelectDoldur(secili || null);
    }
  });

  window.APARTIM.rezervasyon = {
    yeni,
    duzenle,
    modalKapat,
    kaydet,
    rezIdAl,
    cikisAc,
    listeRender,
    daireRezListele,
    kartOlustur,
    onayAc
  };
})();
