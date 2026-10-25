# سكينة — رفع نسخة iOS على App Store / TestFlight
**For Ihab** — English steps below the Arabic.

## المطلوب
- جهاز Mac عليه **Xcode 16 أو أحدث** (من App Store).
- حساب Apple Developer (مدفوع ومفعّل).
- لا يلزم Node.js ولا CocoaPods: المشروع جاهز، وملفات التطبيق منسوخة داخل مشروع Xcode، والإضافات مضمّنة في المجلد.

## الخطوات
1. فك الضغط، وافتح الملف: `sakina/app/ios/App/App.xcodeproj`
   (انتظر دقيقة حتى يكمل Xcode تنزيل حزمة Capacitor من GitHub — تظهر في الشريط الجانبي «Package Dependencies»).
2. اختر الهدف **App** ← تبويب **Signing & Capabilities**:
   - **Team**: اختر فريقك.
   - **Bundle Identifier**: `dev.zeyad.sakina` (أو غيّره لمعرّف خاص بك مثل `com.yourname.sakina` لو رفضه Xcode).
   - اترك «Automatically manage signing» مفعّلًا.
   - تأكد من وجود **Background Modes → Audio** (موجود في Info.plist؛ لو لم يظهر أضفه من «+ Capability»).
3. أنشئ التطبيق في **App Store Connect** ← My Apps ← «+» ← New App: نفس الـ Bundle ID، الاسم «سكينة — Sakina»، اللغة العربية. (لو الاسم محجوز جرّب «سكينة: قرآن وصلاة».)
4. في Xcode اختر الجهاز **Any iOS Device (arm64)** ثم **Product → Archive**.
5. بعد انتهاء الأرشفة: **Distribute App → App Store Connect → Upload**.
6. بعد ١٠–٣٠ دقيقة تظهر النسخة في App Store Connect ← **TestFlight**:
   - **Internal testing**: أضف نفسك وزياد (حتى ١٠٠ شخص من فريقك) — لا تحتاج مراجعة.
   - **External testing** (لعرضها على أي أحد برابط عام): أنشئ مجموعة، فعّل **Public Link**، وأرسل للمراجعة التجريبية (عادة أقل من يوم).
7. للنشر العام لاحقًا: املأ صفحة المتجر من `store/LISTING.md` وارفع الصور من `store/screenshots-6.9/` ثم Submit for Review.

## لكل تحديث جديد
زِد **Build** (CURRENT_PROJECT_VERSION) بواحد في تبويب General، ثم Archive ← Upload.

## لو احتجت تعديل كود الويب (اختياري)
هذا الملف المضغوط لا يحتوي مجلد `app/public` (المحتوى موجود بالفعل داخل مشروع Xcode). للتعديل خذ المشروع كاملًا من GitHub: `github.com/ZeyadTharwat1212/sakina` ثم:
```
cd sakina/app
npm ci
npm run build
npx cap sync ios
```

---

## English
**Needs:** a Mac with Xcode 16+, an active Apple Developer account. No Node/CocoaPods needed — web assets are already synced into the Xcode project and the plugin packages are included (Swift Package Manager).

1. Open `sakina/app/ios/App/App.xcodeproj`; let Xcode resolve the Capacitor package from GitHub.
2. Target **App → Signing & Capabilities**: pick your Team; bundle id `dev.zeyad.sakina` (change it if needed); automatic signing on. Background Modes → Audio is set in Info.plist.
3. App Store Connect → New App with the same bundle id; name «سكينة — Sakina»; primary language Arabic.
4. Destination **Any iOS Device (arm64)** → **Product → Archive** → **Distribute App → App Store Connect → Upload**.
5. TestFlight: internal testers (no review) or an external group with a **public link** (short beta review).
6. Store listing text, privacy answers ("Data Not Collected"), review notes and 6.9″ screenshots: `store/LISTING.md`, `store/screenshots-6.9/`.

Already configured: iPhone-only, portrait, location/motion usage strings (Arabic + English), background audio + `.playback` audio session, downloads excluded from iCloud backup, `ITSAppUsesNonExemptEncryption = NO`, 1024 px app icon without alpha, light/dark launch screen, iOS 14+.

If the build fails with "No such module 'Capacitor'": File → Packages → Reset Package Caches, then build again.
