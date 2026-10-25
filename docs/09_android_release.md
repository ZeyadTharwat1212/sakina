# Android / Google Play release — how it works (Oct 2026)

- **Project:** `app/android` (Capacitor 7, package **dev.zeyad.sakina**, min SDK 23, target/compile SDK 36). Generated once with `npx cap add android`, then customised and committed:
  brand icons + splash (`app/assets` → `npx @capacitor/assets generate --android`), status-bar icon `ic_stat_sakina`, home-screen prayer widget (`SakinaWidget.java`, reads Preferences key `widget` written by `writeWidget()` in `src/lib/notify.ts`), permissions (notifications, exact alarms, boot, location).
- **Build:** GitHub Actions → **Android (Google Play)** (`workflow_dispatch` or a `v*` tag). Runs tests, web build, `cap sync`, `./gradlew bundleRelease`; versionCode = run number, versionName = 1.0.<run>. The bundle is attached to a pre-release `android-<run>`.
- **Signing:** upload key `sakina-upload.jks` (alias `upload`, RSA 2048, 10 000 days). Kept OFF GitHub: a copy is on the owner's PC in `E:\القران الكريم\sakina-signing\` (with its password file). Two ways:
  1. Add repo secrets `SAKINA_KEYSTORE_B64` (contents of `SAKINA_KEYSTORE_B64.txt`) and `SAKINA_KS_PASS` → CI signs automatically.
  2. Without secrets the CI bundle is unsigned; sign it with `jarsigner -keystore sakina-upload.jks -sigalg SHA256withRSA -digestalg SHA-256 <aab> upload`.
  Google Play App Signing holds the real app-signing key; if the upload key is lost, request an upload-key reset in Play Console.
- **Upload key SHA-256:** `E5:1B:9B:99:47:B9:92:DD:52:9C:8F:F6:B8:73:49:BA:BF:01:2B:29:72:88:1B:DB:08:D2:60:B9:C4:69:EA:EB`
- **Privacy policy:** `https://zeyadtharwat1212.github.io/sakina/privacy.html` (`app/public/privacy.html`).
- **Play Console:** account EMZo United (personal). New personal accounts must run a **closed test with 12+ testers for 14 days** before production; internal testing (up to 100 testers) works immediately.
