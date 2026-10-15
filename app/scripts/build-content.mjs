#!/usr/bin/env node
/**
 * build-content.mjs — builds Sakina's offline content packs from licensed upstream snapshots.
 *
 * Usage:  SOURCES_DIR=/path/to/sources node scripts/build-content.mjs
 *
 * Expected SOURCES_DIR layout (each is a git clone / checkout):
 *   qj/        github.com/risan/quran-json        (data/tanzil/*.json, data/meta/sources.json, data/audio/mp3quran.json, data/quranenc/english_saheeh.json)
 *   qapi/      github.com/fawazahmed0/quran-api @1 (info.json, editions/ara-jalaladdinalmah.json, editions/ara-kingfahadquranc.json)
 *   azkardb/   github.com/osamayy/azkar-db          (azkar.json)
 *   hadith/    github.com/AhmedBaset/hadith-json    (db/by_book/the_9_books/bukhari.json, muslim.json, db/by_book/forties/nawawi40.json)
 *
 * Principles (from the master prompt, sections 07, 12, 22, 34):
 *   - Religious source text is copied VERBATIM. We never edit an ayah, hadith or dhikr.
 *   - Every pack carries a ledger entry: source, licence, upstream revision, review status, date.
 *   - Nothing here is "scholar-reviewed" unless the ledger says who reviewed it and when.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SRC = process.env.SOURCES_DIR;
if (!SRC) { console.error('Set SOURCES_DIR'); process.exit(1); }
const OUT = path.resolve(process.cwd(), 'public/content');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const rj = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const wj = (rel, obj) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj));
};
const rev = (dir) => { try { return execSync('git rev-parse HEAD', { cwd: path.join(SRC, dir) }).toString().trim(); } catch { return 'unknown'; } };
const today = new Date().toISOString().slice(0, 10);

const ledger = [];
const addLedger = (e) => ledger.push({ builtOn: today, ...e });

/* ------------------------------------------------------------------ */
/* 1. Quran text — Tanzil Uthmani (Hafs ʿan ʿĀṣim), verbatim            */
/* ------------------------------------------------------------------ */
const uth = rj(path.join(SRC, 'qj/data/tanzil/uthmani.json'));
// The basmala is taken verbatim from 1:1 so the comparison uses Tanzil's exact code-point order.
const BASMALA = uth['1'][0].text;
const chaptersRaw = rj(path.join(SRC, 'qj/data/tanzil/chapters.json'));
const chapters = Array.isArray(chaptersRaw) ? Object.fromEntries(chaptersRaw).chapters : chaptersRaw.chapters;

const info = rj(path.join(SRC, 'qapi/info.json'));
const pageRefs = info.pages.references; // 604 Madani pages
const juzRefs = info.juzs.references;
const sajdaRefs = info.sajdas.references;

