// service-worker.js – Lagedienst Cockpit

const CACHE_NAME = "lagedienst-cockpit-v2";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./feuer.html",
  "./gefahrgut.html",
  "./hilfeleistung.html",
  "./rettung.html",
  "./stoerung.html",
  "./tuis.html",
  "./sonstiges.html",
  "./bibliothek.html",
  "./erweiterte-lagebild.html",
  "./admin.html",
  "./admin-massnahmen.html",
  "./admin-bibliothek.html",
  "./admin-settings.html",
  "./assets/js/sharepoint-service.js",
  "./assets/js/engine.js",
  "./manifest.json"
];

// Installation
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.error("SW Cache Fehler:", err);
      });
    })
  );
  self.skipWaiting();
});

// Aktivierung
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
  self.clients.claim();
});

// Fetch-Handler
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
