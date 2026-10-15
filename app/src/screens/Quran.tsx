/** Sections 07–10: index, ayah mode, page mode, tafsir/translation panel, bookmarks, last position. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getChapters, getMeta, getSurah, getTafsir, getTranslation, ayahDisplay, basmalaOf, pageOf, juzOf, isSajda, TAFSIRS, type Chapter, type QuranMeta, type SurahText } from '../lib/content';
import { useStore, updateUser, updateSettings, type Bookmark } from '../lib/store';
import { t, num, isAr } from '../lib/i18n';
import { navigate } from '../lib/router';
import { TopBar, Sheet, Icon, useAsync, Loading, Seg, shareText, copyText, Toggle } from '../components/ui';
import { playFromReader } from './Audio';

const toArabicIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

export function QuranIndex() {
  const { user } = useStore();
  const chapters = useAsync(getChapters, []);
  const meta = useAsync(getMeta, []);
  const [tab, setTab] = useState<'surah' | 'juz' | 'page' | 'marks'>('surah');
  const [q, setQ] = useState('');
  const [jump, setJump] = useState('');
  if (!chapters.data || !meta.data) return <main class="screen"><TopBar title={t('quran')} /><Loading error={chapters.error || meta.error} /></main>;
  const chs = chapters.data, m = meta.data;
  const filtered = chs.filter((c) => !q || c.name.includes(q) || c.tr.toLowerCase().includes(q.toLowerCase()) || String(c.id) === q);
  const doJump = () => {
    const mm = jump.trim().match(/^(\d+)(?:[:\s]+(\d+))?$/);
    if (!mm) return;
    const a = Number(mm[1]), b = mm[2] ? Number(mm[2]) : 1;
    if (tab === 'page') { if (a >= 1 && a <= m.mushaf.pages) navigate(`/quran/page/${a}`); return; }
    if (a >= 1 && a <= 114) navigate(`/quran/read/${a}/${Math.min(Math.max(1, b), chs[a - 1].verses)}`);
  };
  return (
    <main class="screen">
      <TopBar title={t('quran')} right={<>
        <button class="icon-btn" aria-label={isAr() ? 'القراء' : 'Reciters'} onClick={() => navigate('/quran/reciters')}><Icon name="play" /></button>
        <button class="icon-btn" aria-label={t('search')} onClick={() => navigate('/library/search')}><Icon name="search" /></button>
      </>} />
      {user.lastRead && (
        <button class="card soft" style="width:100%;text-align:start;margin-bottom:12px" onClick={() => navigate(`/quran/read/${user.lastRead!.ch}/${user.lastRead!.v}`)}>
          <strong>{t('continueReading')}</strong><br /><span class="text-2">{chs[user.lastRead.ch - 1].name} · {t('ayah')} {num(user.lastRead.v)} · {t('page')} {num(user.lastRead.page)}</span>
        </button>
      )}
      <Seg value={tab} options={[{ v: 'surah', label: t('surah') }, { v: 'juz', label: t('juz') }, { v: 'page', label: t('page') }, { v: 'marks', label: t('bookmark') }]} onChange={setTab} />
      <div class="row" style="margin:12px 0">
        {tab === 'surah' ? <input class="input" placeholder={isAr() ? 'اسم السورة أو رقمها' : 'Surah name or number'} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          : <><input class="input" inputMode="numeric" placeholder={tab === 'page' ? (isAr() ? 'رقم الصفحة' : 'Page number') : (isAr() ? 'سورة:آية مثل 2:255' : 'surah:ayah e.g. 2:255')} value={jump} onInput={(e) => setJump((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && doJump()} /><button class="btn sm" onClick={doJump}>{isAr() ? 'انتقال' : 'Go'}</button></>}
      </div>
      {tab === 'surah' && (
        <div class="list">
          {filtered.map((c) => (
            <button key={c.id} class="list-item" onClick={() => navigate(`/quran/read/${c.id}/1`)}>
              <span class="badge num">{num(c.id)}</span>
              <span class="grow"><span class="title" style="font-family:var(--font-quran);font-size:1.15em">{c.name}</span><br /><span class="sub">{c.type === 'meccan' ? (isAr() ? 'مكية' : 'Meccan') : (isAr() ? 'مدنية' : 'Medinan')} · {num(c.verses)} {t('ayah')} · {t('page')} {num(c.page)}</span></span>
              {!isAr() && <span class="sub">{c.tr}</span>}
            </button>
          ))}
        </div>
      )}
      {tab === 'juz' && (
        <div class="list">
          {m.juz.map(([j, sc, sv]) => (
            <button key={j} class="list-item" onClick={() => navigate(`/quran/read/${sc}/${sv}`)}>
              <span class="badge num">{num(j)}</span>
              <span class="grow"><span class="title">{t('juz')} {num(j)}</span><br /><span class="sub">{chs[sc - 1].name} · {t('ayah')} {num(sv)} · {t('page')} {num(pageOf(m, sc, sv))}</span></span>
            </button>
          ))}
        </div>
      )}
      {tab === 'page' && (
        <>
          <p class="muted small" style="margin-bottom:8px">{m.mushaf.name} · {m.mushaf.riwayah} · {num(m.mushaf.pages)} {t('page')}</p>
          <div class="grid-2 tablet-3">
            {chs.map((c) => <button key={c.id} class="chip" onClick={() => navigate(`/quran/page/${c.page}`)}>{c.name} · {num(c.page)}</button>)}
          </div>
        </>
      )}
      {tab === 'marks' && (
        user.bookmarks.length === 0 ? <p class="muted" style="text-align:center;padding:32px">{isAr() ? 'لا علامات بعد. اضغط آية ثم «علامة».' : 'No bookmarks yet. Tap an ayah, then “Bookmark”.'}</p> :
        <div class="list">
          {[...user.bookmarks].sort((a, b) => b.at - a.at).map((b) => (
            <button key={b.id} class="list-item" onClick={() => navigate(`/quran/read/${b.ch}/${b.v}`)}>
              <span class={`badge ${b.tag === 'hifz' ? 'ok' : b.tag === 'review' ? 'warn' : ''}`}>{b.tag === 'reading' ? (isAr() ? 'قراءة' : 'reading') : b.tag === 'hifz' ? (isAr() ? 'حفظ' : 'hifz') : (isAr() ? 'مراجعة' : 'review')}</span>
              <span class="grow"><span class="title">{chs[b.ch - 1].name} · {num(b.v)}</span>{b.note && <><br /><span class="sub">{b.note}</span></>}</span>
              <button class="icon-btn" aria-label="حذف" onClick={(e) => { e.stopPropagation(); updateUser((u) => ({ bookmarks: u.bookmarks.filter((x) => x.id !== b.id) })); }}><Icon name="close" /></button>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
interface ReaderProps { ch?: number; v?: number; page?: number }
export function QuranReader(props: ReaderProps) {
  const { settings } = useStore();
  const chapters = useAsync(getChapters, []);
  const meta = useAsync(getMeta, []);
  const pageMode = props.page !== undefined;
  // Which surahs do we need? page mode may span two surahs.
  const span = useMemo(() => {
    if (!meta.data) return null;
    if (!pageMode) return { chs: [props.ch!], page: 0 };
    const p = meta.data.pages[props.page! - 1];
    if (!p) return null;
    const chs: number[] = []; for (let c = p[1]; c <= p[3]; c++) chs.push(c);
    return { chs, page: props.page!, p };
  }, [meta.data, props.ch, props.page]);
  const texts = useAsync(async () => span ? Promise.all(span.chs.map(getSurah)) : [], [span?.chs.join(',')]);
  const [sel, setSel] = useState<{ ch: number; v: number } | null>(null);
  const [multi, setMulti] = useState<{ ch: number; from: number; to: number } | null>(null); // "اختر عدة آيات" mode
  const [panel, setPanel] = useState<'none' | 'tafsir' | 'translation'>('none');
  const inMulti = (ch: number, v: number) => !!multi && multi.ch === ch && v >= multi.from && v <= multi.to;
  const tapAyah = (ch: number, v: number) => {
    if (!multi) { setSel({ ch, v }); return; }
    if (multi.ch !== ch) { setMulti({ ch, from: v, to: v }); return; }
    if (v === multi.from && v === multi.to) { setMulti(null); return; }
    if (v < multi.from) setMulti({ ...multi, from: v }); else if (v > multi.to) setMulti({ ...multi, to: v }); else if (v - multi.from <= multi.to - v) setMulti({ ...multi, from: v }); else setMulti({ ...multi, to: v });
  };
  const [focus, setFocus] = useState(false);
  const scrolledRef = useRef(false);

  // Scroll to requested ayah once.
  useEffect(() => {
    if (!texts.data || scrolledRef.current || pageMode) return;
    const el = document.getElementById(`a-${props.ch}-${props.v}`);
    if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); scrolledRef.current = true; }
  }, [texts.data]);
  useEffect(() => { scrolledRef.current = false; }, [props.ch, props.v, props.page]);

  // Track the topmost visible ayah → last reading position (distinct from "listened", section 08).
  useEffect(() => {
    if (!texts.data || !meta.data) return;
    const m = meta.data;
    let timer: number | undefined;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!vis) return;
      const [, c, v] = (vis.target as HTMLElement).id.split('-').map(Number);
      clearTimeout(timer);
      timer = window.setTimeout(() => updateUser({ lastRead: { ch: c, v, page: pageOf(m, c, v), at: Date.now(), kind: 'read' } }), 800);
    }, { rootMargin: '-15% 0px -70% 0px' });
    document.querySelectorAll('[id^="a-"]').forEach((el) => io.observe(el));
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [texts.data, meta.data]);

  if (!chapters.data || !meta.data || !texts.data) return <main class="screen"><TopBar title={t('quran')} onBack /><Loading error={chapters.error || meta.error || texts.error} /></main>;
  const chs = chapters.data, m = meta.data;
  const title = pageMode ? `${t('page')} ${num(props.page!)}` : chs[props.ch! - 1].name;
  const curPage = pageMode ? props.page! : (sel ? pageOf(m, sel.ch, sel.v) : pageOf(m, props.ch!, props.v!));
  const curJuz = pageMode ? juzOf(m, span!.p![1], span!.p![2]) : juzOf(m, props.ch!, props.v!);

  const renderSurah = (s: SurahText, onlyRange?: [number, number]) => {
    const c = chs[s.ch - 1];
    const verses = onlyRange ? s.verses.filter((x) => x.v >= onlyRange[0] && x.v <= onlyRange[1]) : s.verses;
    const showHead = !onlyRange || onlyRange[0] === 1;
    const basmala = basmalaOf(s);
    return (
      <div key={s.ch}>
        {showHead && <div class="surah-head"><div class="name">سُورَةُ {c.name}</div><small class="muted">{c.type === 'meccan' ? 'مكية' : 'مدنية'} · {num(c.verses)} آية</small></div>}
        {showHead && basmala && <div class="basmala">{basmala}</div>}
        {settings.quranMode === 'page' || pageMode ? (
          <p class="ayah-text">
            {verses.map((x) => (
              <span key={x.v} id={`a-${s.ch}-${x.v}`} class={`ayah ${(sel?.ch === s.ch && sel.v === x.v) || inMulti(s.ch, x.v) ? 'selected' : ''}`} onClick={() => tapAyah(s.ch, x.v)} role="button" tabIndex={0}>
                {ayahDisplay(s, x)} <span class="ayah-no">﴿{toArabicIndic(x.v)}﴾</span>{isSajda(m, s.ch, x.v) && <span class="badge" title="سجدة">۩</span>}{' '}
              </span>
            ))}
          </p>
        ) : (
          <div class="ayah-list">
            {verses.map((x) => (
              <div key={x.v} id={`a-${s.ch}-${x.v}`} class={`ayah-item ${(sel?.ch === s.ch && sel.v === x.v) || inMulti(s.ch, x.v) ? 'selected' : ''}`} onClick={() => tapAyah(s.ch, x.v)} role="button" tabIndex={0}>
                <p class="ayah-text">{ayahDisplay(s, x)} <span class="ayah-no">﴿{toArabicIndic(x.v)}﴾</span>{isSajda(m, s.ch, x.v) && <span class="badge" title="سجدة">۩</span>}</p>
                {panel !== 'none' && <PanelText kind={panel} ch={s.ch} v={x.v} tafsirId={settings.tafsir} />}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <main class="screen" style={focus ? 'padding-top:8px' : ''}>
      {!focus && (
        <TopBar title={title} onBack right={<>
          <button class="icon-btn" aria-label={t('listen')} onClick={() => void playFromReader(pageMode ? span!.chs[0] : props.ch!, settings.reciterId)}><Icon name="play" /></button>
          <button class="icon-btn" aria-label="خيارات" onClick={() => setPanel(panel === 'none' ? 'tafsir' : panel === 'tafsir' ? 'translation' : 'none')}><Icon name="book" /></button>
        </>}>
          <small class="muted num">{t('juz')} {num(curJuz)} · {t('page')} {num(curPage)}</small>
        </TopBar>
      )}
      {!focus && !pageMode && (
        <div class="row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">
          <Seg value={settings.quranMode} options={[{ v: 'ayah', label: t('ayahMode') }, { v: 'page', label: t('pageMode') }]} onChange={(v) => updateSettings({ quranMode: v })} />
          <button class="chip" aria-pressed={panel === 'tafsir'} onClick={() => setPanel(panel === 'tafsir' ? 'none' : 'tafsir')}>{t('tafsir')}: {TAFSIRS.find((x) => x.id === settings.tafsir)?.name}</button>
          <button class="chip" aria-pressed={panel === 'translation'} onClick={() => setPanel(panel === 'translation' ? 'none' : 'translation')}>{t('translation')} EN</button>
          <button class="chip" onClick={() => setFocus(true)}>{isAr() ? 'تركيز' : 'Focus'}</button>
        </div>
      )}
      {focus && <button class="chip" style="position:fixed;top:calc(var(--safe-top) + 8px);inset-inline-end:16px;z-index:5" onClick={() => setFocus(false)}>{isAr() ? 'إنهاء التركيز' : 'Exit focus'}</button>}

      <div class="quran-surface">
        {pageMode && <p class="muted small" style="text-align:center;margin-bottom:8px">{isAr() ? 'صفحة نصية بحدود صفحات مصحف المدينة (604) — ليست صورة طبق الأصل لسطور المصحف' : 'Text page following the Madani (604) page boundaries — not a facsimile of the printed lines'}</p>}
        {pageMode
          ? texts.data.map((s) => {
              const p = span!.p!;
              const from = s.ch === p[1] ? p[2] : 1;
              const to = s.ch === p[3] ? p[4] : s.verses.length;
              return renderSurah(s, [from, to]);
            })
          : texts.data.map((s) => renderSurah(s))}
      </div>

      <div class="row between" style="margin-top:16px">
        {pageMode ? (
          <>
            <button class="btn secondary sm" disabled={props.page! >= m.mushaf.pages} onClick={() => navigate(`/quran/page/${props.page! + 1}`)}>{isAr() ? 'الصفحة التالية' : 'Next page'}</button>
            <span class="muted num">{num(props.page!)} / {num(m.mushaf.pages)}</span>
            <button class="btn secondary sm" disabled={props.page! <= 1} onClick={() => navigate(`/quran/page/${props.page! - 1}`)}>{isAr() ? 'السابقة' : 'Previous'}</button>
          </>
        ) : (
          <>
            <button class="btn secondary sm" disabled={props.ch! >= 114} onClick={() => navigate(`/quran/read/${props.ch! + 1}/1`)}>{isAr() ? 'السورة التالية' : 'Next surah'}</button>
            <button class="btn ghost sm" onClick={() => navigate(`/quran/page/${curPage}`)}>{t('page')} {num(curPage)}</button>
            <button class="btn secondary sm" disabled={props.ch! <= 1} onClick={() => navigate(`/quran/read/${props.ch! - 1}/1`)}>{isAr() ? 'السابقة' : 'Previous'}</button>
          </>
        )}
      </div>
      <p class="muted small" style="margin-top:16px;text-align:center">{isAr() ? 'النص: مشروع تنزيل (Tanzil) — رواية حفص عن عاصم، نسخة حرفية دون تعديل.' : 'Text: Tanzil Project — Hafs ʿan ʿĀṣim, verbatim.'} <a href="#/library/sources">{t('sources')}</a></p>

      <AyahSheet sel={sel} onClose={() => setSel(null)} chs={chs} meta={m} texts={texts.data} tafsirId={settings.tafsir} onMulti={() => { if (sel) { setMulti({ ch: sel.ch, from: sel.v, to: sel.v }); setSel(null); } }} />
      {multi && (() => { const st = texts.data!.find((x) => x.ch === multi.ch)!; const c = chs[multi.ch - 1]; const n = multi.to - multi.from + 1; const joined = st.verses.slice(multi.from - 1, multi.to).map((v) => `${ayahDisplay(st, v)} ﴿${toArabicIndic(v.v)}﴾`).join(' '); const ref = `﴿${joined}﴾ [${c.name}: ${multi.from}${n > 1 ? `–${multi.to}` : ''}]`; return (
        <div class="multi-bar" role="toolbar">
          <div class="grow"><strong>{c.name} · {n === 1 ? `${t('ayah')} ${num(multi.from)}` : `${t('ayah')} ${num(multi.from)}–${num(multi.to)}`}</strong><br /><small class="muted">{isAr() ? 'اضغط آية أخرى لتوسيع التحديد، أو الآية نفسها لإلغائه' : 'Tap another ayah to extend, the same one to clear'}</small></div>
          <button class="btn sm" onClick={() => { void playFromReader(multi.ch, settings.reciterId, { from: multi.from, to: multi.to }); }}><Icon name="play" />{t('listen')}</button>
          <button class="icon-btn" aria-label={t('copy')} onClick={() => void copyText(ref)}><Icon name="copy" /></button>
          <button class="icon-btn" aria-label={t('share')} onClick={() => void shareText(`${ref}\n${isAr() ? 'المصدر: مشروع تنزيل، رواية حفص' : 'Source: Tanzil, Hafs'}`)}><Icon name="share" /></button>
          <button class="icon-btn" aria-label={t('cancel')} onClick={() => setMulti(null)}><Icon name="close" /></button>
        </div>); })()}
    </main>
  );
}

function PanelText({ kind, ch, v, tafsirId }: { kind: 'tafsir' | 'translation'; ch: number; v: number; tafsirId: string }) {
  const d = useAsync(() => kind === 'tafsir' ? getTafsir(tafsirId, ch) : getTranslation('en-saheeh', ch), [kind, ch, tafsirId]);
  const row = d.data?.verses.find((x) => x.v === v);
  if (!row) return null;
  const label = kind === 'tafsir' ? TAFSIRS.find((x) => x.id === tafsirId)?.name : 'Saheeh International';
  return <p class="tafsir-text" style={`margin-top:8px;color:var(--text-2);${kind === 'translation' ? 'direction:ltr;text-align:left;font-family:var(--font-ui)' : ''}`}><small class="badge" style="margin-inline-end:6px">{label}</small>{row.t}</p>;
}

function AyahSheet({ sel, onClose, chs, meta, texts, tafsirId, onMulti }: { sel: { ch: number; v: number } | null; onClose: () => void; chs: Chapter[]; meta: QuranMeta; texts: SurahText[]; tafsirId: string; onMulti: () => void }) {
  const { user, settings } = useStore();
  const [view, setView] = useState<'actions' | 'tafsir' | 'translation' | 'bookmark'>('actions');
  const [tid, setTid] = useState(tafsirId);
  const [tag, setTag] = useState<Bookmark['tag']>('reading');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setView('actions'); setMsg(''); setNote(''); }, [sel?.ch, sel?.v]);
  const taf = useAsync(() => sel && view === 'tafsir' ? getTafsir(tid, sel.ch) : Promise.resolve(null), [sel?.ch, tid, view]);
  const tr = useAsync(() => sel && view === 'translation' ? getTranslation('en-saheeh', sel.ch) : Promise.resolve(null), [sel?.ch, view]);
  if (!sel) return null;
  const s = texts.find((x) => x.ch === sel.ch)!;
  const verse = s.verses[sel.v - 1];
  const text = ayahDisplay(s, verse);
  const c = chs[sel.ch - 1];
  const ref = `﴿${text}﴾ [${c.name}: ${sel.v}]`;
  const existing = user.bookmarks.find((b) => b.ch === sel.ch && b.v === sel.v);
  const tafRow = taf.data?.verses.find((x) => x.v === sel.v);
  const trRow = tr.data?.verses.find((x) => x.v === sel.v);

  return (
    <Sheet open={!!sel} onClose={onClose} title={`${c.name} · ${t('ayah')} ${num(sel.v)} · ${t('page')} ${num(pageOf(meta, sel.ch, sel.v))}`}>
      {view === 'actions' && (
        <>
          <p class="ayah-text" style="font-size:calc(var(--quran-size) * .85);text-align:start;text-align-last:start;margin-bottom:12px">{text}</p>
          <div class="grid-2">
            <button class="btn secondary" onClick={() => { void playFromReader(sel.ch, settings.reciterId, { from: sel.v, to: sel.v }); onClose(); }}><Icon name="play" />{isAr() ? 'استماع لهذه الآية' : 'Listen to this ayah'}</button>
            <button class="btn secondary" onClick={onMulti}><Icon name="check" />{isAr() ? 'اختيار عدة آيات' : 'Select more ayahs'}</button>
            <button class="btn secondary" onClick={() => { void playFromReader(sel.ch, settings.reciterId); onClose(); }}><Icon name="play" />{isAr() ? 'استماع من بداية السورة' : 'Listen from surah start'}</button>
            <button class="btn secondary" onClick={() => setView('tafsir')}><Icon name="book" />{t('tafsir')}</button>
            <button class="btn secondary" onClick={() => setView('translation')}>EN {t('translation')}</button>
            <button class="btn secondary" onClick={() => setView('bookmark')}><Icon name="star" />{existing ? (isAr() ? 'تعديل العلامة' : 'Edit bookmark') : t('bookmark')}</button>
            <button class="btn secondary" onClick={async () => setMsg((await copyText(ref)) ? t('copied') : '')}><Icon name="copy" />{t('copy')}</button>
            <button class="btn secondary" onClick={() => shareText(`${ref}\n${isAr() ? 'المصدر: مشروع تنزيل، رواية حفص' : 'Source: Tanzil, Hafs'}`)}><Icon name="share" />{t('share')}</button>
          </div>
          {msg && <p class="muted small" style="text-align:center;margin-top:8px">{msg}</p>}
          <p class="muted small" style="margin-top:12px">{isAr() ? 'المشاركة تتضمن المصدر والمرجع ولا تتضمن ملاحظاتك.' : 'Sharing includes the source and reference, never your notes.'}</p>
        </>
      )}
      {view === 'tafsir' && (
        <>
          <div class="chips" style="margin-bottom:12px">{TAFSIRS.map((x) => <button key={x.id} class="chip" aria-pressed={tid === x.id} onClick={() => setTid(x.id)}>{x.name}</button>)}</div>
          <p class="ayah-text" style="font-size:calc(var(--quran-size) * .8);text-align:start;text-align-last:start;color:var(--primary)">{text}</p>
          <hr />
          {tafRow ? <p class="tafsir-text">{tafRow.t}</p> : <Loading error={taf.error} />}
          <p class="muted small" style="margin-top:12px">{TAFSIRS.find((x) => x.id === tid)?.name} — {TAFSIRS.find((x) => x.id === tid)?.author} · <span class="badge warn">{t('notReviewed')}</span> · <a href="#/library/sources">{t('sources')}</a></p>
          <div class="row" style="margin-top:12px"><button class="btn secondary sm" onClick={() => setView('actions')}>{t('back')}</button><button class="btn ghost sm" onClick={() => { updateSettings({ tafsir: tid as 'jalalayn' | 'muyassar' }); setMsg(''); }}>{isAr() ? 'اجعله الافتراضي' : 'Make default'}</button></div>
        </>
      )}
      {view === 'translation' && (
        <>
          <p class="ayah-text" style="font-size:calc(var(--quran-size) * .8);text-align:start;text-align-last:start;color:var(--primary)">{text}</p>
          <hr />
          {trRow ? <div style="direction:ltr;text-align:left"><p class="body-text" style="font-family:var(--font-ui)">{trRow.t}</p>{trRow.fn && <p class="muted small" style="margin-top:8px;white-space:pre-wrap">{trRow.fn}</p>}</div> : <Loading error={tr.error} />}
          <p class="muted small" style="margin-top:12px">Saheeh International — via QuranEnc.com (translation of meanings, not the Quran itself)</p>
          <button class="btn secondary sm" style="margin-top:12px" onClick={() => setView('actions')}>{t('back')}</button>
        </>
      )}
      {view === 'bookmark' && (
        <>
          <div class="chips" style="margin-bottom:12px">
            {(['reading', 'hifz', 'review'] as const).map((g) => <button key={g} class="chip" aria-pressed={tag === g} onClick={() => setTag(g)}>{g === 'reading' ? (isAr() ? 'قراءة' : 'Reading') : g === 'hifz' ? (isAr() ? 'حفظ' : 'Hifz') : (isAr() ? 'مراجعة' : 'Review')}</button>)}
          </div>
          <input class="input" placeholder={isAr() ? 'ملاحظة خاصة (اختياري)' : 'Private note (optional)'} value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
          <div class="row" style="margin-top:12px">
            <button class="btn" onClick={() => { updateUser((u) => ({ bookmarks: [...u.bookmarks.filter((b) => !(b.ch === sel.ch && b.v === sel.v)), { id: `${sel.ch}:${sel.v}`, ch: sel.ch, v: sel.v, tag, note: note || undefined, at: Date.now() }] })); onClose(); }}>{t('save')}</button>
            {existing && <button class="btn danger" onClick={() => { updateUser((u) => ({ bookmarks: u.bookmarks.filter((b) => !(b.ch === sel.ch && b.v === sel.v)) })); onClose(); }}>{isAr() ? 'حذف' : 'Delete'}</button>}
            <button class="btn ghost" onClick={() => setView('actions')}>{t('cancel')}</button>
          </div>
        </>
      )}
      <div style="display:none">{settings.showTranslation}</div>
    </Sheet>
  );
}
