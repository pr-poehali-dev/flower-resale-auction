const CACHE_NAME = 'flowerflip-v7';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first — обязательный fetch-обработчик для установки PWA
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(r => r || new Response('', { status: 503 }))
    )
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'FlowerFlip', {
      body: data.body || 'Новое событие',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag: data.tag || 'default',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});