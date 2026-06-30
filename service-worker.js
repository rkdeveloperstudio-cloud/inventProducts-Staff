const CACHE_NAME = "inventory-pwa-v2";

const STATIC_FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.json"
];

// INSTALL
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener("fetch", event => {

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch("./index.html").catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (event.request.url.includes("/rest/v1/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      });
    })
  );
});