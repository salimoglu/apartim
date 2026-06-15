/* =========================================================
   APARTIM — Bina (ana ekran SVG)
   Material You tarzı flat & minimal tasarım.
   Düz renkler, ince çizgi sınırlar, yumuşak pastel paleti.
   ========================================================= */

(function () {
  "use strict";

  const wrap = () => document.getElementById("bina-svg-wrap");

  // Renk paleti (Material You ilham, koyu/açık tema otomatik gelir)
  // Renkler doğrudan inline tanımlı, CSS değişkenleriyle override edilebilir.
  const SVG = `
<svg class="bina-svg" viewBox="0 0 600 660" xmlns="http://www.w3.org/2000/svg" aria-label="Apartım binası">
  <defs>
    <clipPath id="clipUst"><rect x="170" y="180" width="260" height="120" rx="14"/></clipPath>
    <clipPath id="clipOrtaSol"><rect x="120" y="320" width="178" height="130" rx="14"/></clipPath>
    <clipPath id="clipOrtaSag"><rect x="302" y="320" width="178" height="130" rx="14"/></clipPath>
    <clipPath id="clipAltSol"><rect x="110" y="470" width="188" height="140" rx="14"/></clipPath>
    <clipPath id="clipAltSag"><rect x="302" y="470" width="188" height="140" rx="14"/></clipPath>
  </defs>

  <!-- =============== ÇATI =============== -->
  <path d="M 130 175 L 300 80 L 470 175 Z" fill="var(--bina-cati, #c97365)" stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2" stroke-linejoin="round"/>
  <!-- Çatı alt şeridi (saçak) -->
  <rect x="120" y="172" width="360" height="12" rx="6" fill="var(--bina-cati-koyu, #a85549)" stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>

  <!-- =============== ÜST KAT (tek daire) =============== -->
  <g class="daire" data-daire-id="ust" tabindex="0" role="button" aria-label="Üst Kat dairesi">
    <rect x="170" y="184" width="260" height="116" rx="14"
          fill="var(--bina-ust, #f4d4b8)"
          stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>

    <!-- 3'lü pencere -->
    <g class="pencere">
      <rect x="194" y="208" width="60" height="76" rx="8"
            fill="var(--bina-cam, #b8d5e8)"
            stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>
      <rect x="270" y="208" width="60" height="76" rx="8"
            fill="var(--bina-cam, #b8d5e8)"
            stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>
      <rect x="346" y="208" width="60" height="76" rx="8"
            fill="var(--bina-cam, #b8d5e8)"
            stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>
    </g>

    <rect class="daire-bolge" x="170" y="184" width="260" height="116" rx="14"/>

    <g class="daire-etiket-grup" transform="translate(186, 200)">
      <rect x="-4" y="-12" width="46" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="19" y="1" text-anchor="middle">ÜST</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="414" cy="200" r="6" stroke="#fff" stroke-opacity="0.95" stroke-width="2"/>
  </g>

  <!-- =============== ORTA KAT (2 daire) =============== -->
  <!-- Orta-Sol -->
  <g class="daire" data-daire-id="orta-sol" tabindex="0" role="button" aria-label="Orta Sol dairesi">
    <rect x="120" y="320" width="178" height="130" rx="14"
          fill="var(--bina-orta, #e8c39a)"
          stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>

    <g class="pencere">
      <rect x="138" y="346" width="58" height="78" rx="8"
            fill="var(--bina-cam, #b8d5e8)"
            stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>
      <rect x="222" y="346" width="58" height="78" rx="8"
            fill="var(--bina-cam, #b8d5e8)"
            stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>
    </g>

    <rect class="daire-bolge" x="120" y="320" width="178" height="130" rx="14"/>

    <g class="daire-etiket-grup" transform="translate(132, 336)">
      <rect x="-4" y="-12" width="42" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="17" y="1" text-anchor="middle">2A</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="286" cy="336" r="6" stroke="#fff" stroke-opacity="0.95" stroke-width="2"/>
  </g>

  <!-- Orta-Sağ -->
  <g class="daire" data-daire-id="orta-sag" tabindex="0" role="button" aria-label="Orta Sağ dairesi">
    <rect x="302" y="320" width="178" height="130" rx="14"
          fill="var(--bina-orta, #e8c39a)"
          stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>

    <g class="pencere">
      <rect x="320" y="346" width="58" height="78" rx="8"
            fill="var(--bina-cam, #b8d5e8)"
            stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>
      <rect x="404" y="346" width="58" height="78" rx="8"
            fill="var(--bina-cam, #b8d5e8)"
            stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>
    </g>

    <rect class="daire-bolge" x="302" y="320" width="178" height="130" rx="14"/>

    <g class="daire-etiket-grup" transform="translate(446, 336)">
      <rect x="-21" y="-12" width="42" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="0" y="1" text-anchor="middle">2B</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="466" cy="336" r="6" stroke="#fff" stroke-opacity="0.95" stroke-width="2"/>
  </g>

  <!-- =============== ALT KAT (2 daire) =============== -->
  <!-- Alt-Sol -->
  <g class="daire" data-daire-id="alt-sol" tabindex="0" role="button" aria-label="Alt Sol dairesi">
    <rect x="110" y="470" width="188" height="140" rx="14"
          fill="var(--bina-alt, #f5ead7)"
          stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>

    <!-- Pencere -->
    <rect x="124" y="498" width="86" height="62" rx="8"
          fill="var(--bina-cam, #b8d5e8)"
          stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2" class="pencere-tek"/>

    <!-- Kapı (yuvarlak üstlü, Material) -->
    <path d="M 228 602 L 228 530 Q 228 510 248 510 L 268 510 Q 288 510 288 530 L 288 602 Z"
          fill="var(--bina-kapi, #6b4a3a)"
          stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="276" cy="566" r="2.5" fill="var(--bina-kapi-kol, #e8c87a)"/>

    <rect class="daire-bolge" x="110" y="470" width="188" height="140" rx="14"/>

    <g class="daire-etiket-grup" transform="translate(122, 488)">
      <rect x="-4" y="-12" width="42" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="17" y="1" text-anchor="middle">1A</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="286" cy="488" r="6" stroke="#fff" stroke-opacity="0.95" stroke-width="2"/>
  </g>

  <!-- Alt-Sağ -->
  <g class="daire" data-daire-id="alt-sag" tabindex="0" role="button" aria-label="Alt Sağ dairesi">
    <rect x="302" y="470" width="188" height="140" rx="14"
          fill="var(--bina-alt, #f5ead7)"
          stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2"/>

    <!-- Kapı -->
    <path d="M 312 602 L 312 530 Q 312 510 332 510 L 352 510 Q 372 510 372 530 L 372 602 Z"
          fill="var(--bina-kapi, #6b4a3a)"
          stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="324" cy="566" r="2.5" fill="var(--bina-kapi-kol, #e8c87a)"/>

    <!-- Pencere -->
    <rect x="390" y="498" width="86" height="62" rx="8"
          fill="var(--bina-cam, #b8d5e8)"
          stroke="var(--bina-kenar, #2a1a1a)" stroke-width="2" class="pencere-tek"/>

    <rect class="daire-bolge" x="302" y="470" width="188" height="140" rx="14"/>

    <g class="daire-etiket-grup" transform="translate(446, 488)">
      <rect x="-21" y="-12" width="42" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="0" y="1" text-anchor="middle">1B</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="478" cy="488" r="6" stroke="#fff" stroke-opacity="0.95" stroke-width="2"/>
  </g>

  <!-- Yumuşak zemin gölgesi -->
  <ellipse cx="300" cy="628" rx="220" ry="8" fill="#000" opacity="0.15"/>
</svg>`;

  // ---- Render & güncelleme ----
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
