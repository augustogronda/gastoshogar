const CACHE_NAME = 'gastoshogar-v1.26.2';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Warning al precachear activos:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo interceptar peticiones GET del mismo origen
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // No cachear chequeos de versión, api ni auth para garantizar datos frescos
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.searchParams.has('_t')
  ) {
    return;
  }

  // 1. Navegación (Apertura de la App / Recarga): Stale-While-Revalidate
  // Devuelve la App Shell en 0ms desde la memoria local del celular para evitar la pantalla negra.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((cached) => {
        const networkFetch = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put('/', clone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // En caso de estar sin internet, responder con el shell en caché
            return cached;
          });

        // Si tenemos el cascarón en caché, responder INMEDIATAMENTE
        return cached || networkFetch;
      })
    );
    return;
  }

  // 2. Archivos estáticos de Next.js (_next/static), imágenes, iconos y fuentes: Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff|woff2|ttf)$/i)
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;

        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, clone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Para todo lo demás: Network primero con fallback a caché
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(req))
  );
});
