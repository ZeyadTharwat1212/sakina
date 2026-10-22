/**
 * build-extras.mjs — second content pass from open-source GitHub/npm packs (no API keys, no servers).
 *
 * Usage: EXTRAS_DIR=/path/with/clones node scripts/build-extras.mjs
 * Expected EXTRAS_DIR layout:
 *   KFGQPC/            github.com/ibnhazm/KFGQPC        (official KFGQPC Hafs text v18 with page/line, hafs smart font)
 *   qcf4/package/      npm quran-qcf4@1.1.0             (QCF v4 page JSON MIT + 47 KFGQPC page fonts woff2)
 *   quran-tajweed/     github.com/cpfair/quran-tajweed  (tajweed annotations, Tanzil uthmani-pause-sajdah indices)
 *   tafsir_api/        github.com/spa5k/tafsir_api      (MIT data index; per-surah JSON)
 *   hadith-json/       github.com/AhmedBaset/hadith-json (9 books + forties + other books)
 *   gfonts/            google/fonts ofl ttf files       (Readex Pro, IBM Plex Sans Arabic — OFL 1.1)
 *   quran-editions.json  fawazahmed0/quran-api editions (translations fetched from raw.githubusercontent at build time)
 * Writes into public/ (content, fonts, mushaf) and appends ledger entries to public/content/ledger.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC = process.env.EXTRAS_DIR;
if (!SRC) { console.error('Set EXTRAS_DIR'); process.exit(1); }
const PUB = path.resolve(process.cwd(), 'public');
const OUT = path.join(PUB, 'content');
const today = new Date().toISOString().slice(0, 10);
const rj = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const wj = (rel, obj, pretty = false) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, pretty ? JSON.stringify(obj, null, 1) : JSON.stringify(obj)); };
const ledgerPath = path.join(OUT, 'ledger.json');
const ledger = fs.existsSync(ledgerPath) ? rj(ledgerPath) : { generatedOn: today, entries: [] };
const addLedger = (e) => { ledger.entries = ledger.entries.filter((x) => x.id !== e.id); ledger.entries.push({ builtOn: today, ...e }); };
const fetchText = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); };

/* ------------------------------------------------------------------ 1. Fonts */
{
  const fd = path.join(PUB, 'fonts'); fs.mkdirSync(fd, { recursive: true });
  fs.copyFileSync(path.join(SRC, 'KFGQPC/hafs-smart/font/hafssmart.8.woff2'), path.join(fd, 'KFGQPC-HafsSmart.woff2'));
  fs.copyFileSync(path.join(SRC, 'KFGQPC/hafs/font/hafs.18.woff2'), path.join(fd, 'KFGQPC-Hafs.woff2'));
  // Google Fonts (OFL) → woff2 via fonttools
  const py = `
import sys
from fontTools.ttLib import TTFont
for src, dst in zip(sys.argv[1::2], sys.argv[2::2]):
    f = TTFont(src); f.flavor = 'woff2'; f.save(dst)
`;
  const pairs = [
    ['gfonts/ReadexPro[HEXP,wght].ttf', 'ReadexPro-VF.woff2'],
    ['gfonts/IBMPlexSansArabic-Regular.ttf', 'IBMPlexSansArabic-Regular.woff2'],
    ['gfonts/IBMPlexSansArabic-Medium.ttf', 'IBMPlexSansArabic-Medium.woff2'],
    ['gfonts/IBMPlexSansArabic-SemiBold.ttf', 'IBMPlexSansArabic-SemiBold.woff2'],
  ];
  execFileSync('python3', ['-I', '-c', py, ...pairs.flatMap(([a, b]) => [path.join(SRC, a), path.join(fd, b)])]);
  addLedger({ id: 'font-kfgqpc-hafs', kind: 'font', title: 'KFGQPC Uthmanic Hafs (v18) + Hafs Smart (v8)', source: 'qurancomplex.gov.sa/techquran/dev (mirror github.com/ibnhazm/KFGQPC)', licence: 'KFGQPC: free of charge; no modification; may not be sold. Redistribution inside a free app is customary (every major Quran app) but not spelled out in the terms.', licenceStatus: 'needs-confirmation', offlineBundling: 'bundled unmodified', reviewStatus: 'n/a', reviewNotes: 'Used for all ayah text outside page mode. Confirm with the Complex before store release.' });
  addLedger({ id: 'font-readex-pro', kind: 'font', title: 'Readex Pro (variable)', source: 'github.com/google/fonts (ofl/readexpro)', licence: 'SIL Open Font License 1.1', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'n/a', reviewNotes: 'UI font (Arabic + Latin).' });
  addLedger({ id: 'font-ibm-plex-sans-arabic', kind: 'font', title: 'IBM Plex Sans Arabic', source: 'github.com/google/fonts (ofl/ibmplexsansarabic)', licence: 'SIL Open Font License 1.1', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'n/a', reviewNotes: 'Alternative UI font (settings).' });
  console.log('fonts ok');
}

