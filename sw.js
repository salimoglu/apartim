/* Apartım — basit cache-first service worker */
const CACHE_VERSION = "apartim-v56-20260804";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/firebase.js",
  "./js/pwa-install.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/para.js",
  "./js/bina.js",
  "./js/takvim.js",
  "./js/daire.js",
  "./js/rezervasyon.js",
  "./js/rez-ozet.js",
  "./js/temizlik.js",
  "./js/tema.js",
  "./js/ayarlar.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-256.png",
  "./icons/icon-512.png",
  "./icons/apart-illustrasyon.png"
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
    const fetchPromise = fetch(request)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return resp;
      })
      .catch(() => cached);
    return cached || fetchPromise;
  });
}

function kritikDosyaMi(url) {
  const p = url.pathname;
  return p.endsWith("/manifest.json") ||
    p.endsWith("/index.html") ||
    p.endsWith("/sw.js") ||
    p.endsWith("/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(CORE_ASSETS).catch(() => null)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (kritikDosyaMi(url)) {
    event.respondWith(networkFirstThenCache(req));
    return;
  }

  event.respondWith(cacheFirstThenNetwork(req));
});
