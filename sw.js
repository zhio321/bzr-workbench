const CACHE = 'bzr-wb-v1';
const CORE = [
  '/bzr-workbench/',
  '/bzr-workbench/index.html',
  '/bzr-workbench/manifest.webmanifest',
  '/bzr-workbench/icon-96.png',
  '/bzr-workbench/icon-192.png',
  '/bzr-workbench/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // 同源策略：只在 /bzr-workbench/ 作用域内缓存
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/bzr-workbench/')) return;

  // 页面/导航请求：network-first，离线时回退缓存
  if (request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/bzr-workbench/') {
    e.respondWith(
      fetch(request)
        .then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/bzr-workbench/index.html')))
    );
    return;
  }

  // 静态资源（图标/manifest）：cache-first
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (resp && resp.status === 200 && request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return resp;
      }).catch(() => new Response('', { status: 404 }));
    })
  );
});
