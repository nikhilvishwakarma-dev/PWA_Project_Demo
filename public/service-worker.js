
const CACHE_NAME = "pwa-connect-v6";

const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/assets/index-DobtphH2.css",
  "/assets/index-a-tPQUSS.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("pwa-connect-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

async function findCachedRequest(request) {
  // Try the exact request in all caches.
  let response = await caches.match(request);
  if (response) return response;

  // Fallback: match by pathname, ignoring query strings.
  const requestedURL = new URL(request.url);
  const keys = await caches.keys();

  for (const key of keys) {
    const cache = await caches.open(key);
    const requests = await cache.keys();

    const match = requests.find((item) => {
      const cachedURL = new URL(item.url);

      return (
        cachedURL.origin === requestedURL.origin &&
        cachedURL.pathname === requestedURL.pathname
      );
    });

    if (match) {
      response = await cache.match(match);
      if (response) return response;
    }
  }

  return undefined;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      if (request.mode === "navigate") {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }

          return response;
        } catch {
          return (
            (await findCachedRequest(request)) ||
            (await findCachedRequest(
              new Request(new URL("/index.html", self.location.origin))
            )) ||
            (await findCachedRequest(
              new Request(new URL("/offline.html", self.location.origin))
            ))
          );
        }
      }

      // Cache-first for CSS, JavaScript, icons and other same-origin assets.
      const cached = await findCachedRequest(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      } catch {
        return new Response("Asset unavailable offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })()
  );
});
