# سكينة (Sakina) — Muslim daily companion

Offline-first iOS/Android app: Quran (Hafs, Tanzil text), on-device prayer times & qibla, adhkar, Sahih al-Bukhari/Muslim (Arabic), tafsir (al-Muyassar, al-Jalalayn), English translation.
**No backend, no Cloudflare, no paid APIs, no AI at runtime.** Everything the user needs is bundled; the only network use is optional recitation streaming.

Built from the master prompt `Muslim_App_Master_Prompt_AR` (40 sections). Status per section: `docs/04_status_register.md`.

## Repo layout
```
app/      Capacitor + Vite + Preact + TypeScript application (see app/README below)
docs/     00 product brief & journeys · 01 sources & rights matrix · 02 visual directions & design system
          03 architecture & data model · 04 status register (01–40) · 05 phases, release gates, test plan
```

## Use it on your phone today (PWA, no store needed)
The web build is an installable PWA (manifest + service worker, offline after first load). Host `app/dist` on any static host —
`.github/workflows/pages.yml` deploys it to GitHub Pages on every push to `main`. Then on the phone: open the URL →
iPhone: Share → *Add to Home Screen*; Android: *Install app*. Notifications and GPS-less compass are limited in the PWA; the
Capacitor build below is the full native path.

## Build & run (web preview)
```bash
cd app
npm install
npm run build        # tsc + vite → dist/
npm run preview      # http://localhost:4173
npm test             # content integrity + prayer-time tests (18)
node tests/e2e-smoke.mjs   # daily journeys in headless Chromium (needs `npm run preview` running)
```

## Build the native apps (App Store / Play Store)
Requirements: Node 20+, Xcode 16+ (macOS) for iOS, Android Studio for Android. No accounts or keys are needed to build; store accounts are needed only to publish.
```bash
cd app
npm run build
npx cap add ios        # once
npx cap add android    # once
npx cap sync           # copies dist/ + plugins into the native projects
npx cap open ios       # → Xcode: set Team/bundle id (com.sakina.app), run on device
npx cap open android   # → Android Studio: run on device
```
Native settings to add once (not automated):
- **iOS** `Info.plist`: `NSLocationWhenInUseUsageDescription` ("لحساب المواقيت والقبلة على جهازك فقط"), `UIBackgroundModes: audio` (recitation keeps playing), notification permission is requested in-app.
- **Android** `AndroidManifest.xml`: `POST_NOTIFICATIONS`, `ACCESS_COARSE_LOCATION`; for exact prayer alarms later: `SCHEDULE_EXACT_ALARM` (Phase 3).
- Icons/splash: replace Capacitor defaults (`npx @capacitor/assets generate` with a 1024px icon).

## Rebuilding the content packs
Content is generated, never hand-edited (section 34). Clone the upstream sources and run:
```bash
# in SOURCES_DIR: qj (risan/quran-json), qapi (fawazahmed0/quran-api @1), azkardb (osamayy/azkar-db), hadith (AhmedBaset/hadith-json)
SOURCES_DIR=/path/to/sources npm run content
npm test
```
The script verifies 114/6236, the basmala rule (incl. the idgham shadda in 95 & 97), tafsir/translation coverage, and writes `public/content/ledger.json` with each pack's source, licence, upstream commit and review status. The app shows the ledger under Library → Sources & rights.

## What is honest about this build
- Prayer times are **calculated** on the device (adhan-js, MIT) and labelled so; never "official".
- Hadith packs are bundled for development; **sunnah.com redistribution permission is unconfirmed** and the Bukhari count (7277) does not match a named printed edition. Release gate: see `docs/01`.
- Adhkar: 103/345 entries carry a takhrij reference; the rest are labelled "reference pending".
- Notifications are short system notifications; a full background adhan needs native AlarmKit/AlarmManager work (Phase 3) and must be tested on real devices before it is advertised.
- Recitations stream from MP3Quran; offline download is disabled until rights are confirmed.

## Licences
Code: MIT. Content: see `app/public/content/ledger.json` and `docs/01_sources_rights_matrix.md`. Fonts: SIL OFL (files in `app/public/fonts/`).
