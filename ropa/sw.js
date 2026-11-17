/* sw.js · permite instalar la app en el teléfono y abrirla aunque falle la señal.
   Primero intenta internet (siempre datos frescos); si no hay, usa la copia guardada. */
const CACHE = "app-v1";
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(r, c)).catch(() => {}); return res; })
    .catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
