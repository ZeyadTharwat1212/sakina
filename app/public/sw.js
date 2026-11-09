/* Sakina service worker — offline shell + content cache. No backend involved. */
const VERSION = 'sakina-v1';            // stamped per build by scripts/postbuild.mjs (sakina-YYYYMMDDHHMM)
const STATIC = 'sakina-static-v1';      // immutable files kept across app updates: QCF page fonts, versioned mushaf pages
const PHOTOS = 'sakina-photos-v1';      // reciter photos from Wikimedia Commons — kept across app updates
const SHELL = ['./', './index.html', './manifest.webmanifest', './content/quran/chapters.json', './content/quran/meta.json', './content/adhkar/azkar.json', './content/ledger.json', './fonts/ReadexPro-VF.woff2', './fonts/KFGQPC-HafsSmart.woff2', './fonts/NotoNaskhArabic-VF.ttf', './mushaf/font-map.json'];

self.addEventListener('install', (e) => {
  // cache: 'reload' — never precache a stale copy from the browser's HTTP cache
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // Only old app-shell caches are removed. The user's downloads (sakina-audio-v1, sakina-ayah-audio-v1,
  // sakina-text-v1), the static fonts/pages and the photos survive every update.
  const oldShell = (k) => k !== VERSION && (k === 'sakina-v1' || /^sakina-\d{8,14}$/.test(k));
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter(oldShell).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isStatic = (url) => url.pathname.includes('/fonts/qcf4/') || (url.pathname.includes('/mushaf/pages/') && url.searchParams.has('v'));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname === 'upload.wikimedia.org') {
    // cache-first so photos show offline after the first view; only real (CORS) responses are stored —
    // an opaque copy can't serve the canvas artwork and costs ~7 MB of quota each
    e.respondWith(caches.open(PHOTOS).then((c) => c.match(e.request).then((hit) => (hit && hit.type !== 'opaque') ? hit : fetch(e.request).then((r) => { if (r.ok && r.type !== 'opaque') c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== location.origin) return; // never touch audio streams or other origins
  const isShell = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isShell) {
    // network-first for the page so updates arrive; fallback to cache offline
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
    return;
  }
  // cache-first for content, fonts and hashed assets; revalidate with the server (ETag) so a stale HTTP-cache copy never gets pinned
  const store = isStatic(url) ? STATIC : VERSION;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(store).then((c) => c.put(e.request, copy)); }
    return r;
  })));
});
