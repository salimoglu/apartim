/* Apartım — basit cache-first service worker */
/* Sürüm: js/version.js APP ile senkron (1.0 → 1.1 → 1.2 …) */
const CACHE_VERSION = "apartim-2-141";
const ASSET_V = "2.141";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/version.js?v=" + ASSET_V,
  "./css/style.css?v=" + ASSET_V,
  "./js/firebase.js?v=" + ASSET_V,
  "./js/avatar.js?v=" + ASSET_V,
  "./js/pwa-install.js?v=" + ASSET_V,
  "./js/auth.js?v=" + ASSET_V,
  "./js/db.js?v=" + ASSET_V,
  "./js/gorunum.js?v=" + ASSET_V,
  "./js/para.js?v=" + ASSET_V,
  "./js/bina.js?v=" + ASSET_V,
  "./js/takvim.js?v=" + ASSET_V,
  "./js/daire.js?v=" + ASSET_V,
  "./js/rezervasyon.js?v=" + ASSET_V,
  "./js/rez-form-mobil.js?v=" + ASSET_V,
  "./js/rez-ozet.js?v=" + ASSET_V,
  "./js/tema.js?v=" + ASSET_V,
  "./js/ayarlar.js?v=" + ASSET_V,
  "./js/app.js?v=" + ASSET_V,
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-256.png",
  "./icons/icon-512.png",
  "./icons/logo-ev.png?v=" + ASSET_V,
  "./icons/avatars/ev.svg?v=" + ASSET_V,
  "./icons/avatars/apart.svg?v=" + ASSET_V,
  "./icons/avatars/kamp.svg?v=" + ASSET_V,
  "./icons/avatars/doga.svg?v=" + ASSET_V,
  "./icons/avatars/deniz.svg?v=" + ASSET_V,
  "./icons/avatars/dag.svg?v=" + ASSET_V,
  "./icons/avatars/gece.svg?v=" + ASSET_V,
  "./icons/avatars/orman.svg?v=" + ASSET_V
];

function networkFirstThenCache(request) {
  return fetch(request)
    .then((resp) => {
      if (resp && resp.status === 200 && resp.type === "basic") {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return resp;
    })
    .catch(() => caches.match(request));
}

function cacheFirstThenNetwork(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((resp) => {
      if (resp && resp.status === 200 && resp.type === "basic") {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return resp;
    });
  });
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.replace(/\/$/, "");
  const isRoot = path.endsWith("/apartim") || path.endsWith("/apartim/index.html") || path === "" || path.endsWith("/index.html");
  if (isRoot && event.request.mode === "navigate") {
    event.respondWith(networkFirstThenCache(event.request));
    return;
  }
  if (/\.(js|css)$/i.test(url.pathname)) {
    event.respondWith(networkFirstThenCache(event.request));
    return;
  }
  if (/\.(png|svg|json|ico|webp)$/i.test(url.pathname) || url.pathname.includes("/icons/")) {
    event.respondWith(cacheFirstThenNetwork(event.request));
    return;
  }
  event.respondWith(networkFirstThenCache(event.request));
});
