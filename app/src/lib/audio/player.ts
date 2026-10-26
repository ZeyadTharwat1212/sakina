/**
 * Player engine (section 11): queue, repeat (off/one/all/ayah-range when timings exist), seek ±10s, sleep timer,
 * last position per recording+surah, Media Session (lock screen / headset keys), local file first, stream second.
 * Honest sync: ayah highlighting only when the source provides timings for THIS recording.
 */
import { getCatalog, recordingById, fileUrl, getTimings, displayName, hasTimings, timedRecordingFor, refreshTimedReads, type Recording, type AyahTiming, type Catalog } from './catalog';
import { localSource } from './downloads';
import { getUser, updateUser } from '../store';
import { getChapters } from '../content';

export interface Track { recId: string; surah: number }
export interface PlayerState {
  queue: Track[]; index: number; playing: boolean; loading: boolean; error: string | null;
  pos: number; dur: number; rate: number; repeat: 'off' | 'one' | 'all';
  timings: AyahTiming[] | null; currentAyah: number | null; ayahRange: { from: number; to: number } | null; rangeNote: string | null;
  sleepAt: number | null; open: 'none' | 'mini' | 'full'; local: boolean;
}
let s: PlayerState = { queue: [], index: -1, playing: false, loading: false, error: null, pos: 0, dur: 0, rate: 1, repeat: 'off', timings: null, currentAyah: null, ayahRange: null, rangeNote: null, sleepAt: null, open: 'none', local: false };
const subs = new Set<() => void>();
const set = (p: Partial<PlayerState>) => { s = { ...s, ...p }; subs.forEach((f) => f()); };
export const getPlayer = () => s;
export function subscribePlayer(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
export const current = (): Track | null => s.queue[s.index] || null;

let audio: HTMLAudioElement | null = null;
let catalog: Catalog | null = null;
let saveTimer: number | undefined;
let blobUrl: string | null = null;

function el() {
  if (audio) return audio;
  audio = new Audio(); audio.preload = 'metadata';
  audio.addEventListener('play', () => set({ playing: true, error: null }));
  audio.addEventListener('pause', () => set({ playing: false }));
  audio.addEventListener('waiting', () => set({ loading: true }));
  audio.addEventListener('canplay', () => set({ loading: false }));
  audio.addEventListener('durationchange', () => set({ dur: audio!.duration || 0 }));
  audio.addEventListener('timeupdate', onTime);
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('error', () => set({ playing: false, loading: false, error: s.local ? 'تعذّر تشغيل الملف المنزّل — أعد تنزيله' : 'تعذّر تشغيل التلاوة — تحقق من الاتصال، أو نزّل السورة للاستماع دون إنترنت' }));
  // lock-screen controls and metadata: ./nowplaying.ts (one place for both engines)
  return audio;
}

function onTime() {
  const a = audio!; const pos = a.currentTime;
  let currentAyah = s.currentAyah;
  if (s.timings) {
    const ms = pos * 1000;
    const t = s.timings.find((x) => ms >= x.start && ms < x.end);
    currentAyah = t ? t.ayah : currentAyah;
    if (s.ayahRange && t && t.ayah > s.ayahRange.to) {
      // End of the chosen ayahs: loop when repeat is on, otherwise stop at the start of the selection (section 11: play *only* what was chosen).
      const from = s.timings.find((x) => x.ayah === s.ayahRange!.from);
      if (s.repeat === 'off') { a.pause(); if (from) a.currentTime = from.start / 1000; set({ playing: false, currentAyah: s.ayahRange.from }); return; }
      if (from) a.currentTime = from.start / 1000;
    }
  }
  set({ pos, currentAyah });
  if (s.sleepAt && Date.now() >= s.sleepAt) { pause(); set({ sleepAt: null }); }
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { const t = current(); if (t) updateUser((u) => ({ listenPos: { ...(u.listenPos || {}), [`${t.recId}#${t.surah}`]: pos }, lastListen: { ch: t.surah, v: currentAyah || 1, page: 0, at: Date.now(), kind: 'listen' } })); }, 1500);
}
async function onEnded() {
  if (s.repeat === 'one') { el().currentTime = 0; await el().play(); return; }
  if (s.index < s.queue.length - 1) await load(s.index + 1, true);
  else if (s.repeat === 'all' && s.queue.length) await load(0, true);
  else set({ playing: false });
  const t = current(); if (t) updateUser((u) => ({ listenPos: { ...(u.listenPos || {}), [`${t.recId}#${t.surah}`]: 0 } }));
}

