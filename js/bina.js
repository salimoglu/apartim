/* =========================================================
   APARTIM — Bina (ana ekran)
   Gercek illustrasyon arka plan + tiklanabilir 5 daire hotspot.
   ========================================================= */

(function () {
  "use strict";

  const wrap = () => document.getElementById("bina-svg-wrap");

  // ViewBox illustrasyonun gercek piksel boyutuyla aynı (1024 x 792).
  // Hotspot koordinatlari binanın gercek daire konumlarina hizali:
  //   UST KAT     : x=80-940,  y=100-360  (ucgen + buyuk ortadakiler + yan kucukler)
  //   ORTA SOL    : x=80-510,  y=365-545  (sol 2 buyuk pencere)
  //   ORTA SAG    : x=514-940, y=365-545  (sag 2 buyuk pencere)
  //   ALT SOL     : x=50-510,  y=550-735  (tas cephe sol, 2 kapi + pencereler)
  //   ALT SAG     : x=514-985, y=550-735  (tas cephe sag, 2 kapi + pencereler)
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
  <!-- UST KAT (tek daire) -->
  <g class="daire" data-daire-id="ust" tabindex="0" role="button" aria-label="Üst Kat dairesi">
    <rect class="daire-bolge" x="80" y="100" width="860" height="260" rx="16"/>
    <g class="daire-etiket-grup" transform="translate(512, 235)">
      <rect x="-58" y="-22" width="116" height="40" rx="20" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ÜST KAT</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="895" cy="138" r="22" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="895" cy="138" r="14"/>
    </g>
  </g>

  <!-- ORTA SOL -->
  <g class="daire" data-daire-id="orta-sol" tabindex="0" role="button" aria-label="Orta Kat - Sol dairesi">
    <rect class="daire-bolge" x="80" y="365" width="432" height="180" rx="16"/>
    <g class="daire-etiket-grup" transform="translate(296, 458)">
      <rect x="-62" y="-22" width="124" height="40" rx="20" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ORTA SOL</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="490" cy="395" r="22" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="490" cy="395" r="14"/>
    </g>
  </g>

  <!-- ORTA SAG -->
  <g class="daire" data-daire-id="orta-sag" tabindex="0" role="button" aria-label="Orta Kat - Sağ dairesi">
    <rect class="daire-bolge" x="514" y="365" width="426" height="180" rx="16"/>
    <g class="daire-etiket-grup" transform="translate(727, 458)">
      <rect x="-62" y="-22" width="124" height="40" rx="20" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ORTA SAĞ</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="918" cy="395" r="22" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="918" cy="395" r="14"/>
    </g>
  </g>

  <!-- ALT SOL (tas cephe) -->
  <g class="daire" data-daire-id="alt-sol" tabindex="0" role="button" aria-label="Alt Kat - Sol dairesi">
    <rect class="daire-bolge" x="50" y="550" width="462" height="185" rx="16"/>
    <g class="daire-etiket-grup" transform="translate(281, 645)">
      <rect x="-58" y="-22" width="116" height="40" rx="20" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ALT SOL</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="490" cy="580" r="22" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="490" cy="580" r="14"/>
    </g>
  </g>

  <!-- ALT SAG (tas cephe) -->
  <g class="daire" data-daire-id="alt-sag" tabindex="0" role="button" aria-label="Alt Kat - Sağ dairesi">
    <rect class="daire-bolge" x="514" y="550" width="470" height="185" rx="16"/>
    <g class="daire-etiket-grup" transform="translate(748, 645)">
      <rect x="-58" y="-22" width="116" height="40" rx="20" fill="rgba(20,15,10,0.85)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ALT SAĞ</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="960" cy="580" r="22" fill="#fff" opacity="0.95"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="960" cy="580" r="14"/>
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
