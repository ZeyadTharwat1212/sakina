/**
 * Audio catalogue enrichment (runs on the committed snapshot, no network):
 *  1. MP3Quran: Arabic reciter names, exact surah lists of partial recordings, every riwayah named (no more "unknown").
 *  2. QuranicAudio.com: ~130 more recordings — new reciters, Haramain taraweeh by year (Makkah / Madinah), non-Hafs riwayat.
 * Inputs: scripts/data/*.txt (snapshots taken 2026-10-22). Idempotent: re-running replaces the QuranicAudio part.
 *   node scripts/enrich-audio.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = (p) => join(root, p);
const lines = (f) => readFileSync(P(`scripts/data/${f}`), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const ranges = (s) => s.split(',').flatMap((x) => { const [a, b] = x.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; }).filter((n) => n >= 1 && n <= 114);

export const RIWAYAH_AR = {
  hafs: 'حفص عن عاصم', shubah: 'شعبة عن عاصم', warsh: 'ورش عن نافع', qalun: 'قالون عن نافع',
  duri: 'الدوري عن أبي عمرو', susi: 'السوسي عن أبي عمرو', 'duri-kisai': 'الدوري عن الكسائي', 'abul-harith': 'أبو الحارث عن الكسائي',
  bazzi: 'البزي عن ابن كثير', qunbul: 'قنبل عن ابن كثير', 'bazzi-qunbul': 'البزي وقنبل عن ابن كثير',
  'ibn-dhakwan': 'ابن ذكوان عن ابن عامر', hisham: 'هشام عن ابن عامر', khalaf: 'خلف عن حمزة', khallad: 'خلاد عن حمزة',
  yaqub: 'رويس وروح عن يعقوب', 'ibn-jammaz': 'ابن جماز عن أبي جعفر', unknown: 'غير محددة في المصدر',
};
export function riwayahOf(text) {
  const r = text.toLowerCase();
  if (/mojawwad|mujawwad|mo'?lim|muallim|مجود|معلم|almusshaf/.test(r) && !/warsh|qalon|ورش|قالون/.test(r)) return 'hafs';
  if (/albizi and qunbol|البزي وقنبل/.test(r)) return 'bazzi-qunbul';
  if (/dora?i a'n al-kisa|الدوري عن الكسائي/.test(r)) return 'duri-kisai';
  if (/abi al-?haarith|أبو الحارث|abi_al7arith/.test(r)) return 'abul-harith';
  if (/rowis|rawh|yakoob|يعقوب|رويس/.test(r)) return 'yaqub';
  if (/jammaz|جماز/.test(r)) return 'ibn-jammaz';
  if (/hafs|حفص/.test(r)) return 'hafs';
  if (/warsh|ورش/.test(r)) return 'warsh';
  if (/qalon|qaloon|qalun|قالون/.test(r)) return 'qalun';
  if (/sho'?bah|shu'?bah|shu3ba|شعبة/.test(r)) return 'shubah';
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
const styleOf = (t) => /تراويح|taraweeh|tarawee7|madinah_|makkah_/.test(t) ? 'taraweeh' : /مجود|mujawwad|mojawwad/i.test(t) ? 'mujawwad' : /معلم|muallim|mo'?lim/i.test(t) ? 'muallim' : 'murattal';

const cat = JSON.parse(readFileSync(P('public/content/audio/catalog.json'), 'utf8'));

/* ---- 1. MP3Quran ---- */
const namesAr = new Map(lines('mp3quran-names-ar.txt').map((l) => l.split('|')));
const partial = new Map(lines('mp3quran-partial-surahs.txt').map((l) => { const [k, v] = l.split('|'); return [k, ranges(v)]; }));
cat.recordings = cat.recordings.filter((r) => r.source === 'mp3quran');
cat.reciters = cat.reciters.filter((r) => !String(r.id).startsWith('qa-'));
for (const re of cat.reciters) { const n = namesAr.get(re.id); if (n) re.nameAr = n; re.recordings = re.recordings.filter((id) => id.startsWith('mp3quran:')); }
let unknown = 0;
for (const r of cat.recordings) {
  r.nameAr = namesAr.get(r.reciterId) || r.nameAr;
  const list = partial.get(`${r.reciterId}:${r.moshafId}`);
  if (list) { r.surahList = list; r.surahTotal = list.length; r.complete = list.length === 114; }
  r.riwayah = riwayahOf(r.recitation + ' ' + (r.recitationAr || ''));
  r.riwayahAr = RIWAYAH_AR[r.riwayah];
  r.style = /mojawwad|mujawwad/i.test(r.recitation) ? 'mujawwad' : /mo'?lim/i.test(r.recitation) ? 'muallim' : 'murattal';
  if (r.riwayah === 'unknown') unknown++;
}

