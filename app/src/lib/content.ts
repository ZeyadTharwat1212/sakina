/** Loaders for bundled content packs (public/content). Cached in memory; everything is offline. */

export interface Chapter { id: number; name: string; tr: string; en: string; type: 'meccan' | 'medinan'; verses: number; page: number; juz: number; basmala: boolean }
export interface SurahText { ch: number; basmalaPrefixLen: number; verses: { v: number; t: string }[] }
export interface QuranMeta {
  mushaf: { id: string; name: string; pages: number; riwayah: string };
  pages: [number, number, number, number, number][]; // page, startCh, startV, endCh, endV
  juz: [number, number, number, number, number][];
  sajda: [number, number, string][];
}
export interface PerVerse { ch: number; verses: { v: number; t: string; fn?: string }[] }
export interface AdhkarPack { source: string; categories: { id: number; name: string; items: Dhikr[] }[] }
export interface Dhikr { id: number; text: string; count: number; ref: string | null; note: string | null }
export interface HadithIndex { id: string; title: string; author: string; total: number; chapters: { id: number; ar: string; en: string; count: number }[] }
export interface HadithChapter { chapter: number; hadiths: { id: number; ar: string; narrator: string | null }[] }
export interface LedgerEntry { id: string; kind: string; title: string; author?: string; source: string; licence: string; licenceStatus: string; offlineBundling: string; edition?: string; reviewStatus: string; reviewNotes?: string; upstreamRevision?: string; builtOn: string }

const cache = new Map<string, Promise<unknown>>();
function load<T>(rel: string): Promise<T> {
  if (!cache.has(rel)) {
    cache.set(rel, fetch(`content/${rel}`).then((r) => { if (!r.ok) throw new Error(`content ${rel}: ${r.status}`); return r.json(); }));
  }
  return cache.get(rel) as Promise<T>;
}

export const getChapters = () => load<Chapter[]>('quran/chapters.json');
export const getMeta = () => load<QuranMeta>('quran/meta.json');
export const getSurah = (ch: number) => load<SurahText>(`quran/text/${ch}.json`);
export const getTafsir = (id: string, ch: number) => load<PerVerse>(`quran/tafsir/${id}/${ch}.json`);
export const getTranslation = (id: string, ch: number) => load<PerVerse>(`quran/translation/${id}/${ch}.json`);
export const getSearchIndex = () => load<[number, number, string][]>('quran/search-index.json');
export const getAdhkar = () => load<AdhkarPack>('adhkar/azkar.json');
export const getHadithIndex = (book: string) => load<HadithIndex>(`hadith/${book}/index.json`);
export const getHadithChapter = (book: string, chapter: number) => load<HadithChapter>(`hadith/${book}/${chapter}.json`);
export const getAsma = () => load<{ source: string; note: string; names: { ar: string; tr: string; search: string; meaning?: string }[] }>('asma/asma.json');
export const getLedger = () => load<{ generatedOn: string; entries: LedgerEntry[] }>('ledger.json');

export const TAFSIRS = [
  { id: 'muyassar', name: 'التفسير الميسر', author: 'مجمع الملك فهد', level: 'مبسط' },
  { id: 'jalalayn', name: 'تفسير الجلالين', author: 'المحلي والسيوطي', level: 'مختصر' },
] as const;

/* ---------- Second content pass (scripts/build-extras.mjs) ---------- */
export interface TafsirEntry { id: string; name: string; lang: string; author: string; bundled: boolean; builtin?: boolean; url?: string }
export interface TranslationEntry { id: string; lang: string; name: string; author: string; bundled: boolean; direction?: string; source?: string }
export const getTafsirCatalog = () => load<TafsirEntry[]>('tafsir/catalog.json');
export const getTranslationCatalog = () => load<TranslationEntry[]>('translations/catalog.json');
export const getHadithBooks = () => load<{ id: string; title: string; author: string; total?: number }[]>('hadith/books.json');
/** KFGQPC official Hafs text (v18) with page/line per ayah. */
export const getHafs = (ch: number) => load<{ ch: number; verses: { v: number; t: string; page: number; l1: number; l2: number }[] }>(`quran/hafs/${ch}.json`);
export const getTajweed = (ch: number) => load<Record<string, [number, number, string][]>>(`quran/tajweed/${ch}.json`);
export const getAyahAudioSources = () => load<{ templates: { everyayah: string; islamicnet: string }; reciters: { id: string; ar: string; en: string; in: string | null; ea: string; lite: string; tm?: string; kbps: number; liteKbps: number; riwayah?: string }[] }>('audio/ayah-sources.json');
/** Word timings (quran-align): { [ayah]: [[w0, w1, startMs, endMs], ...] } — w indices are 0-based Tanzil words = QCF position-1. */
export const getWordTimings = (tm: string, ch: number) => load<Record<string, [number, number, number, number][]>>(`audio/word-timings/${tm}/${ch}.json`);

