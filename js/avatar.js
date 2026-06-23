/* =========================================================
   APARTIM — Profil avatarları
   ========================================================= */

(function () {
  "use strict";

  const V = "20260810";
  const VARSAYILAN = "ev";

  const AVATARLAR = [
    { id: "ev", etiket: "Apart ev", src: "icons/logo-ev.png", png: true },
    { id: "apart", etiket: "Apart otel", src: "icons/avatars/apart.svg" },
    { id: "kamp", etiket: "Kamp", src: "icons/avatars/kamp.svg" },
    { id: "doga", etiket: "Doğa", src: "icons/avatars/doga.svg" },
    { id: "deniz", etiket: "Deniz", src: "icons/avatars/deniz.svg" },
    { id: "dag", etiket: "Dağ", src: "icons/avatars/dag.svg" },
    { id: "gece", etiket: "Gece", src: "icons/avatars/gece.svg" },
    { id: "orman", etiket: "Orman", src: "icons/avatars/orman.svg" }
  ];

  const byId = {};
  AVATARLAR.forEach((a) => { byId[a.id] = a; });

  function srcUrl(avatarId) {
    const a = byId[avatarId] || byId[VARSAYILAN];
    return a.src + (a.png ? "" : "?v=" + V);
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

  window.APARTIM.avatar = {
    VERSIYON: V,
    VARSAYILAN,
    liste: AVATARLAR,
    srcUrl,
    coz,
    guncelle,
    kullaniciyaEkle,
    logoEv: "icons/logo-ev.png",
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