let totalVerses = 0;
const chapterOut = [];
for (const ch of chapters) {
  const verses = uth[String(ch.id)];
  if (!verses || verses.length !== ch.total_verses) throw new Error(`Verse count mismatch for surah ${ch.id}`);
  totalVerses += verses.length;
  // Tanzil prepends the basmala to verse 1 of every surah except 1 and 9. We keep the stored
  // text verbatim and only record the fact, so the UI can render the basmala as a header.
  const v1 = verses[0].text;
  // Surahs 95 and 97 follow surahs ending in ب, so the Madani print shows the basmala's ب with
  // an idgham shadda (بِّسْمِ). Tanzil keeps that; we accept both forms.
  const BASMALA_SHADDA = BASMALA.slice(0, 1) + 'ّ' + BASMALA.slice(1);
  const prefix = v1.startsWith(BASMALA + ' ') ? BASMALA : v1.startsWith(BASMALA_SHADDA + ' ') ? BASMALA_SHADDA : null;
  const hasBasmalaPrefix = ch.id !== 1 && ch.id !== 9 && prefix !== null;
  if (ch.id !== 1 && ch.id !== 9 && !hasBasmalaPrefix) throw new Error(`Expected basmala prefix in ${ch.id}:1`);
  if (ch.id === 9 && v1.startsWith(BASMALA)) throw new Error('Surah 9 must not start with basmala');
  const infoCh = info.chapters[ch.id - 1];
  chapterOut.push({
    id: ch.id,
    name: ch.name,
    tr: ch.transliteration,
    en: ch.translation,
    type: ch.type,
    verses: ch.total_verses,
    page: infoCh.verses[0].page,
    juz: infoCh.verses[0].juz,
    basmala: hasBasmalaPrefix,
  });
  wj(`quran/text/${ch.id}.json`, {
    ch: ch.id,
    basmalaPrefixLen: hasBasmalaPrefix ? prefix.length + 1 : 0,
    verses: verses.map((v) => ({ v: v.verse, t: v.text })),
  });
}
if (totalVerses !== 6236) throw new Error(`Expected 6236 verses, got ${totalVerses}`);
wj('quran/chapters.json', chapterOut);
wj('quran/meta.json', {
  mushaf: { id: 'madani-604', name: 'مصحف المدينة النبوية (604 صفحة)', pages: pageRefs.length, riwayah: 'حفص عن عاصم' },
  pages: pageRefs.map((p) => [p.page, p.start.chapter, p.start.verse, p.end.chapter, p.end.verse]),
  juz: juzRefs.map((j) => [j.juz, j.start.chapter, j.start.verse, j.end.chapter, j.end.verse]),
  sajda: sajdaRefs.map((s) => [s.chapter, s.verse, s.obligatory ? 'obligatory' : 'recommended']),
});
// Search index: Tanzil simple-clean (no diacritics) — separate from the display text.
const clean = rj(path.join(SRC, 'qj/data/tanzil/simple-clean.json'));
const searchRows = [];
for (const ch of chapters) for (const v of clean[String(ch.id)]) searchRows.push([ch.id, v.verse, v.text]);
wj('quran/search-index.json', searchRows);

const tanzilSources = rj(path.join(SRC, 'qj/data/meta/sources.json'));
const tz = tanzilSources.find((s) => s.path === 'data/tanzil/uthmani.json');
addLedger({
  id: 'quran-text-uthmani-hafs',
  kind: 'quran-text',
  title: 'القرآن الكريم — نص عثماني، رواية حفص عن عاصم',
  source: 'Tanzil Project (tanzil.net) via github.com/risan/quran-json',
  upstreamRevision: rev('qj'),
  upstreamSha256: tz?.sha256,
  licence: 'Creative Commons Attribution 3.0 — verbatim copies only, no modification (tanzil.net/docs/text_license)',
  licenceStatus: 'granted',
  offlineBundling: 'allowed (verbatim, with attribution shown in app)',
  reviewStatus: 'automated-integrity-checks-only',
  reviewNotes: '6236 ayat / 114 surah verified; basmala rule verified for 1 and 9. Visual rendering review on devices still required (section 38).',
});
addLedger({
  id: 'quran-page-map-madani-604',
  kind: 'mushaf-page-map',
  title: 'خريطة صفحات مصحف المدينة (604) والأجزاء والسجدات',
  source: 'github.com/fawazahmed0/quran-api (info.json)',
  upstreamRevision: rev('qapi'),
  licence: 'Unlicense (public domain dedication by repo author); page boundaries are facts of the standard Madani layout',
  licenceStatus: 'granted',
  offlineBundling: 'allowed',
  reviewStatus: 'spot-checked',
  reviewNotes: 'Checked 2:142→p22, 18:1→p293, 114→p604. Full page-by-page verification against a printed Madani mushaf pending. No hizb-quarter data in this source.',
});
addLedger({
  id: 'quran-search-index',
  kind: 'derived-index',
  title: 'فهرس بحث (نص مبسط بلا تشكيل)',
  source: 'Tanzil simple-clean via risan/quran-json',
  licence: 'CC BY 3.0 (Tanzil) — index only, never displayed as Quran text',
  licenceStatus: 'granted',
  offlineBundling: 'allowed',
  reviewStatus: 'n/a (derived)',
});

