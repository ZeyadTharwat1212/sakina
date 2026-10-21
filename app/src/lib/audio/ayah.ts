/**
 * Ayah-by-ayah playback (section 11b): streams single-ayah files from free archives (everyayah.com, cdn.islamic.network).
 * - Two audio elements: while one ayah plays the next is pre-loaded, so the surah flows without gaps.
 * - Quality: "hq" (original bitrate) or "lite" (the smallest copy of the SAME recording, ½–⅛ the size).
 * - Exposes a clock (current ayah + ms) so the mushaf can follow the recitation word by word.
 * Nothing is re-hosted; files are cached on the device only when the user asks (Cache Storage).
 */
import { getAyahAudioSources, getChapters } from '../content';
import { getSettings, updateUser } from '../store';
import { pause as pauseMain, getPlayer, subscribePlayer } from './player';

export interface AyahReciter { id: string; ar: string; en: string; in: string | null; ea: string; lite: string; tm?: string; kbps: number; liteKbps: number; riwayah?: string }
export interface AyahPlayerState { active: boolean; playing: boolean; ch: number; v: number; from: number; to: number; rep: number; reciter: string; error: string | null; loading: boolean; continuous: boolean }
let s: AyahPlayerState = { active: false, playing: false, ch: 0, v: 0, from: 0, to: 0, rep: 1, reciter: '', error: null, loading: false, continuous: false };
const subs = new Set<() => void>();
const set = (p: Partial<AyahPlayerState>) => { s = { ...s, ...p }; subs.forEach((f) => f()); };
export const getAyahPlayer = () => s;
export function subscribeAyahPlayer(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }

export const AYAH_CACHE = 'sakina-ayah-audio-v1';
let verseCounts: number[] | null = null;
let verseOffsets: number[] | null = null;
async function counts() {
  if (!verseCounts) { const chs = await getChapters(); verseCounts = chs.map((c) => c.verses); let acc = 0; verseOffsets = verseCounts.map((n) => { const o = acc; acc += n; return o; }); }
  return verseCounts;
}
export async function getAyahReciter(id: string): Promise<AyahReciter> {
  const src = await getAyahAudioSources();
  return ((src.reciters as unknown as AyahReciter[]).find((x) => x.id === id) || (src.reciters as unknown as AyahReciter[])[0]);
}
const folderUrl = (tpl: string, folder: string, ch: number, v: number) => tpl.replace('{folder}', folder).replace('{sss}', String(ch).padStart(3, '0')).replace('{aaa}', String(v).padStart(3, '0'));
/** Candidate URLs, best first, for the chosen quality. */
export async function ayahUrls(ch: number, v: number, reciterId: string, quality = getSettings().audioQuality): Promise<string[]> {
  const src = await getAyahAudioSources(); await counts();
  const r = await getAyahReciter(reciterId);
  const a = folderUrl(src.templates.everyayah, quality === 'lite' ? r.lite : r.ea, ch, v);
  const b = folderUrl(src.templates.everyayah, quality === 'lite' ? r.ea : r.lite, ch, v);
  const urls = [a]; if (b !== a) urls.push(b);
  if (r.in) { const n = String(verseOffsets![ch - 1] + v); urls.push(src.templates.islamicnet.replace('{bitrate}', quality === 'lite' ? '64' : '128').replace('{edition}', r.in).replace('{n}', n)); }
  return urls;
}
async function cachedBlobUrl(urls: string[]): Promise<string | null> {
  try { const c = await caches.open(AYAH_CACHE); for (const u of urls) { const hit = await c.match(u); if (hit) return URL.createObjectURL(await hit.blob()); } } catch { /* no cache API */ }
  return null;
}

/* ---------- engine ---------- */
interface Slot { el: HTMLAudioElement; key: string; urls: string[]; i: number; blob: string | null; ready: Promise<void> | null }
const slots: Slot[] = [];
let cur = 0; // index of the playing slot
let session = 0;
let repLeft = 1;
function mkSlot(): Slot { const el = new Audio(); el.preload = 'auto'; return { el, key: '', urls: [], i: 0, blob: null, ready: null }; }
function slot(i: number) { while (slots.length < 2) slots.push(mkSlot()); return slots[i]; }
async function prepare(sl: Slot, ch: number, v: number) {
  const key = `${s.reciter}:${ch}:${v}:${getSettings().audioQuality}`;
  if (sl.key === key && sl.ready) return sl.ready;
  if (sl.blob) { URL.revokeObjectURL(sl.blob); sl.blob = null; }
  sl.key = key; sl.i = 0;
  sl.ready = (async () => {
    sl.urls = await ayahUrls(ch, v, s.reciter);
    sl.blob = await cachedBlobUrl(sl.urls);
    sl.el.src = sl.blob || sl.urls[0];
    sl.el.load();
  })();
  return sl.ready;
}
async function nextPos(ch: number, v: number): Promise<[number, number] | null> {
  const vc = await counts();
  if (v < s.to && ch === s.ch) return [ch, v + 1];
  if (s.continuous) { if (v < vc[ch - 1]) return [ch, v + 1]; if (ch < 114) return [ch + 1, 1]; }
  return null;
}
async function playSlot(my: number) {
  const sl = slot(cur);
  await sl.ready;
  if (my !== session) return;
  sl.el.playbackRate = 1;
  sl.el.onended = () => void onEnded(my);
  sl.el.onerror = () => { if (my !== session) return; if (sl.i + 1 < sl.urls.length) { sl.i++; sl.el.src = sl.urls[sl.i]; void sl.el.play().catch(() => {}); } else set({ playing: false, loading: false, error: 'تعذّر جلب الملف الصوتي لهذه الآية — تحقق من الاتصال أو اختر قارئًا آخر' }); };
  sl.el.onplaying = () => { if (my === session) set({ loading: false, playing: true, error: null }); };
  sl.el.onwaiting = () => { if (my === session) set({ loading: true }); };
  try { await sl.el.play(); } catch { if (my === session) set({ loading: false, playing: false }); return; }
  // pre-load what comes next into the other slot
  const n = repLeft > 1 ? [s.ch, s.v] as [number, number] : await nextPos(s.ch, s.v);
  if (n && my === session) void prepare(slot(1 - cur), n[0], n[1]);
}
async function onEnded(my: number) {
  if (my !== session) return;
  if (repLeft > 1) { repLeft--; const sl = slot(cur); sl.el.currentTime = 0; void sl.el.play(); return; }
  const n = await nextPos(s.ch, s.v);
  if (!n) { set({ playing: false, active: false }); updateUser({ lastListen: { ch: s.ch, v: s.v, page: 0, at: Date.now(), kind: 'listen' } }); return; }
  repLeft = s.rep;
  cur = 1 - cur;
  set({ ch: n[0], v: n[1], ...(n[0] !== s.ch ? { from: 1, to: (await counts())[n[0] - 1] } : {}) });
  await prepare(slot(cur), n[0], n[1]);
  await playSlot(my);
}

