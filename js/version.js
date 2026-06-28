/* Apartım sürüm — sw.js ile senkron tutun */
(function () {
  "use strict";
  const APP = "2.54";
  window.APARTIM_VERSION = {
    APP,
    CACHE: "apartim-" + APP.replace(".", "-"),
    ASSET: APP,
    LABEL: APP
  };
})();