/* ------------------------------------------------------------------ */
/* 2. Tafsir — al-Jalalayn and al-Muyassar (Arabic), per ayah           */
/* ------------------------------------------------------------------ */
function tafsirPack(file, id, title, author, notes) {
  const ed = rj(path.join(SRC, `qapi/editions/${file}.json`)).quran;
  const byCh = {};
  for (const r of ed) (byCh[r.chapter] ||= []).push({ v: r.verse, t: r.text });
  for (const ch of chapters) {
    if (!byCh[ch.id] || byCh[ch.id].length !== ch.total_verses) throw new Error(`${id}: coverage mismatch in ${ch.id}`);
    wj(`quran/tafsir/${id}/${ch.id}.json`, { ch: ch.id, verses: byCh[ch.id] });
  }
  addLedger({
    id: `tafsir-${id}`,
    kind: 'tafsir',
    title,
    author,
    source: `Tanzil translations collection (tanzil.net/trans) via github.com/fawazahmed0/quran-api (${file})`,
    upstreamRevision: rev('qapi'),
    licence: 'Tanzil translation terms: free redistribution with attribution, unmodified. Classical text itself is public domain.',
    licenceStatus: 'granted-attribution-required',
    offlineBundling: 'allowed',
    edition: 'الطبعة/التحقيق غير مذكورين في المصدر الرقمي',
    reviewStatus: 'not-scholar-reviewed',
    reviewNotes: notes,
  });
}
tafsirPack('ara-jalaladdinalmah', 'jalalayn', 'تفسير الجلالين', 'جلال الدين المحلي وجلال الدين السيوطي',
  'Per-ayah coverage complete (6236). Edition/tahqiq must be identified and spot-checked by a reviewer before the app labels it with an edition.');
tafsirPack('ara-kingfahadquranc', 'muyassar', 'التفسير الميسر', 'مجمع الملك فهد لطباعة المصحف الشريف',
  'Per-ayah coverage complete (6236). Compare a sample against the printed KFGQPC edition before release.');

/* ------------------------------------------------------------------ */
/* 3. English translation — Saheeh International (QuranEnc)             */
/* ------------------------------------------------------------------ */
{
  const tr = rj(path.join(SRC, 'qj/data/quranenc/english_saheeh.json'));
  const byCh = {};
  for (const [c, list] of Object.entries(tr)) {
    byCh[Number(c)] = list.map((r) => ({ v: Number(r.verse), t: r.text, fn: r.footnotes || undefined }));
  }
  let ok = true;
  for (const ch of chapters) {
    if (!byCh[ch.id] || byCh[ch.id].length !== ch.total_verses) { ok = false; break; }
    wj(`quran/translation/en-saheeh/${ch.id}.json`, { ch: ch.id, verses: byCh[ch.id] });
  }
  const meta = tanzilSources.find((s) => s.path === 'data/quranenc/english_saheeh.json');
  addLedger({
    id: 'translation-en-saheeh',
    kind: 'translation',
    title: 'Saheeh International (English)',
    source: `QuranEnc.com (${meta?.source || 'english_saheeh'}) via risan/quran-json`,
    upstreamRevision: rev('qj'),
    licence: meta?.license || 'QuranEnc republication terms (verbatim, credit, version shown)',
    licenceStatus: ok ? 'granted-conditions' : 'coverage-error',
    offlineBundling: 'allowed with credit and version',
    reviewStatus: 'coverage-verified',
  });
}

