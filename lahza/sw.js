/* Lahza service worker — scoped to /lahza/ ONLY. Never controls other parts
 * of saadm.dev. Cache-first for static assets, network-first for the app
 * shell and AI calls (so visitors always get the latest UI when online). */
const CACHE = 'lahza-v20260520a';
const STATIC_ASSETS = [
  '/lahza/',
  '/lahza/index.html',
  '/lahza/css/lahza.css?v=20260520a',
  '/lahza/js/data.js?v=20260520a',
  '/lahza/js/mock-api.js?v=20260520a',
  '/lahza/js/app.js?v=20260520a',
  '/lahza/js/ai-engine.js?v=20260520a',
  '/lahza/js/router.js?v=20260520a',
  '/lahza/manifest.webmanifest?v=20260520a',
  '/lahza/icons/icon.svg?v=20260520a',
  '/lahza/icons/icon-192.png?v=20260520a',
  '/lahza/icons/icon-512.png?v=20260520a'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only handle requests within our scope. Defensive — the SW scope already
  // restricts to /lahza/, but be explicit.
  if (!url.pathname.startsWith('/lahza/')) return;

  // AI calls — go to network, no caching (they vary by request body).
  if (url.pathname.startsWith('/api/lahza/ai/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ ok: false, fallback: true }), { headers: { 'Content-Type': 'application/json' }, status: 503 })));
    return;
  }

  // HTML — network-first so fresh visitors get the latest UI; cache fallback for offline.
  if (e.request.mode === 'navigate' || url.pathname === '/lahza/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return r;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match('/lahza/index.html')))
    );
    return;
  }

  // Static assets — cache-first.
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); }
      return r;
    }))
  );
});
