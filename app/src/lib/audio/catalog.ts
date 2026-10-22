/**
 * Audio catalogue (section 11): bundled MP3Quran snapshot + optional live refresh.
 * Every recording has a stable id `mp3quran:{reciterId}:{moshafId}`; a file is `{server}{surah:3}.mp3`.
 * We never merge recordings to fake a complete mushaf; `complete` is true only when the source says 114 surahs.
 */
import { Preferences } from '@capacitor/preferences';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface Recording {
  id: string; source: 'mp3quran' | 'quranicaudio'; reciterId: string; moshafId: string;
  name: string; nameAr: string | null; recitation: string; recitationAr?: string;
  server: string; surahTotal: number; complete: boolean; surahList: number[] | null;
  riwayah: string; riwayahAr: string; style: 'murattal' | 'mujawwad' | 'muallim' | 'taraweeh';
  /** QuranicAudio extras: median bitrate, whole-set size, taraweeh year (Hijri) */
  kbps?: number | null; sizeMB?: number | null; year?: string | null;
}
export interface ReciterEntry { id: string; name: string; nameAr: string | null; famous: boolean; recordings: string[]; kind?: 'taraweeh' }
export interface Catalog {
  source: string; fileUrl: string; liveApi: { reciters: string; timing: string };
  recordings: Recording[]; reciters: ReciterEntry[]; famousOrder: string[]; famousMissing: string[];
  refreshedAt?: number; refreshedFrom?: string; version?: number; sources?: string[];
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
  // …and only if it was made from the same catalogue version (v2 added QuranicAudio + Arabic names + exact surah lists)
  cached = stored && stored.source === bundled.source && stored.refreshedAt && (stored.version || 1) === (bundled.version || 1) ? stored : bundled;
  return cached;
}

export const recordingById = (c: Catalog, id: string) => c.recordings.find((r) => r.id === id) || null;
export const recordingsOf = (c: Catalog, reciterId: string) => c.recordings.filter((r) => r.reciterId === reciterId);
export const fileUrl = (rec: Recording, surah: number) => `${rec.server}${String(surah).padStart(3, '0')}.mp3`;
export const displayName = (r: { name: string; nameAr: string | null }) => r.nameAr || r.name;
export const STYLE_AR: Record<string, string> = { murattal: 'مرتّل', mujawwad: 'مجوّد', muallim: 'معلّم', taraweeh: 'تراويح' };
export const SOURCE_AR: Record<string, string> = { mp3quran: 'MP3Quran', quranicaudio: 'QuranicAudio' };

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