/* ------------------------------------------------------------------ */
/* 4. Adhkar — azkar-db (Hisn al-Muslim derived)                          */
/* ------------------------------------------------------------------ */
{
  const az = rj(path.join(SRC, 'azkardb/azkar.json'));
  const cols = az.columns.map((c) => c.name);
  const rows = az.rows.map((r) => Object.fromEntries(r.map((x, i) => [cols[i], x])));
  const cats = [];
  const catMap = new Map();
  let id = 0, withRef = 0;
  for (const r of rows) {
    if (!catMap.has(r.category)) { catMap.set(r.category, { id: cats.length + 1, name: r.category, items: [] }); cats.push(catMap.get(r.category)); }
    const ref = (r.reference || '').trim();
    if (ref) withRef++;
    catMap.get(r.category).items.push({
      id: ++id,
      text: r.zekr,
      count: Number(r.count) || 1,
      ref: ref || null,
      note: (r.description || '').trim() || null,
    });
  }
  wj('adhkar/azkar.json', { source: 'azkar-db', categories: cats });
  addLedger({
    id: 'adhkar-hisn-azkardb',
    kind: 'adhkar',
    title: 'الأذكار والأدعية (مستند إلى حصن المسلم)',
    source: 'github.com/osamayy/azkar-db (azkar.json)',
    upstreamRevision: rev('azkardb'),
    licence: 'Repo states: no licence restrictions, free to use ("بدون رخصة استخدام، يحق لك فعل ما تريد بها")',
    licenceStatus: 'granted',
    offlineBundling: 'allowed',
    reviewStatus: 'not-scholar-reviewed',
    reviewNotes: `${rows.length} entries in ${cats.length} categories; takhrij reference present on ${withRef}/${rows.length}. Counts and references must be verified against حصن المسلم (القحطاني) with hadith numbers before the app may label the pack as reviewed.`,
  });
}

/* ------------------------------------------------------------------ */
/* 5. Hadith — Sahih al-Bukhari, Sahih Muslim (Arabic), Nawawi 40        */
/* ------------------------------------------------------------------ */
function hadithPack(file, id, title, author, extraNotes) {
  const b = rj(path.join(SRC, `hadith/db/by_book/${file}.json`));
  const chapters = b.chapters.map((c) => ({ id: c.id, ar: c.arabic, en: c.english, count: 0 }));
  const byChapter = {};
  for (const h of b.hadiths) {
    (byChapter[h.chapterId] ||= []).push({ id: h.idInBook, ar: h.arabic, narrator: h.english?.narrator || null });
  }
  for (const c of chapters) c.count = (byChapter[c.id] || []).length;
  wj(`hadith/${id}/index.json`, { id, title, author, total: b.hadiths.length, chapters });
  for (const [cid, list] of Object.entries(byChapter)) wj(`hadith/${id}/${cid}.json`, { chapter: Number(cid), hadiths: list });
  addLedger({
    id: `hadith-${id}`,
    kind: 'hadith',
    title,
    author,
    source: 'github.com/AhmedBaset/hadith-json (scraped from sunnah.com)',
    upstreamRevision: rev('hadith'),
    licence: 'Arabic matn is classical public-domain text; the digital compilation was scraped from sunnah.com — sunnah.com\'s redistribution permission for bulk data has NOT been confirmed. English translations deliberately excluded (copyrighted).',
    licenceStatus: 'needs-confirmation',
    offlineBundling: 'bundled for development only — confirm with sunnah.com or replace with a licensed edition before store release',
    edition: 'ترقيم sunnah.com (غير مؤكد مقابل طبعة ورقية محددة)',
    reviewStatus: 'not-scholar-reviewed',
    reviewNotes: `${b.hadiths.length} entries, ${chapters.length} books/kutub. ${extraNotes}`,
  });
}
hadithPack('the_9_books/bukhari', 'bukhari', 'صحيح البخاري', 'الإمام محمد بن إسماعيل البخاري',
  'Count differs from the 7563 of the Fath al-Bari numbering; completeness vs a named edition must be audited before the app may call this book complete (section 22).');
hadithPack('the_9_books/muslim', 'muslim', 'صحيح مسلم', 'الإمام مسلم بن الحجاج النيسابوري',
  'Numbering/edition unknown; audit completeness against a named edition before release.');
hadithPack('forties/nawawi40', 'nawawi40', 'الأربعون النووية', 'الإمام يحيى بن شرف النووي', 'Phase-2 content; included for structure testing.');

