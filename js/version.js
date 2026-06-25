/* Apartım sürüm — sw.js ile senkron tutun
 * Her güncellemede APP değerini 0.1 artırın: 1.0 → 1.1 → 1.2 → 1.3 …
 * sw.js: CACHE_VERSION ve ASSET_V aynı sürümle güncellenmeli
 * index.html: ?v= sorgu parametreleri ASSET ile eşleşmeli
 */
(function () {
  "use strict";
  const APP = "1.3";
  window.APARTIM_VERSION = {
    APP,
    CACHE: "apartim-" + APP.replace(".", "-"),
    ASSET: APP,
    LABEL: APP
  };
})();