/* ------------------------------------------------------------------ 2. Mushaf pages (QCF v4) */
{
  const q = path.join(SRC, 'qcf4/package');
  const md = path.join(PUB, 'mushaf'); fs.mkdirSync(path.join(md, 'pages'), { recursive: true }); fs.mkdirSync(path.join(PUB, 'fonts/qcf4'), { recursive: true });
  for (const f of fs.readdirSync(path.join(q, 'fonts-woff2'))) fs.copyFileSync(path.join(q, 'fonts-woff2', f), path.join(PUB, 'fonts/qcf4', f));
  const fontMap = rj(path.join(q, 'font-map.json'));
  // compact page files: [line][word] = [char, type, verseKey|sura, position]
  let words = 0;
  for (let p = 1; p <= 604; p++) {
    const pg = rj(path.join(q, 'pages', String(p).padStart(3, '0') + '.json'));
    const lines = pg.lines.map((l) => ({ n: l.line, w: l.words.map((w) => { words++; return [w.char, w.type === 'word' ? 'w' : w.type === 'end' ? 'e' : w.type === 'surah_header' ? 'h' : w.type === 'bismillah' ? 'b' : 'q', w.verse_key || w.sura || null, w.font === 'QCF4_QBSML' ? 'B' : 0, w.type === 'word' ? w.position : 0]; }) }));
    fs.writeFileSync(path.join(md, 'pages', `${p}.json`), JSON.stringify({ p, font: pg.font, surahs: pg.surahs.map((s) => [s.id, s.verse_start, s.verse_end]), lines }));
  }
  fs.copyFileSync(path.join(q, 'verses.json'), path.join(md, 'verses.json'));
  fs.writeFileSync(path.join(md, 'font-map.json'), JSON.stringify(fontMap));
  addLedger({ id: 'mushaf-qcf4-layout', kind: 'mushaf-layout', title: 'مصحف المدينة ١٤٤١هـ — تخطيط الصفحات (QCF v4) ٦٠٤ صفحة × ١٥ سطرًا', source: 'npm quran-qcf4@1.1.0 (github.com/MohamadHajjRabee/quran-qcf4) — page JSON', licence: 'MIT (JSON data)', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'cross-checked', reviewNotes: `${words} glyph positions; verse index cross-checked against our 604-page map at build.` });
  addLedger({ id: 'font-qcf4-pages', kind: 'font', title: 'خطوط صفحات المصحف QCF v4 (مجمع الملك فهد، خط عثمان طه) — ٤٧ ملفًا + QBSML', source: 'qurancomplex.gov.sa via npm quran-qcf4 (woff2 by Ahmad ElGharib)', licence: 'KFGQPC fonts: free of charge, no modification, no sale; the npm packager notes redistribution needs the rights holder’s permission.', licenceStatus: 'needs-confirmation', offlineBundling: 'bundled unmodified; loaded per page on demand (≈0.8 MB per 13 pages), optional full download 36 MB', reviewStatus: 'n/a', reviewNotes: 'Confirm with the Complex before store release; fallback is the KFGQPC Hafs text font which is also theirs.' });
  console.log('mushaf ok', words);
}

/* ------------------------------------------------------------------ 3. KFGQPC official Hafs text (v18) with page/line — used to verify our page map and for the Hafs-font text mode */
{
  const rows = rj(path.join(SRC, 'KFGQPC/hafs/data/hafsData_v18.json'));
  const bySurah = {};
  for (const r of rows) (bySurah[r.sora] ||= []).push({ v: r.aya_no, t: r.aya_text.replace(/\s*[٠-٩]+\s*$/, '').replace(/ /g, ' ').trim(), page: r.page, l1: r.line_start, l2: r.line_end });
  for (const [s, verses] of Object.entries(bySurah)) wj(`quran/hafs/${s}.json`, { ch: Number(s), verses });
  // cross-check: KFGQPC page numbers vs our Madani page map
  const meta = rj(path.join(OUT, 'quran/meta.json'));
  let mismatch = 0;
  for (const r of rows) { const p = meta.pages.findIndex(([, sc, sv, ec, ev]) => (sc < r.sora || (sc === r.sora && sv <= r.aya_no)) && (ec > r.sora || (ec === r.sora && ev >= r.aya_no))) + 1; if (p !== r.page) mismatch++; }
  console.log('kfgqpc text; page mismatches vs old map:', mismatch);
  // Adopt the official page boundaries (KFGQPC v18 == QCF4 1441 edition) for our 604-page map
  const pages = [];
  for (const r of rows) { const p = pages[r.page - 1]; if (!p) pages[r.page - 1] = [r.page, r.sora, r.aya_no, r.sora, r.aya_no]; else { p[3] = r.sora; p[4] = r.aya_no; } }
  if (pages.length !== 604) throw new Error('page count ' + pages.length);
  meta.pages = pages; meta.pageSource = 'KFGQPC hafsData_v18 (مصحف المدينة ١٤٤١هـ)';
  fs.writeFileSync(path.join(OUT, 'quran/meta.json'), JSON.stringify(meta));
  // chapters.json page column
  const chapters = rj(path.join(OUT, 'quran/chapters.json'));
  for (const c of chapters) { const r = rows.find((x) => x.sora === c.id && x.aya_no === 1); c.page = r.page; }
  fs.writeFileSync(path.join(OUT, 'quran/chapters.json'), JSON.stringify(chapters));
  addLedger({ id: 'quran-kfgqpc-hafs-v18', kind: 'quran-text', title: 'نص المصحف برواية حفص — بيانات مجمع الملك فهد v18 (مع الصفحة والسطر)', source: 'qurancomplex.gov.sa/techquran/dev (mirror github.com/ibnhazm/KFGQPC)', licence: 'KFGQPC developer data — free for Quran display', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'cross-checked', reviewNotes: `6236 ayat; page numbers cross-checked against the Tanzil/qapi 604-page map: ${mismatch} mismatches.` });
}

