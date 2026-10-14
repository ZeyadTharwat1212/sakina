/**
 * Audio catalogue (section 11): bundled MP3Quran snapshot + optional live refresh.
 * Every recording has a stable id `mp3quran:{reciterId}:{moshafId}`; a file is `{server}{surah:3}.mp3`.
 * We never merge recordings to fake a complete mushaf; `complete` is true only when the source says 114 surahs.
 */
import { Preferences } from '@capacitor/preferences';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface Recording {
  id: string; source: 'mp3quran'; reciterId: string; moshafId: string;
  name: string; nameAr: string | null; recitation: string; recitationAr?: string;
  server: string; surahTotal: number; complete: boolean; surahList: number[] | null;
  riwayah: string; riwayahAr: string; style: 'murattal' | 'mujawwad' | 'muallim';
}
export interface ReciterEntry { id: string; name: string; nameAr: string | null; famous: boolean; recordings: string[] }
export interface Catalog {
  source: string; fileUrl: string; liveApi: { reciters: string; timing: string };
  recordings: Recording[]; reciters: ReciterEntry[]; famousOrder: string[]; famousMissing: string[];
  refreshedAt?: number; refreshedFrom?: string;
}

const KEY = 'sakina.catalog';
let cached: Catalog | null = null;
const native = Capacitor.isNativePlatform();

async function readCache(): Promise<Catalog | null> {
  try {
    const raw = native ? (await Preferences.get({ key: KEY })).value : localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Catalog) : null;
  } catch { return null; }
}
async function writeCache(c: Catalog) {
  const raw = JSON.stringify(c);
  try { if (native) await Preferences.set({ key: KEY, value: raw }); else localStorage.setItem(KEY, raw); } catch { /* quota: keep in memory */ }
}

export async function getCatalog(): Promise<Catalog> {
  if (cached) return cached;
  const bundled = (await fetch('content/audio/catalog.json').then((r) => r.json())) as Catalog;
  const stored = await readCache();
  // A stored refresh wins only if it is newer than the bundle and has the same source
  cached = stored && stored.source === bundled.source && stored.refreshedAt ? stored : bundled;
  return cached;
}

export const recordingById = (c: Catalog, id: string) => c.recordings.find((r) => r.id === id) || null;
export const recordingsOf = (c: Catalog, reciterId: string) => c.recordings.filter((r) => r.reciterId === reciterId);
export const fileUrl = (rec: Recording, surah: number) => `${rec.server}${String(surah).padStart(3, '0')}.mp3`;
export const displayName = (r: { name: string; nameAr: string | null }) => r.nameAr || r.name;
export const STYLE_AR: Record<string, string> = { murattal: 'مرتّل', mujawwad: 'مجوّد', muallim: 'معلّم' };

/** Which surahs a recording provides. null surahList + complete → all 114; partial without list → unknown (shown honestly). */
export function surahStatusKnown(rec: Recording): boolean { return rec.complete || !!rec.surahList; }
export function hasSurah(rec: Recording, surah: number): boolean | null {
  if (rec.complete) return true;
  if (rec.surahList) return rec.surahList.includes(surah);
  return null; // unknown until the live catalogue supplies surah_list
}

/** Normalise names so "Mahmoud Khalil Al-Hussary" ~ "Mahmood Khaleel Alhusary" never becomes two reciters. */
export function normName(s: string) {
  return s.toLowerCase().replace(/\bal[- ]?/g, '').replace(/ou|oo/g, 'u').replace(/ee/g, 'i').replace(/[^a-z؀-ۿ]/g, '').replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا');
}

interface LiveMoshaf { id: number; name: string; server: string; surah_total: number; moshaf_type: number; surah_list: string }
interface LiveReciter { id: number; name: string; letter: string; moshaf: LiveMoshaf[] }

async function fetchJson(url: string): Promise<unknown> {
  if (native) { const r = await CapacitorHttp.get({ url, connectTimeout: 15000, readTimeout: 20000 }); if (r.status !== 200) throw new Error(`HTTP ${r.status}`); return r.data; }
  const r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}

