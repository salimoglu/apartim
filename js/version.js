/* Apartım sürüm — artır: node tools/bump-version.cjs (2.99 → 3.0) */
(function () {
  "use strict";
  const APP = "3.12";
  window.APARTIM_VERSION = {
    APP,
    CACHE: "apartim-" + APP.replace(/\./g, "-"),
    ASSET: APP,
    LABEL: APP
  };
})();
