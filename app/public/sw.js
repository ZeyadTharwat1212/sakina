/* Sakina service worker — offline shell + content cache. No backend involved. */
const VERSION = 'sakina-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './content/quran/chapters.json', './content/quran/meta.json', './content/adhkar/azkar.json', './content/ledger.json', './fonts/AmiriQuran.ttf', './fonts/NotoSansArabic-VF.ttf', './fonts/NotoNaskhArabic-VF.ttf'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // never touch audio streams or other origins
  const isShell = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isShell) {
    // network-first for the page so updates arrive; fallback to cache offline
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
    return;
  }
  // cache-first for content, fonts and hashed assets
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return r; })));
});