/** Refresh from the live API (Arabic names, surah lists, new reciters). Never deletes user files or choices. */
export async function refreshCatalog(): Promise<{ ok: boolean; added: number; updated: number; error?: string }> {
  const base = await getCatalog();
  try {
    const [ar, en] = await Promise.all([fetchJson(base.liveApi.reciters) as Promise<{ reciters: LiveReciter[] }>, fetchJson(base.liveApi.reciters.replace('language=ar', 'language=eng')) as Promise<{ reciters: LiveReciter[] }>]);
    const enById = new Map(en.reciters.map((r) => [String(r.id), r]));
    const byId = new Map(base.recordings.map((r) => [r.id, r]));
    let added = 0, updated = 0;
    const reciters = new Map(base.reciters.map((r) => [r.id, { ...r, recordings: [...r.recordings] }]));
    for (const lr of ar.reciters) {
      const rid = String(lr.id);
      const enR = enById.get(rid);
      for (const m of lr.moshaf) {
        const id = `mp3quran:${rid}:${m.id}`;
        const surahList = m.surah_list ? m.surah_list.split(',').map(Number).filter((n) => n >= 1 && n <= 114) : null;
        const enM = enR?.moshaf.find((x) => x.id === m.id);
        const existing = byId.get(id);
        const recitationEn = enM?.name || existing?.recitation || m.name;
        const parsed = parseRecitationClient(recitationEn + ' ' + m.name);
        const rec: Recording = {
          id, source: 'mp3quran', reciterId: rid, moshafId: String(m.id),
          name: enR?.name || existing?.name || lr.name, nameAr: lr.name, recitation: recitationEn, recitationAr: m.name,
          server: m.server, surahTotal: m.surah_total, complete: m.surah_total === 114 && (!surahList || surahList.length === 114),
          surahList, riwayah: existing?.riwayah && existing.riwayah !== 'unknown' ? existing.riwayah : parsed.riwayah, riwayahAr: RIWAYAH_AR[existing?.riwayah && existing.riwayah !== 'unknown' ? existing.riwayah : parsed.riwayah], style: parsed.style,
        };
        if (existing) updated++; else added++;
        byId.set(id, rec);
        const re = reciters.get(rid) || { id: rid, name: rec.name, nameAr: rec.nameAr, famous: base.famousOrder.includes(rid), recordings: [] };
        re.nameAr = lr.name; if (!re.recordings.includes(id)) re.recordings.push(id);
        reciters.set(rid, re);
      }
    }
    cached = { ...base, recordings: [...byId.values()], reciters: [...reciters.values()], refreshedAt: Date.now(), refreshedFrom: base.liveApi.reciters };
    await writeCache(cached);
    return { ok: true, added, updated };
  } catch (e) {
    return { ok: false, added: 0, updated: 0, error: String((e as Error)?.message || e) };
  }
}

const RIWAYAH_AR: Record<string, string> = { hafs: 'حفص عن عاصم', warsh: 'ورش عن نافع', qalun: 'قالون عن نافع', duri: 'الدوري عن أبي عمرو', bazzi: 'البزي عن ابن كثير', qunbul: 'قنبل عن ابن كثير', shubah: 'شعبة عن عاصم', khalaf: 'خلف عن حمزة', khallad: 'خلاد عن حمزة', susi: 'السوسي عن أبي عمرو', 'ibn-dhakwan': 'ابن ذكوان عن ابن عامر', hisham: 'هشام عن ابن عامر', unknown: 'غير محددة في المصدر' };
function parseRecitationClient(rec: string): { riwayah: string; style: Recording['style'] } {
  const r = rec.toLowerCase();
  const riwayah = /hafs|حفص/.test(r) ? 'hafs' : /warsh|ورش/.test(r) ? 'warsh' : /qalon|qaloon|qalun|قالون/.test(r) ? 'qalun' : /aldori|al-dori|douri|duri|الدوري/.test(r) ? 'duri' : /bazzi|البزي/.test(r) ? 'bazzi' : /qunbul|قنبل/.test(r) ? 'qunbul' : /shu'?bah|shoba|شعبة/.test(r) ? 'shubah' : /khallad|خلاد/.test(r) ? 'khallad' : /khalaf|خلف/.test(r) ? 'khalaf' : /soosi|susi|السوسي/.test(r) ? 'susi' : /thakwan|ذكوان/.test(r) ? 'ibn-dhakwan' : /hisham|هشام/.test(r) ? 'hisham' : 'unknown';
  const style: Recording['style'] = /mojawwad|mujawwad|مجود|مجوّد/.test(r) ? 'mujawwad' : /mo'?lim|moalim|muallim|معلم|معلّم/.test(r) ? 'muallim' : 'murattal';
  return { riwayah, style };
}

/** Ayah timings for a recording+surah (only some recordings have them). Cached per session. */
export interface AyahTiming { ayah: number; start: number; end: number }
const timingCache = new Map<string, AyahTiming[] | null>();
export async function getTimings(c: Catalog, rec: Recording, surah: number): Promise<AyahTiming[] | null> {
  const key = `${rec.id}:${surah}`;
  if (timingCache.has(key)) return timingCache.get(key)!;
  try {
    const url = c.liveApi.timing.replace('{surah}', String(surah)).replace('{moshafId}', rec.moshafId);
    const data = (await fetchJson(url)) as { ayah: number; start_time: number; end_time: number }[];
    const list = Array.isArray(data) ? data.filter((t) => t.ayah > 0 && t.end_time > t.start_time).map((t) => ({ ayah: t.ayah, start: t.start_time, end: t.end_time })) : [];
    const ok = list.length > 0 ? list : null;
    timingCache.set(key, ok);
    return ok;
  } catch { timingCache.set(key, null); return null; }
}
