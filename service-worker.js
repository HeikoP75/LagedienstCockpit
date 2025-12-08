// service-worker.js – Lagedienst Cockpit

const CACHE_NAME = "lagedienst-cockpit-v1";

// Hier alle Dateien eintragen, die offline verfügbar sein sollen
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./feuer.html",
  "./gefahrgut.html",
  "./hilfeleistung.html",
  "./rettung.html",
  "./tools.html",
  "./wissen.html",
  "./uebergabe.html",
  "./assets/styles.css",
  "./assets/engine.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Nur GET-Anfragen cachen
  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          // Erfolgreiche Antworten in den Cache legen (rudimentär)
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return networkResponse;
        })
        .catch(() => {
          // Optional: Fallback-Seite liefern
          return caches.match("./index.html");
        });
    })
  );
});
