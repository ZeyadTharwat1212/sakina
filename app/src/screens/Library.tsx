/** Sections 22–24, 34: hadith library, unified search, sources & rights ledger. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { getHadithIndex, getHadithChapter, getChapters, getSearchIndex, getAdhkar, getLedger, normalizeArabic, type LedgerEntry } from '../lib/content';
import { useStore, updateUser } from '../lib/store';
import { t, num, isAr } from '../lib/i18n';
import { navigate } from '../lib/router';
import { TopBar, Icon, useAsync, Loading, shareText, copyText, Notice } from '../components/ui';

const BOOKS = [
  { id: 'bukhari', name: 'صحيح البخاري', en: 'Sahih al-Bukhari' },
  { id: 'muslim', name: 'صحيح مسلم', en: 'Sahih Muslim' },
  { id: 'nawawi40', name: 'الأربعون النووية', en: 'Forty Hadith of al-Nawawi' },
];

export function LibraryHome() {
  const { user } = useStore();
  return (
    <main class="screen">
      <TopBar title={t('library')} right={<button class="icon-btn" aria-label={t('search')} onClick={() => navigate('/library/search')}><Icon name="search" /></button>} />
      <button class="input" style="text-align:start;color:var(--muted);margin-bottom:16px" onClick={() => navigate('/library/search')}>{t('searchHint')}</button>
      <h2 style="margin-bottom:8px">{t('hadith')}</h2>
      <div class="list">
        {BOOKS.map((b) => (
          <button key={b.id} class="list-item" onClick={() => navigate(`/library/hadith/${b.id}`)}>
            <Icon name="library" /><span class="grow"><span class="title">{isAr() ? b.name : b.en}</span><br /><span class="sub">{isAr() ? 'متن عربي · يعمل دون إنترنت' : 'Arabic matn · offline'}</span></span><span class="badge warn">{t('needsLicence')}</span>
          </button>
        ))}
      </div>
      <h2 style="margin:20px 0 8px">{isAr() ? 'المزيد' : 'More'}</h2>
      <div class="list">
        <button class="list-item" onClick={() => navigate('/quran?tab=marks')}><Icon name="star" /><span class="grow"><span class="title">{t('favourites')}</span><br /><span class="sub">{num(user.bookmarks.length)} {isAr() ? 'آية' : 'ayat'} · {num(user.favAdhkar.length)} {isAr() ? 'ذكر' : 'adhkar'} · {num(user.favHadith.length)} {t('hadith')}</span></span></button>
        <button class="list-item" onClick={() => navigate('/library/sources')}><Icon name="info" /><span class="grow"><span class="title">{t('sources')}</span><br /><span class="sub">{isAr() ? 'سجل المصدر والطبعة والترخيص والمراجعة لكل مادة' : 'Source, edition, licence and review record for every pack'}</span></span></button>
        <div class="list-item" style="opacity:.6"><Icon name="book" /><span class="grow"><span class="title">{isAr() ? 'التعلم · الفقه · السيرة · الحج · الزكاة · رمضان' : 'Learning · Fiqh · Seerah · Hajj · Zakat · Ramadan'}</span><br /><span class="sub">{isAr() ? 'المرحلة الثانية — بعد المراجعة العلمية وتأمين الحقوق' : 'Phase 2 — after scholarly review and rights clearance'}</span></span><span class="badge">{isAr() ? 'لاحقًا' : 'later'}</span></div>
      </div>
    </main>
  );
}

export function HadithBook({ book }: { book: string }) {
  const idx = useAsync(() => getHadithIndex(book), [book]);
  const [q, setQ] = useState('');
  const meta = BOOKS.find((b) => b.id === book);
  if (!idx.data) return <main class="screen"><TopBar title={meta?.name || ''} onBack /><Loading error={idx.error} /></main>;
  const d = idx.data;
  const chapters = d.chapters.filter((c) => !q || c.ar.includes(q) || c.en.toLowerCase().includes(q.toLowerCase()));
  return (
    <main class="screen">
      <TopBar title={d.title} onBack />
      <p class="muted small" style="margin-bottom:8px">{d.author} · {num(d.total)} {isAr() ? 'حديثًا' : 'hadith'} · {num(d.chapters.length)} {t('books')}</p>
      <div style="margin-bottom:12px"><Notice>{isAr() ? 'نسخة رقمية (ترقيم sunnah.com) لم تُطابَق بعد مع طبعة ورقية محددة ولم تُؤكَّد حقوق إعادة التوزيع — للتطوير والمراجعة.' : 'Digital copy (sunnah.com numbering) not yet matched to a named printed edition; redistribution rights unconfirmed — for development and review.'}</Notice></div>
      <input class="input" style="margin-bottom:12px" placeholder={isAr() ? 'ابحث في الكتب' : 'Search books'} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="list">
        {chapters.map((c) => <button key={c.id} class="list-item" onClick={() => navigate(`/library/hadith/${book}/${c.id}`)}><span class="badge num">{num(c.id)}</span><span class="grow"><span class="title">{c.ar}</span><br /><span class="sub">{num(c.count)} {t('hadith')}{!isAr() ? ` · ${c.en}` : ''}</span></span></button>)}
      </div>
    </main>
  );
}

export function HadithChapterScreen({ book, chapter, focus }: { book: string; chapter: number; focus?: number }) {
  const { user } = useStore();
  const idx = useAsync(() => getHadithIndex(book), [book]);
  const ch = useAsync(() => getHadithChapter(book, chapter), [book, chapter]);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (ch.data && focus) { const el = document.getElementById(`h-${focus}`); if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); } } }, [ch.data, focus]);
  if (!idx.data || !ch.data) return <main class="screen"><TopBar title="" onBack /><Loading error={idx.error || ch.error} /></main>;
  const chapterMeta = idx.data.chapters.find((c) => c.id === chapter);
  return (
    <main class="screen">
      <TopBar title={chapterMeta?.ar || ''} onBack><small class="muted">{idx.data.title}</small></TopBar>
      <div class="stack">
        {ch.data.hadiths.map((h) => {
          const key = `${book}:${h.id}`;
          const fav = user.favHadith.includes(key);
          const ref = `${idx.data!.title} · ${chapterMeta?.ar} · ${isAr() ? 'رقم' : 'no.'} ${h.id}`;
          return (
            <section key={h.id} id={`h-${h.id}`} class={`card ${focus === h.id ? 'soft' : ''}`}>
              <p class="hadith-text" dir="rtl">{h.ar}</p>
              <p class="muted small" style="margin-top:8px">{ref} <span class="badge">{isAr() ? 'ترقيم sunnah.com' : 'sunnah.com numbering'}</span></p>
              <div class="row" style="margin-top:8px;gap:4px;flex-wrap:wrap">
                <button class="btn ghost sm" aria-pressed={fav} onClick={() => updateUser((u) => ({ favHadith: fav ? u.favHadith.filter((x) => x !== key) : [...u.favHadith, key] }))}><Icon name="star" />{fav ? '★' : '☆'}</button>
                <button class="btn ghost sm" onClick={async () => setMsg((await copyText(`${h.ar}\n[${ref}]`)) ? t('copied') : '')}><Icon name="copy" />{t('copy')}</button>
                <button class="btn ghost sm" onClick={() => shareText(`${h.ar}\n[${ref}]`)}><Icon name="share" />{t('share')}</button>
              </div>
            </section>
          );
        })}
      </div>
      {msg && <p class="muted small" style="text-align:center;margin-top:8px">{msg}</p>}
      <p class="muted small" style="margin-top:16px;text-align:center">{isAr() ? 'المشاركة تتضمن المتن كاملًا مع مرجعه. لا يحكم التطبيق على صحة الحديث؛ الحكم للمحدّثين بأسمائهم.' : 'Sharing includes the full text with its reference. The app never grades authenticity itself.'}</p>
    </main>
  );
}

/* ------------------------------------------------------------------ */
export function SearchScreen({ q: initial }: { q: string }) {
  const [q, setQ] = useState(initial);
  const [scope, setScope] = useState<'quran' | 'adhkar' | 'hadith'>('quran');
  const [book, setBook] = useState('nawawi40');
  const chapters = useAsync(getChapters, []);
  const qIndex = useAsync(getSearchIndex, []);
  const adhkar = useAsync(getAdhkar, []);
  const hadith = useAsync(async () => { const i = await getHadithIndex(book); const all = await Promise.all(i.chapters.map((c) => getHadithChapter(book, c.id))); return { index: i, all }; }, [book, scope === 'hadith']);
  const nq = normalizeArabic(q.trim());
  const refMatch = q.trim().match(/^(\d{1,3})[:\s](\d{1,3})$/);
  // Normalised copy of the index (built once); results always point back to the original text.
  const qNorm = useMemo(() => qIndex.data ? qIndex.data.map(([c, v, txt]) => [c, v, txt, normalizeArabic(txt)] as const) : null, [qIndex.data]);

  const results = useMemo(() => {
    if (!nq || nq.length < 2) return [] as { kind: string; title: string; text: string; sub: string; go: string }[];
    const out: { kind: string; title: string; text: string; sub: string; go: string }[] = [];
    if (scope === 'quran' && qNorm && chapters.data) {
      for (const [c, v, txt, ntxt] of qNorm) {
        if (ntxt.includes(nq)) { out.push({ kind: t('ayah'), title: `${chapters.data[c - 1].name} · ${num(v)}`, text: txt, sub: isAr() ? 'نص مبسط للبحث — افتح الآية للنص العثماني' : 'Simplified search text — open for the Uthmani text', go: `/quran/read/${c}/${v}` }); if (out.length >= 100) break; }
      }
    }
    if (scope === 'adhkar' && adhkar.data) {
      for (const c of adhkar.data.categories) for (const i of c.items) if (normalizeArabic(i.text).includes(nq)) out.push({ kind: t('adhkar'), title: c.name, text: i.text, sub: i.ref || '', go: `/adhkar/session/${c.id}` });
    }
    if (scope === 'hadith' && hadith.data) {
      for (const ch of hadith.data.all) for (const h of ch.hadiths) if (normalizeArabic(h.ar).includes(nq)) { out.push({ kind: t('hadith'), title: `${hadith.data.index.title} · ${num(h.id)}`, text: h.ar, sub: hadith.data.index.chapters.find((c) => c.id === ch.chapter)?.ar || '', go: `/library/hadith/${book}/${ch.chapter}/${h.id}` }); if (out.length >= 100) break; }
    }
    return out;
  }, [nq, scope, qNorm, adhkar.data, hadith.data, chapters.data]);

  const highlight = (text: string) => {
    const i = normalizeArabic(text).indexOf(nq);
    const start = Math.max(0, i - 60);
    return (i >= 0 ? (start > 0 ? '…' : '') : '') + text.slice(start, start + 220) + (text.length > start + 220 ? '…' : '');
  };
  return (
    <main class="screen">
      <TopBar title={t('search')} onBack />
      <input class="input" autoFocus placeholder={t('searchHint')} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="chips" style="margin:12px 0">
        {(['quran', 'adhkar', 'hadith'] as const).map((s) => <button key={s} class="chip" aria-pressed={scope === s} onClick={() => setScope(s)}>{t(s)}</button>)}
        {scope === 'hadith' && BOOKS.map((b) => <button key={b.id} class="chip" aria-pressed={book === b.id} onClick={() => setBook(b.id)}>{b.name}</button>)}
      </div>
      {refMatch && chapters.data && Number(refMatch[1]) <= 114 && <button class="card soft" style="width:100%;text-align:start;margin-bottom:12px" onClick={() => navigate(`/quran/read/${refMatch[1]}/${refMatch[2]}`)}>{isAr() ? 'انتقال إلى' : 'Go to'} {chapters.data[Number(refMatch[1]) - 1].name} : {num(refMatch[2])}</button>}
      {scope === 'hadith' && hadith.loading && <Loading />}
      {nq.length >= 2 && results.length === 0 && !(scope === 'hadith' && hadith.loading) && <p class="muted" style="text-align:center;padding:24px">{t('noResults')}</p>}
      <div class="list">
        {results.map((r, i) => (
          <button key={i} class="list-item" onClick={() => navigate(r.go)}>
            <span class="grow"><span class="badge" style="margin-bottom:4px">{r.kind}</span> <span class="title">{r.title}</span><br /><span class="body-text" style="font-size:.95em">{highlight(r.text)}</span>{r.sub && <><br /><span class="sub">{r.sub}</span></>}</span>
          </button>
        ))}
      </div>
      <p class="muted small" style="margin-top:16px">{isAr() ? 'البحث يتجاهل التشكيل والهمزات؛ النتائج تعود إلى النص الأصلي دون تغيير. البحث محلي بالكامل.' : 'Search ignores diacritics and hamza forms; results link to the unchanged original text. Entirely on-device.'}</p>
    </main>
  );
}

