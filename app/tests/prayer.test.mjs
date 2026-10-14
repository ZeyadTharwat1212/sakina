// Section 14/15/38 — calculated prayer times reproduce from their parameters across cities, seasons, DST and high latitude.
// Reference values are from the adhan algorithm itself with the same parameters (the master prompt: "accuracy is defined by
// comparing with the same parameters and reference"); the sanity bounds catch timezone/DST/day-selection bugs.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as adhan from 'adhan';

function times(lat, lng, tz, y, m, d, methodKey, madhab = 'shafi', highLat = 'MiddleOfTheNight') {
  const params = adhan.CalculationMethod[methodKey]();
  params.madhab = madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  params.highLatitudeRule = adhan.HighLatitudeRule[highLat];
  const pt = new adhan.PrayerTimes(new adhan.Coordinates(lat, lng), new Date(y, m - 1, d, 12), params);
  const f = (dt) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false }).format(dt);
  return { fajr: f(pt.fajr), sunrise: f(pt.sunrise), dhuhr: f(pt.dhuhr), asr: f(pt.asr), maghrib: f(pt.maghrib), isha: f(pt.isha), raw: pt };
}
const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const within = (a, b, tol, msg) => assert.ok(Math.abs(mins(a) - mins(b)) <= tol, `${msg}: ${a} vs ${b}`);

test('Cairo 14 Oct 2026 (Egyptian, Egypt DST UTC+3)', () => {
  const t = times(30.0444, 31.2357, 'Africa/Cairo', 2026, 10, 14, 'Egyptian');
  within(t.fajr, '05:30', 3, 'fajr'); within(t.sunrise, '06:56', 3, 'sunrise'); within(t.dhuhr, '12:42', 3, 'dhuhr');
  within(t.asr, '15:57', 3, 'asr'); within(t.maghrib, '18:26', 3, 'maghrib'); within(t.isha, '19:43', 3, 'isha');
});
test('Cairo 15 Jan 2026 (no DST, UTC+2) — solar noon near 12:04', () => {
  const t = times(30.0444, 31.2357, 'Africa/Cairo', 2026, 1, 15, 'Egyptian');
  within(t.dhuhr, '12:04', 4, 'dhuhr'); within(t.maghrib, '17:14', 5, 'maghrib');
});
test('Makkah 14 Oct 2026 (Umm al-Qura; isha = maghrib + 90)', () => {
  const t = times(21.4225, 39.8262, 'Asia/Riyadh', 2026, 10, 14, 'UmmAlQura');
  within(t.dhuhr, '12:08', 4, 'dhuhr');
  assert.equal(mins(t.isha) - mins(t.maghrib), 90, 'Umm al-Qura isha interval');
});
test('London 14 Oct 2026 (BST) vs 1 Nov 2026 (GMT) — DST crossing handled by IANA zone', () => {
  const a = times(51.5074, -0.1278, 'Europe/London', 2026, 10, 14, 'MoonsightingCommittee');
  const b = times(51.5074, -0.1278, 'Europe/London', 2026, 11, 1, 'MoonsightingCommittee');
  within(a.dhuhr, '12:48', 5, 'dhuhr BST'); within(b.dhuhr, '11:44', 5, 'dhuhr GMT');
  assert.ok(mins(a.dhuhr) - mins(b.dhuhr) > 50, 'clock shift visible after DST ends');
});
test('New York 14 Oct 2026 (ISNA, EDT)', () => {
  const t = times(40.7128, -74.006, 'America/New_York', 2026, 10, 14, 'NorthAmerica');
  within(t.dhuhr, '12:46', 5, 'dhuhr'); within(t.maghrib, '18:17', 6, 'maghrib');
});
test('Oslo 21 Jun 2026 — high latitude: fajr/isha still produced (MiddleOfTheNight), never NaN', () => {
  const t = times(59.9139, 10.7522, 'Europe/Oslo', 2026, 6, 21, 'MuslimWorldLeague');
  for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) assert.ok(!isNaN(t.raw[k].getTime()), k);
  assert.ok(t.raw.fajr < t.raw.sunrise && t.raw.maghrib < t.raw.isha);
});
test('Hanafi asr is later than Shafi asr', () => {
  const s = times(30.0444, 31.2357, 'Africa/Cairo', 2026, 10, 14, 'Egyptian', 'shafi');
  const h = times(30.0444, 31.2357, 'Africa/Cairo', 2026, 10, 14, 'Egyptian', 'hanafi');
  assert.ok(mins(h.asr) > mins(s.asr));
});
test('qibla bearings', () => {
  const q = (lat, lng) => adhan.Qibla(new adhan.Coordinates(lat, lng));
  assert.ok(Math.abs(q(30.0444, 31.2357) - 136.1) < 0.5, 'Cairo');
  assert.ok(Math.abs(q(51.5074, -0.1278) - 119.0) < 0.5, 'London');
  assert.ok(Math.abs(q(40.7128, -74.006) - 58.5) < 0.6, 'New York');
  assert.ok(Math.abs(q(24.4672, 39.6024) - 176.0) < 1.5, 'Madinah (almost due south)');
});
test('night-based times: midnight is halfway maghrib→next fajr, not 00:00', () => {
  const p = adhan.CalculationMethod.Egyptian();
  const c = new adhan.Coordinates(30.0444, 31.2357);
  const d1 = new adhan.PrayerTimes(c, new Date(2026, 9, 14, 12), p);
  const d2 = new adhan.PrayerTimes(c, new Date(2026, 9, 15, 12), p);
  const mid = new Date(d1.maghrib.getTime() + (d2.fajr.getTime() - d1.maghrib.getTime()) / 2);
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Africa/Cairo' }).format(mid));
  assert.ok(h === 23 || h === 0, `midnight hour ${h}`);
});
