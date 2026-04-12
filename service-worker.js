// service-worker.js – Cockpit OS

const CACHE_NAME = "cockpit-os-v4";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./einsatz.html",
  "./bibliothek.html",
  "./erweiterte-lagebild.html",
  "./admin.html",
  "./admin-massnahmen.html",
  "./admin-bibliothek.html",
  "./admin-settings.html",
  "./personal.html",
  "./personal-datenblatt.html",
  "./assets/js/sharepoint-service.js",
  "./assets/js/engine.js",
  "./assets/js/personal-auth.js",
  "./assets/js/personal-data.js",
  "./assets/js/personal-ui.js",
  "./assets/css/main.css",
  "./assets/css/personal.css",
  "./assets/lib/html2pdf.bundle.min.js",
  "./assets/data/massnahmen.json",
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

  const url = new URL(request.url);
  const isHtmlRequest =
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html") ||
    url.pathname.endsWith(".html");

  if (isHtmlRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

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