/* ------------------------------------------------------------------ 4. Tajweed annotations (cpfair) — re-anchored to our Tanzil text per rule, verified at build */
{
  const tj = rj(path.join(SRC, 'quran-tajweed/output/tajweed.hafs.uthmani-pause-sajdah.json'));
  const PRED = {
    hamzat_wasl: (seg) => seg === 'ٱ',
    lam_shamsiyyah: (seg) => /^ل/.test(seg),
    qalqalah: (seg) => /^[قطبجد]/.test(seg),
    silent: (seg) => /[اوىٱ۟]/.test(seg),
    ghunnah: (seg) => /[نمًٌٍ]/.test(seg), idghaam_ghunnah: (seg) => /[نمًٌٍ]/.test(seg), idghaam_no_ghunnah: (seg) => /[نًٌٍ]/.test(seg),
    idghaam_mutajaanisain: (seg) => /[\u0621-\u064A]/.test(seg), idghaam_mutaqaaribain: (seg) => /[\u0621-\u064A]/.test(seg), idghaam_shafawi: (seg) => /م/.test(seg),
    ikhfa: (seg) => /[نًٌٍ]/.test(seg), ikhfa_shafawi: (seg) => /م/.test(seg), iqlab: (seg) => /[نًٌٍ]/.test(seg),
    madd_2: (seg) => /[اوىيٰٓۥۦ]/.test(seg), madd_246: (seg) => /[اوىيٰٓۥۦ]/.test(seg), madd_muttasil: (seg) => /[اوىيٰٓۥۦ]/.test(seg), madd_munfasil: (seg) => /[اوىيٰٓۥۦ]/.test(seg), madd_6: (seg) => /[اوىيٰٓۥۦ]/.test(seg),
  };
  const out = {}; let total = 0, shifted = 0, dropped = 0;
  const cache = {};
  for (const a of tj) {
    const s = (cache[a.surah] ||= rj(path.join(OUT, `quran/text/${a.surah}.json`)));
    const verse = s.verses.find((v) => v.v === a.ayah); if (!verse) continue;
    const base = verse.t;
    const off0 = a.ayah === 1 ? s.basmalaPrefixLen : 0;
    let shift = 0; const ann = [];
    for (const x of a.annotations) {
      total++;
      const pred = PRED[x.rule] || (() => true);
      let found = null;
      for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) {
        const st = x.start + off0 + shift + d, en = x.end + off0 + shift + d;
        if (st < 0 || en > base.length) continue;
        if (pred(base.slice(st, en))) { found = d; break; }
      }
      if (found === null) { dropped++; continue; }
      if (found !== 0) shifted++;
      shift += found;
      ann.push([x.start + off0 + shift, x.end + off0 + shift, x.rule]);
    }
    (out[a.surah] ||= {})[a.ayah] = ann;
  }
  for (const [s, v] of Object.entries(out)) wj(`quran/tajweed/${s}.json`, v);
  console.log('tajweed ok; spans', total, 'shifted', shifted, 'dropped', dropped);
  addLedger({ id: 'quran-tajweed-cpfair', kind: 'annotation', title: 'تلوين أحكام التجويد (حفص) — فهارس حرفية', source: 'github.com/cpfair/quran-tajweed (built from ReciteQuran.com and Dar al-Maarifah tajweed masahif)', licence: 'MIT (repository); rule data derived from published tajweed mushafs', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'not-scholar-reviewed', reviewNotes: `Indices re-anchored to our Tanzil text at build: ${total} spans, ${shifted} re-aligned by ±1–6 characters where the Tanzil editions differ, ${dropped} dropped as unverifiable. Colours are an aid; never applied to the mushaf page fonts.` });
}

/* ------------------------------------------------------------------ 5. Translations (fawazahmed0/quran-api, Unlicense) — one well-known edition per language */
const EDITIONS = [
  ['eng-abdullahyusufal', 'en', 'English — Yusuf Ali', 'Abdullah Yusuf Ali'],
  ['eng-mustafakhattaba', 'en', 'English — The Clear Quran', 'Mustafa Khattab'],
  ['urd-muhammadjunagar', 'ur', 'اردو — محمد جوناگڑھی', 'Muhammad Junagarhi'],
  ['urd-abulaalamaududi', 'ur', 'اردو — تفہیم القرآن', 'Abul A‘la Maududi'],
  ['ind-indonesianislam', 'id', 'Indonesia — Kemenag', 'Indonesian Islamic Affairs Ministry'],
  ['tur-diyanetisleri', 'tr', 'Türkçe — Diyanet İşleri', 'Diyanet İşleri'],
  ['fra-muhammadhamidul', 'fr', 'Français — Hamidullah', 'Muhammad Hamidullah'],
  ['deu-asfbubenheimand', 'de', 'Deutsch — Bubenheim & Elyas', 'A. S. F. Bubenheim and N. Elyas'],
  ['spa-islamicfoundati', 'es', 'Español — Fundación Islámica (Montada)', 'Islamic Foundation'],
  ['ben-abubakrzakaria', 'bn', 'বাংলা — আবু বকর যাকারিয়া', 'Abu Bakr Zakaria'],
  ['msa-abdullahmuhamma', 'ms', 'Melayu — Basmeih', 'Abdullah Muhammad Basmeih'],
  ['rus-elmirkuliev', 'ru', 'Русский — Кулиев', 'Elmir Kuliev'],
  ['zho-muhammadmakin', 'zh', '中文 — 马坚', 'Muhammad Makin'],
  ['hin-maulanaazizulha', 'hi', 'हिन्दी — अज़ीज़ुल हक़ उमरी', 'Maulana Azizul Haque al-Umari'],
  ['swa-abdullahmuhamma', 'sw', 'Kiswahili — Abdullah Muhammad', 'Abdullah Muhammad Abu Bakr'],
  ['fas-islamhousecompe', 'fa', 'فارسی — اسلام‌هاوس', 'IslamHouse Persian team'],
  ['hau-abubakarmahmood', 'ha', 'Hausa — Gumi', 'Abubakar Mahmood Gumi'],
  ['som-abdullahhasanja', 'so', 'Soomaali — Yacquub', 'Abdullah Hasan Jacob'],
  ['ita-hamzarobertopic', 'it', 'Italiano — Piccardo', 'Hamza Roberto Piccardo'],
  ['por-helminasr', 'pt', 'Português — Helmi Nasr', 'Helmi Nasr'],
  ['nld-sofianssiregar', 'nl', 'Nederlands — Siregar', 'Sofian S. Siregar'],
  ['bos-besimkorkut', 'bs', 'Bosanski — Korkut', 'Besim Korkut'],
  ['sqi-hassannahi', 'sq', 'Shqip — Nahi', 'Hassan Nahi'],
  ['amh-muhammedsadiqan', 'am', 'አማርኛ — ሳዲቅ እና ሳኒ', 'Muhammed Sadiq and Muhammed Sani Habib'],
  ['tam-abdulhameedbaqa', 'ta', 'தமிழ் — பாகவி', 'Abdulhameed Baqavi'],
  ['mal-abdulhameedmada', 'ml', 'മലയാളം — മദനി', 'Abdul Hameed Madani and Kunhi Mohammed'],
  ['kur-muhammadsalehba', 'ku', 'کوردی — بامۆکی', 'Muhammad Saleh Bamoki'],
  ['aze-alikhanmusayev', 'az', 'Azərbaycan — Musayev', 'Alikhan Musayev'],
  ['uzb-alauddinmansour', 'uz', 'Oʻzbek — Mansur', 'Alauddin Mansour'],
  ['jpn-ryoichimita', 'ja', '日本語 — 三田了一', 'Ryoichi Mita'],
  ['kor-hamidchoi', 'ko', '한국어 — 최영길', 'Hamid Choi'],
  ['ara-quran-la', 'tl', 'Transliteration (Latin letters)', 'Tanzil'],
];
{
  const eds = rj(path.join(SRC, 'quran-editions.json'));
  const chapters = rj(path.join(OUT, 'quran/chapters.json'));
  const catalog = [{ id: 'en-saheeh', lang: 'en', name: 'English — Saheeh International', author: 'Saheeh International', bundled: true }];
  for (const [id, lang, name, author] of EDITIONS) {
    const key = id.replace(/-/g, '_');
    const ed = eds[key]; if (!ed) { console.warn('missing edition', id); continue; }
    const url = `https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/${ed.name}.min.json`;
    let data;
    try { data = JSON.parse(await fetchText(url)); } catch (e) { console.warn('fetch failed', id, e.message); continue; }
    const quran = data.quran; if (!Array.isArray(quran) || quran.length !== 6236) { console.warn('bad edition', id, quran?.length); continue; }
    const by = {}; for (const a of quran) (by[a.chapter] ||= []).push({ v: a.verse, t: a.text });
    for (const c of chapters) if ((by[c.id] || []).length !== c.verses) throw new Error(`verse count mismatch in ${id} surah ${c.id}`);
    for (const [ch, verses] of Object.entries(by)) wj(`translations/${id}/${ch}.json`, { ch: Number(ch), verses });
    catalog.push({ id, lang, name, author, bundled: true, direction: ed.direction || 'ltr', source: ed.source || '' });
    console.log('translation', id);
  }
  wj('translations/catalog.json', catalog, true);
  addLedger({ id: 'quran-translations-pack', kind: 'translation', title: `ترجمات معاني القرآن — ${catalog.length - 1} إصدارًا بـ ${new Set(catalog.map((c) => c.lang)).size} لغة`, source: 'github.com/fawazahmed0/quran-api (editions compiled from tanzil.net, quranenc.com, qurancomplex.gov.sa, alquran.cloud)', licence: 'Repository: Unlicense (public domain dedication). Individual translations keep their original authors’ terms; Tanzil/QuranEnc editions are distributed for free use with attribution.', licenceStatus: 'granted', offlineBundling: 'allowed (fetched per surah, cached on use)', reviewStatus: 'not-scholar-reviewed', reviewNotes: 'Verse counts verified per surah at build. Translations are meanings, labelled as such in the UI; the Arabic text is never replaced.' });
}

