/* Apartım sürüm — sw.js ile senkron tutun
 * Her güncellemede APP değerini 0.1 artırın: 1.0 → 1.1 → 1.2 → 1.3 …
 */
(function () {
  "use strict";
  const APP = "1.4";
  window.APARTIM_VERSION = {
    APP,
    CACHE: "apartim-" + APP.replace(".", "-"),
    ASSET: APP,
    LABEL: APP
  };
})();