/** Play ayahs from..to of one surah; `continuous` keeps going to the end of the mushaf. */
export async function playAyahs(ch: number, from: number, to: number, opts?: { reciter?: string; rep?: number; continuous?: boolean }) {
  const st = getSettings();
  pauseMain();
  for (const sl of slots) sl.el.pause();
  const my = ++session;
  repLeft = Math.max(1, opts?.rep || st.ayahRepeat || 1);
  set({ active: true, playing: true, loading: true, ch, from, to, v: from, rep: repLeft, reciter: opts?.reciter || st.ayahReciter, error: null, continuous: !!opts?.continuous });
  cur = 0;
  await prepare(slot(cur), ch, from);
  await playSlot(my);
}
/** Listen from an ayah to the end of the mushaf (used by "listen with the mushaf"). */
export async function playFrom(ch: number, v: number) { const vc = await counts(); return playAyahs(ch, v, vc[ch - 1], { continuous: true, rep: 1 }); }
export async function skip(delta: number) {
  if (!s.active) return; const vc = await counts();
  let ch = s.ch, v = s.v + delta;
  if (v < 1) { if (ch > 1) { ch--; v = vc[ch - 1]; } else v = 1; }
  if (v > vc[ch - 1]) { if (ch < 114) { ch++; v = 1; } else v = vc[ch - 1]; }
  return playAyahs(ch, v, s.continuous ? vc[ch - 1] : Math.max(v, s.to), { continuous: s.continuous, rep: s.rep });
}
export function stopAyahs() { session++; for (const sl of slots) { sl.el.pause(); sl.el.removeAttribute('src'); sl.key = ''; sl.ready = null; } set({ playing: false, loading: false, active: false }); }
export function toggleAyahs() { const sl = slots[cur]; if (!sl) return; if (sl.el.paused) { void sl.el.play(); set({ playing: true }); } else { sl.el.pause(); set({ playing: false }); } }
/** For the follow view: where are we right now? */
export function ayahClock(): { ch: number; v: number; ms: number; dur: number; playing: boolean } | null {
  if (!s.active) return null; const sl = slots[cur]; if (!sl) return null;
  return { ch: s.ch, v: s.v, ms: sl.el.currentTime * 1000, dur: (sl.el.duration || 0) * 1000, playing: !sl.el.paused };
}

/* ---------- offline (user-initiated) ---------- */
export async function cachedCount(reciter: string, ch: number): Promise<number> {
  const vc = await counts(); let n = 0;
  try { const c = await caches.open(AYAH_CACHE); for (let v = 1; v <= vc[ch - 1]; v++) { const urls = await ayahUrls(ch, v, reciter); for (const u of urls) if (await c.match(u)) { n++; break; } } } catch { /* no cache */ }
  return n;
}
export async function cacheAyahs(ch: number, from: number, to: number, reciter: string, onProgress?: (done: number, total: number, bytes: number) => void, signal?: { cancel: boolean }) {
  const c = await caches.open(AYAH_CACHE); let bytes = 0;
  for (let v = from; v <= to; v++) {
    if (signal?.cancel) throw new Error('cancelled');
    const urls = await ayahUrls(ch, v, reciter);
    let ok = false;
    for (const u of urls) { if (await c.match(u)) { ok = true; break; } try { const r = await fetch(u); if (r.ok) { const b = await r.blob(); bytes += b.size; await c.put(u, new Response(b, { headers: { 'Content-Type': 'audio/mpeg' } })); ok = true; break; } } catch { /* next */ } }
    onProgress?.(v - from + 1, to - from + 1, bytes);
    if (!ok) throw new Error(`ayah ${ch}:${v}`);
  }
  return bytes;
}
export async function deleteCached(reciter: string, ch: number) {
  const vc = await counts(); const c = await caches.open(AYAH_CACHE);
  for (let v = 1; v <= vc[ch - 1]; v++) for (const q of ['hq', 'lite'] as const) for (const u of await ayahUrls(ch, v, reciter, q)) await c.delete(u);
}

// Only one engine at a time: when a full-surah recording starts, the ayah-by-ayah engine steps aside.
subscribePlayer(() => { if (getPlayer().playing && s.active) stopAyahs(); });
