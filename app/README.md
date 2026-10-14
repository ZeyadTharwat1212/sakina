# app/ — Sakina (Capacitor + Vite + Preact + TypeScript)

See the root README for build, native packaging and content-pipeline instructions.

- `src/lib/store.ts` — all local state (settings, last position, bookmarks, sessions). No server.
- `src/lib/prayer.ts` — 12 calculation methods, cities, night-based times, qibla (adhan-js).
- `src/lib/notify.ts` — Capacitor LocalNotifications: reschedules 10 days × 5 prayers, cancels stale ones.
- `src/lib/content.ts` — loaders for `public/content/*` with in-memory cache; `normalizeArabic` for search only.
- `src/screens/*` — one file per tab: Today, Quran, Prayer, Adhkar, Library, Settings, Player, Onboarding.
- `scripts/build-content.mjs` — reproducible content build + rights ledger.
- `tests/` — `npm test` (unit) and `node tests/e2e-smoke.mjs` (journeys).
