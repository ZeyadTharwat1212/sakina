/**
 * On-device prayer times & qibla (sections 14, 15, 17, 19).
 * Engine: adhan-js (MIT). Times are "محسوب" (calculated) — never labelled official.
 */
import * as adhan from 'adhan';
import type { Location, PrayerSettings } from './store';

export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const PRAYERS: PrayerName[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const FIVE: Exclude<PrayerName, 'sunrise'>[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export interface MethodInfo { key: string; ar: string; en: string; authority: string; make: () => adhan.CalculationParameters }
export const METHODS: MethodInfo[] = [
  { key: 'Egyptian', ar: 'الهيئة المصرية العامة للمساحة', en: 'Egyptian General Authority of Survey', authority: 'مصر', make: () => adhan.CalculationMethod.Egyptian() },
  { key: 'UmmAlQura', ar: 'أم القرى', en: 'Umm al-Qura (Makkah)', authority: 'السعودية', make: () => adhan.CalculationMethod.UmmAlQura() },
  { key: 'MuslimWorldLeague', ar: 'رابطة العالم الإسلامي', en: 'Muslim World League', authority: 'عام', make: () => adhan.CalculationMethod.MuslimWorldLeague() },
  { key: 'Karachi', ar: 'جامعة العلوم الإسلامية، كراتشي', en: 'University of Islamic Sciences, Karachi', authority: 'باكستان/الهند', make: () => adhan.CalculationMethod.Karachi() },
  { key: 'NorthAmerica', ar: 'الجمعية الإسلامية لأمريكا الشمالية (ISNA)', en: 'ISNA', authority: 'أمريكا الشمالية', make: () => adhan.CalculationMethod.NorthAmerica() },
  { key: 'MoonsightingCommittee', ar: 'لجنة رؤية الهلال', en: 'Moonsighting Committee', authority: 'عام', make: () => adhan.CalculationMethod.MoonsightingCommittee() },
  { key: 'Dubai', ar: 'دبي', en: 'Dubai', authority: 'الإمارات', make: () => adhan.CalculationMethod.Dubai() },
  { key: 'Kuwait', ar: 'الكويت', en: 'Kuwait', authority: 'الكويت', make: () => adhan.CalculationMethod.Kuwait() },
  { key: 'Qatar', ar: 'قطر', en: 'Qatar', authority: 'قطر', make: () => adhan.CalculationMethod.Qatar() },
  { key: 'Singapore', ar: 'سنغافورة', en: 'Singapore', authority: 'سنغافورة', make: () => adhan.CalculationMethod.Singapore() },
  { key: 'Turkey', ar: 'رئاسة الشؤون الدينية التركية', en: 'Turkey (Diyanet)', authority: 'تركيا', make: () => adhan.CalculationMethod.Turkey() },
  { key: 'Tehran', ar: 'جامعة طهران', en: 'University of Tehran', authority: 'إيران', make: () => adhan.CalculationMethod.Tehran() },
];
export const methodByKey = (k: string) => METHODS.find((m) => m.key === k) ?? METHODS[0];

export interface City { name: string; en: string; country: string; cc: string; lat: number; lng: number; tz: string }
/** Seed list; the user can also type coordinates or use GPS. */
export const CITIES: City[] = [
  { name: 'القاهرة', en: 'Cairo', country: 'مصر', cc: 'EG', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo' },
  { name: 'الإسكندرية', en: 'Alexandria', country: 'مصر', cc: 'EG', lat: 31.2001, lng: 29.9187, tz: 'Africa/Cairo' },
  { name: 'الجيزة', en: 'Giza', country: 'مصر', cc: 'EG', lat: 30.0131, lng: 31.2089, tz: 'Africa/Cairo' },
  { name: 'المنصورة', en: 'Mansoura', country: 'مصر', cc: 'EG', lat: 31.0409, lng: 31.3785, tz: 'Africa/Cairo' },
  { name: 'أسيوط', en: 'Asyut', country: 'مصر', cc: 'EG', lat: 27.1809, lng: 31.1837, tz: 'Africa/Cairo' },
  { name: 'مكة المكرمة', en: 'Makkah', country: 'السعودية', cc: 'SA', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh' },
  { name: 'المدينة المنورة', en: 'Madinah', country: 'السعودية', cc: 'SA', lat: 24.4672, lng: 39.6024, tz: 'Asia/Riyadh' },
  { name: 'الرياض', en: 'Riyadh', country: 'السعودية', cc: 'SA', lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh' },
  { name: 'جدة', en: 'Jeddah', country: 'السعودية', cc: 'SA', lat: 21.4858, lng: 39.1925, tz: 'Asia/Riyadh' },
  { name: 'دبي', en: 'Dubai', country: 'الإمارات', cc: 'AE', lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai' },
  { name: 'الدوحة', en: 'Doha', country: 'قطر', cc: 'QA', lat: 25.2854, lng: 51.531, tz: 'Asia/Qatar' },
  { name: 'الكويت', en: 'Kuwait City', country: 'الكويت', cc: 'KW', lat: 29.3759, lng: 47.9774, tz: 'Asia/Kuwait' },
  { name: 'عمّان', en: 'Amman', country: 'الأردن', cc: 'JO', lat: 31.9454, lng: 35.9284, tz: 'Asia/Amman' },
  { name: 'بغداد', en: 'Baghdad', country: 'العراق', cc: 'IQ', lat: 33.3152, lng: 44.3661, tz: 'Asia/Baghdad' },
  { name: 'الرباط', en: 'Rabat', country: 'المغرب', cc: 'MA', lat: 34.0209, lng: -6.8416, tz: 'Africa/Casablanca' },
  { name: 'الجزائر', en: 'Algiers', country: 'الجزائر', cc: 'DZ', lat: 36.7538, lng: 3.0588, tz: 'Africa/Algiers' },
  { name: 'تونس', en: 'Tunis', country: 'تونس', cc: 'TN', lat: 36.8065, lng: 10.1815, tz: 'Africa/Tunis' },
  { name: 'الخرطوم', en: 'Khartoum', country: 'السودان', cc: 'SD', lat: 15.5007, lng: 32.5599, tz: 'Africa/Khartoum' },
  { name: 'إسطنبول', en: 'Istanbul', country: 'تركيا', cc: 'TR', lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul' },
  { name: 'كراتشي', en: 'Karachi', country: 'باكستان', cc: 'PK', lat: 24.8607, lng: 67.0011, tz: 'Asia/Karachi' },
  { name: 'جاكرتا', en: 'Jakarta', country: 'إندونيسيا', cc: 'ID', lat: -6.2088, lng: 106.8456, tz: 'Asia/Jakarta' },
  { name: 'كوالالمبور', en: 'Kuala Lumpur', country: 'ماليزيا', cc: 'MY', lat: 3.139, lng: 101.6869, tz: 'Asia/Kuala_Lumpur' },
  { name: 'لندن', en: 'London', country: 'المملكة المتحدة', cc: 'GB', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  { name: 'باريس', en: 'Paris', country: 'فرنسا', cc: 'FR', lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris' },
  { name: 'برلين', en: 'Berlin', country: 'ألمانيا', cc: 'DE', lat: 52.52, lng: 13.405, tz: 'Europe/Berlin' },
  { name: 'نيويورك', en: 'New York', country: 'الولايات المتحدة', cc: 'US', lat: 40.7128, lng: -74.006, tz: 'America/New_York' },
  { name: 'شيكاغو', en: 'Chicago', country: 'الولايات المتحدة', cc: 'US', lat: 41.8781, lng: -87.6298, tz: 'America/Chicago' },
  { name: 'لوس أنجلوس', en: 'Los Angeles', country: 'الولايات المتحدة', cc: 'US', lat: 34.0522, lng: -118.2437, tz: 'America/Los_Angeles' },
  { name: 'تورونتو', en: 'Toronto', country: 'كندا', cc: 'CA', lat: 43.6532, lng: -79.3832, tz: 'America/Toronto' },
  { name: 'سيدني', en: 'Sydney', country: 'أستراليا', cc: 'AU', lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney' },
  { name: 'أوسلو', en: 'Oslo', country: 'النرويج', cc: 'NO', lat: 59.9139, lng: 10.7522, tz: 'Europe/Oslo' },
];
export function suggestMethod(cc: string): string {
  const map: Record<string, string> = { EG: 'Egyptian', SA: 'UmmAlQura', AE: 'Dubai', QA: 'Qatar', KW: 'Kuwait', TR: 'Turkey', PK: 'Karachi', IN: 'Karachi', BD: 'Karachi', US: 'NorthAmerica', CA: 'NorthAmerica', SG: 'Singapore', MY: 'Singapore', ID: 'Singapore', IR: 'Tehran', GB: 'MoonsightingCommittee' };
  return map[cc] ?? 'MuslimWorldLeague';
}

/** Date parts of "now" in a given IANA zone. */
export function zonedParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour % 24, min: o.minute };
}
/** A local Date carrying the civil (y,m,d) of the city — adhan reads y/m/d components only. */
export function civilDate(tz: string, offsetDays = 0, base = new Date()): Date {
  const p = zonedParts(base, tz);
  return new Date(p.y, p.m - 1, p.d + offsetDays, 12, 0, 0);
}

export interface DayTimes { date: Date; times: Record<PrayerName, Date>; params: { fajrAngle: number; ishaAngle: number; ishaInterval: number; madhab: string; highLat: string } }

export function computeDay(loc: Location, ps: PrayerSettings, civil: Date): DayTimes {
  const m = methodByKey(ps.method);
  const params = m.make();
  params.madhab = ps.madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  params.highLatitudeRule = ps.highLat === 'SeventhOfTheNight' ? adhan.HighLatitudeRule.SeventhOfTheNight
    : ps.highLat === 'TwilightAngle' ? adhan.HighLatitudeRule.TwilightAngle : adhan.HighLatitudeRule.MiddleOfTheNight;
  params.adjustments = { fajr: ps.adjust.fajr, sunrise: ps.adjust.sunrise, dhuhr: ps.adjust.dhuhr, asr: ps.adjust.asr, maghrib: ps.adjust.maghrib, isha: ps.adjust.isha };
  const pt = new adhan.PrayerTimes(new adhan.Coordinates(loc.lat, loc.lng), civil, params);
  return {
    date: civil,
    times: { fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha },
    params: { fajrAngle: params.fajrAngle, ishaAngle: params.ishaAngle, ishaInterval: params.ishaInterval, madhab: ps.madhab, highLat: ps.highLat },
  };
}

export interface NextInfo { name: PrayerName; at: Date; current: PrayerName | null; day: DayTimes }
export function nextPrayer(loc: Location, ps: PrayerSettings, now = new Date()): NextInfo {
  const today = computeDay(loc, ps, civilDate(loc.tz, 0, now));
  for (const n of PRAYERS) if (today.times[n].getTime() > now.getTime()) {
    const idx = PRAYERS.indexOf(n);
    return { name: n, at: today.times[n], current: idx > 0 ? PRAYERS[idx - 1] : null, day: today };
  }
  const tomorrow = computeDay(loc, ps, civilDate(loc.tz, 1, now));
  return { name: 'fajr', at: tomorrow.times.fajr, current: 'isha', day: today };
}

/** Night-based times (section 19): night = maghrib → next fajr (documented definition). */
export function nightTimes(loc: Location, ps: PrayerSettings, civil: Date) {
  const d = computeDay(loc, ps, civil);
  const next = computeDay(loc, ps, new Date(civil.getFullYear(), civil.getMonth(), civil.getDate() + 1, 12));
  const night = next.times.fajr.getTime() - d.times.maghrib.getTime();
  return {
    maghrib: d.times.maghrib,
    nextFajr: next.times.fajr,
    midnight: new Date(d.times.maghrib.getTime() + night / 2),
    lastThird: new Date(d.times.maghrib.getTime() + (night * 2) / 3),
    duhaReminder: new Date(d.times.sunrise.getTime() + ps.duhaOffsetMin * 60000),
    sunrise: d.times.sunrise,
  };
}

export function qiblaBearing(lat: number, lng: number): number {
  return adhan.Qibla(new adhan.Coordinates(lat, lng));
}

/** Upcoming prayer instants for scheduling (next `days` days, five prayers). */
export function upcomingSchedule(loc: Location, ps: PrayerSettings, days: number, now = new Date()) {
  const out: { name: Exclude<PrayerName, 'sunrise'>; at: Date }[] = [];
  for (let i = 0; i < days; i++) {
    const d = computeDay(loc, ps, civilDate(loc.tz, i, now));
    for (const n of FIVE) if (ps.notify[n] && d.times[n].getTime() > now.getTime()) out.push({ name: n, at: d.times[n] });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export const LOCATION_STALE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days without a GPS refresh → "موقع قديم" (manual city never goes stale)
export function isLocationStale(loc: Location | null, now = Date.now()) {
  return !!loc && loc.source === 'gps' && now - loc.updatedAt > LOCATION_STALE_MS;
}
