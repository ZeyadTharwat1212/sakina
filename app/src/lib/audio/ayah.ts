/**
 * Ayah-by-ayah playback (section 11b): streams single-ayah files from free archives (everyayah.com, cdn.islamic.network).
 * No timing data needed, works with every listed reciter, supports repeat-per-ayah for memorisation.
 * Nothing is re-hosted; files are cached on the device only when the user asks (Cache Storage).
 */
import { getAyahAudioSources, getChapters } from '../content';
import { getSettings, updateUser } from '../store';
import { pause as pauseMain } from './player';

export interface AyahPlayerState { playing: boolean; ch: number; v: number; from: number; to: number; rep: number; reciter: string; error: string | null; loading: boolean; pos: number; src: string }
let s: AyahPlayerState = { playing: false, ch: 0, v: 0, from: 0, to: 0, rep: 1, reciter: '', error: null, loading: false, pos: 0, src: '' };
const subs = new Set<() => void>();
const set = (p: Partial<AyahPlayerState>) => { s = { ...s, ...p }; subs.forEach((f) => f()); };
export const getAyahPlayer = () => s;
export function subscribeAyahPlayer(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }

let audio: HTMLAudioElement | null = null;
let session = 0;
let verseOffsets: number[] | null = null; // global ayah number = offsets[ch-1] + v
const CACHE = 'sakina-ayah-audio-v1';

async function globalNumber(ch: number, v: number) {
  if (!verseOffsets) { const chs = await getChapters(); let acc = 0; verseOffsets = chs.map((c) => { const o = acc; acc += c.verses; return o; }); }
  return verseOffsets[ch - 1] + v;
}
export async function ayahUrls(ch: number, v: number, reciterId: string): Promise<string[]> {
  const src = await getAyahAudioSources();
  const r = src.reciters.find((x) => x.id === reciterId) || src.reciters[0];
  const urls: string[] = [src.templates.everyayah.replace('{folder}', r.ea).replace('{sss}', String(ch).padStart(3, '0')).replace('{aaa}', String(v).padStart(3, '0'))];
  if (r.in) { const n = String(await globalNumber(ch, v)); urls.push(src.templates.islamicnet.replace('{bitrate}', '128').replace('{edition}', r.in).replace('{n}', n), src.templates.islamicnet.replace('{bitrate}', '64').replace('{edition}', r.in).replace('{n}', n)); }
  return urls;
}
async function sourceFor(urls: string[]): Promise<string> {
  try { const c = await caches.open(CACHE); for (const u of urls) { const hit = await c.match(u); if (hit) return URL.createObjectURL(await hit.blob()); } } catch { /* no cache */ }
  return urls[0];
}
function el() {
  if (!audio) { audio = new Audio(); audio.preload = 'auto'; audio.addEventListener('timeupdate', () => set({ pos: audio!.currentTime, src: audio!.currentSrc })); }
  return audio;
}
/** Play one file, trying fallbacks; resolves when it ends (or rejects on error/stop). */
function playOne(urls: string[], mySession: number): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const a = el();
    let i = 0;
    const tryNext = async () => {
      if (mySession !== session) return reject(new Error('stopped'));
      if (i >= urls.length) return reject(new Error('unavailable'));
      const u = urls[i++];
      a.src = i === 1 ? await sourceFor([u]) : u;
      a.onended = () => resolve();
      a.onerror = () => { void tryNext(); };
      try { await a.play(); } catch (e) { if (mySession === session) void tryNext(); }
    };
    void tryNext();
  });
}

/** Play ayahs from..to of one surah with the chosen reciter, each repeated `rep` times. */
export async function playAyahs(ch: number, from: number, to: number, opts?: { reciter?: string; rep?: number }) {
  const st = getSettings();
  const reciter = opts?.reciter || st.ayahReciter; const rep = Math.max(1, opts?.rep || st.ayahRepeat || 1);
  pauseMain();
  const my = ++session;
  set({ playing: true, loading: true, ch, from, to, v: from, rep, reciter, error: null });
  try {
    for (let v = from; v <= to; v++) {
      for (let k = 0; k < rep; k++) {
        if (my !== session) return;
        set({ v, loading: true });
        const urls = await ayahUrls(ch, v, reciter);
        set({ loading: false });
        await playOne(urls, my);
      }
    }
    if (my === session) { set({ playing: false }); updateUser({ lastListen: { ch, v: to, page: 0, at: Date.now(), kind: 'listen' } }); }
  } catch (e) {
    if (my === session) set({ playing: false, loading: false, error: (e as Error).message === 'unavailable' ? 'تعذّر جلب الملف الصوتي لهذه الآية — تحقق من الاتصال أو اختر قارئًا آخر' : null });
  }
}
export function stopAyahs() { session++; if (audio) { audio.pause(); audio.removeAttribute('src'); } set({ playing: false, loading: false }); }
export function toggleAyahs() { if (!audio) return; if (audio.paused) { void audio.play(); set({ playing: true }); } else { audio.pause(); set({ playing: false }); } }

/** Cache a range of ayahs for offline listening (user-initiated only). */
export async function cacheAyahs(ch: number, from: number, to: number, reciter: string, onProgress?: (done: number, total: number) => void) {
  const c = await caches.open(CACHE);
  for (let v = from; v <= to; v++) {
    const urls = await ayahUrls(ch, v, reciter);
    let ok = false;
    for (const u of urls) { if (await c.match(u)) { ok = true; break; } try { const r = await fetch(u); if (r.ok) { await c.put(u, r); ok = true; break; } } catch { /* next */ } }
    onProgress?.(v - from + 1, to - from + 1);
    if (!ok) throw new Error(`ayah ${ch}:${v}`);
  }
}
