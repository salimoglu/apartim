/* =========================================================
   APARTIM — Bina (ana ekran SVG)
   Cartoon illustrasyon: ahsap+tas cephe, kirmizi cati,
   genis pencereler, sandalye ve saksilar.
   ========================================================= */

(function () {
  "use strict";

  const wrap = () => document.getElementById("bina-svg-wrap");

  const SVG = `
<svg class="bina-svg" viewBox="0 0 600 540" xmlns="http://www.w3.org/2000/svg" aria-label="Apartım binası">
  <defs>
    <!-- AHSAP DOKU (dikey kalas paneli) -->
    <pattern id="ahsapDoku" width="22" height="120" patternUnits="userSpaceOnUse">
      <rect width="22" height="120" fill="#c89060"/>
      <line x1="0" y1="0" x2="0" y2="120" stroke="#7a4621" stroke-width="1" opacity="0.55"/>
      <line x1="22" y1="0" x2="22" y2="120" stroke="#7a4621" stroke-width="1" opacity="0.55"/>
      <line x1="11" y1="0" x2="11" y2="120" stroke="#9d6936" stroke-width="0.6" opacity="0.45"/>
    </pattern>

    <!-- AHSAP DOKU KOYU (orta kat) -->
    <pattern id="ahsapDokuKoyu" width="22" height="120" patternUnits="userSpaceOnUse">
      <rect width="22" height="120" fill="#b07a4a"/>
      <line x1="0" y1="0" x2="0" y2="120" stroke="#5a3a1e" stroke-width="1" opacity="0.6"/>
      <line x1="22" y1="0" x2="22" y2="120" stroke="#5a3a1e" stroke-width="1" opacity="0.6"/>
      <line x1="11" y1="0" x2="11" y2="120" stroke="#8a5b30" stroke-width="0.6" opacity="0.45"/>
    </pattern>

    <!-- TAS DOKU (kayrak desenleri) -->
    <pattern id="tasDoku" width="60" height="38" patternUnits="userSpaceOnUse">
      <rect width="60" height="38" fill="#e6d6b8"/>
      <ellipse cx="12" cy="10" rx="10" ry="6" fill="#c8b48c" opacity="0.85"/>
      <ellipse cx="36" cy="8" rx="13" ry="5" fill="#bfa982" opacity="0.85"/>
      <ellipse cx="50" cy="22" rx="9" ry="6" fill="#d6c39f" opacity="0.8"/>
      <ellipse cx="22" cy="24" rx="11" ry="6" fill="#bfa982" opacity="0.78"/>
      <ellipse cx="6" cy="32" rx="8" ry="5" fill="#a89478" opacity="0.7"/>
      <ellipse cx="40" cy="34" rx="12" ry="5" fill="#c8b48c" opacity="0.78"/>
    </pattern>

    <!-- CAM YANSIMASI -->
    <linearGradient id="camYansima" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#dbeaf2"/>
      <stop offset="45%" stop-color="#a9c2d2"/>
      <stop offset="100%" stop-color="#6e8a98"/>
    </linearGradient>
    <linearGradient id="camDoluGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffe6b3"/>
      <stop offset="100%" stop-color="#e8a347"/>
    </linearGradient>

    <!-- CATI KIREMIT KENARI -->
    <linearGradient id="catiGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#9c4a2e"/>
      <stop offset="100%" stop-color="#6e2f17"/>
    </linearGradient>
    <linearGradient id="catiKenar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#b04a32"/>
      <stop offset="100%" stop-color="#7d2f1c"/>
    </linearGradient>

    <!-- CIM -->
    <linearGradient id="cim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5e9648"/>
      <stop offset="100%" stop-color="#3f7a2f"/>
    </linearGradient>

    <!-- GOLGE -->
    <filter id="ySg" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-opacity="0.30"/>
    </filter>
  </defs>

  <!-- ARKA PLAN CAM AGACI SILUETI -->
  <g opacity="0.18">
    <path d="M -20 200 L 30 100 L 60 145 L 90 80 L 130 145 L 165 90 L 210 150 L 245 75 L 290 145 L 325 95 L 370 155 L 410 70 L 450 150 L 490 85 L 540 145 L 580 95 L 620 200 Z"
          fill="#1a3a1e"/>
  </g>

  <!-- CATI -->
  <g filter="url(#ySg)">
    <!-- Ana üçgen -->
    <path d="M 80 150 L 300 40 L 520 150 Z" fill="url(#catiGrad)" stroke="#3a1a0c" stroke-width="2.5" stroke-linejoin="round"/>
    <!-- Catı kiremit hatları -->
    <line x1="160" y1="110" x2="440" y2="110" stroke="#5a2418" stroke-width="1.5" opacity="0.65"/>
    <line x1="120" y1="135" x2="480" y2="135" stroke="#5a2418" stroke-width="1.5" opacity="0.65"/>
    <!-- Saçak -->
    <rect x="60" y="146" width="480" height="14" rx="3" fill="url(#catiKenar)" stroke="#3a1a0c" stroke-width="2"/>
  </g>

  <!-- =============== UST KAT (tek daire) =============== -->
  <g class="daire" data-daire-id="ust" tabindex="0" role="button" aria-label="Üst Kat dairesi">
    <!-- Üçgen tympanon -->
    <path d="M 100 160 L 300 75 L 500 160 L 500 200 L 380 200 L 380 165 L 220 165 L 220 200 L 100 200 Z"
          fill="url(#ahsapDoku)" stroke="#3a1a0c" stroke-width="2" stroke-linejoin="round"/>

    <!-- Geniş orta pencereler (2 büyük) -->
    <g class="pencere">
      <rect x="232" y="105" width="60" height="80" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2.5"/>
      <rect x="308" y="105" width="60" height="80" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2.5"/>
      <!-- Cam yansıma çizgileri -->
      <line x1="240" y1="115" x2="280" y2="170" stroke="#fff" stroke-width="2" opacity="0.45"/>
      <line x1="316" y1="115" x2="356" y2="170" stroke="#fff" stroke-width="2" opacity="0.45"/>
      <!-- Mullion -->
      <line x1="262" y1="105" x2="262" y2="185" stroke="#3a1a0c" stroke-width="1.5"/>
      <line x1="338" y1="105" x2="338" y2="185" stroke="#3a1a0c" stroke-width="1.5"/>
    </g>

    <!-- Yan küçük pencereler -->
    <g class="pencere">
      <rect x="130" y="178" width="50" height="50" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2"/>
      <line x1="155" y1="178" x2="155" y2="228" stroke="#3a1a0c" stroke-width="1.2"/>
      <line x1="130" y1="203" x2="180" y2="203" stroke="#3a1a0c" stroke-width="1.2"/>
      <rect x="420" y="178" width="50" height="50" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2"/>
      <line x1="445" y1="178" x2="445" y2="228" stroke="#3a1a0c" stroke-width="1.2"/>
      <line x1="420" y1="203" x2="470" y2="203" stroke="#3a1a0c" stroke-width="1.2"/>
    </g>

    <rect class="daire-bolge" x="100" y="160" width="400" height="68" rx="4"/>
    <g class="daire-etiket-grup" transform="translate(116, 174)">
      <rect x="-4" y="-12" width="46" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="19" y="1" text-anchor="middle">ÜST</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="488" cy="174" r="7" stroke="#fff" stroke-width="2"/>
  </g>

  <!-- Ahşap kat arası şerit -->
  <rect x="80" y="232" width="440" height="14" fill="#5a3819" stroke="#3a1a0c" stroke-width="2"/>

  <!-- =============== ORTA KAT (2 daire) =============== -->
  <g class="daire" data-daire-id="orta-sol" tabindex="0" role="button" aria-label="Orta Sol dairesi">
    <rect x="80" y="246" width="218" height="120" fill="url(#ahsapDokuKoyu)" stroke="#3a1a0c" stroke-width="2"/>

    <!-- 2 geniş pencere -->
    <g class="pencere">
      <rect x="100" y="266" width="84" height="84" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2.5"/>
      <rect x="196" y="266" width="84" height="84" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2.5"/>
      <line x1="105" y1="278" x2="170" y2="345" stroke="#fff" stroke-width="2.5" opacity="0.45"/>
      <line x1="201" y1="278" x2="266" y2="345" stroke="#fff" stroke-width="2.5" opacity="0.45"/>
      <line x1="142" y1="266" x2="142" y2="350" stroke="#3a1a0c" stroke-width="1.5"/>
      <line x1="238" y1="266" x2="238" y2="350" stroke="#3a1a0c" stroke-width="1.5"/>
    </g>

    <rect class="daire-bolge" x="80" y="246" width="218" height="120" rx="3"/>
    <g class="daire-etiket-grup" transform="translate(94, 262)">
      <rect x="-4" y="-12" width="42" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="17" y="1" text-anchor="middle">2A</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="284" cy="262" r="7" stroke="#fff" stroke-width="2"/>
  </g>

  <!-- Dikey ahşap ayraç -->
  <rect x="298" y="246" width="6" height="120" fill="#5a3819" stroke="#3a1a0c" stroke-width="1.5"/>

  <g class="daire" data-daire-id="orta-sag" tabindex="0" role="button" aria-label="Orta Sağ dairesi">
    <rect x="304" y="246" width="216" height="120" fill="url(#ahsapDokuKoyu)" stroke="#3a1a0c" stroke-width="2"/>

    <g class="pencere">
      <rect x="320" y="266" width="84" height="84" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2.5"/>
      <rect x="416" y="266" width="84" height="84" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2.5"/>
      <line x1="325" y1="278" x2="390" y2="345" stroke="#fff" stroke-width="2.5" opacity="0.45"/>
      <line x1="421" y1="278" x2="486" y2="345" stroke="#fff" stroke-width="2.5" opacity="0.45"/>
      <line x1="362" y1="266" x2="362" y2="350" stroke="#3a1a0c" stroke-width="1.5"/>
      <line x1="458" y1="266" x2="458" y2="350" stroke="#3a1a0c" stroke-width="1.5"/>
    </g>

    <rect class="daire-bolge" x="304" y="246" width="216" height="120" rx="3"/>
    <g class="daire-etiket-grup" transform="translate(490, 262)">
      <rect x="-21" y="-12" width="42" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="0" y="1" text-anchor="middle">2B</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="510" cy="262" r="7" stroke="#fff" stroke-width="2"/>
  </g>

  <!-- Kat arası kalın şerit -->
  <rect x="60" y="366" width="480" height="14" fill="#5a3819" stroke="#3a1a0c" stroke-width="2"/>

  <!-- =============== ALT KAT (TAS) =============== -->
  <g class="daire" data-daire-id="alt-sol" tabindex="0" role="button" aria-label="Alt Sol dairesi">
    <rect x="60" y="380" width="240" height="110" fill="url(#tasDoku)" stroke="#3a1a0c" stroke-width="2"/>

    <!-- Pencere -->
    <rect x="78" y="404" width="58" height="62" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2"/>
    <line x1="78" y1="412" x2="120" y2="460" stroke="#fff" stroke-width="2" opacity="0.4"/>
    <line x1="107" y1="404" x2="107" y2="466" stroke="#3a1a0c" stroke-width="1.2"/>
    <line x1="78" y1="435" x2="136" y2="435" stroke="#3a1a0c" stroke-width="1.2"/>

    <!-- Kapı -->
    <rect x="156" y="416" width="42" height="72" rx="3" fill="#6b3f23" stroke="#3a1a0c" stroke-width="2"/>
    <!-- Kapı panel -->
    <rect x="162" y="424" width="30" height="22" rx="2" fill="none" stroke="#3a1a0c" stroke-width="1.2"/>
    <rect x="162" y="452" width="30" height="22" rx="2" fill="none" stroke="#3a1a0c" stroke-width="1.2"/>
    <circle cx="192" cy="452" r="1.8" fill="#e8c87a"/>

    <!-- Anahtar -->
    <g transform="translate(155, 396)" opacity="0.9">
      <circle cx="6" cy="6" r="5" fill="none" stroke="#d4a574" stroke-width="2"/>
      <line x1="11" y1="6" x2="22" y2="6" stroke="#d4a574" stroke-width="2"/>
      <line x1="19" y1="6" x2="19" y2="11" stroke="#d4a574" stroke-width="2"/>
      <line x1="22" y1="6" x2="22" y2="10" stroke="#d4a574" stroke-width="2"/>
    </g>

    <!-- 2. pencere -->
    <rect x="216" y="404" width="58" height="62" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2"/>
    <line x1="216" y1="412" x2="258" y2="460" stroke="#fff" stroke-width="2" opacity="0.4"/>
    <line x1="245" y1="404" x2="245" y2="466" stroke="#3a1a0c" stroke-width="1.2"/>
    <line x1="216" y1="435" x2="274" y2="435" stroke="#3a1a0c" stroke-width="1.2"/>

    <rect class="daire-bolge" x="60" y="380" width="240" height="110" rx="3"/>
    <g class="daire-etiket-grup" transform="translate(74, 396)">
      <rect x="-4" y="-12" width="42" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="17" y="1" text-anchor="middle">1A</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="286" cy="396" r="7" stroke="#fff" stroke-width="2"/>
  </g>

  <!-- Alt orta ayraç -->
  <rect x="300" y="380" width="6" height="110" fill="#5a3819" stroke="#3a1a0c" stroke-width="1.2"/>

  <g class="daire" data-daire-id="alt-sag" tabindex="0" role="button" aria-label="Alt Sağ dairesi">
    <rect x="306" y="380" width="234" height="110" fill="url(#tasDoku)" stroke="#3a1a0c" stroke-width="2"/>

    <!-- Pencere 1 -->
    <rect x="320" y="404" width="58" height="62" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2"/>
    <line x1="320" y1="412" x2="362" y2="460" stroke="#fff" stroke-width="2" opacity="0.4"/>
    <line x1="349" y1="404" x2="349" y2="466" stroke="#3a1a0c" stroke-width="1.2"/>
    <line x1="320" y1="435" x2="378" y2="435" stroke="#3a1a0c" stroke-width="1.2"/>

    <!-- Kapı -->
    <rect x="398" y="416" width="42" height="72" rx="3" fill="#6b3f23" stroke="#3a1a0c" stroke-width="2"/>
    <rect x="404" y="424" width="30" height="22" rx="2" fill="none" stroke="#3a1a0c" stroke-width="1.2"/>
    <rect x="404" y="452" width="30" height="22" rx="2" fill="none" stroke="#3a1a0c" stroke-width="1.2"/>
    <circle cx="408" cy="452" r="1.8" fill="#e8c87a"/>

    <g transform="translate(397, 396)" opacity="0.9">
      <circle cx="6" cy="6" r="5" fill="none" stroke="#d4a574" stroke-width="2"/>
      <line x1="11" y1="6" x2="22" y2="6" stroke="#d4a574" stroke-width="2"/>
      <line x1="19" y1="6" x2="19" y2="11" stroke="#d4a574" stroke-width="2"/>
      <line x1="22" y1="6" x2="22" y2="10" stroke="#d4a574" stroke-width="2"/>
    </g>

    <!-- Pencere 2 -->
    <rect x="458" y="404" width="58" height="62" rx="3" fill="url(#camYansima)" stroke="#3a1a0c" stroke-width="2"/>
    <line x1="458" y1="412" x2="500" y2="460" stroke="#fff" stroke-width="2" opacity="0.4"/>
    <line x1="487" y1="404" x2="487" y2="466" stroke="#3a1a0c" stroke-width="1.2"/>
    <line x1="458" y1="435" x2="516" y2="435" stroke="#3a1a0c" stroke-width="1.2"/>

    <rect class="daire-bolge" x="306" y="380" width="234" height="110" rx="3"/>
    <g class="daire-etiket-grup" transform="translate(510, 396)">
      <rect x="-21" y="-12" width="42" height="18" rx="9" fill="rgba(0,0,0,0.75)"/>
      <text class="daire-etiket" x="0" y="1" text-anchor="middle">1B</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="530" cy="396" r="7" stroke="#fff" stroke-width="2"/>
  </g>

  <!-- =============== ZEMIN: CIM + DETAYLAR =============== -->
  <rect x="0" y="490" width="600" height="50" fill="url(#cim)"/>
  <!-- Çim taraması -->
  <g stroke="#2c5a1f" stroke-width="1.5" opacity="0.55">
    <line x1="30" y1="495" x2="32" y2="490"/>
    <line x1="55" y1="500" x2="57" y2="495"/>
    <line x1="80" y1="495" x2="82" y2="490"/>
    <line x1="105" y1="498" x2="107" y2="492"/>
    <line x1="130" y1="495" x2="132" y2="490"/>
    <line x1="178" y1="500" x2="180" y2="495"/>
    <line x1="230" y1="495" x2="232" y2="490"/>
    <line x1="275" y1="498" x2="277" y2="492"/>
    <line x1="325" y1="495" x2="327" y2="490"/>
    <line x1="372" y1="500" x2="374" y2="495"/>
    <line x1="425" y1="495" x2="427" y2="490"/>
    <line x1="475" y1="498" x2="477" y2="492"/>
    <line x1="525" y1="495" x2="527" y2="490"/>
    <line x1="565" y1="498" x2="567" y2="492"/>
  </g>

  <!-- SANDALYE (sol) -->
  <g transform="translate(122, 478)">
    <rect x="0" y="-2" width="14" height="3" rx="1" fill="#d94e4e" stroke="#3a1a0c" stroke-width="1.2"/>
    <rect x="0" y="-12" width="3" height="12" rx="1" fill="#d94e4e" stroke="#3a1a0c" stroke-width="1.2"/>
    <line x1="2" y1="1" x2="2" y2="10" stroke="#3a1a0c" stroke-width="1.5"/>
    <line x1="12" y1="1" x2="12" y2="10" stroke="#3a1a0c" stroke-width="1.5"/>
  </g>

  <!-- Saksı (sol) -->
  <g transform="translate(146, 478)">
    <path d="M 0 -2 L 2 8 L 12 8 L 14 -2 Z" fill="#a85a3a" stroke="#3a1a0c" stroke-width="1.2"/>
    <ellipse cx="7" cy="-2" rx="7" ry="2" fill="#8c4530" stroke="#3a1a0c" stroke-width="1.2"/>
    <circle cx="3" cy="-8" r="3" fill="#3d8a5a"/>
    <circle cx="9" cy="-9" r="4" fill="#4ca06b"/>
    <circle cx="12" cy="-6" r="3" fill="#3d8a5a"/>
  </g>

  <!-- SANDALYE (orta-sol) -->
  <g transform="translate(218, 478)">
    <rect x="0" y="-2" width="14" height="3" rx="1" fill="#f0c44e" stroke="#3a1a0c" stroke-width="1.2"/>
    <rect x="0" y="-12" width="3" height="12" rx="1" fill="#f0c44e" stroke="#3a1a0c" stroke-width="1.2"/>
    <line x1="2" y1="1" x2="2" y2="10" stroke="#3a1a0c" stroke-width="1.5"/>
    <line x1="12" y1="1" x2="12" y2="10" stroke="#3a1a0c" stroke-width="1.5"/>
  </g>

  <!-- Saksı (orta) -->
  <g transform="translate(290, 478)">
    <path d="M 0 -2 L 2 8 L 12 8 L 14 -2 Z" fill="#a85a3a" stroke="#3a1a0c" stroke-width="1.2"/>
    <ellipse cx="7" cy="-2" rx="7" ry="2" fill="#8c4530" stroke="#3a1a0c" stroke-width="1.2"/>
    <circle cx="3" cy="-8" r="3" fill="#3d8a5a"/>
    <circle cx="9" cy="-9" r="4" fill="#4ca06b"/>
    <circle cx="12" cy="-6" r="3" fill="#3d8a5a"/>
  </g>

  <!-- SANDALYE (orta-sag) -->
  <g transform="translate(370, 478)">
    <rect x="0" y="-2" width="14" height="3" rx="1" fill="#e8623c" stroke="#3a1a0c" stroke-width="1.2"/>
    <rect x="0" y="-12" width="3" height="12" rx="1" fill="#e8623c" stroke="#3a1a0c" stroke-width="1.2"/>
    <line x1="2" y1="1" x2="2" y2="10" stroke="#3a1a0c" stroke-width="1.5"/>
    <line x1="12" y1="1" x2="12" y2="10" stroke="#3a1a0c" stroke-width="1.5"/>
  </g>

  <!-- Saksı (sag) -->
  <g transform="translate(448, 478)">
    <path d="M 0 -2 L 2 8 L 12 8 L 14 -2 Z" fill="#a85a3a" stroke="#3a1a0c" stroke-width="1.2"/>
    <ellipse cx="7" cy="-2" rx="7" ry="2" fill="#8c4530" stroke="#3a1a0c" stroke-width="1.2"/>
    <circle cx="3" cy="-8" r="3" fill="#3d8a5a"/>
    <circle cx="9" cy="-9" r="4" fill="#4ca06b"/>
    <circle cx="12" cy="-6" r="3" fill="#3d8a5a"/>
  </g>

  <!-- SANDALYE (sag) -->
  <g transform="translate(478, 478)">
    <rect x="0" y="-2" width="14" height="3" rx="1" fill="#3eb4a8" stroke="#3a1a0c" stroke-width="1.2"/>
    <rect x="0" y="-12" width="3" height="12" rx="1" fill="#3eb4a8" stroke="#3a1a0c" stroke-width="1.2"/>
    <line x1="2" y1="1" x2="2" y2="10" stroke="#3a1a0c" stroke-width="1.5"/>
    <line x1="12" y1="1" x2="12" y2="10" stroke="#3a1a0c" stroke-width="1.5"/>
  </g>

  <!-- Zemin alt cizgi -->
  <rect x="0" y="535" width="600" height="5" fill="#2c5a1f"/>
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

      // Dolu rezervasyon → camlar altın sarısı yanıyor (içeride ışık)
      g.querySelectorAll(".pencere rect").forEach((r) => {
        if (dr.durum === "dolu") {
          r.setAttribute("fill", "url(#camDoluGrad)");
        } else {
          r.setAttribute("fill", "url(#camYansima)");
        }
      });

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
