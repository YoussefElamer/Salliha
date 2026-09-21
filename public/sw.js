const CACHE_NAME = 'salliha-app-v3';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/apple-touch-icon.png', '/favicon.png'];
// أصوات الأذان تخزن عند أول استخدام وتقرأ من الكاش بعدها (حجمها أكبر من أن تُثبت مسبقًا مع القشرة).
const SOUND_CACHE = 'salliha-sounds-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== 'salliha-audio-v1' && key !== SOUND_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  // لا نخزّن طلبات التطوير ولا أي طلب يحمل بارامترات.
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/') || url.search) return;
  const targetCache = url.pathname.startsWith('/sounds/') ? SOUND_CACHE : CACHE_NAME;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const clone = response.clone();
      caches.open(targetCache).then((cache) => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match('/')))
  );
});
