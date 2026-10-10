/* Service worker: caches the app files so My Library works offline.
   When you change any app file, bump CACHE_VERSION so phones fetch the update. */
const CACHE_VERSION = "my-library-v14";
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/app-192.png",
  "./icons/app-512.png",
  "./icons/app-maskable-192.png",
  "./icons/app-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./fonts/cormorant-garamond-latin-600-normal.woff2",
  "./fonts/cormorant-garamond-latin-700-normal.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first, then network. Page navigations fall back to index.html offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;   // show database and poster requests go straight to the network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() =>
        event.request.mode === "navigate" ? caches.match("./index.html") : Response.error()
      );
    })
  );
});
