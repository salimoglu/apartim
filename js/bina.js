/* =========================================================
   APARTIM — Bina (ana ekran SVG)
   Notion/Linear tarzı mimari iz: soft pastel + ince çizgi.
   ========================================================= */

(function () {
  "use strict";

  const wrap = () => document.getElementById("bina-svg-wrap");

  // CSS değişkenleri ile tema uyumu, varsayılanlar dark için.
  const SVG = `
<svg class="bina-svg" viewBox="0 0 600 640" xmlns="http://www.w3.org/2000/svg" aria-label="Apartım binası">
  <defs>
    <!-- Hairline (1.5 birim) stroke standartlaştırma -->
    <style>
      .ln { stroke: var(--bina-cizgi, #c8d4e1); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; fill: none; }
      .lnIc { stroke: var(--bina-cizgi-ic, rgba(200,212,225,0.45)); stroke-width: 1; stroke-linecap: round; }
      .doluCati { fill: var(--bina-cati, rgba(201,115,101,0.16)); }
      .doluUst { fill: var(--bina-ust, rgba(244,212,184,0.10)); }
      .doluOrta { fill: var(--bina-orta, rgba(232,195,154,0.10)); }
      .doluAlt { fill: var(--bina-alt, rgba(245,234,215,0.10)); }
      .doluCam { fill: var(--bina-cam, rgba(184,213,232,0.28)); }
      .doluKapi { fill: var(--bina-kapi, rgba(107,74,58,0.35)); }
    </style>
  </defs>

  <!-- =============== ÇATI =============== -->
  <g>
    <path class="ln doluCati" d="M 130 178 L 300 80 L 470 178 Z"/>
    <!-- Çatı saçağı (alt şerit) -->
    <path class="ln doluCati" d="M 118 178 L 482 178 L 482 192 L 118 192 Z"/>
    <!-- Çatı iç çizgileri (kiremit hissi, çok ince) -->
    <line class="lnIc" x1="215" y1="124" x2="385" y2="124"/>
    <line class="lnIc" x1="170" y1="152" x2="430" y2="152"/>
  </g>

  <!-- =============== ÜST KAT =============== -->
  <g class="daire" data-daire-id="ust" tabindex="0" role="button" aria-label="Üst Kat dairesi">
    <rect class="ln doluUst" x="170" y="192" width="260" height="110" rx="6"/>

    <!-- 3'lü pencere -->
    <g class="pencere">
      <rect class="ln doluCam" x="194" y="214" width="56" height="72" rx="3"/>
      <rect class="ln doluCam" x="272" y="214" width="56" height="72" rx="3"/>
      <rect class="ln doluCam" x="350" y="214" width="56" height="72" rx="3"/>
      <!-- Pencere mullion (haç) -->
      <line class="lnIc" x1="222" y1="214" x2="222" y2="286"/>
      <line class="lnIc" x1="194" y1="250" x2="250" y2="250"/>
      <line class="lnIc" x1="300" y1="214" x2="300" y2="286"/>
      <line class="lnIc" x1="272" y1="250" x2="328" y2="250"/>
      <line class="lnIc" x1="378" y1="214" x2="378" y2="286"/>
      <line class="lnIc" x1="350" y1="250" x2="406" y2="250"/>
    </g>

    <rect class="daire-bolge" x="170" y="192" width="260" height="110" rx="6"/>
    <g class="daire-etiket-grup" transform="translate(186, 208)">
      <rect x="-4" y="-12" width="46" height="18" rx="9" fill="var(--metin)" opacity="0.85"/>
      <text class="daire-etiket" x="19" y="1" text-anchor="middle">ÜST</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="414" cy="208" r="5"/>
  </g>

  <!-- =============== ORTA KAT =============== -->
  <!-- Sol -->
  <g class="daire" data-daire-id="orta-sol" tabindex="0" role="button" aria-label="Orta Sol dairesi">
    <rect class="ln doluOrta" x="120" y="312" width="178" height="122" rx="6"/>

    <g class="pencere">
      <rect class="ln doluCam" x="140" y="336" width="54" height="74" rx="3"/>
      <rect class="ln doluCam" x="224" y="336" width="54" height="74" rx="3"/>
      <line class="lnIc" x1="167" y1="336" x2="167" y2="410"/>
      <line class="lnIc" x1="140" y1="373" x2="194" y2="373"/>
      <line class="lnIc" x1="251" y1="336" x2="251" y2="410"/>
      <line class="lnIc" x1="224" y1="373" x2="278" y2="373"/>
    </g>

    <rect class="daire-bolge" x="120" y="312" width="178" height="122" rx="6"/>
    <g class="daire-etiket-grup" transform="translate(132, 328)">
      <rect x="-4" y="-12" width="42" height="18" rx="9" fill="var(--metin)" opacity="0.85"/>
      <text class="daire-etiket" x="17" y="1" text-anchor="middle">2A</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="286" cy="328" r="5"/>
  </g>

  <!-- Sağ -->
  <g class="daire" data-daire-id="orta-sag" tabindex="0" role="button" aria-label="Orta Sağ dairesi">
    <rect class="ln doluOrta" x="302" y="312" width="178" height="122" rx="6"/>

    <g class="pencere">
      <rect class="ln doluCam" x="322" y="336" width="54" height="74" rx="3"/>
      <rect class="ln doluCam" x="406" y="336" width="54" height="74" rx="3"/>
      <line class="lnIc" x1="349" y1="336" x2="349" y2="410"/>
      <line class="lnIc" x1="322" y1="373" x2="376" y2="373"/>
      <line class="lnIc" x1="433" y1="336" x2="433" y2="410"/>
      <line class="lnIc" x1="406" y1="373" x2="460" y2="373"/>
    </g>

    <rect class="daire-bolge" x="302" y="312" width="178" height="122" rx="6"/>
    <g class="daire-etiket-grup" transform="translate(446, 328)">
      <rect x="-21" y="-12" width="42" height="18" rx="9" fill="var(--metin)" opacity="0.85"/>
      <text class="daire-etiket" x="0" y="1" text-anchor="middle">2B</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="466" cy="328" r="5"/>
  </g>

  <!-- =============== ALT KAT =============== -->
  <!-- Sol -->
  <g class="daire" data-daire-id="alt-sol" tabindex="0" role="button" aria-label="Alt Sol dairesi">
    <rect class="ln doluAlt" x="110" y="444" width="188" height="142" rx="6"/>

    <!-- Pencere -->
    <rect class="ln doluCam pencere-tek" x="124" y="476" width="84" height="58" rx="3"/>
    <line class="lnIc" x1="166" y1="476" x2="166" y2="534"/>
    <line class="lnIc" x1="124" y1="505" x2="208" y2="505"/>

    <!-- Kapı (panel detaylı) -->
    <path class="ln doluKapi" d="M 228 580 L 228 504 Q 228 488 244 488 L 272 488 Q 288 488 288 504 L 288 580 Z"/>
    <!-- Kapı paneli -->
    <rect class="lnIc" x="238" y="510" width="40" height="22" rx="2" fill="none"/>
    <rect class="lnIc" x="238" y="540" width="40" height="22" rx="2" fill="none"/>
    <circle cx="278" cy="538" r="1.4" fill="var(--bina-cizgi, #c8d4e1)"/>

    <rect class="daire-bolge" x="110" y="444" width="188" height="142" rx="6"/>
    <g class="daire-etiket-grup" transform="translate(122, 462)">
      <rect x="-4" y="-12" width="42" height="18" rx="9" fill="var(--metin)" opacity="0.85"/>
      <text class="daire-etiket" x="17" y="1" text-anchor="middle">1A</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="286" cy="462" r="5"/>
  </g>

  <!-- Sağ -->
  <g class="daire" data-daire-id="alt-sag" tabindex="0" role="button" aria-label="Alt Sağ dairesi">
    <rect class="ln doluAlt" x="302" y="444" width="188" height="142" rx="6"/>

    <!-- Kapı -->
    <path class="ln doluKapi" d="M 312 580 L 312 504 Q 312 488 328 488 L 356 488 Q 372 488 372 504 L 372 580 Z"/>
    <rect class="lnIc" x="322" y="510" width="40" height="22" rx="2" fill="none"/>
    <rect class="lnIc" x="322" y="540" width="40" height="22" rx="2" fill="none"/>
    <circle cx="322" cy="538" r="1.4" fill="var(--bina-cizgi, #c8d4e1)"/>

    <!-- Pencere -->
    <rect class="ln doluCam pencere-tek" x="392" y="476" width="84" height="58" rx="3"/>
    <line class="lnIc" x1="434" y1="476" x2="434" y2="534"/>
    <line class="lnIc" x1="392" y1="505" x2="476" y2="505"/>

    <rect class="daire-bolge" x="302" y="444" width="188" height="142" rx="6"/>
    <g class="daire-etiket-grup" transform="translate(446, 462)">
      <rect x="-21" y="-12" width="42" height="18" rx="9" fill="var(--metin)" opacity="0.85"/>
      <text class="daire-etiket" x="0" y="1" text-anchor="middle">1B</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="478" cy="462" r="5"/>
  </g>

  <!-- Zemin çizgisi -->
  <line class="ln" x1="80" y1="592" x2="520" y2="592"/>
  <!-- Çok ince zemin gölgesi -->
  <ellipse cx="300" cy="600" rx="200" ry="4" fill="var(--bina-cizgi-ic, rgba(200,212,225,0.25))"/>
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
