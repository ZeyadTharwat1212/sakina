/**
 * Hijri-driven helpers for Ramadan, sunnah fasting days and occasions (reference-app parity: رمضان / صائمون).
 * Everything is derived from the *arithmetic* Hijri calendar + the user's ±day correction (section 26),
 * so the app always labels these dates as calculated, never as an official announcement.
 */
import { toHijri, type HijriDate } from './hijri';

const DAY = 86400000;
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);

/** First Gregorian day (local noon) on which the Hijri calendar shows (m, d), searching forward from `from`. */
export function nextHijriDate(m: number, d: number, from: Date, adjust = 0, span = 400): Date | null {
  for (let i = 0; i < span; i++) { const x = addDays(from, i); const h = toHijri(x, adjust); if (h.m === m && h.d === d) return x; }
  return null;
}

export interface RamadanInfo {
  inRamadan: boolean;
  start: Date;         // 1 Ramadan (calculated)
  end: Date;           // last day of Ramadan (29 or 30)
  days: Date[];        // every day of the month
  dayIndex: number;    // 0-based if inRamadan, else -1
  daysUntil: number;   // days until 1 Ramadan (0 if in Ramadan)
  year: number;        // Hijri year of that Ramadan
}
export function ramadanInfo(now = new Date(), adjust = 0): RamadanInfo {
  const today = addDays(now, 0);
  const h = toHijri(today, adjust);
  let start: Date;
  if (h.m === 9) start = addDays(today, -(h.d - 1));
  else start = nextHijriDate(9, 1, today, adjust)!;
  const days: Date[] = [];
  for (let i = 0; i < 31; i++) { const x = addDays(start, i); if (toHijri(x, adjust).m !== 9) break; days.push(x); }
  const end = days[days.length - 1];
  const inRamadan = h.m === 9;
  return { inRamadan, start, end, days, dayIndex: inRamadan ? h.d - 1 : -1, daysUntil: inRamadan ? 0 : Math.round((start.getTime() - today.getTime()) / DAY), year: toHijri(start, adjust).y };
}

export interface FastDay { date: Date; hijri: HijriDate; reasons: FastReason[]; forbidden: string | null }
export interface FastReason { id: string; title: string; virtue: string; source: string }

/** Short, well-known narrations (summarised wording; sources named). Flagged in the ledger as pending scholar review. */
export const FAST_REASONS: Record<string, FastReason> = {
  monthu: { id: 'monthu', title: 'الاثنين والخميس', virtue: 'تُعرض الأعمال يوم الاثنين والخميس، وكان النبي ﷺ يتحرى صيامهما.', source: 'رواه الترمذي والنسائي (المعنى)؛ وفي صحيح مسلم أن يوم الاثنين «فيه وُلدتُ وفيه أُنزل عليّ»' },
  white: { id: 'white', title: 'الأيام البيض (١٣–١٥)', virtue: 'صيام ثلاثة أيام من كل شهر يعدل صيام الدهر؛ ورغّب النبي ﷺ في جعلها الأيام البيض.', source: 'متفق عليه (ثلاثة أيام من كل شهر)؛ أبو داود والنسائي (تخصيص البيض)' },
  arafah: { id: 'arafah', title: 'يوم عرفة', virtue: 'صيام يوم عرفة يُرجى أن يكفّر السنة التي قبله والسنة التي بعده — لغير الحاج.', source: 'صحيح مسلم' },
  tasua: { id: 'tasua', title: 'تاسوعاء', virtue: 'صيام التاسع مع العاشر من محرم مخالفةً لأهل الكتاب: «لئن بقيتُ إلى قابل لأصومنّ التاسع».', source: 'صحيح مسلم' },
  ashura: { id: 'ashura', title: 'عاشوراء', virtue: 'صيام يوم عاشوراء يُرجى أن يكفّر السنة التي قبله.', source: 'صحيح مسلم' },
  shawwal: { id: 'shawwal', title: 'ستٌّ من شوال', virtue: 'من صام رمضان ثم أتبعه ستًا من شوال كان كصيام الدهر.', source: 'صحيح مسلم' },
  dhulhijjah: { id: 'dhulhijjah', title: 'العشر من ذي الحجة', virtue: 'ما من أيام العمل الصالح فيهن أحب إلى الله من هذه الأيام العشر؛ والصيام من العمل الصالح.', source: 'صحيح البخاري (فضل الأيام)؛ صيامها ثابت عن بعض الصحابة' },
  shaban: { id: 'shaban', title: 'شعبان', virtue: 'كان النبي ﷺ يصوم شعبان إلا قليلًا، وهو شهر تُرفع فيه الأعمال.', source: 'متفق عليه؛ النسائي (رفع الأعمال)' },
  ramadan: { id: 'ramadan', title: 'رمضان (فريضة)', virtue: 'شهر الصيام المفروض.', source: 'القرآن الكريم (البقرة ١٨٣–١٨٥)' },
};

