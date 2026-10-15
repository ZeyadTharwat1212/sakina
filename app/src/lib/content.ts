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
export const getAsma = () => load<{ source: string; note: string; names: { ar: string; tr: string; search: string }[] }>('asma/asma.json');
export const getLedger = () => load<{ generatedOn: string; entries: LedgerEntry[] }>('ledger.json');

export const TAFSIRS = [
  { id: 'muyassar', name: 'التفسير الميسر', author: 'مجمع الملك فهد', level: 'مبسط' },
  { id: 'jalalayn', name: 'تفسير الجلالين', author: 'المحلي والسيوطي', level: 'مختصر' },
] as const;

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