const OFFLINE_CACHE = 'sakina-text-v1';
/** Any tafsir by id: built-in (quran/tafsir), bundled (tafsir/<id>) or on-demand from jsDelivr (cached on device once fetched). */
export async function getTafsirAny(id: string, ch: number): Promise<PerVerse> {
  if (id === 'muyassar' || id === 'jalalayn') return getTafsir(id, ch);
  const cat = await getTafsirCatalog();
  const e = cat.find((x) => x.id === id);
  if (!e) throw new Error('tafsir ' + id);
  if (e.bundled) return load<PerVerse>(`tafsir/${id}/${ch}.json`);
  const url = e.url!.replace('{surah}', String(ch));
  const key = `tafsir:${id}:${ch}`;
  if (!cache.has(key)) cache.set(key, (async () => {
    let r: Response | undefined;
    try { const c = await caches.open(OFFLINE_CACHE); r = await c.match(url) || undefined; } catch { /* no cache API */ }
    if (!r) { r = await fetch(url); if (!r.ok) throw new Error(`${r.status}`); try { const c = await caches.open(OFFLINE_CACHE); await c.put(url, r.clone()); } catch { /* ignore */ } }
    const rows = (await r.json()) as { ayah: number; text: string }[];
    return { ch, verses: rows.map((x) => ({ v: x.ayah, t: x.text })) } as PerVerse;
  })());
  return cache.get(key) as Promise<PerVerse>;
}
/** Download a whole on-demand tafsir for offline use; reports progress. */
export async function downloadTafsir(id: string, onProgress?: (done: number) => void) {
  const cat = await getTafsirCatalog(); const e = cat.find((x) => x.id === id); if (!e || e.bundled) return;
  const c = await caches.open(OFFLINE_CACHE);
  for (let ch = 1; ch <= 114; ch++) { const url = e.url!.replace('{surah}', String(ch)); if (!(await c.match(url))) { const r = await fetch(url); if (r.ok) await c.put(url, r); } onProgress?.(ch); }
}
export async function tafsirOfflineCount(id: string): Promise<number> {
  const cat = await getTafsirCatalog(); const e = cat.find((x) => x.id === id); if (!e || e.bundled) return 114;
  try { const c = await caches.open(OFFLINE_CACHE); let n = 0; for (let ch = 1; ch <= 114; ch++) if (await c.match(e.url!.replace('{surah}', String(ch)))) n++; return n; } catch { return 0; }
}
export const getTranslationAny = (id: string, ch: number) => id === 'en-saheeh' ? getTranslation(id, ch) : load<PerVerse>(`translations/${id}/${ch}.json`);

/* ---------- Mushaf pages (QCF v4) ---------- */
export type MushafWord = [string, 'w' | 'e' | 'h' | 'b' | 'q', string | number | null, 'B' | 0 | undefined, number];
export interface MushafPage { p: number; font: string; surahs: [number, number, number][]; lines: { n: number; w: MushafWord[] }[] }
export const getMushafPage = (p: number) => { const key = `mushaf/pages/${p}`; if (!cache.has(key)) cache.set(key, fetch(`mushaf/pages/${p}.json`).then((r) => { if (!r.ok) throw new Error(`page ${p}: ${r.status}`); return r.json(); })); return cache.get(key) as Promise<MushafPage>; };
export const getMushafVerses = () => { const key = 'mushaf/verses'; if (!cache.has(key)) cache.set(key, fetch('mushaf/verses.json').then((r) => r.json())); return cache.get(key) as Promise<Record<string, { page: number; lines: { line: number; word_start: number; word_end: number }[] }>>; };
const loadedFonts = new Set<string>();
/** Load one QCF4 page font (≈0.8 MB, covers ~13 pages) through the FontFace API; cached by the service worker afterwards. */
export async function ensureMushafFont(name: string): Promise<void> {
  if (loadedFonts.has(name)) return;
  const file = name === 'QCF4_QBSML' ? 'QCF4_QBSML.woff2' : `${name}_W.woff2`;
  const ff = new FontFace(name, `url(fonts/qcf4/${file})`);
  await ff.load();
  (document.fonts as unknown as { add: (f: FontFace) => void }).add(ff);
  loadedFonts.add(name);
}
export async function mushafFontsCached(): Promise<number> {
  try { const keys = await caches.keys(); let n = 0; for (const k of keys) { const c = await caches.open(k); const reqs = await c.keys(); n += reqs.filter((r) => r.url.includes('/fonts/qcf4/')).length; } return n; } catch { return 0; }
}
export async function downloadAllMushafFonts(onProgress?: (done: number, total: number) => void) {
  const names = [...new Set(Object.values(await (await fetch('mushaf/font-map.json')).json() as Record<string, string>)), 'QCF4_QBSML'];
  let i = 0; for (const n of names) { await ensureMushafFont(n); onProgress?.(++i, names.length); }
}

/** Display text of an ayah: the stored text is verbatim Tanzil; the basmala prefix of verse 1 is rendered as a header instead. */
export function ayahDisplay(s: SurahText, v: { v: number; t: string }): string {
  return v.v === 1 && s.basmalaPrefixLen ? v.t.slice(s.basmalaPrefixLen) : v.t;
}
export function basmalaOf(s: SurahText): string | null {
  return s.basmalaPrefixLen ? s.verses[0].t.slice(0, s.basmalaPrefixLen - 1) : null;
}

export function pageOf(meta: QuranMeta, ch: number, v: number): number {
  // pages sorted; find the last page whose start <= (ch, v)
  let lo = 0, hi = meta.pages.length - 1, ans = 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [p, sc, sv] = meta.pages[mid];
    if (sc < ch || (sc === ch && sv <= v)) { ans = p; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
export function juzOf(meta: QuranMeta, ch: number, v: number): number {
  let ans = 1;
  for (const [j, sc, sv] of meta.juz) { if (sc < ch || (sc === ch && sv <= v)) ans = j; else break; }
  return ans;
}
export function isSajda(meta: QuranMeta, ch: number, v: number): string | null {
  const s = meta.sajda.find(([c, vv]) => c === ch && vv === v);
  return s ? s[2] : null;
}

/** Arabic normalisation for search only (section 24) — never applied to displayed text. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '') // harakat, tatweel, quranic marks
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ').trim();
}
