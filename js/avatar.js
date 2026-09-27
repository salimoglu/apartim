/* =========================================================
   APARTIM — Profil avatarları
   ========================================================= */

(function () {
  "use strict";

  const V = (window.APARTIM_VERSION && window.APARTIM_VERSION.ASSET) || "3.75";
  const VARSAYILAN = "ev";

  const AVATARLAR = [
    { id: "uzungol", etiket: "Uzungöl", src: "icons/avatars/uzungol.svg" },
    { id: "cami", etiket: "Cami", src: "icons/avatars/cami.svg" },
    { id: "yayla", etiket: "Yayla", src: "icons/avatars/yayla.svg" },
    { id: "iskele", etiket: "İskele", src: "icons/avatars/iskele.svg" },
    { id: "otel", etiket: "Apart otel", src: "icons/avatars/otel.svg" },
    { id: "bungalov", etiket: "Bungalov", src: "icons/avatars/bungalov.svg" },
    { id: "balkon", etiket: "Balkon", src: "icons/avatars/balkon.svg" },
    { id: "anahtar", etiket: "Anahtar", src: "icons/avatars/anahtar.svg" },
    { id: "zil", etiket: "Zil", src: "icons/avatars/zil.svg" },
    { id: "kedi", etiket: "Kedi", src: "icons/avatars/kedi.svg" },
    { id: "kopek", etiket: "Köpek", src: "icons/avatars/kopek.svg" },
    { id: "tavsan", etiket: "Tavşan", src: "icons/avatars/tavsan.svg" },
    { id: "ayi", etiket: "Ayı", src: "icons/avatars/ayi.svg" },
    { id: "panda", etiket: "Panda", src: "icons/avatars/panda.svg" },
    { id: "tilki", etiket: "Tilki", src: "icons/avatars/tilki.svg" },
    { id: "penguen", etiket: "Penguen", src: "icons/avatars/penguen.svg" },
    { id: "koala", etiket: "Koala", src: "icons/avatars/koala.svg" },
    { id: "kirpi", etiket: "Kirpi", src: "icons/avatars/kirpi.svg" },
    { id: "baykus", etiket: "Baykuş", src: "icons/avatars/baykus.svg" },
    { id: "kus", etiket: "Kuş", src: "icons/avatars/kus.svg" },
    { id: "civciv", etiket: "Civciv", src: "icons/avatars/civciv.svg" },
    { id: "flamingo", etiket: "Flamingo", src: "icons/avatars/flamingo.svg" },
    { id: "marti", etiket: "Martı", src: "icons/avatars/marti.svg" },
    { id: "kelebek", etiket: "Kelebek", src: "icons/avatars/kelebek.svg" },
    { id: "ari", etiket: "Arı", src: "icons/avatars/ari.svg" },
    { id: "yunus", etiket: "Yunus", src: "icons/avatars/yunus.svg" },
    { id: "kaplumbaga", etiket: "Kaplumbağa", src: "icons/avatars/kaplumbaga.svg" },
    { id: "cicek", etiket: "Çiçek", src: "icons/avatars/cicek.svg" },
    { id: "papatya", etiket: "Papatya", src: "icons/avatars/papatya.svg" },
    { id: "lale", etiket: "Lale", src: "icons/avatars/lale.svg" },
    { id: "gul", etiket: "Gül", src: "icons/avatars/gul.svg" },
    { id: "cilek", etiket: "Çilek", src: "icons/avatars/cilek.svg" },
    { id: "kalp", etiket: "Kalp", src: "icons/avatars/kalp.svg" },
    { id: "yildiz", etiket: "Yıldız", src: "icons/avatars/yildiz.svg" },
    { id: "gunes", etiket: "Güneş", src: "icons/avatars/gunes.svg" },
    { id: "bulut", etiket: "Bulut", src: "icons/avatars/bulut.svg" },
    { id: "kahve", etiket: "Kahve", src: "icons/avatars/kahve.svg" },
    { id: "dondurma", etiket: "Dondurma", src: "icons/avatars/dondurma.svg" },
    { id: "pasta", etiket: "Pasta", src: "icons/avatars/pasta.svg" },
    { id: "kurabiye", etiket: "Kurabiye", src: "icons/avatars/kurabiye.svg" },
    { id: "balon", etiket: "Balon", src: "icons/avatars/balon.svg" },
    { id: "ev", etiket: "Ev", src: "icons/avatars/ev.svg" },
    { id: "apart", etiket: "Apart", src: "icons/avatars/apart.svg" },
    { id: "deniz", etiket: "Deniz", src: "icons/avatars/deniz.svg" },
    { id: "doga", etiket: "Doğa", src: "icons/avatars/doga.svg" },
    { id: "dag", etiket: "Dağ", src: "icons/avatars/dag.svg" },
    { id: "orman", etiket: "Orman", src: "icons/avatars/orman.svg" },
    { id: "kamp", etiket: "Kamp", src: "icons/avatars/kamp.svg" },
    { id: "gece", etiket: "Gece", src: "icons/avatars/gece.svg" }
  ];

  const byId = {};
  AVATARLAR.forEach((a) => { byId[a.id] = a; });

  function srcUrl(avatarId) {
    const a = byId[avatarId] || byId[VARSAYILAN];
    return a.src + "?v=" + V;
  }

  function coz(kullanici) {
    if (!kullanici) return srcUrl(VARSAYILAN);
    if (kullanici.avatarId && byId[kullanici.avatarId]) {
      return srcUrl(kullanici.avatarId);
    }
    if (kullanici.googleFoto) return kullanici.googleFoto;
    return srcUrl(VARSAYILAN);
  }

  function guncelle(imgEl, kullanici) {
    if (!imgEl) return;
    imgEl.src = coz(kullanici);
    imgEl.referrerPolicy = "no-referrer";
  }

  function kullaniciyaEkle(k) {
    if (!k) return k;
    const out = Object.assign({}, k);
    out.foto = coz(k);
    return out;
  }

  function depoKey(uid) {
    return "apartim-avatar-" + (uid || "");
  }

  function depoOku(uid) {
    if (!uid) return null;
    try {
      const id = localStorage.getItem(depoKey(uid));
      return id && byId[id] ? id : null;
    } catch (e) {
      return null;
    }
  }

  function depoYaz(uid, avatarId) {
    if (!uid || !avatarId || !byId[avatarId]) return;
    try {
      localStorage.setItem(depoKey(uid), avatarId);
    } catch (e) {}
  }

  function depoSil(uid) {
    if (!uid) return;
    try {
      localStorage.removeItem(depoKey(uid));
    } catch (e) {}
  }

  window.APARTIM.avatar = {
    VERSIYON: V,
    VARSAYILAN,
    liste: AVATARLAR,
    srcUrl,
    coz,
    guncelle,
    kullaniciyaEkle,
    depoOku,
    depoYaz,
    depoSil,
    seciciAc,
    seciciKapat
  };

  function seciliIsaretle(avatarId) {
    document.querySelectorAll(".avatar-secim-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.avatarId === avatarId);
    });
  }

  function seciciCiz() {
    const grid = document.getElementById("avatar-secim-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const mevcut = window.APARTIM.kullanici?.avatarId || VARSAYILAN;
    AVATARLAR.forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "avatar-secim-btn" + (a.id === mevcut ? " active" : "");
      btn.dataset.avatarId = a.id;
      btn.title = a.etiket;
      btn.innerHTML =
        '<img src="' + srcUrl(a.id) + '" alt="' + a.etiket + '" width="64" height="64" decoding="async" />' +
        '<span>' + a.etiket + "</span>";
      btn.addEventListener("click", async () => {
        seciliIsaretle(a.id);
        if (window.APARTIM.db?.profilAvatarKaydet) {
          await window.APARTIM.db.profilAvatarKaydet(a.id);
        }
        window.APARTIM.toast?.("Profil fotoğrafı güncellendi", "bilgi");
        seciciKapat();
        document.getElementById("ayar-menu")?.classList.add("hidden");
      });
      grid.appendChild(btn);
    });
  }

  function seciciAc() {
    seciciCiz();
    document.getElementById("modal-avatar")?.classList.remove("hidden");
  }

  function seciciKapat() {
    document.getElementById("modal-avatar")?.classList.add("hidden");
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ayar-profil")?.addEventListener("click", () => {
      seciciAc();
    });
    document.getElementById("avatar-close")?.addEventListener("click", seciciKapat);
    document.getElementById("modal-avatar")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-avatar") seciciKapat();
    });
  });
})();
