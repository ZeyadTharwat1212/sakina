// Section 38 — text integrity & pack consistency. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const C = path.resolve('public/content');
const rj = (p) => JSON.parse(fs.readFileSync(path.join(C, p), 'utf8'));

test('114 surahs, 6236 ayat, verse counts match', () => {
  const chapters = rj('quran/chapters.json');
  assert.equal(chapters.length, 114);
  let total = 0;
  for (const c of chapters) {
    const s = rj(`quran/text/${c.id}.json`);
    assert.equal(s.verses.length, c.verses, `surah ${c.id}`);
    s.verses.forEach((v, i) => assert.equal(v.v, i + 1));
    total += s.verses.length;
  }
  assert.equal(total, 6236);
});

test('basmala rules: present as header for all but 1 and 9; stored text untouched', () => {
  const chapters = rj('quran/chapters.json');
  const bas = rj('quran/text/1.json').verses[0].t;
  for (const c of chapters) {
    const s = rj(`quran/text/${c.id}.json`);
    if (c.id === 1 || c.id === 9) { assert.equal(s.basmalaPrefixLen, 0); assert.equal(c.basmala, false); }
    else {
      assert.ok(s.basmalaPrefixLen > 0, `surah ${c.id}`);
      const head = s.verses[0].t.slice(0, s.basmalaPrefixLen - 1);
      assert.ok(head === bas || head === bas[0] + 'ّ' + bas.slice(1), `surah ${c.id} basmala form`);
      assert.ok(s.verses[0].t.slice(s.basmalaPrefixLen).length > 0);
    }
  }
  assert.ok(!rj('quran/text/9.json').verses[0].t.startsWith(bas));
});

test('page map: 604 pages, contiguous, covers 1:1 → 114:6', () => {
  const m = rj('quran/meta.json');
  const chapters = rj('quran/chapters.json');
  assert.equal(m.pages.length, 604);
  assert.deepEqual(m.pages[0].slice(1), [1, 1, 1, 7]);
  assert.deepEqual(m.pages[603].slice(1, 3), [112, 1]);
  assert.deepEqual(m.pages[603].slice(3), [114, 6]);
  for (let i = 1; i < m.pages.length; i++) {
    const prev = m.pages[i - 1], cur = m.pages[i];
    assert.equal(cur[0], prev[0] + 1);
    // next page starts right after previous page ends
    const [, , , ec, ev] = prev;
    const [, sc, sv] = cur;
    if (ev === chapters[ec - 1].verses) assert.deepEqual([sc, sv], [ec + 1, 1], `page ${cur[0]}`);
    else assert.deepEqual([sc, sv], [ec, ev + 1], `page ${cur[0]}`);
  }
  assert.equal(m.juz.length, 30);
  assert.equal(m.sajda.length, 15);
});

test('known page anchors (Madani mushaf)', () => {
  const m = rj('quran/meta.json');
  const pageOf = (ch, v) => m.pages.find(([, sc, sv, ec, ev]) => (sc < ch || (sc === ch && sv <= v)) && (ec > ch || (ec === ch && ev >= v)))[0];
  assert.equal(pageOf(2, 1), 2);
  assert.equal(pageOf(2, 255), 42);
  assert.equal(pageOf(18, 1), 293);
  assert.equal(pageOf(36, 1), 440);
  assert.equal(pageOf(67, 1), 562);
  assert.equal(pageOf(114, 1), 604);
});

test('tafsir and translation packs cover every ayah', () => {
  const chapters = rj('quran/chapters.json');
  for (const id of ['tafsir/jalalayn', 'tafsir/muyassar', 'translation/en-saheeh']) {
    for (const c of chapters) {
      const p = rj(`quran/${id}/${c.id}.json`);
      assert.equal(p.verses.length, c.verses, `${id} ${c.id}`);
      assert.ok(p.verses.every((v) => typeof v.t === 'string' && v.t.length > 0));
    }
  }
});

