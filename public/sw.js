// Kill-switch service worker — unregisters itself and clears all caches.
// Replaces an older sw.js that was intercepting POST requests and returning
// stale/405 responses (breaking /api/mix-console/.../revise in particular).
// Cache name bumped so the browser activates THIS version over the old one.
const CACHE_NAME = 'indiethis-killswitch-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Nuke every cache
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    // Unregister this SW so it never runs again
    await self.registration.unregister();
    // Reload every client so they fetch fresh, un-intercepted responses
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});

// Never intercept fetches — pass everything through the network.
self.addEventListener('fetch', () => {});
