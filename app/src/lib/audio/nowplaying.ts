/**
 * One "now playing" state for both engines (full-surah recordings and ayah-by-ayah), with the ayah being recited
 * right now when it is known. Drives the lock-screen / Control Center card (Media Session API — native in iOS
 * WKWebView): the title becomes the live ayah, the artist line "سورة … · reciter", artwork the reciter's photo.
 * The ayah is only shown when it is actually known (ayah-by-ayah playback or recordings with ayah timings) — never guessed.
 */
import { getPlayer, subscribePlayer, toggle as toggleMain, next, prev, seekTo, seekBy } from './player';
import { getAyahPlayer, subscribeAyahPlayer, toggleAyahs, skip, ayahClock, getAyahReciter } from './ayah';
import { getCatalog, recordingById, displayName } from './catalog';
import { getChapters, getSurah, ayahDisplay, type SurahText, type Chapter } from '../content';
import { squareArtwork } from './photos';

export interface NowPlaying { engine: 'full' | 'ayah'; ch: number; v: number | null; surah: string; reciter: string; reciterId: string | null; text: string | null; playing: boolean; pos: number; dur: number }
let np: NowPlaying | null = null;
const subs = new Set<() => void>();
export const getNowPlaying = () => np;
export function subscribeNowPlaying(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }

let chapters: Chapter[] | null = null;
const surahs = new Map<number, SurahText>();
const ayahNames = new Map<string, string>();
function text(ch: number, v: number | null): string | null {
  if (!v) return null;
  const s = surahs.get(ch);
  if (!s) { void getSurah(ch).then((x) => { surahs.set(ch, x); compute(); }).catch(() => {}); return null; }
  const verse = s.verses[v - 1]; return verse ? ayahDisplay(s, verse) : null;
}
/** Lock-screen fonts lack some Quranic annotation marks; drop them there (the app itself shows the full text). */
const plain = (t: string) => t.replace(/[ۖ-ۜ۞-ۭ]/g, '').replace(/\s+/g, ' ').trim();

let catalog: Awaited<ReturnType<typeof getCatalog>> | null = null;
function compute() {
  const ap = getAyahPlayer();
  let next_: NowPlaying | null = null;
  if (!chapters) { void getChapters().then((c) => { chapters = c; compute(); }); return; }
  if (ap.active) {
    const clk = ayahClock();
    let who = ayahNames.get(ap.reciter);
    if (who == null) { ayahNames.set(ap.reciter, ''); void getAyahReciter(ap.reciter).then((r) => { ayahNames.set(ap.reciter, r.ar); compute(); }); who = ''; }
    next_ = { engine: 'ayah', ch: ap.ch, v: ap.v, surah: chapters[ap.ch - 1]?.name || '', reciter: who, reciterId: null, text: text(ap.ch, ap.v), playing: ap.playing, pos: (clk?.ms || 0) / 1000, dur: (clk?.dur || 0) / 1000 };
  } else {
    const p = getPlayer(); const tr = p.queue[p.index];
    if (tr && p.open !== 'none') {
      if (!catalog) { void getCatalog().then((c) => { catalog = c; compute(); }); }
      const rec = catalog ? recordingById(catalog, tr.recId) : null;
      next_ = { engine: 'full', ch: tr.surah, v: p.currentAyah, surah: chapters[tr.surah - 1]?.name || '', reciter: rec ? displayName(rec) : '', reciterId: rec?.reciterId || null, text: text(tr.surah, p.currentAyah), playing: p.playing, pos: p.pos, dur: p.dur };
    }
  }
  np = next_;
  subs.forEach((f) => f());
  void toMediaSession(np);
}

/* ---------- lock screen ---------- */
let lastKey = ''; let lastPosAt = 0;
async function toMediaSession(n: NowPlaying | null) {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  if (!n) { if (lastKey) { ms.metadata = null; ms.playbackState = 'none'; lastKey = ''; } return; }
  ms.playbackState = n.playing ? 'playing' : 'paused';
  const key = `${n.engine}|${n.ch}|${n.v}|${n.reciter}|${!!n.text}`;
  if (key !== lastKey) {
    lastKey = key;
    const title = n.text ? `﴿${plain(n.text)}﴾` : `سورة ${n.surah}`;
    const artist = `سورة ${n.surah}${n.v && n.text ? ` · ${n.v}` : ''}${n.reciter ? ` · ${n.reciter}` : ''}`;
    const fallback = [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }];
    ms.metadata = new MediaMetadata({ title, artist, album: 'سكينة', artwork: fallback });
    if (n.reciterId) { const art = await squareArtwork(n.reciterId); if (art && lastKey === key) ms.metadata = new MediaMetadata({ title, artist, album: 'سكينة', artwork: [{ src: art, sizes: '512x512', type: 'image/jpeg' }] }); }
  }
  const now = Date.now();
  if (n.dur > 0 && now - lastPosAt > 900) { lastPosAt = now; try { ms.setPositionState({ duration: n.dur, position: Math.min(n.pos, n.dur), playbackRate: 1 }); } catch { /* unsupported */ } }
}
function handlers() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession; const ayah = () => getAyahPlayer().active;
  const h: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => { if (ayah()) { if (!getAyahPlayer().playing) toggleAyahs(); } else if (!getPlayer().playing) void toggleMain(); }],
    ['pause', () => { if (ayah()) { if (getAyahPlayer().playing) toggleAyahs(); } else if (getPlayer().playing) void toggleMain(); }],
    ['previoustrack', () => { if (ayah()) void skip(-1); else void prev(); }],
    ['nexttrack', () => { if (ayah()) void skip(1); else void next(); }],
    ['seekbackward', () => { if (!ayah()) seekBy(-10); }],
    ['seekforward', () => { if (!ayah()) seekBy(10); }],
    ['seekto', (d) => { if (!ayah() && d.seekTime != null) seekTo(d.seekTime); }],
  ];
  for (const [a, f] of h) { try { ms.setActionHandler(a, f); } catch { /* unsupported action */ } }
}

let started = false;
export function startNowPlaying() {
  if (started) return; started = true;
  handlers();
  subscribePlayer(compute); subscribeAyahPlayer(compute);
  window.setInterval(() => { if (getAyahPlayer().active) compute(); }, 1000); // ayah engine has no timeupdate in its state
}
