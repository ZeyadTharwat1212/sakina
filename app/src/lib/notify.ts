/**
 * Prayer notifications (section 16) via Capacitor LocalNotifications.
 * Honest limits: this is a *notification*, not a full adhan alarm. iOS custom sounds are ≤30 s;
 * a full adhan on iOS needs AlarmKit (native, iOS 26+) — not part of Phase 1 (see docs/04_status_register.md).
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Location, PrayerSettings } from './store';
import { upcomingSchedule, type PrayerName } from './prayer';
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
const DAYS = 10; // 5 prayers × 10 days = 50 < iOS pending limit (64)

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
    extra: { prayer: p.name },
  }));
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  return notifications.length;
}

export async function testNotification() {
  if (!isNative) return false;
  await LocalNotifications.schedule({ notifications: [{ id: 6999, title: 'سكينة', body: 'اختبار تنبيه — إذا وصلك هذا فالتنبيهات تعمل.', schedule: { at: new Date(Date.now() + 5000) } }] });
  return true;
}
