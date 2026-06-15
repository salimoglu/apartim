/* =========================================================
   APARTIM — Bina (ana ekran SVG)
   3 katlı, 5 daireli (üst tek, orta 2, alt 2) inline SVG.
   Her daire tıklanabilir bölge + durum noktası içerir.
   ========================================================= */

(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const wrap = () => document.getElementById("bina-svg-wrap");

  // ---- SVG iskelet ----
  // ViewBox: 600 x 700 (orijinal foto oranına yakın)
  // Koordinatlar fotoğraf temelli sadeleştirilmiş çerçeve.
  const SVG = `
<svg class="bina-svg" viewBox="0 0 600 720" xmlns="http://www.w3.org/2000/svg" aria-label="Apartım binası">
  <defs>
    <linearGradient id="gokyuzu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a2d3e"/>
      <stop offset="100%" stop-color="#0e1924"/>
    </linearGradient>
    <linearGradient id="ahsap1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a76936"/>
      <stop offset="100%" stop-color="#7a4621"/>
    </linearGradient>
    <linearGradient id="ahsap2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8b552a"/>
      <stop offset="100%" stop-color="#5e3a1c"/>
    </linearGradient>
    <linearGradient id="cati" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5b2a17"/>
      <stop offset="100%" stop-color="#3a1a0c"/>
    </linearGradient>
    <linearGradient id="cam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#bfe4ff"/>
      <stop offset="50%" stop-color="#7fb5dc"/>
      <stop offset="100%" stop-color="#4e85ad"/>
    </linearGradient>
    <linearGradient id="camDolu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffd28a"/>
      <stop offset="100%" stop-color="#c87b2e"/>
    </linearGradient>
    <pattern id="tasDoku" width="40" height="22" patternUnits="userSpaceOnUse">
      <rect width="40" height="22" fill="#cbb89c"/>
      <rect x="0" y="0" width="22" height="10" fill="#b9a585" opacity="0.85"/>
      <rect x="24" y="0" width="14" height="10" fill="#a99977" opacity="0.85"/>
      <rect x="0" y="12" width="12" height="10" fill="#a99977" opacity="0.85"/>
      <rect x="14" y="12" width="24" height="10" fill="#b9a585" opacity="0.85"/>
    </pattern>
    <filter id="bina-golge" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Arka plan -->
  <rect width="600" height="720" fill="url(#gokyuzu)"/>
  <!-- Dağ silüeti -->
  <path d="M 0 360 L 60 280 L 130 320 L 200 260 L 280 310 L 360 240 L 440 290 L 520 250 L 600 300 L 600 720 L 0 720 Z"
        fill="#0a1118" opacity="0.65"/>

  <!-- Zemin / taş duvar -->
  <rect x="40" y="600" width="520" height="80" fill="#1a1a1a" opacity="0.4"/>
  <rect x="30" y="660" width="540" height="14" fill="#000" opacity="0.6"/>

  <!-- =============== ÜST KAT (tek daire) =============== -->
  <g class="daire daire-ust" data-daire-id="ust" tabindex="0" role="button" aria-label="Üst Kat dairesi">
    <!-- Çatı -->
    <path d="M 140 175 L 300 95 L 460 175 L 446 195 L 300 122 L 154 195 Z" fill="url(#cati)" filter="url(#bina-golge)"/>
    <!-- Baca -->
    <rect x="400" y="115" width="22" height="40" fill="#3a1a0c"/>
    <rect x="397" y="110" width="28" height="10" fill="#2a1308"/>

    <!-- Ahşap cephe -->
    <rect x="170" y="195" width="260" height="115" fill="url(#ahsap1)"/>
    <!-- Ahşap dikey çizgiler -->
    <g stroke="#3a1a0c" stroke-width="1" opacity="0.7">
      <line x1="200" y1="195" x2="200" y2="310"/>
      <line x1="240" y1="195" x2="240" y2="310"/>
      <line x1="280" y1="195" x2="280" y2="310"/>
      <line x1="320" y1="195" x2="320" y2="310"/>
      <line x1="360" y1="195" x2="360" y2="310"/>
      <line x1="400" y1="195" x2="400" y2="310"/>
    </g>
    <!-- Üst kenarlık -->
    <rect x="170" y="195" width="260" height="6" fill="#3a1a0c"/>
    <rect x="170" y="304" width="260" height="6" fill="#3a1a0c"/>

    <!-- Geniş pencereler (3'lü grup) -->
    <g class="pencere">
      <rect x="184" y="210" width="74" height="86" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
      <rect x="262" y="210" width="74" height="86" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
      <rect x="340" y="210" width="74" height="86" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
      <line x1="221" y1="210" x2="221" y2="296" stroke="#2a1308" stroke-width="1.5"/>
      <line x1="299" y1="210" x2="299" y2="296" stroke="#2a1308" stroke-width="1.5"/>
      <line x1="377" y1="210" x2="377" y2="296" stroke="#2a1308" stroke-width="1.5"/>
    </g>

    <!-- Tıklanabilir bölge -->
    <rect class="daire-bolge" x="170" y="180" width="260" height="135" rx="4"/>
    <!-- Etiket + durum noktası -->
    <g class="daire-etiket-grup" transform="translate(300, 280)">
      <rect class="daire-etiket-bg" x="-44" y="-12" width="88" height="20" rx="10" fill="rgba(0,0,0,0.55)"/>
      <text class="daire-etiket" y="3">ÜST KAT</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="418" cy="200" r="7" stroke="#000" stroke-opacity="0.4" stroke-width="1"/>
  </g>

  <!-- =============== ORTA KAT (2 daire) =============== -->
  <!-- Üst kenar çıkıntı -->
  <rect x="80" y="310" width="440" height="10" fill="#3a1a0c"/>

  <!-- Orta-Sol -->
  <g class="daire daire-orta-sol" data-daire-id="orta-sol" tabindex="0" role="button" aria-label="Orta Sol daire">
    <rect x="80" y="320" width="220" height="135" fill="url(#ahsap1)"/>
    <g stroke="#3a1a0c" stroke-width="1" opacity="0.7">
      <line x1="120" y1="320" x2="120" y2="455"/>
      <line x1="160" y1="320" x2="160" y2="455"/>
      <line x1="200" y1="320" x2="200" y2="455"/>
      <line x1="240" y1="320" x2="240" y2="455"/>
      <line x1="280" y1="320" x2="280" y2="455"/>
    </g>
    <g class="pencere">
      <rect x="100" y="340" width="80" height="98" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
      <rect x="200" y="340" width="80" height="98" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
      <line x1="140" y1="340" x2="140" y2="438" stroke="#2a1308" stroke-width="1.5"/>
      <line x1="240" y1="340" x2="240" y2="438" stroke="#2a1308" stroke-width="1.5"/>
      <line x1="100" y1="385" x2="180" y2="385" stroke="#2a1308" stroke-width="1.2"/>
      <line x1="200" y1="385" x2="280" y2="385" stroke="#2a1308" stroke-width="1.2"/>
    </g>
    <rect class="daire-bolge" x="80" y="320" width="220" height="135" rx="3"/>
    <g class="daire-etiket-grup" transform="translate(190, 420)">
      <rect x="-46" y="-12" width="92" height="20" rx="10" fill="rgba(0,0,0,0.55)"/>
      <text class="daire-etiket" y="3">ORTA - SOL</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="290" cy="335" r="7" stroke="#000" stroke-opacity="0.4" stroke-width="1"/>
  </g>

  <!-- Orta dikey kolon -->
  <rect x="298" y="320" width="6" height="135" fill="#2a1308"/>

  <!-- Orta-Sağ -->
  <g class="daire daire-orta-sag" data-daire-id="orta-sag" tabindex="0" role="button" aria-label="Orta Sağ daire">
    <rect x="302" y="320" width="220" height="135" fill="url(#ahsap1)"/>
    <g stroke="#3a1a0c" stroke-width="1" opacity="0.7">
      <line x1="340" y1="320" x2="340" y2="455"/>
      <line x1="380" y1="320" x2="380" y2="455"/>
      <line x1="420" y1="320" x2="420" y2="455"/>
      <line x1="460" y1="320" x2="460" y2="455"/>
      <line x1="500" y1="320" x2="500" y2="455"/>
    </g>
    <g class="pencere">
      <rect x="320" y="340" width="80" height="98" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
      <rect x="420" y="340" width="80" height="98" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
      <line x1="360" y1="340" x2="360" y2="438" stroke="#2a1308" stroke-width="1.5"/>
      <line x1="460" y1="340" x2="460" y2="438" stroke="#2a1308" stroke-width="1.5"/>
      <line x1="320" y1="385" x2="400" y2="385" stroke="#2a1308" stroke-width="1.2"/>
      <line x1="420" y1="385" x2="500" y2="385" stroke="#2a1308" stroke-width="1.2"/>
    </g>
    <rect class="daire-bolge" x="302" y="320" width="220" height="135" rx="3"/>
    <g class="daire-etiket-grup" transform="translate(412, 420)">
      <rect x="-46" y="-12" width="92" height="20" rx="10" fill="rgba(0,0,0,0.55)"/>
      <text class="daire-etiket" y="3">ORTA - SAĞ</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="510" cy="335" r="7" stroke="#000" stroke-opacity="0.4" stroke-width="1"/>
  </g>

  <!-- Alt kat ahşap-taş geçiş kenarı -->
  <rect x="80" y="455" width="440" height="8" fill="#3a1a0c"/>

  <!-- =============== ALT KAT (2 daire — taş cephe) =============== -->
  <!-- Alt-Sol -->
  <g class="daire daire-alt-sol" data-daire-id="alt-sol" tabindex="0" role="button" aria-label="Alt Sol daire">
    <rect x="80" y="463" width="220" height="140" fill="url(#tasDoku)"/>
    <!-- Kapı -->
    <rect x="98" y="498" width="42" height="100" fill="#5e3a1c" stroke="#2a1308" stroke-width="2"/>
    <circle cx="132" cy="552" r="2.5" fill="#d4a35e"/>
    <!-- Yan pencere -->
    <rect x="160" y="490" width="58" height="60" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
    <line x1="189" y1="490" x2="189" y2="550" stroke="#2a1308" stroke-width="1.5"/>
    <line x1="160" y1="520" x2="218" y2="520" stroke="#2a1308" stroke-width="1.2"/>
    <!-- İkinci pencere -->
    <rect x="234" y="490" width="58" height="60" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
    <line x1="263" y1="490" x2="263" y2="550" stroke="#2a1308" stroke-width="1.5"/>
    <line x1="234" y1="520" x2="292" y2="520" stroke="#2a1308" stroke-width="1.2"/>
    <rect class="daire-bolge" x="80" y="463" width="220" height="140" rx="3"/>
    <g class="daire-etiket-grup" transform="translate(190, 580)">
      <rect x="-44" y="-12" width="88" height="20" rx="10" fill="rgba(0,0,0,0.65)"/>
      <text class="daire-etiket" y="3">ALT - SOL</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="290" cy="478" r="7" stroke="#000" stroke-opacity="0.4" stroke-width="1"/>
  </g>

  <!-- Alt orta kolon -->
  <rect x="298" y="463" width="6" height="140" fill="#2a1308"/>

  <!-- Alt-Sağ -->
  <g class="daire daire-alt-sag" data-daire-id="alt-sag" tabindex="0" role="button" aria-label="Alt Sağ daire">
    <rect x="302" y="463" width="220" height="140" fill="url(#tasDoku)"/>
    <!-- Pencereler -->
    <rect x="316" y="490" width="58" height="60" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
    <line x1="345" y1="490" x2="345" y2="550" stroke="#2a1308" stroke-width="1.5"/>
    <line x1="316" y1="520" x2="374" y2="520" stroke="#2a1308" stroke-width="1.2"/>
    <rect x="390" y="490" width="58" height="60" fill="url(#cam)" stroke="#2a1308" stroke-width="2"/>
    <line x1="419" y1="490" x2="419" y2="550" stroke="#2a1308" stroke-width="1.5"/>
    <line x1="390" y1="520" x2="448" y2="520" stroke="#2a1308" stroke-width="1.2"/>
    <!-- Kapı -->
    <rect x="464" y="498" width="42" height="100" fill="#5e3a1c" stroke="#2a1308" stroke-width="2"/>
    <circle cx="472" cy="552" r="2.5" fill="#d4a35e"/>
    <rect class="daire-bolge" x="302" y="463" width="220" height="140" rx="3"/>
    <g class="daire-etiket-grup" transform="translate(412, 580)">
      <rect x="-44" y="-12" width="88" height="20" rx="10" fill="rgba(0,0,0,0.65)"/>
      <text class="daire-etiket" y="3">ALT - SAĞ</text>
    </g>
    <circle class="durum-nokta durum-nokta-bos-temiz" cx="510" cy="478" r="7" stroke="#000" stroke-opacity="0.4" stroke-width="1"/>
  </g>

  <!-- Zemin gölgesi -->
  <ellipse cx="300" cy="660" rx="240" ry="14" fill="#000" opacity="0.6"/>
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
      // Camları dolu rezervasyonda altın renge çevir
      g.querySelectorAll(".pencere rect").forEach((r) => {
        if (dr.durum === "dolu") {
          r.setAttribute("fill", "url(#camDolu)");
        } else {
          r.setAttribute("fill", "url(#cam)");
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
