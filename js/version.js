/* Apartım sürüm — sw.js + index.html ?v= için: node tools/sync-version.cjs */
(function () {
  "use strict";
  const APP = "2.126";
  window.APARTIM_VERSION = {
    APP,
    CACHE: "apartim-" + APP.replace(".", "-"),
    ASSET: APP,
    LABEL: APP
  };
})();