/* ------------------------------------------------------------------ */
export function SourcesScreen() {
  const ledger = useAsync(getLedger, []);
  if (!ledger.data) return <main class="screen"><TopBar title={t('sources')} onBack /><Loading error={ledger.error} /></main>;
  const statusBadge = (e: LedgerEntry) => e.licenceStatus.startsWith('granted') ? <span class="badge ok">{isAr() ? 'مرخّص' : 'licensed'}</span> : <span class="badge warn">{e.licenceStatus === 'unknown' ? (isAr() ? 'ترخيص غير معروف' : 'licence unknown') : t('needsLicence')}</span>;
  const review = (e: LedgerEntry) => e.reviewStatus.includes('not-scholar') ? <span class="badge warn">{t('notReviewed')}</span> : <span class="badge">{e.reviewStatus}</span>;
  return (
    <main class="screen">
      <TopBar title={t('sources')} onBack />
      <p class="text-2 small" style="margin-bottom:12px">{isAr() ? `سجل تحريري لكل مادة: المصدر، الترخيص، الإصدار، حالة المراجعة. أُنشئ في ${ledger.data.generatedOn}. لا توصف أي مادة بأنها «راجعها علماء» دون أسماء وسجل مراجعة فعلي.` : `Editorial record per pack: source, licence, revision, review status. Generated ${ledger.data.generatedOn}. Nothing is labelled “scholar-reviewed” without named reviewers and a real record.`}</p>
      <div class="stack">
        {ledger.data.entries.map((e) => (
          <section key={e.id} class="card">
            <div class="row between" style="align-items:flex-start"><h3>{e.title}</h3><span class="badge">{e.kind}</span></div>
            {e.author && <p class="text-2 small">{e.author}</p>}
            <div class="chips" style="margin:8px 0">{statusBadge(e)}{review(e)}</div>
            <dl class="kv">
              <dt>{t('source')}</dt><dd style="word-break:break-word">{e.source}</dd>
              <dt>{isAr() ? 'الترخيص' : 'Licence'}</dt><dd>{e.licence}</dd>
              <dt>{isAr() ? 'دون إنترنت' : 'Offline'}</dt><dd>{e.offlineBundling}</dd>
              {e.edition && <><dt>{isAr() ? 'الطبعة' : 'Edition'}</dt><dd>{e.edition}</dd></>}
              {e.upstreamRevision && <><dt>{isAr() ? 'الإصدار' : 'Revision'}</dt><dd class="num" style="word-break:break-all">{e.upstreamRevision.slice(0, 12)}</dd></>}
              {e.reviewNotes && <><dt>{isAr() ? 'ملاحظات' : 'Notes'}</dt><dd>{e.reviewNotes}</dd></>}
            </dl>
          </section>
        ))}
      </div>
    </main>
  );
}
