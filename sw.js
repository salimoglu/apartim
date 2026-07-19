/* Apartım — service worker
   JS/CSS: stale-while-revalidate (hızlı yenileme + arka planda güncelleme)
   HTML navigate: network-first (kısa zaman aşımı → cache)
   Sürüm: js/version.js APP ile senkron (2.99 → 3.0; minor 0–99) */
const CACHE_VERSION = "apartim-3-25";
const ASSET_V = "3.25";
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
  "./js/kimlik.js?v=" + ASSET_V,
  "./js/db.js?v=" + ASSET_V,
  "./js/gorunum.js?v=" + ASSET_V,
  "./js/para.js?v=" + ASSET_V,
  "./js/bina.js?v=" + ASSET_V,
  "./js/takvim.js?v=" + ASSET_V,
  "./js/daire.js?v=" + ASSET_V,
  "./js/rezervasyon.js?v=" + ASSET_V,
  "./js/rez-form-mobil.js?v=" + ASSET_V,
  "./js/rez-ozet.js?v=" + ASSET_V,
  "./js/excel-import.js?v=" + ASSET_V,
  "./js/sezon-temizle.js?v=" + ASSET_V,
  "./js/tema.js?v=" + ASSET_V,
  "./js/ayarlar.js?v=" + ASSET_V,
  "./js/kasa.js?v=" + ASSET_V,
  "./js/app.js?v=" + ASSET_V,
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-256.png",
  "./icons/avatars/ev.svg?v=" + ASSET_V,
  "./icons/avatars/apart.svg?v=" + ASSET_V,
  "./icons/avatars/kamp.svg?v=" + ASSET_V,
  "./icons/avatars/doga.svg?v=" + ASSET_V,
  "./icons/avatars/deniz.svg?v=" + ASSET_V,
  "./icons/avatars/dag.svg?v=" + ASSET_V,
  "./icons/avatars/gece.svg?v=" + ASSET_V,
  "./icons/avatars/orman.svg?v=" + ASSET_V
];

const NAV_TIMEOUT_MS = 2500;

function putCache(request, resp) {
  if (resp && resp.status === 200 && resp.type === "basic") {
    const copy = resp.clone();
    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
  }
}

/** Önce cache (anında), arka planda ağı güncelle — telefon yenilemesini hızlandırır */
function staleWhileRevalidate(request) {
  return caches.open(CACHE_VERSION).then((cache) =>
    cache.match(request).then((cached) => {
      const networkPromise = fetch(request)
        .then((resp) => {
          putCache(request, resp);
          return resp;
        })
        .catch(() => cached);
      return cached || networkPromise;
    })
  );
}

function networkFirstThenCache(request) {
  return fetch(request)
    .then((resp) => {
      putCache(request, resp);
      return resp;
    })
    .catch(() => caches.match(request));
}

/** Navigate: ağı dene, yavaşsa cache’e düş */
function networkFirstWithTimeout(request, ms) {
  const network = fetch(request)
    .then((resp) => {
      putCache(request, resp);
      return resp;
    })
    .catch(() => null);

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), ms);
  });

  return Promise.race([network, timeout]).then((resp) => {
    if (resp) return resp;
    return caches.match(request).then((cached) => {
      if (cached) return cached;
      return network.then((r) => r || Response.error());
    });
  });
}

function cacheFirstThenNetwork(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((resp) => {
      putCache(request, resp);
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
    event.respondWith(networkFirstWithTimeout(event.request, NAV_TIMEOUT_MS));
    return;
  }
  if (/\.(js|css)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  if (/\.(png|svg|json|ico|webp)$/i.test(url.pathname) || url.pathname.includes("/icons/")) {
    event.respondWith(cacheFirstThenNetwork(event.request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event.request));
});
