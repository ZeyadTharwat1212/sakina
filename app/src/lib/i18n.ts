/** UI strings only. Religious content is never machine-translated (section 10). */
import { getSettings } from './store';

const AR = {
  today: 'اليوم', quran: 'القرآن', prayer: 'الصلاة', adhkar: 'الأذكار', library: 'المكتبة', settings: 'الإعدادات',
  nextPrayer: 'الصلاة التالية', remaining: 'المتبقي', continueReading: 'تابع من حيث توقفت', startReading: 'ابدأ القراءة',
  morningAdhkar: 'أذكار الصباح', eveningAdhkar: 'أذكار المساء', dailyWird: 'الورد اليومي', hadithOfDay: 'حديث اليوم',
  fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء',
  calculated: 'محسوب', method: 'طريقة الحساب', city: 'المدينة', locationOld: 'الموقع قديم — حدّثه', notificationsOff: 'تنبيهات الصلاة غير مفعّلة',
  enable: 'تفعيل', update: 'تحديث', skip: 'تخطي', next: 'التالي', back: 'رجوع', done: 'تم', cancel: 'إلغاء', save: 'حفظ',
  source: 'المصدر', sources: 'المصادر والحقوق', share: 'مشاركة', copy: 'نسخ', copied: 'تم النسخ', bookmark: 'علامة', tafsir: 'التفسير', translation: 'الترجمة',
  search: 'بحث', searchHint: 'ابحث في القرآن والحديث والأذكار', noResults: 'لم نجد تطابقًا في المصادر المتاحة',
  surah: 'سورة', ayah: 'آية', juz: 'جزء', page: 'صفحة', pageMode: 'صفحات', ayahMode: 'آيات',
  listen: 'استماع', reciter: 'القارئ', play: 'تشغيل', pause: 'إيقاف', stop: 'إنهاء',
  counter: 'العدّاد', undo: 'تراجع', complete: 'اكتملت الجلسة', resume: 'استكمال', count: 'العدد الوارد',
  qibla: 'القبلة', qiblaBearing: 'اتجاه القبلة من الشمال الحقيقي', compassUnavailable: 'لا تتوفر بوصلة على هذا الجهاز أو لم يُسمح بها — استخدم الزاوية المعروضة مع بوصلة خارجية أو خريطة',
  diagnostics: 'تشخيص التنبيهات', permission: 'الإذن', scheduled: 'المجدولة', testSound: 'اختبار تنبيه',
  language: 'اللغة', theme: 'المظهر', light: 'فاتح', dark: 'داكن', paper: 'ورقي', auto: 'تلقائي', textSize: 'حجم نص الواجهة', quranSize: 'حجم خط المصحف', bodySize: 'حجم نص الحديث والأذكار',
  reduceMotion: 'تقليل الحركة', simpleMode: 'وضع مبسط (خط كبير وأزرار واضحة)', quietMode: 'وضع هادئ', exportData: 'تصدير بياناتي', deleteData: 'حذف كل بياناتي', about: 'عن التطبيق',
  guest: 'تستخدم التطبيق كضيف — لا حساب ولا رفع بيانات.',
  hijri: 'التاريخ الهجري', hijriAdjust: 'تصحيح التاريخ الهجري (أيام)', hijriNote: 'تقويم حسابي تقريبي؛ اتبع إعلان الجهة التي تعتمدها وصحّح الفرق هنا.',
  nawafil: 'النوافل والأوقات المستحبة', duha: 'الضحى', midnight: 'منتصف الليل', lastThird: 'الثلث الأخير',
  offline: 'يعمل دون إنترنت', needsInternet: 'يحتاج اتصالًا بالإنترنت', notReviewed: 'لم يُراجع علميًا بعد', needsLicence: 'يحتاج تأكيد ترخيص',
  books: 'الكتب', hadith: 'حديث', bukhari: 'صحيح البخاري', muslim: 'صحيح مسلم', nawawi: 'الأربعون النووية',
  favourites: 'المفضلة', notes: 'ملاحظاتي', tasbih: 'السبحة', target: 'الهدف الشخصي',
  welcome: 'السلام عليكم', welcomeSub: 'مرجعك اليومي للقرآن والصلاة والأذكار — يعمل دون حساب ودون إنترنت.',
  chooseCity: 'اختر مدينتك', useGps: 'استخدام موقعي الحالي', whyLocation: 'نحتاج الموقع لحساب المواقيت والقبلة على جهازك فقط؛ لا يُرسل إلى أي خادم.',
  confirmMethod: 'تأكيد طريقة الحساب', methodNote: 'اقتراح تلقائي حسب البلد — ليس توثيقًا رسميًا للجدول. يمكنك تغييره لاحقًا.',
  notifications: 'تنبيهات الصلاة', whyNotify: 'لنذكّرك بوقت الصلاة. يمكنك ضبط كل صلاة على حدة لاحقًا.', later: 'لاحقًا',
  goal: 'ما هدفك اليومي؟ (اختياري)', goalPrayer: 'الصلاة', goalReading: 'قراءة', goalHifz: 'حفظ', goalAdhkar: 'أذكار', goalGeneral: 'استخدام عام',
  week: 'الأسبوع', month: 'الشهر', timezone: 'المنطقة الزمنية', adjustments: 'تعديل الدقائق', reset: 'إعادة الضبط',
  madhab: 'حساب العصر', shafi: 'الجمهور (الشافعي)', hanafi: 'الحنفي', highLat: 'خطوط العرض العالية',
  version: 'الإصدار', dataLocal: 'كل بياناتك محفوظة على جهازك فقط.',
  streamNote: 'التلاوة تُبث من MP3Quran عبر الإنترنت. التنزيل للاستماع دون اتصال يحتاج إذنًا من صاحب الحق ولم يُفعّل بعد.',
  noSync: 'لا يوجد تزامن للآيات مع الصوت في هذا التسجيل.',
  incomplete: 'غير مكتمل', complete114: 'مصحف كامل',
};
const EN: Record<keyof typeof AR, string> = {
  today: 'Today', quran: 'Quran', prayer: 'Prayer', adhkar: 'Adhkar', library: 'Library', settings: 'Settings',
  nextPrayer: 'Next prayer', remaining: 'Remaining', continueReading: 'Continue where you left off', startReading: 'Start reading',
  morningAdhkar: 'Morning adhkar', eveningAdhkar: 'Evening adhkar', dailyWird: 'Daily wird', hadithOfDay: 'Hadith of the day',
  fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
  calculated: 'calculated', method: 'Calculation method', city: 'City', locationOld: 'Location is stale — update it', notificationsOff: 'Prayer notifications are off',
  enable: 'Enable', update: 'Update', skip: 'Skip', next: 'Next', back: 'Back', done: 'Done', cancel: 'Cancel', save: 'Save',
  source: 'Source', sources: 'Sources & rights', share: 'Share', copy: 'Copy', copied: 'Copied', bookmark: 'Bookmark', tafsir: 'Tafsir', translation: 'Translation',
  search: 'Search', searchHint: 'Search Quran, hadith and adhkar', noResults: 'No match found in the available sources',
  surah: 'Surah', ayah: 'Ayah', juz: 'Juz', page: 'Page', pageMode: 'Pages', ayahMode: 'Ayahs',
  listen: 'Listen', reciter: 'Reciter', play: 'Play', pause: 'Pause', stop: 'Stop',
  counter: 'Counter', undo: 'Undo', complete: 'Session complete', resume: 'Resume', count: 'Narrated count',
  qibla: 'Qibla', qiblaBearing: 'Qibla bearing from true north', compassUnavailable: 'No compass available or permission denied — use the bearing shown with an external compass or a map',
  diagnostics: 'Notification diagnostics', permission: 'Permission', scheduled: 'Scheduled', testSound: 'Test notification',
  language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark', paper: 'Paper', auto: 'Auto', textSize: 'UI text size', quranSize: 'Mushaf font size', bodySize: 'Hadith & adhkar text size',
  reduceMotion: 'Reduce motion', simpleMode: 'Simple mode (large text, clear buttons)', quietMode: 'Quiet mode', exportData: 'Export my data', deleteData: 'Delete all my data', about: 'About',
  guest: 'You are using the app as a guest — no account, nothing uploaded.',
  hijri: 'Hijri date', hijriAdjust: 'Hijri correction (days)', hijriNote: 'Arithmetic calendar (approximate). Follow your local authority’s announcement and correct the difference here.',
  nawafil: 'Voluntary prayers & times', duha: 'Duha', midnight: 'Midnight', lastThird: 'Last third of the night',
  offline: 'Works offline', needsInternet: 'Needs internet', notReviewed: 'Not yet scholar-reviewed', needsLicence: 'Licence confirmation pending',
  books: 'Books', hadith: 'Hadith', bukhari: 'Sahih al-Bukhari', muslim: 'Sahih Muslim', nawawi: 'Forty Hadith of al-Nawawi',
  favourites: 'Favourites', notes: 'My notes', tasbih: 'Tasbih', target: 'Personal target',
  welcome: 'As-salamu alaykum', welcomeSub: 'Your daily companion for Quran, prayer and adhkar — no account, works offline.',
  chooseCity: 'Choose your city', useGps: 'Use my current location', whyLocation: 'Location is used only on your device to calculate prayer times and qibla; it is never sent to a server.',
  confirmMethod: 'Confirm calculation method', methodNote: 'Suggested from your country — not an official timetable. You can change it later.',
  notifications: 'Prayer notifications', whyNotify: 'To remind you at prayer time. Each prayer can be set separately later.', later: 'Later',
  goal: 'Your daily goal? (optional)', goalPrayer: 'Prayer', goalReading: 'Reading', goalHifz: 'Memorisation', goalAdhkar: 'Adhkar', goalGeneral: 'General use',
  week: 'Week', month: 'Month', timezone: 'Time zone', adjustments: 'Minute adjustments', reset: 'Reset',
  madhab: 'Asr calculation', shafi: 'Majority (Shafi‘i)', hanafi: 'Hanafi', highLat: 'High latitudes',
  version: 'Version', dataLocal: 'All your data stays on this device.',
  streamNote: 'Recitation streams from MP3Quran over the internet. Offline download needs the rights-holder’s permission and is not enabled yet.',
  noSync: 'This recording has no ayah-level timing data.',
  incomplete: 'incomplete', complete114: 'complete mushaf',
};
export type Key = keyof typeof AR;
export function t(k: Key): string { return (getSettings().lang === 'en' ? EN : AR)[k]; }
export const isAr = () => getSettings().lang === 'ar';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function num(n: number | string): string {
  const s = String(n);
  return isAr() ? s.replace(/\d/g, (d) => AR_DIGITS[Number(d)]) : s;
}
export function fmtTime(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat(isAr() ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(d);
  } catch { return d.toLocaleTimeString(); }
}
export function fmtDate(d: Date, tz?: string): string {
  try {
    return new Intl.DateTimeFormat(isAr() ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(d);
  } catch { return d.toDateString(); }
}
