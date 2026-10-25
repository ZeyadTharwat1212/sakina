/**
 * Prayer notifications (section 16) via Capacitor LocalNotifications.
 * Honest limits: this is a *notification*, not a full adhan alarm. iOS custom sounds are ≤30 s;
 * a full adhan on iOS needs AlarmKit (native, iOS 26+) — not part of Phase 1 (see docs/04_status_register.md).
 * Everything optional (reminders, qiyam, fajr alarm, Ramadan, adhkar times) is scheduled here from the same engine,
 * sorted by time and capped under the iOS pending limit (64).
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Location, PrayerSettings, Settings } from './store';
import { upcomingSchedule, computeDay, civilDate, nightTimes, type PrayerName } from './prayer';
import { getSettings } from './store';
import { t, fmtTime } from './i18n';
import { fastingFor, ramadanInfo, atTime, addDays } from './calendar';
import { toHijri, formatHijri } from './hijri';
import { Preferences } from '@capacitor/preferences';

export const isNative = Capacitor.isNativePlatform();
export type PermState = 'granted' | 'denied' | 'prompt' | 'unavailable';

export async function permissionState(): Promise<PermState> {
  if (!isNative) return 'unavailable';
  try { const r = await LocalNotifications.checkPermissions(); return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'prompt'; } catch { return 'unavailable'; }
}
export async function requestPermission(): Promise<PermState> {
  if (!isNative) return 'unavailable';
  try { const r = await LocalNotifications.requestPermissions(); return r.display === 'granted' ? 'granted' : 'denied'; } catch { return 'unavailable'; }
}
export async function pendingCount(): Promise<number> {
  if (!isNative) return 0;
  try { return (await LocalNotifications.getPending()).notifications.length; } catch { return 0; }
}

const BASE_ID = 7000;
const DAYS = 7; // 5 prayers × 7 days = 35, plus optional reminders, kept under the iOS pending limit (64)
const CAP = 60;

interface Planned { id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle: boolean }; sound?: string; silent: boolean; extra: { prayer: string } }

/** Pure planner (exported for tests): every notification the current settings call for in the next DAYS days. */
export function planNotifications(loc: Location, ps: PrayerSettings, s: Settings, now = new Date()): Planned[] {
  const ar = s.lang === 'ar';
  const names: Record<PrayerName, string> = { fajr: t('fajr'), sunrise: t('sunrise'), dhuhr: t('dhuhr'), asr: t('asr'), maghrib: t('maghrib'), isha: t('isha') };
  const out: Planned[] = [];
  const push = (at: Date, title: string, body: string, kind: string, silent = false) => {
    if (at.getTime() > now.getTime()) out.push({ id: 0, title, body, schedule: { at, allowWhileIdle: true }, sound: silent ? undefined : 'default', silent, extra: { prayer: kind } });
  };
  for (const p of upcomingSchedule(loc, ps, DAYS, now)) {
    push(new Date(p.at.getTime() - ps.preMinutes * 60000), `${names[p.name]} — ${loc.name}`, `${fmtTime(p.at, loc.tz)} · ${t('calculated')}`, p.name, ps.notifyMode === 'silent');
  }
  const rem = s.reminders;
  const ram = ramadanInfo(now, s.hijriAdjust);
  for (let i = 0; i < DAYS; i++) {
    const civil = civilDate(loc.tz, i, now);
    const d = computeDay(loc, ps, civil);
    const nt = nightTimes(loc, ps, civil);
    const h = toHijri(civil, s.hijriAdjust);
    // Sunrise / Duha / last third / evening tracker
    if (rem.sunrise) push(d.times.sunrise, t('sunrise'), ar ? 'انتهى وقت الفجر (حدث فلكي)' : 'Fajr time has ended (sunrise)', 'reminder');
    if (rem.duha) push(nt.duhaReminder, t('duha'), ar ? `تذكيرك الشخصي بصلاة الضحى (الشروق + ${ps.duhaOffsetMin} د)` : 'Your Duha reminder', 'reminder');
    if (rem.lastThird) push(nt.lastThird, t('lastThird'), ar ? 'بداية الثلث الأخير من الليل (مغرب → فجر)' : 'Last third of the night begins', 'reminder');
    if (rem.trackerEvening) push(new Date(d.times.isha.getTime() + 60 * 60000), ar ? 'متتبع الصلوات' : 'Prayer tracker', ar ? 'سجّل صلوات اليوم (خاص على جهازك)' : 'Log today’s prayers (private)', 'reminder');
    // Friday: Kahf at the chosen time, salawat spread across the day (or every day)
    const friday = civil.getDay() === 5;
    if (friday && rem.fridayKahf) push(atTime(civil, s.kahfTime), ar ? 'الجمعة' : 'Friday', ar ? 'قراءة سورة الكهف' : 'Surat al-Kahf', 'reminder');
    if (rem.fridaySalawat && (friday || !s.salawat.fridayOnly)) {
      const n = Math.max(1, Math.min(10, s.salawat.perDay)); const span = d.times.isha.getTime() - d.times.sunrise.getTime();
      for (let k = 0; k < n; k++) push(new Date(d.times.sunrise.getTime() + (span * (k + 1)) / (n + 1)), ar ? 'الصلاة على النبي ﷺ' : 'Salawat', ar ? 'اللهم صلِّ وسلم على نبينا محمد' : 'Send blessings upon the Prophet ﷺ', 'reminder');
    }
    // Qiyam al-layl: chosen third, tahajjud before fajr, witr after isha
    const night = nt.nextFajr.getTime() - nt.maghrib.getTime();
    const thirdAt = s.qiyam.third === 'first' ? new Date(nt.maghrib.getTime() + night / 3) : s.qiyam.third === 'second' ? nt.midnight : s.qiyam.third === 'last' ? nt.lastThird : null;
    if (thirdAt && !(s.qiyam.third === 'last' && rem.lastThird)) push(thirdAt, ar ? 'قيام الليل' : 'Qiyam al-layl', ar ? `${s.qiyam.third === 'first' ? 'الثلث الأول' : s.qiyam.third === 'second' ? 'منتصف الليل' : 'الثلث الأخير'} — وقت تذكيرك الشخصي` : 'Your qiyam reminder', 'reminder');
    if (s.qiyam.beforeFajrMin > 0) push(new Date(nt.nextFajr.getTime() - s.qiyam.beforeFajrMin * 60000), ar ? 'التهجد' : 'Tahajjud', ar ? `بقي ${s.qiyam.beforeFajrMin} دقيقة على الفجر` : `${s.qiyam.beforeFajrMin} min to Fajr`, 'reminder');
    if (s.qiyam.witr) push(new Date(d.times.isha.getTime() + 45 * 60000), ar ? 'الوتر' : 'Witr', ar ? 'لا تنسَ الوتر قبل النوم' : 'Remember Witr before sleeping', 'reminder');
    // Fajr alarm (notification-based; a true alarm needs the native build)
    if (s.fajrAlarm.on) {
      const at = new Date(d.times.fajr.getTime() + s.fajrAlarm.offsetMin * 60000);
      push(at, ar ? 'منبه الفجر' : 'Fajr alarm', `${fmtTime(d.times.fajr, loc.tz)} · ${ar ? 'الفجر' : 'Fajr'}`, 'alarm');
      if (s.fajrAlarm.repeatMin > 0) push(new Date(at.getTime() + s.fajrAlarm.repeatMin * 60000), ar ? 'منبه الفجر (تكرار)' : 'Fajr alarm (again)', ar ? 'استيقظ للصلاة' : 'Wake up for prayer', 'alarm');
    }
    // Ramadan: iftar at maghrib, suhoor before fajr, Laylat al-Qadr odd nights of the last ten
    if (h.m === 9) {
      if (s.ramadan.iftar) push(d.times.maghrib, ar ? 'حان وقت الإفطار' : 'Iftar time', ar ? `المغرب ${fmtTime(d.times.maghrib, loc.tz)} · تقبّل الله` : `Maghrib ${fmtTime(d.times.maghrib, loc.tz)}`, 'iftar');
      if (s.ramadan.suhoor) push(new Date(d.times.fajr.getTime() - s.ramadan.suhoorMin * 60000), ar ? 'المسحراتي' : 'Suhoor', ar ? `بقي ${s.ramadan.suhoorMin} دقيقة على الفجر (الإمساك)` : `${s.ramadan.suhoorMin} min to Fajr`, 'suhoor');
      if (s.ramadan.qadr && h.d >= 20 && h.d % 2 === 0) push(new Date(d.times.maghrib.getTime() + 30 * 60000), ar ? 'العشر الأواخر' : 'Last ten nights', ar ? `الليلة ليلة ${h.d + 1} — من الليالي الوترية` : `Night ${h.d + 1}, an odd night`, 'reminder');
    } else if (s.ramadan.suhoor && ram.daysUntil === 1 && i === 0) push(new Date(d.times.isha.getTime() + 30 * 60000), ar ? 'رمضان' : 'Ramadan', ar ? 'غدًا أول أيام رمضان (حسابيًا) — تحقق من إعلان بلدك' : 'Ramadan starts tomorrow (calculated)', 'reminder');
    // Sunnah fasting: the evening before
    if (rem.fastEve) { const f = fastingFor(addDays(civil, 1), s.hijriAdjust); if (f.reasons.length && !f.forbidden && f.reasons[0].id !== 'ramadan') push(new Date(d.times.isha.getTime() + 20 * 60000), ar ? 'صيام الغد' : 'Fasting tomorrow', ar ? `غدًا: ${f.reasons.map((r) => r.title).join(' · ')} — انوِ الصيام` : f.reasons.map((r) => r.title).join(' · '), 'reminder'); }
    // Adhkar reminders at chosen clock times
    const a = s.adhkarReminders;
    if (a.morning) push(atTime(civil, a.morningAt), t('morningAdhkar'), ar ? 'حصّن يومك بأذكار الصباح' : 'Morning adhkar', 'adhkar');
    if (a.evening) push(atTime(civil, a.eveningAt), t('eveningAdhkar'), ar ? 'أذكار المساء' : 'Evening adhkar', 'adhkar');
    if (a.sleep) push(atTime(civil, a.sleepAt), ar ? 'أذكار النوم' : 'Sleep adhkar', ar ? 'آية الكرسي والمعوذات قبل النوم' : 'Before sleeping', 'adhkar');
  }
  out.sort((x, y) => x.schedule.at.getTime() - y.schedule.at.getTime());
  return out.slice(0, CAP).map((n, i) => ({ ...n, id: BASE_ID + i }));
}