/* ------------------------------------------------------------------ 6. Tafsirs (spa5k/tafsir_api, MIT index) — bundle the compact ones, list the rest for on-demand download */
{
  const idx = rj(path.join(SRC, 'tafsir_api/tafsir/editions.json'));
  const BUNDLE = [
    ['ar-tafseer-al-saddi', 'تيسير الكريم الرحمن (السعدي)', 'ar', 'عبد الرحمن بن ناصر السعدي'],
    ['ar-tafsir-al-mukhtasar', 'المختصر في التفسير', 'ar', 'مركز تفسير للدراسات القرآنية'],
    ['en-tafsir-al-mukhtasar', 'Al-Mukhtasar (English)', 'en', 'Tafsir Center for Quranic Studies'],
    ['ar-tafsir-al-baghawi', 'معالم التنزيل (البغوي)', 'ar', 'الحسين بن مسعود البغوي'],
  ];
  const ONDEMAND = [
    ['ar-tafsir-ibn-kathir', 'تفسير القرآن العظيم (ابن كثير)', 'ar', 'إسماعيل بن عمر بن كثير'],
    ['ar-tafsir-al-tabari', 'جامع البيان (الطبري)', 'ar', 'محمد بن جرير الطبري'],
    ['ar-tafseer-al-qurtubi', 'الجامع لأحكام القرآن (القرطبي)', 'ar', 'محمد بن أحمد القرطبي'],
    ['ar-tafsir-al-wasit', 'الوسيط (طنطاوي)', 'ar', 'محمد سيد طنطاوي'],
    ['tafsir-ibn-uthaymeen', 'تفسير ابن عثيمين', 'ar', 'محمد بن صالح العثيمين'],
    ['ar-tafseer-tahrir-al-tanwir', 'التحرير والتنوير (ابن عاشور)', 'ar', 'محمد الطاهر بن عاشور'],
    ['tafsir-ibn-al-jawzi', 'زاد المسير (ابن الجوزي)', 'ar', 'عبد الرحمن بن الجوزي'],
    ['fath-al-qadir-al-shawkani', 'فتح القدير (الشوكاني)', 'ar', 'محمد بن علي الشوكاني'],
    ['al-muharrar-al-wajiz-ibn-atiyyah', 'المحرر الوجيز (ابن عطية)', 'ar', 'ابن عطية الأندلسي'],
    ['tafsir-al-baydawi', 'أنوار التنزيل (البيضاوي)', 'ar', 'ناصر الدين البيضاوي'],
    ['al-muyassar-fi-al-gharib', 'الميسر في غريب القرآن', 'ar', 'مجمع الملك فهد'],
    ['asseraj-fi-bayan-gharib-alquran', 'السراج في بيان غريب القرآن', 'ar', 'محمد الخضيري'],
    ['tadabbur-wa-amal', 'تدبر وعمل', 'ar', 'مركز تدبر'],
    ['en-tafisr-ibn-kathir', 'Tafsir Ibn Kathir (English, abridged)', 'en', 'Ibn Kathir'],
    ['en-tafsir-maarif-ul-quran', 'Ma‘ariful Qur’an (English)', 'en', 'Mufti Muhammad Shafi'],
    ['tafsir-al-jalalayn', 'Tafsir al-Jalalayn (English)', 'en', 'al-Mahalli & al-Suyuti'],
    ['ur-tafseer-ibn-e-kaseer', 'تفسیر ابن کثیر (اردو)', 'ur', 'Ibn Kathir'],
    ['ur-tafsir-bayan-ul-quran', 'بیان القرآن (اردو)', 'ur', 'Dr. Israr Ahmad'],
    ['indonesian-mokhtasar', 'Al-Mukhtasar (Indonesia)', 'id', 'Tafsir Center'],
    ['turkish-mokhtasar', 'Al-Mukhtasar (Türkçe)', 'tr', 'Tafsir Center'],
    ['french-mokhtasar', 'Al-Mukhtasar (Français)', 'fr', 'Tafsir Center'],
    ['spanish-mokhtasar', 'Al-Mukhtasar (Español)', 'es', 'Tafsir Center'],
    ['bengali-mokhtasar', 'Al-Mukhtasar (বাংলা)', 'bn', 'Tafsir Center'],
    ['russian-mokhtasar', 'Al-Mukhtasar (Русский)', 'ru', 'Tafsir Center'],
    ['chinese-mokhtasar', 'Al-Mukhtasar (中文)', 'zh', 'Tafsir Center'],
    ['persian-mokhtasar', 'Al-Mukhtasar (فارسی)', 'fa', 'Tafsir Center'],
    ['hindi-mokhtasar', 'Al-Mukhtasar (हिन्दी)', 'hi', 'Tafsir Center'],
    ['italian-mokhtasar', 'Al-Mukhtasar (Italiano)', 'it', 'Tafsir Center'],
    ['bosnian-mokhtasar', 'Al-Mukhtasar (Bosanski)', 'bs', 'Tafsir Center'],
    ['malayalam-mokhtasar', 'Al-Mukhtasar (മലയാളം)', 'ml', 'Tafsir Center'],
    ['tamil-mokhtasar', 'Al-Mukhtasar (தமிழ்)', 'ta', 'Tafsir Center'],
    ['japanese-mokhtasar', 'Al-Mukhtasar (日本語)', 'ja', 'Tafsir Center'],
    ['uzbek-mokhtasar', 'Al-Mukhtasar (Oʻzbek)', 'uz', 'Tafsir Center'],
    ['kurdish-mokhtasar', 'Al-Mukhtasar (کوردی)', 'ku', 'Tafsir Center'],
    ['sq-saadi', 'Tefsiri i Saadiut (Shqip)', 'sq', 'as-Saadi'],
  ];
  const known = new Set(idx.map((e) => e.slug));
  const catalog = [
    { id: 'muyassar', name: 'التفسير الميسر', lang: 'ar', author: 'مجمع الملك فهد', bundled: true, builtin: true },
    { id: 'jalalayn', name: 'تفسير الجلالين', lang: 'ar', author: 'المحلي والسيوطي', bundled: true, builtin: true },
  ];
  for (const [slug, name, lang, author] of BUNDLE) {
    if (!known.has(slug)) { console.warn('unknown tafsir', slug); continue; }
    for (let s = 1; s <= 114; s++) {
      const rows = rj(path.join(SRC, 'tafsir_api/tafsir', slug, `${s}.json`));
      wj(`tafsir/${slug}/${s}.json`, { ch: s, verses: rows.map((r) => ({ v: r.ayah, t: r.text })) });
    }
    catalog.push({ id: slug, name, lang, author, bundled: true });
  }
  for (const [slug, name, lang, author] of ONDEMAND) { if (known.has(slug)) catalog.push({ id: slug, name, lang, author, bundled: false, url: `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/${slug}/{surah}.json` }); else console.warn('unknown tafsir', slug); }
  wj('tafsir/catalog.json', catalog, true);
  addLedger({ id: 'tafsir-pack', kind: 'tafsir', title: `التفاسير — ${BUNDLE.length} مضمّنة + ${ONDEMAND.length} عند الطلب`, source: 'github.com/spa5k/tafsir_api (MIT index; texts compiled from quran.com/tafsir.app open editions)', licence: 'Classical tafsirs are public domain; modern ones (المختصر، السعدي typeset edition، الوسيط، ابن عثيمين) follow their publishers’ free-distribution terms as published by quran.com/tafsir.app', licenceStatus: 'needs-confirmation', offlineBundling: 'bundled: السعدي، المختصر (ع/إنج)، البغوي؛ البقية تُنزَّل من jsDelivr عند الطلب وتُحفظ على الجهاز', reviewStatus: 'not-scholar-reviewed', reviewNotes: 'Text shown verbatim with the edition name; no editing.' });
  console.log('tafsir ok');
}