/* ------------------------------------------------------------------ */
/* 6. Reciters catalogue — MP3Quran (streaming; user-initiated download)   */
/* ------------------------------------------------------------------ */
// Famous reciters (section target list) → MP3Quran reciter ids, matched by hand against the English catalogue names.
const FAMOUS = [
  [118, 'محمود خليل الحصري'], [112, 'محمد صديق المنشاوي'], [51, 'عبد الباسط عبد الصمد'], [125, 'مصطفى إسماعيل'],
  [121, 'محمود علي البنا'], [241, 'محمد رفعت'], [106, 'محمد محمود الطبلاوي'], [109, 'محمد أيوب'], [76, 'علي جابر'],
  [123, 'مشاري راشد العفاسي'], [54, 'عبد الرحمن السديس'], [31, 'سعود الشريم'], [102, 'ماهر المعيقلي'], [92, 'ياسر الدوسري'],
  [30, 'سعد الغامدي'], [5, 'أحمد العجمي'], [74, 'علي الحذيفي'], [60, 'عبد الله بصفر'], [4, 'أبو بكر الشاطري'], [81, 'فارس عباد'],
  [86, 'ناصر القطامي'], [20, 'خالد الجليل'], [12, 'إدريس أبكر'], [89, 'هاني الرفاعي'], [225, 'عبد الرحمن العوسي'],
  [64, 'عبد الرشيد صوفي'], [138, 'نورين محمد صديق'], [267, 'عبد الله كامل'], [231, 'هزاع البلوشي'], [221, 'رعد الكردي'],
  [253, 'إسلام صبحي'], [259, 'أحمد النفيس'], [111, 'محمد جبريل'],
];
function parseRecitation(rec) {
  const r = rec.toLowerCase();
  const riwayah = /hafs/.test(r) ? 'hafs' : /warsh/.test(r) ? 'warsh' : /qalon|qaloon|qalun/.test(r) ? 'qalun' : /aldori|al-dori|douri|duri/.test(r) ? 'duri' : /albazzi|bazzi/.test(r) ? 'bazzi' : /qunbul/.test(r) ? 'qunbul' : /shu'?bah|shoba/.test(r) ? 'shubah' : /khalaf/.test(r) ? 'khalaf' : /khallad/.test(r) ? 'khallad' : /alsoosi|soosi|susi/.test(r) ? 'susi' : /ibn thakwan|thakwan/.test(r) ? 'ibn-dhakwan' : /hisham/.test(r) ? 'hisham' : 'unknown';
  const style = /mojawwad|mujawwad/.test(r) ? 'mujawwad' : /mo'?lim|moalim|muallim/.test(r) ? 'muallim' : 'murattal';
  return { riwayah, style };
}
const RIWAYAH_AR = { hafs: 'حفص عن عاصم', warsh: 'ورش عن نافع', qalun: 'قالون عن نافع', duri: 'الدوري عن أبي عمرو', bazzi: 'البزي عن ابن كثير', qunbul: 'قنبل عن ابن كثير', shubah: 'شعبة عن عاصم', khalaf: 'خلف عن حمزة', khallad: 'خلاد عن حمزة', susi: 'السوسي عن أبي عمرو', 'ibn-dhakwan': 'ابن ذكوان عن ابن عامر', hisham: 'هشام عن ابن عامر', unknown: 'غير محددة في المصدر' };
{
  const mp = rj(path.join(SRC, 'qj/data/audio/mp3quran.json'));
  const famousMap = new Map(FAMOUS.map(([id, ar]) => [String(id), ar]));
  const recordings = (mp.reciters || mp).map((r) => {
    const [reciterId, moshafId] = String(r.id).split('-');
    const { riwayah, style } = parseRecitation(r.recitation);
    return {
      id: `mp3quran:${reciterId}:${moshafId}`, source: 'mp3quran', reciterId, moshafId,
      name: r.name, nameAr: famousMap.get(reciterId) || null, recitation: r.recitation,
      server: r.server, surahTotal: r.surah_total, complete: r.surah_total === 114,
      surahList: null, // filled by the live catalogue refresh (API field surah_list); null = unknown for partial sets
      riwayah, riwayahAr: RIWAYAH_AR[riwayah], style,
    };
  });
  const reciters = {};
  for (const rec of recordings) (reciters[rec.reciterId] ||= { id: rec.reciterId, name: rec.name, nameAr: rec.nameAr, famous: famousMap.has(rec.reciterId), recordings: [] }).recordings.push(rec.id);
  const missing = FAMOUS.filter(([id]) => !reciters[String(id)]).map(([, ar]) => ar);
  wj('audio/catalog.json', {
    source: 'mp3quran', snapshotOf: 'https://mp3quran.net/api/v3/reciters?language=eng', fileUrl: '{server}{surah:3}.mp3',
    liveApi: { reciters: 'https://mp3quran.net/api/v3/reciters?language=ar', timing: 'https://mp3quran.net/api/v3/ayat_timing?surah={surah}&read={moshafId}' },
    recordings, reciters: Object.values(reciters), famousOrder: FAMOUS.map(([id]) => String(id)), famousMissing: missing,
  });
  const meta = tanzilSources.find((s) => s.path === 'data/audio/mp3quran.json');
  addLedger({
    id: 'audio-mp3quran-catalogue', kind: 'audio-catalogue', title: 'فهرس القراء والتسجيلات (MP3Quran)',
    source: 'mp3quran.net API v3 (snapshot via risan/quran-json) + live refresh from the app', upstreamRevision: rev('qj'),
    licence: meta?.license || 'No written redistribution licence published by mp3quran.net.',
    licenceStatus: 'streaming-and-user-download-per-site-function',
    offlineBundling: 'Catalogue bundled. Audio files are never bundled or re-hosted; the app streams from mp3quran servers and lets the USER download to their own device (the same function mp3quran.net offers on its site). Re-hosting on a private server is NOT permitted without written consent.',
    reviewStatus: 'n/a',
    reviewNotes: `${recordings.length} recordings / ${Object.keys(reciters).length} reciters; ${FAMOUS.length - missing.length}/${FAMOUS.length} famous reciters matched by id; missing: ${missing.join(', ') || 'none'}. Ayah timings exist only for some recordings (live API); otherwise no ayah sync is shown.`,
  });
}