export const RIWAYAH_AR: Record<string, string> = {
  hafs: 'حفص عن عاصم', shubah: 'شعبة عن عاصم', warsh: 'ورش عن نافع', qalun: 'قالون عن نافع',
  duri: 'الدوري عن أبي عمرو', susi: 'السوسي عن أبي عمرو', 'duri-kisai': 'الدوري عن الكسائي', 'abul-harith': 'أبو الحارث عن الكسائي',
  bazzi: 'البزي عن ابن كثير', qunbul: 'قنبل عن ابن كثير', 'bazzi-qunbul': 'البزي وقنبل عن ابن كثير',
  'ibn-dhakwan': 'ابن ذكوان عن ابن عامر', hisham: 'هشام عن ابن عامر', khalaf: 'خلف عن حمزة', khallad: 'خلاد عن حمزة',
  yaqub: 'رويس وروح عن يعقوب', 'ibn-jammaz': 'ابن جماز عن أبي جعفر', unknown: 'غير محددة في المصدر',
};
/** Short label for filter pills (the reader's name only). */
export const RIWAYAH_SHORT: Record<string, string> = {
  hafs: 'حفص', shubah: 'شعبة', warsh: 'ورش', qalun: 'قالون', duri: 'الدوري', susi: 'السوسي', 'duri-kisai': 'الدوري (الكسائي)', 'abul-harith': 'أبو الحارث',
  bazzi: 'البزي', qunbul: 'قنبل', 'bazzi-qunbul': 'البزي وقنبل', 'ibn-dhakwan': 'ابن ذكوان', hisham: 'هشام', khalaf: 'خلف', khallad: 'خلاد',
  yaqub: 'يعقوب', 'ibn-jammaz': 'ابن جماز', unknown: 'غير محددة',
};
export const RIWAYAH_EN: Record<string, string> = {
  hafs: 'Hafs', shubah: "Shu'bah", warsh: 'Warsh', qalun: 'Qalun', duri: 'Al-Duri', susi: 'Al-Susi', 'duri-kisai': 'Al-Duri (Kisai)', 'abul-harith': 'Abul-Harith',
  bazzi: 'Al-Bazzi', qunbul: 'Qunbul', 'bazzi-qunbul': 'Bazzi & Qunbul', 'ibn-dhakwan': 'Ibn Dhakwan', hisham: 'Hisham', khalaf: 'Khalaf', khallad: 'Khallad',
  yaqub: "Ya'qub", 'ibn-jammaz': 'Ibn Jammaz', unknown: 'Unspecified',
};
/** Same rules as scripts/enrich-audio.mjs (keep in sync). */
export function riwayahOf(text: string): string {
  const r = text.toLowerCase();
  if (/mojawwad|mujawwad|mo'?lim|muallim|مجود|معلم|almusshaf/.test(r) && !/warsh|qalon|ورش|قالون/.test(r)) return 'hafs';
  if (/albizi and qunbol|البزي وقنبل/.test(r)) return 'bazzi-qunbul';
  if (/dora?i a'n al-kisa|الدوري عن الكسائي/.test(r)) return 'duri-kisai';
  if (/abi al-?haarith|أبو الحارث/.test(r)) return 'abul-harith';
  if (/rowis|rawh|yakoob|يعقوب|رويس/.test(r)) return 'yaqub';
  if (/jammaz|جماز/.test(r)) return 'ibn-jammaz';
  if (/hafs|حفص/.test(r)) return 'hafs';
  if (/warsh|ورش/.test(r)) return 'warsh';
  if (/qalon|qaloon|qalun|قالون/.test(r)) return 'qalun';
  if (/sho'?bah|shu'?bah|شعبة/.test(r)) return 'shubah';
  if (/assosi|soosi|susi|السوسي/.test(r)) return 'susi';
  if (/aldori|al-dori|doori|duri|الدوري/.test(r)) return 'duri';
  if (/albizi|bazzi|البزي/.test(r)) return 'bazzi';
  if (/qunbol|qunbul|قنبل/.test(r)) return 'qunbul';
  if (/thakwan|ذكوان/.test(r)) return 'ibn-dhakwan';
  if (/hesham|hisham|هشام/.test(r)) return 'hisham';
  if (/khallad|خلاد/.test(r)) return 'khallad';
  if (/khalaf|خلف عن/.test(r)) return 'khalaf';
  return 'unknown';
}
function parseRecitationClient(rec: string): { riwayah: string; style: Recording['style'] } {
  const style: Recording['style'] = /mojawwad|mujawwad|مجود|مجوّد/i.test(rec) ? 'mujawwad' : /mo'?lim|moalim|muallim|معلم|معلّم/i.test(rec) ? 'muallim' : 'murattal';
  return { riwayah: riwayahOf(rec), style };
}

/** Which MP3Quran "reads" (moshaf ids) publish ayah timings — fetched live from /ayat_timing/reads and cached;
 *  the baked list (115 ids, verified 2026-10-15) is the offline fallback. */
const TIMED_FALLBACK = '1,3,4,5,6,8,9,10,12,13,14,16,17,20,21,22,24,25,30,31,32,33,38,39,40,42,43,44,46,48,49,50,51,53,54,55,56,58,59,60,61,62,65,66,67,69,70,71,72,74,75,76,77,78,80,81,86,87,88,89,92,106,109,110,112,115,118,119,120,122,123,133,134,135,137,139,159,181,193,198,201,203,208,217,219,221,225,229,232,236,243,244,245,250,256,258,259,265,268,269,270,273,282,288,289,294,295,296,299,300,303,305,314,340,10905'.split(',');
let timedReads: Set<string> | null = null;
export function timedReadsSync(): Set<string> {
  if (timedReads) return timedReads;
  try { const j = JSON.parse(localStorage.getItem('sakina.timedReads') || 'null'); if (Array.isArray(j) && j.length) { timedReads = new Set(j.map(String)); return timedReads; } } catch { /* ignore */ }
  timedReads = new Set(TIMED_FALLBACK); return timedReads;
}
export async function refreshTimedReads(): Promise<Set<string>> {
  try {
    const j = (await fetchJson('https://mp3quran.net/api/v3/ayat_timing/reads')) as { id: number }[];
    if (Array.isArray(j) && j.length > 50) { timedReads = new Set(j.map((r) => String(r.id))); try { localStorage.setItem('sakina.timedReads', JSON.stringify([...timedReads])); } catch { /* ignore */ } }
  } catch { /* keep fallback */ }
  return timedReadsSync();
}
export const hasTimings = (rec: Recording) => rec.source === 'mp3quran' && timedReadsSync().has(String(rec.moshafId));
/** Best recording with ayah timings for a reciter (prefer the same riwayah/style as `like`, then Hafs murattal). */
export function timedRecordingFor(c: Catalog, reciterId: string, like?: Recording | null): Recording | null {
  const list = recordingsOf(c, reciterId).filter(hasTimings);
  if (!list.length) return null;
  return list.find((r) => like && r.riwayah === like.riwayah && r.style === like.style) || list.find((r) => r.riwayah === 'hafs' && r.style === 'murattal') || list.find((r) => r.riwayah === 'hafs') || list[0];
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
