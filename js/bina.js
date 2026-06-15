/* =========================================================
   APARTIM — Bina (ana ekran SVG)
   3 katlı, 5 daireli (üst tek, orta 2, alt 2) sade & şık tasarım.
   Düz renkler, yumuşak gradient, yuvarlatılmış köşeler.
   ========================================================= */

(function () {
  "use strict";

  const wrap = () => document.getElementById("bina-svg-wrap");

  // ViewBox 600 x 680, ortalanmış bina
  const SVG = `
<svg class="bina-svg" viewBox="0 0 600 680" xmlns="http://www.w3.org/2000/svg" aria-label="Apartım binası">
  <defs>
    <linearGradient id="gokGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a3f55" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#15202b" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="catiGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#b04a32"/>
      <stop offset="100%" stop-color="#7d2f1c"/>
    </linearGradient>

    <linearGradient id="ustGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e3b87a"/>
      <stop offset="100%" stop-color="#c8965a"/>
    </linearGradient>

    <linearGradient id="ortaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#dba76a"/>
      <stop offset="100%" stop-color="#b8884a"/>
    </linearGradient>

    <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5e8d3"/>
      <stop offset="100%" stop-color="#e1cfb0"/>
    </linearGradient>

    <linearGradient id="camGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#cfeaff"/>
      <stop offset="60%" stop-color="#8cc6e8"/>
      <stop offset="100%" stop-color="#5b9bc4"/>
    </linearGradient>

    <linearGradient id="camDolu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe2a0"/>
      <stop offset="100%" stop-color="#e8a347"/>
    </linearGradient>

    <linearGradient id="kapiGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6b3f23"/>
      <stop offset="100%" stop-color="#4a2a15"/>
    </linearGradient>

    <filter id="ySolda" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Arkaplan ışıltı -->
  <ellipse cx="300" cy="340" rx="320" ry="240" fill="url(#gokGrad)"/>

  <!-- ÇATI -->
  <g filter="url(#ySolda)">
    <path d="M 130 175 L 300 70 L 470 175 L 470 195 L 300 90 L 130 195 Z" fill="url(#catiGrad)"/>
    <!-- Çatı kenar şeridi -->
    <rect x="120" y="186" width="360" height="14" rx="3" fill="#5b2419"/>
  </g>

  <!-- =============== ÜST KAT (tek daire) =============== -->
  <g class="daire" data-daire-id="ust" tabindex="0" role="button" aria-label="Üst Kat dairesi">
    <!-- Cephe -->
    <rect x="170" y="200" width="260" height="125" fill="url(#ustGrad)" rx="6"/>
    <!-- Üst-alt kenar şerit -->
    <rect x="170" y="200" width="260" height="5" fill="#8a5f2e" opacity="0.5"/>
    <rect x="170" y="320" width="260" height="5" fill="#8a5f2e" opacity="0.5"/>

    <!-- Pencereler (3'lü, geniş) -->
    <g class="pencere">
      <rect x="194" y="222" width="64" height="80" rx="6" fill="url(#camGrad)" stroke="#2a1a0c" stroke-width="2"/>
      <rect x="268" y="222" width="64" height="80" rx="6" fill="url(#camGrad)" stroke="#2a1a0c" stroke-width="2"/>
      <rect x="342" y="222" width="64" height="80" rx="6" fill="url(#camGrad)" stroke="#2a1a0c" stroke-width="2"/>
      <!-- Pencere ortası -->
      <line x1="226" y1="222" x2="226" y2="302" stroke="#2a1a0c" stroke-width="1.5"/>
      <line x1="300" y1="222" x2="300" y2="302" stroke="#2a1a0c" stroke-width="1.5"/>
      <line x1="374" y1="222" x2="374" y2="302" stroke="#2a1a0c" stroke-width="1.5"/>
    </g>

    <!-- Tıklama bölgesi -->
    <rect class="daire-bolge" x="170" y="200" width="260" height="125" rx="6"/>

    <!-- Etiket (sol üst) -->
    <g transform="translate(186, 218)" class="daire-etiket-grup">
      <rect x="-4" y="-12" width="60" height="18" rx="9" fill="rgba(0,0,0,0.55)"/>
      <text class="daire-etiket" x="26" y="1" text-anchor="middle">ÜST</text>
    </g>
    <!-- Durum noktası (sağ üst) -->
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="416" cy="216" r="6.5" stroke="#fff" stroke-opacity="0.85" stroke-width="1.5"/>
  </g>

  <!-- Kat arası şerit -->
  <rect x="120" y="325" width="360" height="10" rx="2" fill="#5b2419"/>

  <!-- =============== ORTA KAT (2 daire) =============== -->
  <!-- Orta-Sol -->
  <g class="daire" data-daire-id="orta-sol" tabindex="0" role="button" aria-label="Orta Kat - Sol dairesi">
    <rect x="120" y="335" width="178" height="125" fill="url(#ortaGrad)" rx="6"/>
    <rect x="120" y="335" width="178" height="5" fill="#7e562a" opacity="0.55"/>
    <rect x="120" y="455" width="178" height="5" fill="#7e562a" opacity="0.55"/>

    <g class="pencere">
      <rect x="138" y="358" width="58" height="78" rx="6" fill="url(#camGrad)" stroke="#2a1a0c" stroke-width="2"/>
      <rect x="222" y="358" width="58" height="78" rx="6" fill="url(#camGrad)" stroke="#2a1a0c" stroke-width="2"/>
      <line x1="167" y1="358" x2="167" y2="436" stroke="#2a1a0c" stroke-width="1.5"/>
      <line x1="251" y1="358" x2="251" y2="436" stroke="#2a1a0c" stroke-width="1.5"/>
      <line x1="138" y1="397" x2="196" y2="397" stroke="#2a1a0c" stroke-width="1.2"/>
      <line x1="222" y1="397" x2="280" y2="397" stroke="#2a1a0c" stroke-width="1.2"/>
    </g>

    <rect class="daire-bolge" x="120" y="335" width="178" height="125" rx="6"/>

    <g transform="translate(132, 351)" class="daire-etiket-grup">
      <rect x="-4" y="-12" width="56" height="18" rx="9" fill="rgba(0,0,0,0.55)"/>
      <text class="daire-etiket" x="24" y="1" text-anchor="middle">2A</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="286" cy="350" r="6.5" stroke="#fff" stroke-opacity="0.85" stroke-width="1.5"/>
  </g>

  <!-- Orta dikey ayraç -->
  <rect x="298" y="335" width="4" height="125" fill="#5b2419"/>

  <!-- Orta-Sağ -->
  <g class="daire" data-daire-id="orta-sag" tabindex="0" role="button" aria-label="Orta Kat - Sağ dairesi">
    <rect x="302" y="335" width="178" height="125" fill="url(#ortaGrad)" rx="6"/>
    <rect x="302" y="335" width="178" height="5" fill="#7e562a" opacity="0.55"/>
    <rect x="302" y="455" width="178" height="5" fill="#7e562a" opacity="0.55"/>

    <g class="pencere">
      <rect x="320" y="358" width="58" height="78" rx="6" fill="url(#camGrad)" stroke="#2a1a0c" stroke-width="2"/>
      <rect x="404" y="358" width="58" height="78" rx="6" fill="url(#camGrad)" stroke="#2a1a0c" stroke-width="2"/>
      <line x1="349" y1="358" x2="349" y2="436" stroke="#2a1a0c" stroke-width="1.5"/>
      <line x1="433" y1="358" x2="433" y2="436" stroke="#2a1a0c" stroke-width="1.5"/>
      <line x1="320" y1="397" x2="378" y2="397" stroke="#2a1a0c" stroke-width="1.2"/>
      <line x1="404" y1="397" x2="462" y2="397" stroke="#2a1a0c" stroke-width="1.2"/>
    </g>

    <rect class="daire-bolge" x="302" y="335" width="178" height="125" rx="6"/>

    <g transform="translate(450, 351)" class="daire-etiket-grup">
      <rect x="-26" y="-12" width="56" height="18" rx="9" fill="rgba(0,0,0,0.55)"/>
      <text class="daire-etiket" x="2" y="1" text-anchor="middle">2B</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="466" cy="350" r="6.5" stroke="#fff" stroke-opacity="0.85" stroke-width="1.5"/>
  </g>

  <!-- Kat arası şerit -->
  <rect x="110" y="460" width="380" height="10" rx="2" fill="#5b2419"/>

  <!-- =============== ALT KAT (2 daire) =============== -->
  <!-- Alt-Sol -->
  <g class="daire" data-daire-id="alt-sol" tabindex="0" role="button" aria-label="Alt Kat - Sol dairesi">
    <rect x="110" y="470" width="188" height="135" fill="url(#altGrad)" rx="6"/>

    <!-- Kapı -->
    <rect x="128" y="510" width="40" height="92" rx="3" fill="url(#kapiGrad)"/>
    <circle cx="160" cy="557" r="2.5" fill="#e8c87a"/>
    <!-- Kapı üst yay (yumuşak detay) -->
    <path d="M 128 514 Q 148 506 168 514" fill="none" stroke="#3a210f" stroke-width="2" opacity="0.6"/>

    <!-- Pencere -->
    <rect x="186" y="505" width="100" height="62" rx="5" fill="url(#camGrad)" stroke="#2a1a0c" stroke-width="2"/>
    <line x1="236" y1="505" x2="236" y2="567" stroke="#2a1a0c" stroke-width="1.5"/>
    <line x1="186" y1="536" x2="286" y2="536" stroke="#2a1a0c" stroke-width="1.2"/>

    <rect class="daire-bolge" x="110" y="470" width="188" height="135" rx="6"/>

    <g transform="translate(122, 488)" class="daire-etiket-grup">
      <rect x="-4" y="-12" width="56" height="18" rx="9" fill="rgba(0,0,0,0.55)"/>
      <text class="daire-etiket" x="24" y="1" text-anchor="middle">1A</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="286" cy="486" r="6.5" stroke="#fff" stroke-opacity="0.85" stroke-width="1.5"/>
  </g>

  <!-- Alt dikey ayraç -->
  <rect x="298" y="470" width="4" height="135" fill="#5b2419"/>

  <!-- Alt-Sağ -->
  <g class="daire" data-daire-id="alt-sag" tabindex="0" role="button" aria-label="Alt Kat - Sağ dairesi">
    <rect x="302" y="470" width="188" height="135" fill="url(#altGrad)" rx="6"/>

    <!-- Pencere -->
    <rect x="314" y="505" width="100" height="62" rx="5" fill="url(#camGrad)" stroke="#2a1a0c" stroke-width="2"/>
    <line x1="364" y1="505" x2="364" y2="567" stroke="#2a1a0c" stroke-width="1.5"/>
    <line x1="314" y1="536" x2="414" y2="536" stroke="#2a1a0c" stroke-width="1.2"/>

    <!-- Kapı -->
    <rect x="432" y="510" width="40" height="92" rx="3" fill="url(#kapiGrad)"/>
    <circle cx="440" cy="557" r="2.5" fill="#e8c87a"/>
    <path d="M 432 514 Q 452 506 472 514" fill="none" stroke="#3a210f" stroke-width="2" opacity="0.6"/>

    <rect class="daire-bolge" x="302" y="470" width="188" height="135" rx="6"/>

    <g transform="translate(450, 488)" class="daire-etiket-grup">
      <rect x="-26" y="-12" width="56" height="18" rx="9" fill="rgba(0,0,0,0.55)"/>
      <text class="daire-etiket" x="2" y="1" text-anchor="middle">1B</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="478" cy="486" r="6.5" stroke="#fff" stroke-opacity="0.85" stroke-width="1.5"/>
  </g>

  <!-- Zemin -->
  <rect x="90" y="605" width="420" height="6" rx="3" fill="#3a210f"/>
  <ellipse cx="300" cy="630" rx="240" ry="10" fill="#000" opacity="0.35"/>

  <!-- Sevimli detaylar: küçük saksılar -->
  <g opacity="0.95">
    <!-- Sol saksı -->
    <ellipse cx="98" cy="612" rx="14" ry="4" fill="#3a210f" opacity="0.6"/>
    <path d="M 90 600 L 92 612 L 104 612 L 106 600 Z" fill="#a85a3a"/>
    <circle cx="94" cy="596" r="5" fill="#3d8a5a"/>
    <circle cx="100" cy="594" r="6" fill="#4ca06b"/>
    <circle cx="104" cy="598" r="4" fill="#3d8a5a"/>

    <!-- Sağ saksı -->
    <ellipse cx="502" cy="612" rx="14" ry="4" fill="#3a210f" opacity="0.6"/>
    <path d="M 494 600 L 496 612 L 508 612 L 510 600 Z" fill="#a85a3a"/>
    <circle cx="498" cy="596" r="5" fill="#3d8a5a"/>
    <circle cx="504" cy="594" r="6" fill="#4ca06b"/>
    <circle cx="508" cy="598" r="4" fill="#3d8a5a"/>
  </g>
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
      // Dolu rezervasyon → camlar altın sarısı (ışık yanıyor efekti)
      g.querySelectorAll(".pencere rect").forEach((r) => {
        if (dr.durum === "dolu") {
          r.setAttribute("fill", "url(#camDolu)");
        } else {
          r.setAttribute("fill", "url(#camGrad)");
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
