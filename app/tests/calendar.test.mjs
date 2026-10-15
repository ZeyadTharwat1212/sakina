// Calendar helpers (Ramadan, sunnah fasts) — pure logic, tested through the built bundle's source via tsx-free re-implementation check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Compile the two TS files on the fly with esbuild (vite's bundled esbuild) into a temp ESM module.
import { build } from 'esbuild';
import fs from 'node:fs';
const out = new URL('./.calendar.test.bundle.mjs', import.meta.url);
await build({ entryPoints: [new URL('../src/lib/calendar.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile: out.pathname, logLevel: 'silent' });
const cal = await import(out.href);
fs.unlinkSync(out.pathname);

test('ramadanInfo finds a 29/30-day month and a future start', () => {
  const info = cal.ramadanInfo(new Date(2026, 9, 15), 0);
  assert.ok(info.days.length === 29 || info.days.length === 30);
  assert.equal(info.inRamadan, false);
  assert.ok(info.daysUntil > 0 && info.daysUntil < 400);
  assert.equal(info.year, 1448);
});
test('inside Ramadan the day index matches the Hijri day', () => {
  const info = cal.ramadanInfo(new Date(2026, 9, 15), 0);
  const inside = cal.ramadanInfo(cal.addDays(info.start, 4), 0);
  assert.equal(inside.inRamadan, true);
  assert.equal(inside.dayIndex, 4);
});
test('fasting rules: Monday/Thursday, white days, Eid forbidden', () => {
  const mon = new Date(2026, 9, 19); // Monday
  assert.ok(cal.fastingFor(mon, 0).reasons.some((r) => r.id === 'monthu'));
  const eidFitr = cal.nextHijriDate(10, 1, new Date(2026, 9, 15), 0);
  assert.ok(cal.fastingFor(eidFitr, 0).forbidden);
  const white = cal.nextHijriDate(11, 14, new Date(2026, 9, 15), 0);
  assert.ok(cal.fastingFor(white, 0).reasons.some((r) => r.id === 'white'));
  const ram = cal.nextHijriDate(9, 10, new Date(2026, 9, 15), 0);
  assert.equal(cal.fastingFor(ram, 0).reasons[0].id, 'ramadan');
});
test('atTime parses HH:MM on the civil day', () => {
  const d = cal.atTime(new Date(2026, 0, 5, 12), '09:30');
  assert.equal(d.getHours(), 9); assert.equal(d.getMinutes(), 30); assert.equal(d.getDate(), 5);
});