async function load(index: number, autoplay: boolean, range?: { from: number; to: number }) {
  catalog ||= await getCatalog();
  const t = s.queue[index]; if (!t) return;
  const rec = recordingById(catalog, t.recId); if (!rec) { set({ error: 'التسجيل غير موجود في الفهرس' }); return; }
  const a = el();
  if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
  const local = await localSource(rec.id, t.surah);
  if (local?.startsWith('blob:')) blobUrl = local;
  a.src = local || fileUrl(rec, t.surah);
  a.playbackRate = s.rate;
  set({ index, pos: 0, dur: 0, timings: null, currentAyah: null, ayahRange: null, rangeNote: null, error: null, loading: true, local: !!local, open: s.open === 'none' ? 'mini' : s.open });
  if (range) {
    // Chosen ayahs: wait for the timings first so playback starts exactly at the first chosen ayah.
    const tm = await getTimings(catalog, rec, t.surah);
    if (current() !== t) return;
    const from = tm?.find((x) => x.ayah === range.from);
    if (tm && from) { set({ timings: tm, ayahRange: range, currentAyah: range.from }); a.currentTime = from.start / 1000; }
    else set({ timings: tm, rangeNote: 'لا تتوفر توقيتات آيات لهذا التسجيل، فلا يمكن تشغيل آيات محددة؛ يُشغَّل من بداية السورة. اختر تسجيلًا آخر (الحصري، العفاسي، المعيقلي… لها توقيتات غالبًا).' });
  } else {
    const saved = getUser().listenPos?.[`${rec.id}#${t.surah}`];
    if (saved && saved > 5) a.currentTime = saved;
    void getTimings(catalog, rec, t.surah).then((tm) => { if (current() === t) set({ timings: tm }); });
  }
  if (autoplay) { try { await a.play(); } catch { set({ loading: false }); } }
}

/* ---------- public API ---------- */
export async function playQueue(tracks: Track[], startIndex = 0) { set({ queue: tracks, open: s.open === 'none' ? 'mini' : s.open }); await load(startIndex, true); }
/** Play only the chosen ayahs of one surah. Needs ayah timings: if the chosen recording has none, switch to another
 *  recording of the same reciter that has them, else to al-Hussary (Hafs, murattal) — and say so in the player. */
export async function playAyahRange(recId: string, surah: number, from: number, to: number) {
  catalog ||= await getCatalog();
  void refreshTimedReads();
  let rec = recordingById(catalog, recId); let note: string | null = null;
  if (rec && !hasTimings(rec)) {
    const alt = timedRecordingFor(catalog, rec.reciterId, rec) || timedRecordingFor(catalog, '118') || catalog.recordings.find(hasTimings) || null;
    if (alt) { note = `تسجيل «${rec.recitationAr || rec.recitation}» بلا توقيتات آيات، فتم التشغيل من ${alt.reciterId === rec.reciterId ? `تسجيل «${alt.recitationAr || alt.recitation}»` : `«${displayName(alt)}»`} الذي يحوي توقيتات.`; rec = alt; }
  }
  if (!rec) return;
  set({ queue: [{ recId: rec.id, surah }], open: s.open === 'none' ? 'mini' : s.open });
  await load(0, true, { from: Math.min(from, to), to: Math.max(from, to) });
  if (note) set({ rangeNote: note });
}
export async function playSurah(recId: string, surah: number, wholeMushaf = true) {
  catalog ||= await getCatalog();
  const rec = recordingById(catalog, recId);
  const list = rec && wholeMushaf ? (rec.complete ? Array.from({ length: 114 }, (_, i) => i + 1) : rec.surahList || [surah]) : [surah];
  const tracks = list.map((n) => ({ recId, surah: n }));
  await playQueue(tracks, Math.max(0, tracks.findIndex((x) => x.surah === surah)));
}
export async function play() { if (s.index < 0 && s.queue.length) return load(0, true); try { await el().play(); } catch { /* error event */ } }
export function pause() { audio?.pause(); }
export async function toggle() { s.playing ? pause() : await play(); }
export async function next() { if (s.index < s.queue.length - 1) await load(s.index + 1, true); }
export async function prev() { if (el().currentTime > 4 || s.index <= 0) { el().currentTime = 0; return; } await load(s.index - 1, true); }
export function seekTo(sec: number) { const a = el(); a.currentTime = Math.max(0, Math.min(sec, a.duration || sec)); }
export function seekBy(delta: number) { seekTo(el().currentTime + delta); }
export function setRate(rate: number) { el().playbackRate = rate; set({ rate }); }
export function setRepeat(r: PlayerState['repeat']) { set({ repeat: r }); }
export function setAyahRange(r: { from: number; to: number } | null) { set({ ayahRange: r, rangeNote: null }); if (r && s.timings) { const t = s.timings.find((x) => x.ayah === r.from); if (t) seekTo(t.start / 1000); } }
export function setSleep(minutes: number | null) { set({ sleepAt: minutes ? Date.now() + minutes * 60000 : null }); }
export function setOpen(o: PlayerState['open']) { set({ open: o }); }
export function stop() { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; } set({ playing: false, open: 'none', queue: [], index: -1, pos: 0, dur: 0, timings: null, currentAyah: null, sleepAt: null }); }
export function removeFromQueue(i: number) { const q = s.queue.filter((_, k) => k !== i); set({ queue: q, index: i < s.index ? s.index - 1 : Math.min(s.index, q.length - 1) }); }
/** For the mushaf follow view: precise position of the full-surah recording (ms) with its ayah timings. */
export function mainClock(): { surah: number; ms: number; playing: boolean; timings: AyahTiming[] | null } | null {
  const t = current(); if (!t || !audio || !audio.src) return null;
  return { surah: t.surah, ms: audio.currentTime * 1000, playing: !audio.paused, timings: s.timings };
}
