/* Build replaces the ID with a digest of the app bundle. */
const BUILD_ID = "development";
const CACHE = `vocab-pwa-${BUILD_ID}`;
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

function isAppAsset(url) {
  return url.origin === self.location.origin && !url.search && !url.pathname.startsWith("/api/") &&
    /\.(?:js|css|woff2?|ttf|otf|png|svg|webmanifest)$/.test(url.pathname) && url.pathname !== "/sw.js";
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    if (BUILD_ID !== "development") {
      const response = await fetch("/offline-assets.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Offline asset manifest unavailable");
      const assets = await response.json();
      if (assets.build !== BUILD_ID || !Array.isArray(assets.urls)) throw new Error("Offline build mismatch");
      const urls = assets.urls.filter(path => typeof path === "string" && isAppAsset(new URL(path, self.location.origin)));
      await cache.addAll(urls);
      await cache.put("/offline-assets.json", new Response(JSON.stringify(assets), { headers: { "Content-Type": "application/json" } }));
    }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => (key.startsWith("vocab-pwa-") || key.startsWith("vocab-shell-")) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
  if (event.data?.type === "CHECK_OFFLINE") event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    if (BUILD_ID !== "development" && await cache.match("/") && await cache.match("/offline-assets.json")) {
      event.source?.postMessage({ type: "OFFLINE_READY" });
    }
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("Authorization")) return;
  if (request.headers.has("RSC") || request.headers.has("Next-Router-State-Tree")) return;
  const navigation = request.mode === "navigate" && url.pathname === "/";
  if (!navigation && !isAppAsset(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Keep HTML and chunks on one build until the user accepts an update.
    const cached = await cache.match(navigation ? "/" : request);
    return cached || fetch(request);
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) await existing.focus();
    else await self.clients.openWindow("/");
  })());
});
