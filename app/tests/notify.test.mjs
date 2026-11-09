// Notification planner + display helpers (bundled on the fly with esbuild; browser globals stubbed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs';
const mem = new Map();
globalThis.window = globalThis; globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} }, setAttribute() {}, classList: { toggle() {}, add() {}, remove() {} } }, addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const out = new URL('./.notify.test.bundle.mjs', import.meta.url);
fs.writeFileSync(new URL('./.notify-entry.ts', import.meta.url), "export * from '../src/lib/notify'; export { frac, num } from '../src/lib/i18n'; export { getSettings } from '../src/lib/store';");
await build({ entryPoints: [new URL('./.notify-entry.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile: out.pathname, logLevel: 'silent' });
const m = await import(out.href);
fs.unlinkSync(out.pathname); fs.unlinkSync(new URL('./.notify-entry.ts', import.meta.url));

const loc = { name: 'Cairo', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo', source: 'city', updatedAt: Date.now() };
const busy = (s) => ({ ...s, reminders: { ...s.reminders, sunrise: true, duha: true, lastThird: true, trackerEvening: true, fridayKahf: true, fridaySalawat: true, fastEve: true },
  salawat: { ...s.salawat, perDay: 10, fridayOnly: false }, qiyam: { ...s.qiyam, third: 'second', beforeFajrMin: 30, witr: true },
  fajrAlarm: { ...s.fajrAlarm, on: true, repeatMin: 10 }, adhkarReminders: { ...s.adhkarReminders, morning: true, evening: true, sleep: true } });

test('all prayer alerts of the next 7 days survive the cap even with every reminder on', () => {
  const s = busy(m.getSettings());
  const plan = m.planNotifications(loc, s.prayer, s, new Date('2026-11-09T06:00:00Z'));
  assert.ok(plan.length <= 60);
  const prayers = plan.filter((p) => ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(p.extra.prayer));
  assert.ok(prayers.length >= 33, `only ${prayers.length} prayer alerts`);
  const ids = new Set(plan.map((p) => p.id)); assert.equal(ids.size, plan.length);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].schedule.at >= plan[i - 1].schedule.at);
});

test('rescheduling after midnight keeps tonight’s tahajjud reminder', () => {
  const s = busy(m.getSettings());
  const plan = m.planNotifications(loc, s.prayer, s, new Date('2026-11-09T23:00:00Z')); // 01:00 Cairo
  const first = plan[0];
  assert.ok(first.schedule.at.getTime() < new Date('2026-11-10T02:47:00Z').getTime(), 'something before Fajr tonight');
  assert.ok(plan.some((p) => /التهجد|Tahajjud/.test(p.title) && p.schedule.at < new Date('2026-11-10T03:00:00Z')));
});

test('fractions read correctly in Arabic', () => {
  assert.equal(m.frac(18, 114), '١٨ من ١١٤');
});