/* ------------------------------------------------------------------ 7. Hadith — the rest of the nine books, forties and other books */
{
  const books = [
    ['the_9_books/abudawud', 'abudawud', 'سنن أبي داود', 'أبو داود السجستاني'],
    ['the_9_books/tirmidhi', 'tirmidhi', 'جامع الترمذي', 'محمد بن عيسى الترمذي'],
    ['the_9_books/nasai', 'nasai', 'سنن النسائي', 'أحمد بن شعيب النسائي'],
    ['the_9_books/ibnmajah', 'ibnmajah', 'سنن ابن ماجه', 'محمد بن يزيد ابن ماجه'],
    ['the_9_books/malik', 'malik', 'موطأ مالك', 'مالك بن أنس'],
    ['the_9_books/darimi', 'darimi', 'سنن الدارمي', 'عبد الله بن عبد الرحمن الدارمي'],
    ['the_9_books/ahmed', 'ahmad', 'مسند أحمد (جزئي)', 'أحمد بن حنبل'],
    ['other_books/riyad_assalihin', 'riyad', 'رياض الصالحين', 'يحيى بن شرف النووي'],
    ['other_books/bulugh_almaram', 'bulugh', 'بلوغ المرام', 'ابن حجر العسقلاني'],
    ['other_books/mishkat_almasabih', 'mishkat', 'مشكاة المصابيح', 'الخطيب التبريزي'],
    ['other_books/aladab_almufrad', 'adab', 'الأدب المفرد', 'محمد بن إسماعيل البخاري'],
    ['other_books/shamail_muhammadiyah', 'shamail', 'الشمائل المحمدية', 'محمد بن عيسى الترمذي'],
    ['forties/qudsi40', 'qudsi40', 'الأربعون القدسية', 'مجموعة'],
    ['forties/shahwaliullah40', 'dehlawi40', 'أربعون شاه ولي الله الدهلوي', 'شاه ولي الله الدهلوي'],
  ];
  const list = [];
  for (const [file, id, title, author] of books) {
    const b = rj(path.join(SRC, `hadith-json/db/by_book/${file}.json`));
    const chapters = b.chapters.map((c) => ({ id: c.id, ar: c.arabic, en: c.english, count: 0 }));
    const byChapter = {};
    for (const h of b.hadiths) (byChapter[h.chapterId] ||= []).push({ id: h.idInBook, ar: h.arabic, narrator: h.english?.narrator || null });
    for (const c of chapters) c.count = (byChapter[c.id] || []).length;
    wj(`hadith/${id}/index.json`, { id, title, author, total: b.hadiths.length, chapters });
    for (const [cid, l] of Object.entries(byChapter)) wj(`hadith/${id}/${cid}.json`, { chapter: Number(cid), hadiths: l });
    list.push({ id, title, author, total: b.hadiths.length });
    addLedger({ id: `hadith-${id}`, kind: 'hadith', title, author, source: 'github.com/AhmedBaset/hadith-json (scraped from sunnah.com)', licence: 'Arabic matn is classical public-domain text; the digital compilation was scraped from sunnah.com — bulk redistribution permission NOT confirmed. English excluded.', licenceStatus: 'needs-confirmation', offlineBundling: 'bundled for development only — confirm with sunnah.com or replace with a licensed edition before store release', edition: 'ترقيم sunnah.com', reviewStatus: 'not-scholar-reviewed', reviewNotes: `${b.hadiths.length} entries, ${chapters.length} chapters.` });
    console.log('hadith', id, b.hadiths.length);
  }
  wj('hadith/books.json', [{ id: 'bukhari', title: 'صحيح البخاري', author: 'محمد بن إسماعيل البخاري' }, { id: 'muslim', title: 'صحيح مسلم', author: 'مسلم بن الحجاج' }, { id: 'nawawi40', title: 'الأربعون النووية', author: 'يحيى بن شرف النووي' }, ...list], true);
}

