/* =========================================================
   APARTIM — Bina (ana ekran)
   Seffaf illustrasyon arka plan + 5 daire hotspot.
   Ust kat: cati hattini takip eden polygon (dikdortgen degil).
   ========================================================= */

(function () {
  "use strict";

  const wrap = () => document.getElementById("bina-svg-wrap");

  // Koordinatlar 1024x792 illustrasyona gore (merkez x=512).
  // Bina dis cerceve: ~x=96-928
  const SVG = `
<svg class="bina-svg" viewBox="0 0 1024 792" xmlns="http://www.w3.org/2000/svg" aria-label="Apartım binası" preserveAspectRatio="xMidYMid meet">
  <defs>
    <filter id="binaSg" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-opacity="0.28"/>
    </filter>
    <filter id="noktaSg" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.4"/>
    </filter>
  </defs>

  <image href="icons/apart-illustrasyon.png?v=20260616" x="0" y="0" width="1024" height="792" filter="url(#binaSg)"/>

  <!-- UST KAT — tek daire, cati ucgeni + alttaki ahşap bolum -->
  <g class="daire" data-daire-id="ust" tabindex="0" role="button" aria-label="Üst Kat dairesi">
    <polygon class="daire-bolge"
      points="512,54 928,172 928,346 96,346 96,172"/>
    <g class="daire-etiket-grup" transform="translate(512, 228)">
      <rect x="-58" y="-22" width="116" height="40" rx="20" fill="rgba(20,15,10,0.88)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ÜST KAT</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="892" cy="118" r="20" fill="#fff" opacity="0.96"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="892" cy="118" r="13"/>
    </g>
  </g>

  <!-- ORTA SOL -->
  <g class="daire" data-daire-id="orta-sol" tabindex="0" role="button" aria-label="Orta Kat - Sol dairesi">
    <rect class="daire-bolge" x="96" y="358" width="408" height="168" rx="4"/>
    <g class="daire-etiket-grup" transform="translate(300, 442)">
      <rect x="-62" y="-22" width="124" height="40" rx="20" fill="rgba(20,15,10,0.88)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ORTA SOL</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="488" cy="378" r="20" fill="#fff" opacity="0.96"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="488" cy="378" r="13"/>
    </g>
  </g>

  <!-- ORTA SAG -->
  <g class="daire" data-daire-id="orta-sag" tabindex="0" role="button" aria-label="Orta Kat - Sağ dairesi">
    <rect class="daire-bolge" x="520" y="358" width="408" height="168" rx="4"/>
    <g class="daire-etiket-grup" transform="translate(724, 442)">
      <rect x="-62" y="-22" width="124" height="40" rx="20" fill="rgba(20,15,10,0.88)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ORTA SAĞ</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="912" cy="378" r="20" fill="#fff" opacity="0.96"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="912" cy="378" r="13"/>
    </g>
  </g>

  <!-- ALT SOL -->
  <g class="daire" data-daire-id="alt-sol" tabindex="0" role="button" aria-label="Alt Kat - Sol dairesi">
    <rect class="daire-bolge" x="96" y="536" width="408" height="168" rx="4"/>
    <g class="daire-etiket-grup" transform="translate(300, 620)">
      <rect x="-58" y="-22" width="116" height="40" rx="20" fill="rgba(20,15,10,0.88)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ALT SOL</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="488" cy="556" r="20" fill="#fff" opacity="0.96"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="488" cy="556" r="13"/>
    </g>
  </g>

  <!-- ALT SAG -->
  <g class="daire" data-daire-id="alt-sag" tabindex="0" role="button" aria-label="Alt Kat - Sağ dairesi">
    <rect class="daire-bolge" x="520" y="536" width="408" height="168" rx="4"/>
    <g class="daire-etiket-grup" transform="translate(724, 620)">
      <rect x="-58" y="-22" width="116" height="40" rx="20" fill="rgba(20,15,10,0.88)"/>
      <text class="daire-etiket" x="0" y="7" text-anchor="middle">ALT SAĞ</text>
    </g>
    <g class="durum-grup" filter="url(#noktaSg)">
      <circle cx="912" cy="556" r="20" fill="#fff" opacity="0.96"/>
      <circle class="durum-nokta durum-nokta-bos-temiz" cx="912" cy="556" r="13"/>
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
