/* Service worker: застосунок відкривається і працює без інтернету */
const CACHE = 'vlnk-v1.8.29';
const SHELL = [
  './', 'index.html', 'app.css', 'config.js', 'manifest.webmanifest',
  'js/core.js', 'js/ui.js', 'js/views-work.js', 'js/views-data.js', 'js/views-vac.js', 'js/views-ppe.js', 'js/views-brief.js', 'js/docs.js', 'js/demo.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png', 'icons/logo.png'
];
const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))); // оминаючи HTTP-кеш браузера — лише свіжі файли
    // бібліотека Excel — заздалегідь, щоб документи формувались офлайн
    await Promise.all(LIBS.map(u => c.add(new Request(u, { mode: 'no-cors' })).catch(() => {})));
  }));
  // нова версія чекає, доки користувач натисне «Оновити» (повідомлення в застосунку)
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // синхронізація (POST) — завжди в мережу
  const url = new URL(req.url);
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  const isLib = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  if (url.origin === location.origin || isLib) {
    // спочатку кеш (миттєве відкриття і робота офлайн)
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
      // файли застосунку оновлюються лише разом з новою версією sw.js (після «Оновити»), щоб версії не змішувались
      if (hit) return hit;
      const r = await fetch(req).then(x => { if (x && (x.ok || x.type === 'opaque')) c.put(req, x.clone()); return x; }).catch(() => null);
      if (r) return r;
      if (req.mode === 'navigate') return c.match('index.html');
      return new Response('', { status: 504 });
    }));
  }
});