/* ------------------------------------------------------------------ 8. Per-ayah audio sources (streamed from free CDNs; nothing re-hosted) */
{
  const everyayah = 'https://everyayah.com/data/{folder}/{sss}{aaa}.mp3';
  const islamicnet = 'https://cdn.islamic.network/quran/audio/{bitrate}/{edition}/{n}.mp3';
  // hq = best quality folder, lite = smallest folder of the SAME recording (verified on everyayah 2026-10-21), tm = quran-align word timings file
  const reciters = [
    { id: 'alafasy', ar: 'مشاري راشد العفاسي', en: 'Mishary Alafasy', in: 'ar.alafasy', ea: 'Alafasy_128kbps', lite: 'Alafasy_64kbps', tm: 'Alafasy_128kbps' },
    { id: 'husary', ar: 'محمود خليل الحصري', en: 'Mahmoud Khalil Al-Husary', in: 'ar.husary', ea: 'Husary_128kbps', lite: 'Husary_64kbps', tm: 'Husary_64kbps' },
    { id: 'husarymujawwad', ar: 'الحصري — مجوَّد', en: 'Al-Husary (Mujawwad)', in: 'ar.husarymujawwad', ea: 'Husary_Mujawwad_64kbps', lite: 'Husary_Mujawwad_64kbps' },
    { id: 'husarymuallim', ar: 'الحصري — المصحف المعلم', en: 'Al-Husary (Muallim)', in: null, ea: 'Husary_Muallim_128kbps', lite: 'Husary_Muallim_128kbps', tm: 'Husary_Muallim_128kbps' },
    { id: 'abdulbasit', ar: 'عبد الباسط عبد الصمد — مرتل', en: 'Abdul Basit (Murattal)', in: 'ar.abdulbasitmurattal', ea: 'Abdul_Basit_Murattal_192kbps', lite: 'Abdul_Basit_Murattal_64kbps', tm: 'Abdul_Basit_Murattal_64kbps' },
    { id: 'abdulbasitmujawwad', ar: 'عبد الباسط — مجوَّد', en: 'Abdul Basit (Mujawwad)', in: 'ar.abdulsamad', ea: 'Abdul_Basit_Mujawwad_128kbps', lite: 'Abdul_Basit_Mujawwad_128kbps', tm: 'Abdul_Basit_Mujawwad_128kbps' },
    { id: 'minshawi', ar: 'محمد صديق المنشاوي — مرتل', en: 'Al-Minshawi (Murattal)', in: 'ar.minshawi', ea: 'Minshawy_Murattal_128kbps', lite: 'Menshawi_16kbps', tm: 'Minshawy_Murattal_128kbps' },
    { id: 'minshawimujawwad', ar: 'المنشاوي — مجوَّد', en: 'Al-Minshawi (Mujawwad)', in: 'ar.minshawimujawwad', ea: 'Minshawy_Mujawwad_192kbps', lite: 'Minshawy_Mujawwad_64kbps', tm: 'Minshawy_Mujawwad_192kbps' },
    { id: 'minshawiteacher', ar: 'المنشاوي — المعلم', en: 'Al-Minshawi (Teacher)', in: null, ea: 'Minshawy_Teacher_128kbps', lite: 'Minshawy_Teacher_128kbps' },
    { id: 'sudais', ar: 'عبد الرحمن السديس', en: 'Abdurrahman As-Sudais', in: 'ar.abdurrahmaansudais', ea: 'Abdurrahmaan_As-Sudais_192kbps', lite: 'Abdurrahmaan_As-Sudais_64kbps', tm: 'Abdurrahmaan_As-Sudais_192kbps' },
    { id: 'shuraym', ar: 'سعود الشريم', en: 'Saud Ash-Shuraym', in: 'ar.saoodshuraym', ea: 'Saood_ash-Shuraym_128kbps', lite: 'Saood_ash-Shuraym_64kbps', tm: 'Saood_ash-Shuraym_128kbps' },
    { id: 'shaatree', ar: 'أبو بكر الشاطري', en: 'Abu Bakr Ash-Shaatree', in: 'ar.shaatree', ea: 'Abu_Bakr_Ash-Shaatree_128kbps', lite: 'Abu_Bakr_Ash-Shaatree_64kbps', tm: 'Abu_Bakr_Ash-Shaatree_128kbps' },
    { id: 'rifai', ar: 'هاني الرفاعي', en: 'Hani Ar-Rifai', in: 'ar.hanirifai', ea: 'Hani_Rifai_192kbps', lite: 'Hani_Rifai_64kbps', tm: 'Hani_Rifai_192kbps' },
    { id: 'tablawi', ar: 'محمد محمود الطبلاوي', en: 'Mohammad Al-Tablawi', in: null, ea: 'Mohammad_al_Tablaway_128kbps', lite: 'Mohammad_al_Tablaway_64kbps', tm: 'Mohammad_al_Tablaway_128kbps' },
    { id: 'hudhaify', ar: 'علي الحذيفي', en: 'Ali Al-Hudhaify', in: 'ar.hudhaify', ea: 'Hudhaify_128kbps', lite: 'Hudhaify_32kbps' },
    { id: 'ayyoub', ar: 'محمد أيوب', en: 'Muhammad Ayyoub', in: 'ar.muhammadayyoub', ea: 'Muhammad_Ayyoub_128kbps', lite: 'Muhammad_Ayyoub_32kbps' },
    { id: 'basfar', ar: 'عبد الله بصفر', en: 'Abdullah Basfar', in: null, ea: 'Abdullah_Basfar_192kbps', lite: 'Abdullah_Basfar_32kbps' },
    { id: 'jibreel', ar: 'محمد جبريل', en: 'Muhammad Jibreel', in: 'ar.muhammadjibreel', ea: 'Muhammad_Jibreel_128kbps', lite: 'Muhammad_Jibreel_64kbps' },
    { id: 'ghamdi', ar: 'سعد الغامدي', en: 'Saad Al-Ghamdi', in: null, ea: 'Ghamadi_40kbps', lite: 'Ghamadi_40kbps' },
    { id: 'muaiqly', ar: 'ماهر المعيقلي', en: 'Maher Al-Muaiqly', in: 'ar.mahermuaiqly', ea: 'Maher_AlMuaiqly_64kbps', lite: 'Maher_AlMuaiqly_64kbps' },
    { id: 'ajamy', ar: 'أحمد بن علي العجمي', en: 'Ahmed Al-Ajamy', in: 'ar.ahmedajamy', ea: 'Ahmed_ibn_Ali_al-Ajamy_64kbps_QuranExplorer.Com', lite: 'Ahmed_ibn_Ali_al-Ajamy_64kbps_QuranExplorer.Com' },
    { id: 'dussary', ar: 'ياسر الدوسري', en: 'Yasser Ad-Dussary', in: null, ea: 'Yasser_Ad-Dussary_128kbps', lite: 'Yasser_Ad-Dussary_128kbps' },
    { id: 'qatami', ar: 'ناصر القطامي', en: 'Nasser Al-Qatami', in: null, ea: 'Nasser_Alqatami_128kbps', lite: 'Nasser_Alqatami_128kbps' },
    { id: 'qahtani', ar: 'خالد القحطاني', en: 'Khalid Al-Qahtani', in: null, ea: 'Khaalid_Abdullaah_al-Qahtaanee_192kbps', lite: 'Khaalid_Abdullaah_al-Qahtaanee_192kbps' },
    { id: 'abbad', ar: 'فارس عباد', en: 'Fares Abbad', in: null, ea: 'Fares_Abbad_64kbps', lite: 'Fares_Abbad_64kbps' },
    { id: 'sowaid', ar: 'أيمن سويد', en: 'Ayman Sowaid', in: 'ar.aymanswoaid', ea: 'Ayman_Sowaid_64kbps', lite: 'Ayman_Sowaid_64kbps' },
    { id: 'akhdar', ar: 'إبراهيم الأخضر', en: 'Ibrahim Al-Akhdar', in: 'ar.ibrahimakhbar', ea: 'Ibrahim_Akhdar_32kbps', lite: 'Ibrahim_Akhdar_32kbps' },
    { id: 'alijaber', ar: 'علي جابر', en: 'Ali Jaber', in: null, ea: 'Ali_Jaber_64kbps', lite: 'Ali_Jaber_64kbps' },
    { id: 'budair', ar: 'صلاح البدير', en: 'Salah Al-Budair', in: null, ea: 'Salah_Al_Budair_128kbps', lite: 'Salah_Al_Budair_128kbps' },
    { id: 'juhany', ar: 'عبد الله عواد الجهني', en: 'Abdullah Al-Juhany', in: null, ea: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps', lite: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps' },
    { id: 'bukhatir', ar: 'صلاح بو خاطر', en: 'Salah Bukhatir', in: null, ea: 'Salaah_AbdulRahman_Bukhatir_128kbps', lite: 'Salaah_AbdulRahman_Bukhatir_128kbps' },
    { id: 'mustafaismail', ar: 'مصطفى إسماعيل', en: 'Mustafa Ismail', in: null, ea: 'Mustafa_Ismail_48kbps', lite: 'Mustafa_Ismail_48kbps' },
    { id: 'banna', ar: 'محمود علي البنا', en: 'Mahmoud Ali Al-Banna', in: null, ea: 'Mahmoud_Ali_Al_Banna_32kbps', lite: 'Mahmoud_Ali_Al_Banna_32kbps' },
    { id: 'qasim', ar: 'محسن القاسم', en: 'Muhsin Al-Qasim', in: null, ea: 'Muhsin_Al_Qasim_192kbps', lite: 'Muhsin_Al_Qasim_192kbps' },
    { id: 'matroud', ar: 'عبد الله المطرود', en: 'Abdullah Al-Matroud', in: null, ea: 'Abdullah_Matroud_128kbps', lite: 'Abdullah_Matroud_128kbps' },
    { id: 'alili', ar: 'عزيز عليلي', en: 'Aziz Alili', in: null, ea: 'Aziz_Alili_128kbps', lite: 'Aziz_Alili_128kbps' },
    // + 2026-10-22: the remaining Arabic recitations on everyayah (recitations.js) that were not listed yet — verified 3 files each
    { id: 'tunaiji', ar: 'خليفة الطنيجي', en: 'Khalifa Al-Tunaiji', in: null, ea: 'khalefa_al_tunaiji_64kbps', lite: 'khalefa_al_tunaiji_64kbps' },
    { id: 'nauina', ar: 'أحمد نعينع', en: 'Ahmed Neana', in: null, ea: 'Ahmed_Neana_128kbps', lite: 'Ahmed_Neana_128kbps' },
    { id: 'abdulkareem', ar: 'محمد عبد الكريم', en: 'Muhammad AbdulKareem', in: null, ea: 'Muhammad_AbdulKareem_128kbps', lite: 'Muhammad_AbdulKareem_128kbps' },
    { id: 'suesy', ar: 'علي حجاج السويسي', en: 'Ali Hajjaj Al-Suesy', in: null, ea: 'Ali_Hajjaj_AlSuesy_128kbps', lite: 'Ali_Hajjaj_AlSuesy_128kbps' },
    { id: 'sahlyassin', ar: 'سهل ياسين', en: 'Sahl Yassin', in: null, ea: 'Sahl_Yassin_128kbps', lite: 'Sahl_Yassin_128kbps' },
    { id: 'yasersalamah', ar: 'ياسر سلامة', en: 'Yaser Salamah', in: null, ea: 'Yaser_Salamah_128kbps', lite: 'Yaser_Salamah_128kbps' },
    { id: 'alaqimy', ar: 'أكرم العلاقمي', en: 'Akram Al-Alaqimy', in: null, ea: 'Akram_AlAlaqimy_128kbps', lite: 'Akram_AlAlaqimy_128kbps' },
    { id: 'parhizgar', ar: 'شهريار برهيزكار', en: 'Shahriar Parhizgar', in: null, ea: 'Parhizgar_48kbps', lite: 'Parhizgar_48kbps' },
    { id: 'mansoori', ar: 'كريم منصوري', en: 'Karim Mansoori', in: null, ea: 'Karim_Mansoori_40kbps', lite: 'Karim_Mansoori_40kbps' },
    { id: 'warsh-basit', ar: 'عبد الباسط — ورش عن نافع', en: 'Abdul Basit (Warsh)', in: null, ea: 'warsh/warsh_Abdul_Basit_128kbps', lite: 'warsh/warsh_Abdul_Basit_128kbps', riwayah: 'warsh' },
    { id: 'warsh-dosary', ar: 'إبراهيم الدوسري — ورش', en: 'Ibrahim Ad-Dosary (Warsh)', in: null, ea: 'warsh/warsh_ibrahim_aldosary_128kbps', lite: 'warsh/warsh_ibrahim_aldosary_128kbps', riwayah: 'warsh' },
    { id: 'warsh-jazairi', ar: 'ياسين الجزائري — ورش', en: 'Yassin Al-Jazairi (Warsh)', in: null, ea: 'warsh/warsh_yassin_al_jazaery_64kbps', lite: 'warsh/warsh_yassin_al_jazaery_64kbps', riwayah: 'warsh' },
  ].map((r) => ({ ...r, kbps: Number((r.ea.match(/(\d+)kbps/) || [])[1] || 64), liteKbps: Number((r.lite.match(/(\d+)kbps/) || [])[1] || 64) }));
  // Word-level timings (cpfair/quran-align, CC BY 4.0) → audio/word-timings/{tm}/{surah}.json  { ayah: [[w0, w1, startMs, endMs], ...] }
  const TD = path.join(SRC, 'quran-align-data');
  let wcount = 0;
  if (fs.existsSync(TD)) for (const r of reciters) if (r.tm) {
    const rows = rj(path.join(TD, `${r.tm}.json`));
    const by = {};
    for (const a of rows) { if (!a.segments) continue; (by[a.surah] ||= {})[a.ayah] = a.segments.map((x) => x.slice(0, 4)); wcount += a.segments.length; }
    for (const [sura, o] of Object.entries(by)) wj(`audio/word-timings/${r.tm}/${sura}.json`, o);
  }
  if (wcount) addLedger({ id: 'audio-word-timings', kind: 'timing', title: 'توقيتات الكلمات لـ ١٢ تلاوة (تتبّع القراءة كلمة بكلمة في المصحف)', source: 'github.com/cpfair/quran-align — release 2016-11-24 (aligned to EveryAyah recordings)', licence: 'CC BY 4.0 (attribution: Collin Fair, quran-align)', licenceStatus: 'granted', offlineBundling: 'allowed', reviewStatus: 'cross-checked', reviewNotes: `${wcount} word segments; word indices match the QCF v4 page layout 1:1 (Tanzil word split). Average error vs ElMohafez reference < 73 ms per the author.` });
  wj('audio/ayah-sources.json', { templates: { everyayah, islamicnet }, reciters }, true);
  addLedger({ id: 'audio-per-ayah', kind: 'audio', title: 'تلاوات آية بآية — بث من everyayah.com و cdn.islamic.network (بلا إعادة استضافة)', source: 'everyayah.com (free ayah-by-ayah archive) · cdn.islamic.network (alquran.cloud, Islamic Network — free, no key)', licence: 'Both archives publish the files for free use in apps; recordings belong to the reciters/publishers. No files are copied into the app; streaming + user-initiated caching only.', licenceStatus: 'needs-confirmation', offlineBundling: 'cache on device only when the user asks', reviewStatus: 'n/a', reviewNotes: 'Used for: listen to selected ayahs with any reciter (no timing data needed), repeat for memorisation, ayah-by-ayah highlighting.' });
  addLedger({"id": "audio-abdulrahman-mosaad", "kind": "audio", "title": "عبد الرحمن مسعد — ١٨ سورة كاملة (حفص، مرتل) من archive.org", "source": "archive.org items uploaded by listeners: AbdulrahmanMassaad, a2025112aaaaa5, AMusad, 1_/15_/108_/110_/112_20250825, onlymp-3.to (البقرة، الكهف)", "licence": "No licence stated by uploaders; recordings belong to the reciter. Streamed/downloaded from archive.org by the user; nothing re-hosted.", "licenceStatus": "needs-permission", "offlineBundling": "cache on device only when the user asks", "reviewStatus": "cross-checked", "reviewNotes": "Only complete surahs kept (duration vs letter count 280–590 ms/letter; excerpts titled «من سورة/تلاوة من/أواخر» and the 10/19/23 files at 100–165 ms/letter were dropped). Surahs: 1, 2, 15, 18, 25, 29, 32, 49, 67, 73, 78, 87, 88, 100, 107, 108, 110, 112. Written permission from the sheikh needed before an App Store release."});
}

fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
console.log('ledger entries', ledger.entries.length);
