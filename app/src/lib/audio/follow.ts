/**
 * "Listen with the mushaf": works out, many times per second, which ayah and which word is being recited and how far
 * through that word we are (0..1), from either engine:
 *  - ayah-by-ayah audio (everyayah): exact word timings for 12 recordings (quran-align, CC BY 4.0), otherwise estimated
 *    by spreading the ayah's duration over its words by letter count;
 *  - full-surah recordings (MP3Quran): ayah timings from MP3Quran, words estimated inside each ayah.
 */
import { ayahClock, getAyahPlayer, getAyahReciter } from './ayah';
import { mainClock } from './player';
import { getWordTimings, getSurah, ayahDisplay, type SurahText } from '../content';

export interface FollowTick { ch: number; v: number; word: number; p: number; exact: boolean; playing: boolean; source: 'ayah' | 'full' }

const timingCache = new Map<string, Record<string, [number, number, number, number][]> | null>();
const surahCache = new Map<number, SurahText>();
const weightCache = new Map<string, number[]>();
const pending = new Set<string>();
function want<T>(key: string, f: () => Promise<T>, put: (v: T | null) => void) { if (pending.has(key)) return; pending.add(key); f().then(put, () => put(null)).finally(() => pending.delete(key)); }

/** Cumulative letter-count weights for the words of an ayah (diacritics and marks ignored). */
function weights(ch: number, v: number): number[] | null {
  const key = `${ch}:${v}`; const hit = weightCache.get(key); if (hit) return hit;
  const s = surahCache.get(ch); if (!s) { want(`s${ch}`, () => getSurah(ch), (x) => { if (x) surahCache.set(ch, x); }); return null; }
  const verse = s.verses[v - 1]; if (!verse) return null;
  const words = ayahDisplay(s, verse).split(' ').filter(Boolean);
  const lens = words.map((w) => Math.max(1, w.replace(/[ً-ٰٟۖ-ۭـ]/g, '').length));
  const tot = lens.reduce((a, b) => a + b, 0); let acc = 0;
  const cum = lens.map((l) => (acc += l) / tot);
  weightCache.set(key, cum); return cum;
}
function estimate(ch: number, v: number, frac: number): { word: number; p: number } {
  const cum = weights(ch, v); if (!cum) return { word: -1, p: 0 };
  const f = Math.min(0.9999, Math.max(0, frac));
  let i = cum.findIndex((c) => f < c); if (i < 0) i = cum.length - 1;
  const lo = i === 0 ? 0 : cum[i - 1];
  return { word: i, p: (f - lo) / Math.max(1e-6, cum[i] - lo) };
}
let tmFor: { reciter: string; tm: string | null } = { reciter: '', tm: null };

export function followTick(): FollowTick | null {
  const ac = ayahClock();
  if (ac) {
    const ap = getAyahPlayer();
    if (tmFor.reciter !== ap.reciter) { tmFor = { reciter: ap.reciter, tm: null }; void getAyahReciter(ap.reciter).then((r) => { if (tmFor.reciter === ap.reciter) tmFor.tm = r.tm || ''; }); }
    const tm = tmFor.tm;
    if (tm) {
      const key = `${tm}:${ac.ch}`;
      if (!timingCache.has(key)) want(key, () => getWordTimings(tm, ac.ch), (x) => timingCache.set(key, x));
      const segs = timingCache.get(key)?.[String(ac.v)];
      if (segs && segs.length) {
        let seg = segs.find((x) => ac.ms >= x[2] && ac.ms < x[3]);
        if (!seg) { const prev = [...segs].reverse().find((x) => ac.ms >= x[3]); seg = prev || segs[0]; return { ch: ac.ch, v: ac.v, word: seg[0], p: prev ? 1 : 0, exact: true, playing: ac.playing, source: 'ayah' }; }
        return { ch: ac.ch, v: ac.v, word: seg[0], p: (ac.ms - seg[2]) / Math.max(1, seg[3] - seg[2]), exact: true, playing: ac.playing, source: 'ayah' };
      }
    }
    const e = ac.dur > 0 ? estimate(ac.ch, ac.v, ac.ms / ac.dur) : { word: -1, p: 0 };
    return { ch: ac.ch, v: ac.v, ...e, exact: false, playing: ac.playing, source: 'ayah' };
  }
  const mc = mainClock();
  if (mc && mc.timings) {
    const t = mc.timings.find((x) => mc.ms >= x.start && mc.ms < x.end) || null;
    if (!t) return null;
    const e = estimate(mc.surah, t.ayah, (mc.ms - t.start) / Math.max(1, t.end - t.start));
    return { ch: mc.surah, v: t.ayah, ...e, exact: false, playing: mc.playing, source: 'full' };
  }
  return null;
}
