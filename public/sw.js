/* No API responses are cached: an offline response must never imply an all-clear. */
const CACHE = 'varta-shell-v1';
const SHELL = ['/', '/favicon.svg', '/icons/icon-192.png', '/data/oblasts.geojson', '/data/raions.geojson', '/fonts/manrope-regular.ttf', '/fonts/manrope-bold.ttf'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(SHELL);
    const html = await (await cache.match('/')).text();
    const assets = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(match => match[1]);
    await cache.addAll([...new Set(assets)]);
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('varta-shell-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put('/', copy))); }
      return response;
    }).catch(() => caches.match('/').then(cached => cached || Response.error())));
    return;
  }
  if (/^\/(assets|fonts|icons|data)\//.test(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy))); }
      return response;
    })));
  }
});
self.addEventListener('push', event => {
  if (!event.data) return;
  let message;
  try { message = event.data.json(); } catch { return; }
  // Expired alert messages must not reappear after a phone reconnects later.
  if (typeof message.expiresAt !== 'number' || message.expiresAt < Date.now()) return;
  event.waitUntil(self.registration.showNotification(message.title || 'ВАРТА', {
    body: message.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: message.tag || 'varta-alert',
    renotify: true,
    timestamp: message.timestamp,
    data: { region: message.region || '' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL('/', self.location.origin);
  if (event.notification.data?.region) url.searchParams.set('region', event.notification.data.region);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const client = clients.find(client => new URL(client.url).origin === url.origin);
    if (client) { await client.navigate(url.href); return client.focus(); }
    return self.clients.openWindow(url.href);
  }));
});
