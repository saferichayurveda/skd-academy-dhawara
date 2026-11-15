const CACHE_NAME = "skd-academy-shell-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/logo.jpg",
  "/manifest.webmanifest",
  "/app-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache admin, office, student records, or server/API responses.
  if (/^\/(admin|school-office|student-fee-record|student-import|file-upload)(\.html)?$/i.test(url.pathname)
      || url.pathname.startsWith("/api/")
      || url.pathname.startsWith("/functions/")) return;

  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match("/")) || (await caches.match("/index.html")))
    );
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});