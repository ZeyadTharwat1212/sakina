# Google Play — كل ما يلزم لرفع سكينة (Play Console)

الحساب: play.google.com/console — رسوم تسجيل لمرة واحدة ٢٥ دولارًا، باسم صاحب التطبيق (لا يمكن إنشاؤه نيابةً عنه).
الحساب الشخصي الجديد يشترط **اختبارًا مغلقًا بـ ١٢ مختبِرًا لمدة ١٤ يومًا** قبل النشر للعامة (شرط جوجل منذ ٢٠٢٣).

## الملفات
| المطلوب | المكان |
|---|---|
| حزمة الرفع (.aab) | GitHub Releases → `android-N` → `sakina-1.0.N.aab` (بعد توقيعها بمفتاح الرفع — انظر أسفل) |
| ملف تثبيت مباشر للتجربة (.apk) | نفس الإصدار → `sakina-1.0.N-test.apk` |
| الاسم / الوصف المختصر / الكامل | `app/fastlane/play/metadata/{ar,en-US}/` |
| الأيقونة ٥١٢×٥١٢ | `.../images/icon.png` |
| صورة الواجهة ١٠٢٤×٥٠٠ | `.../images/featureGraphic.png` |
| لقطات الهاتف ١٠٨٠×١٩٢٠ (٦) | `.../images/phoneScreenshots/` |
| سياسة الخصوصية | https://zeyadtharwat1212.github.io/sakina/privacy.html |

## الخطوات (مرة واحدة)
1. Create app → الاسم «سكينة: قرآن وصلاة وأذكار»، اللغة الافتراضية العربية، App، Free.
2. **App content** (الإجابات):
   - Privacy policy: الرابط أعلاه.
   - Ads: **No ads**.
   - App access: **All functionality is available without special access** (لا تسجيل دخول).
   - Content rating (IARC): Category **Reference, News, or Educational** → لا عنف/لا محتوى جنسي/لا مقامرة/لا تفاعل بين المستخدمين/لا مشاركة موقع مع آخرين → النتيجة المتوقعة: للجميع (Everyone / 3+).
   - Target audience: **13+** (اختيار ما دون ١٣ يُدخل التطبيق في برنامج «العائلات» بمتطلبات إضافية؛ يمكن توسيعه لاحقًا).
   - News app: No. Government app: No. Financial features: None (حاسبة الزكاة أداة حساب فقط). Health: None.
   - **Data safety**: Does your app collect or share any of the required user data types? → **No**.
     (الموقع يُستخدم على الجهاز فقط لحساب المواقيت والقبلة ولا يُرسل لأي خادم؛ لا حسابات؛ لا تحليلات؛ لا إعلانات.)
     Is all user data encrypted in transit? → Yes (كل الاتصالات HTTPS). Account deletion: لا يوجد حساب.
   - Exact alarms (`SCHEDULE_EXACT_ALARM`): التبرير — «تنبيهات الأذان في مواقيت الصلاة بدقة الدقيقة يختارها المستخدم».
3. **Store listing**: الصق الاسم والوصفين من مجلد metadata، وارفع الأيقونة وصورة الواجهة واللقطات. الفئة: **Books & Reference**. البريد: zeyadtharwat1212@gmail.com.
4. **Testing → Closed testing**: أنشئ مسارًا، أضف ١٢ بريدًا على الأقل (Google Group أو قائمة)، ارفع ملف .aab، ثم «Send for review». بعد ١٤ يومًا من الاختبار: Production → Apply.
5. **App signing**: اقبل «Play App Signing» (جوجل تحفظ مفتاح التوقيع النهائي؛ نحن نوقّع بمفتاح الرفع فقط).

## التوقيع بمفتاح الرفع
مفتاح الرفع (`sakina-upload.jks`) وكلمة سره محفوظان على جهاز زياد في `E:\القران الكريم\sakina-keys\` — **لا يُرفع على GitHub أبدًا**. لتوقيع حزمة:
```
jarsigner -keystore sakina-upload.jks -storepass <PASS> -sigalg SHA256withRSA -digestalg SHA-256 sakina-1.0.N.aab upload
```
أو أضِف السرّين `SAKINA_KEYSTORE_B64` (base64 للملف) و `SAKINA_KS_PASS` في GitHub Secrets ليوقّع سير العمل تلقائيًا.

## الرفع التلقائي لاحقًا (اختياري)
بعد أول رفع يدوي: Play Console → Setup → API access → حساب خدمة (Service account) بصلاحية Release manager، ثم سرّ `PLAY_SERVICE_ACCOUNT_JSON` في GitHub؛ سير العمل `android.yml` يرفع إلى مسار الاختبار الداخلي ويحدّث صفحة المتجر عبر fastlane supply.
