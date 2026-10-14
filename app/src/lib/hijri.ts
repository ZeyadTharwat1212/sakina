/**
 * Hijri date — arithmetic (tabular) calendar, Kuwaiti/Microsoft variant, with a user correction (section 26).
 * This is a *calculated* calendar. The app labels it as such and lets the user align it to their authority.
 */
export const HIJRI_MONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
export const HIJRI_MONTHS_EN = ['Muharram', 'Safar', 'Rabi I', 'Rabi II', 'Jumada I', 'Jumada II', 'Rajab', 'Sha‘ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi‘dah', 'Dhu al-Hijjah'];

function jdFromGregorian(y: number, m: number, d: number): number {
  if (m < 3) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524;
}
export interface HijriDate { y: number; m: number; d: number }
export function toHijri(date: Date, adjustDays = 0): HijriDate {
  const jd = jdFromGregorian(date.getFullYear(), date.getMonth() + 1, date.getDate()) + adjustDays;
  // Kuwaiti algorithm (epoch JD 1948439.5)
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const m = Math.floor((24 * l) / 709);
  const d = l - Math.floor((709 * m) / 24);
  const y = 30 * n + j - 30;
  return { y, m, d };
}
const arDigits = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
export function formatHijri(h: HijriDate, ar = true): string {
  return ar ? `${arDigits(h.d)} ${HIJRI_MONTHS[h.m - 1]} ${arDigits(h.y)}هـ` : `${h.d} ${HIJRI_MONTHS_EN[h.m - 1]} ${h.y} AH`;
}
/** Days a user may want reminders for (section 26) — informational only. */
export function hijriFlags(h: HijriDate) {
  const flags: string[] = [];
  if (h.m === 9) flags.push('رمضان');
  if (h.d >= 13 && h.d <= 15) flags.push('الأيام البيض');
  if (h.m === 12 && h.d === 9) flags.push('يوم عرفة');
  if (h.m === 1 && h.d === 10) flags.push('عاشوراء');
  if (h.m === 12 && h.d >= 1 && h.d <= 10) flags.push('العشر من ذي الحجة');
  return flags;
}
