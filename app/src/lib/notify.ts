/**
 * Prayer notifications (section 16) via Capacitor LocalNotifications.
 * Honest limits: this is a *notification*, not a full adhan alarm. iOS custom sounds are ≤30 s;
 * a full adhan on iOS needs AlarmKit (native, iOS 26+) — not part of Phase 1 (see docs/04_status_register.md).
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Location, PrayerSettings, Settings } from './store';
import { upcomingSchedule, computeDay, civilDate, nightTimes, type PrayerName } from './prayer';
import { getSettings } from './store';
import { t, fmtTime } from './i18n';

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

/** Cancel everything we scheduled and schedule afresh for the current location/settings (section 15/16: no stale or duplicate alerts). */
export async function reschedule(loc: Location | null, ps: PrayerSettings): Promise<number> {
  if (!isNative) return 0;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (!loc || (await permissionState()) !== 'granted') return 0;
  const list = upcomingSchedule(loc, ps, DAYS);
  const names: Record<PrayerName, string> = { fajr: t('fajr'), sunrise: t('sunrise'), dhuhr: t('dhuhr'), asr: t('asr'), maghrib: t('maghrib'), isha: t('isha') };
  const notifications = list.map((p, i) => ({
    id: BASE_ID + i,
    title: `${names[p.name]} — ${loc.name}`,
    body: `${fmtTime(p.at, loc.tz)} · ${t('calculated')}`,
    schedule: { at: new Date(p.at.getTime() - ps.preMinutes * 60000), allowWhileIdle: true },
    sound: ps.notifyMode === 'silent' ? undefined : 'default',
    silent: ps.notifyMode === 'silent',
    extra: { prayer: p.name as string },
  }));
  // Optional reminders (section 19/26 + reference-app parity): all opt-in, computed from the same engine.
  const rem = (getSettings() as Settings).reminders;
  const extras: typeof notifications = [];
  for (let i = 0; i < DAYS; i++) {
    const civil = civilDate(loc.tz, i);
    const d = computeDay(loc, ps, civil);
    const nt = nightTimes(loc, ps, civil);
    const push = (at: Date, title: string, body: string) => { if (at.getTime() > Date.now()) extras.push({ id: BASE_ID + 100 + extras.length, title, body, schedule: { at, allowWhileIdle: true }, sound: 'default', silent: false, extra: { prayer: 'reminder' } }); };
    if (rem.sunrise) push(d.times.sunrise, t('sunrise'), isArNow() ? 'انتهى وقت الفجر (حدث فلكي)' : 'Fajr time has ended (sunrise)');
    if (rem.duha) push(nt.duhaReminder, t('duha'), isArNow() ? `تذكيرك الشخصي بصلاة الضحى (الشروق + ${ps.duhaOffsetMin} د)` : 'Your Duha reminder');
    if (rem.lastThird) push(nt.lastThird, t('lastThird'), isArNow() ? 'بداية الثلث الأخير من الليل (مغرب → فجر)' : 'Last third of the night begins');
    if (rem.trackerEvening) push(new Date(d.times.isha.getTime() + 60 * 60000), isArNow() ? 'متتبع الصلوات' : 'Prayer tracker', isArNow() ? 'سجّل صلوات اليوم (خاص على جهازك)' : 'Log today’s prayers (private)');
    if (civil.getDay() === 5) {
      const nine = new Date(d.times.sunrise.getTime() + 2 * 3600000);
      if (rem.fridayKahf) push(nine, isArNow() ? 'الجمعة' : 'Friday', isArNow() ? 'قراءة سورة الكهف' : 'Surat al-Kahf');
      if (rem.fridaySalawat) push(new Date(nine.getTime() + 3600000), isArNow() ? 'الجمعة' : 'Friday', isArNow() ? 'أكثِر من الصلاة على النبي ﷺ' : 'Salawat on the Prophet ﷺ');
    }
  }
  const all = [...notifications, ...extras].slice(0, 60);
  if (all.length) await LocalNotifications.schedule({ notifications: all });
  return all.length;
}
const isArNow = () => getSettings().lang === 'ar';

export async function testNotification() {
  if (!isNative) return false;
  await LocalNotifications.schedule({ notifications: [{ id: 6999, title: 'سكينة', body: 'اختبار تنبيه — إذا وصلك هذا فالتنبيهات تعمل.', schedule: { at: new Date(Date.now() + 5000) } }] });
  return true;
}
