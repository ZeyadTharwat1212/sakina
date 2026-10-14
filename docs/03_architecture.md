# البنية التقنية ومخطط البيانات

> الأقسام 35 و36 و37.

## القيد الحاكم
لا خوادم، لا Cloudflare، لا مفاتيح API مدفوعة، لا اعتماد على أي خدمة ذكاء اصطناعي وقت التشغيل. يجب أن يعمل التطبيق كاملًا من ملفاته المضمّنة، ويُنشر في App Store وGoogle Play.

## مقارنة الأطر
| المعيار | Flutter | React Native | أصلي (Swift + Kotlin) | **Capacitor + ويب (المختار)** |
|---|---|---|---|---|
| تشكيل العربية والخط القرآني | ممتاز (HarfBuzz) | جيد (يعتمد على النظام) | ممتاز | ممتاز — WebKit/Blink مع HarfBuzz، وAmiri Quran مُختبر هنا فعليًا |
| عرض المصحف | مرن | مرن | مرن | CSS `text-align: justify` + خط OpenType؛ صفحة نصية (لا صورة) |
| الصوت في الخلفية | إضافة | إضافة | أصلي | `<audio>` يعمل في الخلفية مع إعداد iOS audio session (مطلوب عند التغليف) |
| المنبهات/الأذان | إضافات | إضافات | AlarmKit / AlarmManager | إشعارات محلية (Capacitor)؛ AlarmKit يحتاج Swift لاحقًا — **ينطبق على كل الأطر** |
| الودجت والساعات | أصلي حتمًا | أصلي حتمًا | أصلي | أصلي حتمًا (مرحلة 2/3) |
| القابلية للصيانة بفريق صغير | تحتاج Dart | JS | فريقان | **JS/TS واحد؛ مهارات موجودة لدى المالك (نظام EMZ)** |
| التكلفة | مجاني | مجاني | مجاني + وقت | مجاني |
| إمكانية البناء والتحقق في بيئة التطوير الحالية | ❌ (لا SDK) | 🟡 | ❌ | ✅ بُني واختُبر |

**القرار**: Capacitor 7 + Vite + Preact + TypeScript. المتجر يقبل تطبيقات Capacitor التي تقدّم وظائف حقيقية (ليست مجرد موقع)، وهذا التطبيق يعمل دون إنترنت بالكامل مع إشعارات وموقع أصليين. المسار الأصلي (Swift/Kotlin) يبقى لازمًا لثلاثة أشياء فقط: الأذان الكامل (AlarmKit/منبه دقيق)، الودجت، الساعات.

## البنية
```
app/
  public/content/        حزم المحتوى (JSON) — تُبنى بالسكربت، لا تُحرَّر يدويًا
    ledger.json          السجل التحريري/الحقوقي
    quran/               chapters, meta (صفحات/أجزاء/سجدات), text/{1..114}, tafsir/{id}/{n}, translation/{id}/{n}, search-index
    adhkar/azkar.json
    hadith/{book}/index.json + {chapter}.json
    audio/reciters.json  فهرس بث فقط
  public/fonts/          OFL
  scripts/build-content.mjs   خط أنابيب المحتوى (قابل لإعادة التشغيل، يسجل الإصدارات)
  src/lib/               store (حالة محلية)، prayer (adhan)، hijri، notify، content (محمّلات)، i18n، router
  src/screens/           Onboarding, Today, Quran, Prayer, Adhkar, Library, Settings, Player
  tests/                 content.test (سلامة النص)، prayer.test (المواقيت)، e2e-smoke (الرحلات)
  capacitor.config.ts
```
- **البيانات الشخصية**: `Preferences` (أصلي) أو `localStorage` (ويب)؛ مفتاحان: `sakina.settings` و`sakina.user`. تصدير JSON وحذف كامل من الإعدادات.
- **لا شبكة** إلا: بث التلاوات (MP3Quran) عند طلب المستخدم. كل شيء آخر محلي.

## الكيانات (35) — كما نُفّذت
| الكيان في البرومبت | التنفيذ |
|---|---|
| Surah / Ayah | `chapters.json` + `text/{n}.json` (`{v, t}` حرفي) |
| MushafEdition / PageMap | `meta.json` (`mushaf.id = madani-604`, pages[], juz[], sajda[]) — إضافة نسخة = حزمة meta جديدة |
| TafsirPassage | `tafsir/{id}/{n}.json` لكل آية (نطاقات الآيات تُدعم بحقل `range` لاحقًا) |
| Translation | `translation/{id}/{n}.json` مع الحواشي |
| Reciter / Recording | `audio/reciters.json` (`complete`, `riwayah`, `style`) |
| TimingSegment | غير متاح (لا توقيتات) — المشغل لا يدّعي تزامنًا |
| HadithEdition / Hadith / HadithReference | `hadith/{book}/index.json` + فصول؛ المرجع = ترقيم sunnah.com موسومًا |
| Dhikr | `adhkar/azkar.json` (`count`, `ref`, `note`) |
| PrayerProfile | `settings.prayer` (الطريقة، المذهب، خطوط العرض، التعديلات، التنبيهات، الضحى) |
| HijriProfile | `settings.hijriAdjust` + `hijriAuthority` |
| Bookmark / Download | `user.bookmarks` (reading/hifz/review + ملاحظة)؛ التنزيل غير مفعّل |
| ContentVersion / Source / License / ReviewRecord | `ledger.json` لكل حزمة |

## الأمان والمرونة (36)
- لا أسرار في التطبيق (لا مفاتيح أصلًا).
- فشل بث الصوت → رسالة واضحة، لا تبديل قارئ بصمت.
- المحتوى مضمّن مع الإصدار → لا «نصف حزمة»؛ تحديث المحتوى = إصدار تطبيق جديد (أو حزمة موقعة لاحقًا).
- التخزين المحلي قد يُمسح من النظام في الويب فقط؛ في التطبيق الأصلي يستخدم `Preferences`.

## الأداء (37)
- الحزمة الأولية 144KB JS (49KB gzip) + CSS 13KB. المحتوى يُحمَّل بالملف عند الحاجة (سورة = 10–90KB).
- البحث القرآني: فهرس 1.1MB يُحمَّل عند أول بحث ويُطبَّع مرة واحدة ثم يبقى في الذاكرة.
- البحث في البخاري/مسلم يحمّل الكتاب كاملًا (≈5MB JSON) عند اختياره — مقبول على الجهاز، ويُستبدل بـ SQLite FTS في المرحلة 2 إذا لزم.
- أهداف القياس على جهاز متوسط (لم تُقَس بعد على جهاز حقيقي): فتح دافئ < 1s، بارد ≈ 2s.