/** Which sunnah fasts apply to a Gregorian day, and whether fasting that day is prohibited. */
export function fastingFor(date: Date, adjust = 0): FastDay {
  const h = toHijri(date, adjust);
  const reasons: FastReason[] = [];
  let forbidden: string | null = null;
  if (h.m === 10 && h.d === 1) forbidden = 'عيد الفطر — يحرم صيامه';
  if (h.m === 12 && h.d === 10) forbidden = 'عيد الأضحى — يحرم صيامه';
  if (h.m === 12 && h.d >= 11 && h.d <= 13) forbidden = 'أيام التشريق — لا تُصام إلا لمن لم يجد الهدي';
  if (forbidden) return { date, hijri: h, reasons, forbidden };
  if (h.m === 9) { reasons.push(FAST_REASONS.ramadan); return { date, hijri: h, reasons, forbidden }; }
  const dow = date.getDay();
  if (dow === 1 || dow === 4) reasons.push(FAST_REASONS.monthu);
  if (h.d >= 13 && h.d <= 15) reasons.push(FAST_REASONS.white);
  if (h.m === 12 && h.d === 9) reasons.unshift(FAST_REASONS.arafah);
  if (h.m === 1 && h.d === 9) reasons.unshift(FAST_REASONS.tasua);
  if (h.m === 1 && h.d === 10) reasons.unshift(FAST_REASONS.ashura);
  if (h.m === 10 && h.d >= 2) reasons.push(FAST_REASONS.shawwal);
  if (h.m === 12 && h.d <= 8) reasons.push(FAST_REASONS.dhulhijjah);
  if (h.m === 8 && h.d <= 15) reasons.push(FAST_REASONS.shaban);
  return { date, hijri: h, reasons, forbidden };
}

export function upcomingFasts(from: Date, days: number, adjust = 0): FastDay[] {
  const out: FastDay[] = [];
  for (let i = 0; i < days; i++) { const f = fastingFor(addDays(from, i), adjust); if (f.reasons.length || f.forbidden) out.push(f); }
  return out;
}

/** Occasions for greeting cards and the calendar. */
export const OCCASIONS = [
  { id: 'ramadan', ar: 'رمضان مبارك', en: 'Ramadan Mubarak', m: 9, d: 1 },
  { id: 'fitr', ar: 'عيد فطر مبارك', en: 'Eid al-Fitr Mubarak', m: 10, d: 1 },
  { id: 'adha', ar: 'عيد أضحى مبارك', en: 'Eid al-Adha Mubarak', m: 12, d: 10 },
  { id: 'hijri', ar: 'كل عام وأنتم بخير — عام هجري جديد', en: 'Happy new Hijri year', m: 1, d: 1 },
  { id: 'arafah', ar: 'يوم عرفة — تقبّل الله', en: 'Day of Arafah', m: 12, d: 9 },
  { id: 'jumuah', ar: 'جمعة مباركة', en: 'Blessed Friday', m: 0, d: 0 },
  { id: 'hajj', ar: 'حجًّا مبرورًا وسعيًا مشكورًا', en: 'A blessed Hajj', m: 12, d: 8 },
  { id: 'umrah', ar: 'عمرة مقبولة', en: 'An accepted Umrah', m: 0, d: 0 },
];
export function nextOccasion(now = new Date(), adjust = 0) {
  const list = OCCASIONS.filter((o) => o.m).map((o) => ({ ...o, at: nextHijriDate(o.m, o.d, addDays(now, 0), adjust)! })).filter((o) => o.at);
  return list.sort((a, b) => a.at.getTime() - b.at.getTime())[0];
}

/** Parse "HH:MM" into a Date on the given civil day. */
export function atTime(civil: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(civil.getFullYear(), civil.getMonth(), civil.getDate(), h || 0, m || 0, 0);
}
