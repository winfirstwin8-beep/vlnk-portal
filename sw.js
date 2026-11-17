/* Service worker: застосунок відкривається і працює без інтернету */
const CACHE = 'vlnk-v1.9.18';
const SHELL = [
  './', 'index.html', 'app.css', 'config.js', 'manifest.webmanifest',
  'js/core.js', 'js/ui.js', 'js/m365.js', 'js/views-work.js', 'js/views-data.js', 'js/views-vac.js', 'js/views-ppe.js', 'js/views-brief.js', 'js/docs.js', 'js/demo.js',
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
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'vlnk-push').map(k => caches.delete(k)))).then(() => self.clients.claim()));
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

// натискання на сповіщення: відкрити портал на потрібній сторінці
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const href = (e.notification.data && e.notification.data.href) || '#/notifs';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ type: 'NAV', href }); return c.focus(); }
    return self.clients.openWindow(self.registration.scope + 'index.html' + href);
  }));
});

// push-сповіщення (портал може бути закритий): сервер лише будить телефон, текст забираємо з «вхідних» сервера сповіщень
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let items = [];
    try {
      const c = await caches.open('vlnk-push');
      const hit = await c.match(new URL('push-cfg', self.registration.scope).href);
      const cfg = hit ? await hit.json() : null;
      if (cfg && cfg.api && cfg.token) {
        const r = await fetch(cfg.api, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'inbox', token: cfg.token }) });
        const j = await r.json();
        if (j && j.ok) items = j.items || [];
      }
    } catch (err) { /* немає мережі — покажемо загальне сповіщення */ }
    const opt = { icon: 'icons/icon-192.png', badge: 'icons/maskable-192.png', lang: 'uk' };
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    cs.forEach(c => c.postMessage({ type: 'SYNC' }));
    if (!items.length) return self.registration.showNotification('Портал ВЛНК', { ...opt, body: 'Є нові зміни — відкрийте портал, щоб переглянути', tag: 'vlnk-push', data: { href: '#/notifs' } });
    if (items.length > 3) return self.registration.showNotification('Портал ВЛНК: нових сповіщень — ' + items.length, { ...opt, body: items.slice(-4).map(x => x.title).join('\n'), tag: 'vlnk-push-many', data: { href: '#/notifs' } });
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      await self.registration.showNotification(x.title, { ...opt, body: (x.body || '') + (x.by ? '\n— ' + x.by : ''), tag: 'vlnk-p-' + x.at + '-' + i, data: { href: x.href || '#/notifs' } });
    }
  })());
});