/** Cancel everything we scheduled and schedule afresh for the current location/settings (section 15/16: no stale or duplicate alerts). */
/** Home-screen widget data (Android SakinaWidget reads Preferences key "widget"): today + 6 days of the five prayers. */
export async function writeWidget(loc: Location | null, ps: PrayerSettings, now = new Date()) {
  if (!isNative || !loc) return;
  try {
    const s = getSettings() as Settings;
    const AR: Record<string, string> = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
    const EN: Record<string, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
    const days = [];
    for (let i = 0; i < 7; i++) {
      const civil = civilDate(loc.tz, i, now);
      const d = computeDay(loc, ps, civil);
      const ymd = `${civil.getFullYear()}-${String(civil.getMonth() + 1).padStart(2, '0')}-${String(civil.getDate()).padStart(2, '0')}`;
      const h = toHijri(civil, s.hijriAdjust);
      days.push({ d: ymd, hijri: formatHijri(h, true), hijriEn: formatHijri(h, false), p: (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((n) => ({ n, ar: AR[n], en: EN[n], t: d.times[n].getTime() })) });
    }
    await Preferences.set({ key: 'widget', value: JSON.stringify({ city: loc.name, tz: loc.tz, lang: s.lang, h24: false, days, at: Date.now() }) });
  } catch { /* widget is optional */ }
}

export async function reschedule(loc: Location | null, ps: PrayerSettings): Promise<number> {
  if (!isNative) return 0;
  await writeWidget(loc, ps);
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (!loc || (await permissionState()) !== 'granted') return 0;
  const all = planNotifications(loc, ps, getSettings() as Settings);
  if (all.length) await LocalNotifications.schedule({ notifications: all });
  return all.length;
}

export async function testNotification() {
  if (!isNative) return false;
  await LocalNotifications.schedule({ notifications: [{ id: 6999, title: 'سكينة', body: 'اختبار تنبيه — إذا وصلك هذا فالتنبيهات تعمل.', schedule: { at: new Date(Date.now() + 5000) } }] });
  return true;
}

/** Soft in-app chime (generated with WebAudio — no third-party sound files, no rights questions). */
export function playChime(kind: 'iftar' | 'soft' = 'soft') {
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    const notes = kind === 'iftar' ? [392, 523, 659, 784] : [523, 659];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.28; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.start(t0); o.stop(t0 + 1);
    });
    return true;
  } catch { return false; }
}
