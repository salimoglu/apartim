/* =========================================================
   APARTIM — Bina (ana ekran)
   Gercek illustrasyon arka plan + tiklanabilir 5 daire hotspot.
   ========================================================= */

(function () {
  "use strict";

  const wrap = () => document.getElementById("bina-svg-wrap");

  // ViewBox illustrasyonun gercek piksel boyutuyla aynı (1024 x 792).
  // Hotspot koordinatlari bu sisteme gore belirlenmis.
  const SVG = `
<svg class="bina-svg" viewBox="0 0 1024 792" xmlns="http://www.w3.org/2000/svg" aria-label="Apartım binası" preserveAspectRatio="xMidYMid meet">
  <defs>
    <filter id="binaSg" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-opacity="0.55"/>
    </filter>
    <filter id="noktaSg" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- ILLUSTRASYON ARKA PLAN -->
  <image href="icons/apart-illustrasyon.png" x="0" y="0" width="1024" height="792" filter="url(#binaSg)"/>

  <!-- =============== HOTSPOTLAR =============== -->
  <!-- UST KAT (tek daire — ucgen + ust pencereler) -->
  <g class="daire" data-daire-id="ust" tabindex="0" role="button" aria-label="Üst Kat dairesi">
    <rect class="daire-bolge" x="260" y="80" width="510" height="220" rx="14"/>
    <g class="daire-etiket-grup" transform="translate(420, 200)">
      <rect x="-46" y="-18" width="92" height="34" rx="17" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="6" text-anchor="middle">ÜST KAT</text>
    </g>
    <!-- Durum noktasi (yuvarlatici beyaz halka icinde) -->
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="745" cy="115" r="20" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="745" cy="115" r="13"/>
    </g>
  </g>

  <!-- ORTA SOL -->
  <g class="daire" data-daire-id="orta-sol" tabindex="0" role="button" aria-label="Orta Kat - Sol dairesi">
    <rect class="daire-bolge" x="80" y="305" width="425" height="170" rx="14"/>
    <g class="daire-etiket-grup" transform="translate(290, 395)">
      <rect x="-46" y="-18" width="92" height="34" rx="17" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="6" text-anchor="middle">ORTA SOL</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="480" cy="332" r="20" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="480" cy="332" r="13"/>
    </g>
  </g>

  <!-- ORTA SAG -->
  <g class="daire" data-daire-id="orta-sag" tabindex="0" role="button" aria-label="Orta Kat - Sağ dairesi">
    <rect class="daire-bolge" x="515" y="305" width="425" height="170" rx="14"/>
    <g class="daire-etiket-grup" transform="translate(725, 395)">
      <rect x="-46" y="-18" width="92" height="34" rx="17" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="6" text-anchor="middle">ORTA SAĞ</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="900" cy="332" r="20" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="900" cy="332" r="13"/>
    </g>
  </g>

  <!-- ALT SOL -->
  <g class="daire" data-daire-id="alt-sol" tabindex="0" role="button" aria-label="Alt Kat - Sol dairesi">
    <rect class="daire-bolge" x="80" y="488" width="425" height="200" rx="14"/>
    <g class="daire-etiket-grup" transform="translate(290, 600)">
      <rect x="-46" y="-18" width="92" height="34" rx="17" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="6" text-anchor="middle">ALT SOL</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="480" cy="515" r="20" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="480" cy="515" r="13"/>
    </g>
  </g>

  <!-- ALT SAG -->
  <g class="daire" data-daire-id="alt-sag" tabindex="0" role="button" aria-label="Alt Kat - Sağ dairesi">
    <rect class="daire-bolge" x="515" y="488" width="425" height="200" rx="14"/>
    <g class="daire-etiket-grup" transform="translate(725, 600)">
      <rect x="-46" y="-18" width="92" height="34" rx="17" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="6" text-anchor="middle">ALT SAĞ</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="900" cy="515" r="20" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="900" cy="515" r="13"/>
    </g>
  </g>
</svg>`;

  function binayiCiz() {
    const w = wrap();
    if (!w) return;
    w.innerHTML = SVG;
    w.querySelectorAll(".daire").forEach((g) => {
      g.addEventListener("click", () => {
        const id = g.getAttribute("data-daire-id");
        if (window.APARTIM.daire && id) window.APARTIM.daire.ac(id);
      });
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const id = g.getAttribute("data-daire-id");
          if (window.APARTIM.daire && id) window.APARTIM.daire.ac(id);
        }
      });
    });
    durumlariGuncelle();
  }

  function durumlariGuncelle() {
    const db = window.APARTIM.db;
    if (!db || !db.durum.yuklendi) return;
    const w = wrap();
    if (!w) return;
    const liste = db.dairelerListele();

    let dolu = 0, bosTemiz = 0, bosKirli = 0, temizleniyor = 0;
    liste.forEach((d) => {
      const dr = db.daireDurumuBugun(d.id);
      const g = w.querySelector('.daire[data-daire-id="' + d.id + '"]');
      if (!g) return;
      g.classList.remove("daire-dolu", "daire-bos-temiz", "daire-bos-kirli", "daire-temizleniyor");
      g.classList.add("daire-" + dr.durum);

      const nokta = g.querySelector(".durum-nokta");
      if (nokta) {
        nokta.classList.remove(
          "durum-nokta-bos-temiz",
          "durum-nokta-dolu",
          "durum-nokta-bos-kirli",
          "durum-nokta-temizleniyor"
        );
        nokta.classList.add("durum-nokta-" + dr.durum);
      }

      if (dr.durum === "dolu") dolu++;
      else if (dr.durum === "bos-temiz") bosTemiz++;
      else if (dr.durum === "bos-kirli") bosKirli++;
      else if (dr.durum === "temizleniyor") temizleniyor++;
    });

    setText("ozet-toplam", liste.length);
    setText("ozet-dolu", dolu);
    setText("ozet-bos", bosTemiz);
    setText("ozet-kirli", bosKirli + temizleniyor);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  document.addEventListener("apartim:veri-degisti", durumlariGuncelle);
  document.addEventListener("apartim:gun-degisti", durumlariGuncelle);

  window.APARTIM.bina = {
    ciz: binayiCiz,
    guncelle: durumlariGuncelle
  };
})();