/* ---- 2. QuranicAudio ---- */
// QuranicAudio qari id → MP3Quran reciter id, checked by hand against both catalogues (same person, different spelling).
const SAME = { 1: 62, 2: 60, 3: 4, 4: 31, 5: 123, 6: 112, 8: 74, 10: 87, 12: 111, 13: 30, 14: 81, 16: 118, 17: 32, 18: 46, 21: 55, 22: 109, 23: 17,
  24: 76, 28: 2, 31: 30, 32: 111, 35: 41, 37: 51, 40: 71, 41: 112, 43: 43, 50: 51, 51: 102, 60: 64, 65: 102, 69: 76, 70: 115, 72: 61, 80: 44,
  85: 163, 86: 163, 87: 163, 88: 125, 91: 106, 93: 78, 96: 163, 97: 92, 103: 1, 104: 86, 105: 226, 106: 304, 107: 109, 110: 64, 111: 64, 112: 64,
  55: 11, 114: 74, 115: 4, 116: 12, 117: 217, 122: 118, 124: 59, 125: 71, 126: 9, 127: 10, 128: 77, 129: 121, 130: 219, 136: 98, 137: 64, 138: 160,
  139: 163, 140: 163, 141: 118, 142: 118, 155: 138, 156: 31, 158: 76, 159: 102, 160: 217, 161: 24, 162: 287, 163: 56, 164: 118, 166: 21196,
  167: 254, 168: 221, 169: 268 };
const byId = new Map(cat.reciters.map((r) => [r.id, r]));
const groups = new Map(); // base Arabic name → new reciter (for reciters that MP3Quran does not have)
let added = 0;
for (const l of lines('quranicaudio-qaris.txt')) {
  const [id, ar, path, sec, surahs, kbps, mb] = l.split('|');
  const list = surahs ? ranges(surahs) : null;
  const style = styleOf(ar + ' ' + path);
  const riw = sec === '3' ? riwayahOf(ar + ' ' + path) : 'hafs';
  const base = ar.split(' - ')[0].replace(/\s*\(.*\)\s*/, '').replace(/[٠-٩\d]+/g, '').trim();
  let reciterId;
  if (sec === '2') {
    const mk = path.startsWith('makkah');
    reciterId = mk ? 'qa-makkah' : 'qa-madinah';
    if (!byId.has(reciterId)) { const re = { id: reciterId, name: mk ? 'Makkah Taraweeh' : 'Madinah Taraweeh', nameAr: mk ? 'تراويح الحرم المكي' : 'تراويح المسجد النبوي', famous: false, recordings: [], kind: 'taraweeh' }; byId.set(reciterId, re); cat.reciters.push(re); }
  } else if (SAME[id] && byId.has(String(SAME[id]))) {
    reciterId = String(SAME[id]);
  } else {
    if (!groups.has(base)) { const re = { id: `qa-${id}`, name: base, nameAr: base, famous: false, recordings: [] }; groups.set(base, re); byId.set(re.id, re); cat.reciters.push(re); }
    reciterId = groups.get(base).id;
  }
  const year = (ar.match(/[٠-٩]{4}|\d{4}/) || [''])[0];
  const variant = ar.includes(' - ') ? ar.split(' - ').slice(1).join(' - ') : sec === '2' ? `${year} هـ` : '';
  const rec = {
    id: `quranicaudio:${id}`, source: 'quranicaudio', reciterId, moshafId: `qa${id}`,
    name: byId.get(reciterId).name, nameAr: byId.get(reciterId).nameAr, recitation: variant || 'QuranicAudio', recitationAr: variant || undefined,
    server: `https://download.quranicaudio.com/quran/${path}/`, surahTotal: list ? list.length : 114, complete: !list || list.length === 114, surahList: list && list.length < 114 ? list : null,
    riwayah: riw, riwayahAr: RIWAYAH_AR[riw], style, kbps: Number(kbps) || null, sizeMB: Number(mb) || null, year: year || null,
  };
  cat.recordings.push(rec);
  byId.get(reciterId).recordings.push(rec.id);
  added++;
}

cat.version = 2;
cat.sources = ['mp3quran', 'quranicaudio'];
cat.sourceNote = 'MP3Quran (mp3quran.net) + QuranicAudio (quranicaudio.com) — streamed, user-initiated download only';
writeFileSync(P('public/content/audio/catalog.json'), JSON.stringify(cat));

/* ---- ledger ---- */
const ledgerPath = P('public/content/ledger.json');
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
ledger.entries = ledger.entries.filter((e) => e.id !== 'audio-quranicaudio-catalogue');
ledger.entries.push({ id: 'audio-quranicaudio-catalogue', kind: 'audio-catalogue', title: 'تسجيلات QuranicAudio (قراء إضافيون، تراويح الحرمين بالسنوات، روايات غير حفص)',
  source: 'quranicaudio.com/api/qaris + download.quranicaudio.com (Quran.Foundation)', licence: 'Free streaming/download site for Muslims; recordings belong to reciters/publishers. Not re-hosted.',
  licenceStatus: 'needs-confirmation', offlineBundling: 'not bundled — streamed; user-initiated download to the device only', reviewStatus: 'metadata-checked',
  reviewNotes: `Snapshot 2026-10-22: ${added} recordings (translation recordings excluded). Same-person matches with MP3Quran checked by hand; surah lists from the files API.` });
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));

const riw = {}; for (const r of cat.recordings) riw[r.riwayah] = (riw[r.riwayah] || 0) + 1;
console.log(`recordings ${cat.recordings.length} (+${added} QuranicAudio) · reciters ${cat.reciters.length} · unknown riwayah ${unknown}`, riw);