test('search index rows align with text', () => {
  const idx = rj('quran/search-index.json');
  assert.equal(idx.length, 6236);
  assert.equal(idx[0][0], 1); assert.equal(idx[0][1], 1);
  assert.equal(idx[6235][0], 114); assert.equal(idx[6235][1], 6);
});

test('adhkar pack: counts ≥ 1, no empty text, ledger notes incomplete takhrij', () => {
  const a = rj('adhkar/azkar.json');
  const items = a.categories.flatMap((c) => c.items);
  assert.ok(items.length > 300);
  for (const i of items) { assert.ok(i.count >= 1); assert.ok(i.text.trim().length > 0); }
  const ledger = rj('ledger.json').entries.find((e) => e.id === 'adhkar-hisn-azkardb');
  assert.equal(ledger.reviewStatus, 'not-scholar-reviewed');
});

test('hadith packs: index counts match chapter files; no English bundled', () => {
  for (const book of ['bukhari', 'muslim', 'nawawi40']) {
    const idx = rj(`hadith/${book}/index.json`);
    let n = 0;
    for (const c of idx.chapters) { const ch = rj(`hadith/${book}/${c.id}.json`); assert.equal(ch.hadiths.length, c.count); n += ch.hadiths.length; for (const h of ch.hadiths) assert.equal(h.en, undefined); }
    assert.equal(n, idx.total);
  }
});

test('ledger: every pack has source, licence, status; hadith flagged needs-confirmation', () => {
  const l = rj('ledger.json');
  for (const e of l.entries) for (const k of ['id', 'kind', 'title', 'source', 'licence', 'licenceStatus', 'offlineBundling', 'reviewStatus']) assert.ok(e[k], `${e.id}.${k}`);
  assert.equal(l.entries.find((e) => e.id === 'hadith-bukhari').licenceStatus, 'needs-confirmation');
  assert.equal(l.entries.find((e) => e.id === 'quran-text-uthmani-hafs').licenceStatus, 'granted');
});

test('audio catalogue: 33 famous reciters resolve, MP3Quran + QuranicAudio merged, every riwayah named, ids are unique, hafs/warsh/qalun parsed, complete only when 114', () => {
  const c = rj('audio/catalog.json');
  assert.equal(c.famousMissing.length, 0);
  assert.equal(c.famousOrder.length, 33);
  const ids = new Set(c.recordings.map((r) => r.id)); assert.equal(ids.size, c.recordings.length);
  for (const r of c.recordings) { assert.equal(r.complete, r.surahTotal === 114); assert.ok(r.server.startsWith('https://')); assert.ok(['murattal', 'mujawwad', 'muallim', 'taraweeh'].includes(r.style)); assert.notEqual(r.riwayah, 'unknown', r.id); assert.ok(!r.surahList || r.surahList.length === r.surahTotal, r.id); }
  // v2: QuranicAudio recordings join the MP3Quran ones; Haramain taraweeh grouped by mosque; every reciter has an Arabic name
  assert.ok(c.recordings.filter((r) => r.source === 'quranicaudio').length >= 120);
  assert.ok(c.reciters.find((r) => r.id === 'qa-makkah')?.recordings.length >= 10);
  for (const r of c.reciters) assert.ok(r.nameAr, `arabic name for reciter ${r.id}`);
  for (const r of c.reciters) for (const id of r.recordings) assert.ok(ids.has(id), id);
  const hussary = c.recordings.filter((r) => r.reciterId === '118');
  assert.ok(hussary.some((r) => r.riwayah === 'hafs') && hussary.some((r) => r.riwayah === 'warsh') && hussary.some((r) => r.riwayah === 'qalun') && hussary.some((r) => r.riwayah === 'duri'));
  for (const id of c.famousOrder) assert.ok(c.reciters.find((r) => r.id === id)?.nameAr, `arabic name for ${id}`);
});