/* 6b. Asmaa al-Husna (names only; meanings deferred to scholar review) */
{
  const a = rj(path.resolve('scripts/data/asma.json'));
  wj('asma/asma.json', a);
  addLedger({ id: 'asma-al-husna-names', kind: 'reference-list', title: 'أسماء الله الحسنى (الأسماء فقط)', source: 'التعداد المشهور في رواية الترمذي (مكتوب يدويًا في scripts/data/asma.json)', licence: 'n/a (أسماء)', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'not-scholar-reviewed', reviewNotes: 'لا معاني مضمّنة؛ تُضاف بعد مراجعة من مصدر معتمد. الخلاف في التعداد مذكور في الشاشة.' });
}

/* ------------------------------------------------------------------ */
/* 7. Fonts                                                            */
/* ------------------------------------------------------------------ */
addLedger({ id: 'font-amiri-quran', kind: 'font', title: 'Amiri Quran 1.001', source: 'github.com/aliftype/amiri', licence: 'SIL Open Font License 1.1', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'n/a', reviewNotes: 'Used for Quran text only (section 04: the Quran font is not the UI font).' });
addLedger({ id: 'font-noto-sans-arabic', kind: 'font', title: 'Noto Sans Arabic (variable)', source: 'github.com/google/fonts (ofl/notosansarabic)', licence: 'SIL Open Font License 1.1', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'n/a', reviewNotes: 'UI font.' });
addLedger({ id: 'font-noto-naskh-arabic', kind: 'font', title: 'Noto Naskh Arabic (variable)', source: 'github.com/google/fonts (ofl/notonaskharabic)', licence: 'SIL Open Font License 1.1', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'n/a', reviewNotes: 'Body font for hadith, adhkar and tafsir.' });

/* ------------------------------------------------------------------ */
/* 8. Prayer-time engine (code, not content, but it is a "source")       */
/* ------------------------------------------------------------------ */
addLedger({ id: 'engine-adhan-js', kind: 'engine', title: 'adhan (JavaScript) — on-device prayer times & qibla', source: 'github.com/batoulapps/adhan-js (npm adhan 4.4.6)', licence: 'MIT', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'cross-checked', reviewNotes: 'Parameters for each method are shown in-app; times are "محسوب" never "معتمد" unless a documented official table is loaded (section 14).' });

wj('ledger.json', { generatedOn: today, entries: ledger });
console.log(`Built ${ledger.length} ledger entries →`, OUT);
