const CACHE_NAME = "inventory-pwa-v3";

const STATIC_FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.json"
];

// =====================
// INSTALL EVENT
// =====================
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_FILES);
    })
  );

  // Force immediate activation
  self.skipWaiting();
});

// =====================
// ACTIVATE EVENT
// =====================
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );

  // Take control immediately
  self.clients.claim();
});

// =====================
// FETCH EVENT
// =====================
self.addEventListener("fetch", event => {

  const request = event.request;

  // =====================
  // 1. NAVIGATION REQUEST (Fix offline 404)
  // =====================
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("index.html"))
    );
    return;
  }

  // =====================
  // 2. SUPABASE API (Always network)
  // =====================
  if (request.url.includes("/rest/v1/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: "Offline - no network connection" }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      })
    );
    return;
  }

  // =====================
  // 3. STATIC FILES (Cache First Strategy)
  // =====================
  const isStatic =
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "document" ||
    request.destination === "image";

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(cached => {
        return (
          cached ||
          fetch(request).then(networkResponse => {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            });
          })
        );
      })
    );
    return;
  }

  // =====================
  // 4. DEFAULT FALLBACK
  // =====================
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});