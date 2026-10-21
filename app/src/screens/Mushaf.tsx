/** Mushaf page mode: the Madani mushaf (1441 AH) page by page, 15 lines, exact line breaks, with the King Fahd Complex
 *  QCF v4 page fonts (loaded on demand). Word-level taps select an ayah; selection, tafsir, bookmarks and listening
 *  reuse the reader's ayah sheet. The text itself is never modified — glyph codes come straight from the layout data. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getChapters, getMeta, getSurah, getMushafPage, ensureMushafFont, pageOf, juzOf, ayahDisplay, type MushafPage as PageData, type SurahText } from '../lib/content';
import { useStore, updateUser, updateSettings } from '../lib/store';
import { t, num, isAr } from '../lib/i18n';
import { navigate } from '../lib/router';
import { TopBar, Icon, useAsync, Loading, shareText, copyText } from '../components/ui';
import { AyahSheet } from './Quran';
import { getAyahPlayer, subscribeAyahPlayer, playAyahs, stopAyahs } from '../lib/audio/ayah';
import { playFromReader } from './Audio';

const toArabicIndic = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

export function useAyahPlayer() {
  const [, force] = useState(0);
  useEffect(() => subscribeAyahPlayer(() => force((n) => n + 1)), []);
  return getAyahPlayer();
}

export function MushafScreen({ page }: { page: number }) {
  const { settings } = useStore();
  const chapters = useAsync(getChapters, []);
  const meta = useAsync(getMeta, []);
  const pg = useAsync(() => getMushafPage(page), [page]);
  const [fontReady, setFontReady] = useState(false);
  const texts = useAsync(async () => pg.data ? Promise.all(pg.data.surahs.map(([id]) => getSurah(id))) : [], [pg.data?.p]);
  const [sel, setSel] = useState<{ ch: number; v: number } | null>(null);
  const [multi, setMulti] = useState<{ ch: number; from: number; to: number } | null>(null);
  const [size, setSize] = useState(0);
  const host = useRef<HTMLDivElement | null>(null);
  const ap = useAyahPlayer();

  useEffect(() => { setFontReady(false); if (!pg.data) return; let alive = true; Promise.all([ensureMushafFont(pg.data.font), pg.data.lines.some((l) => l.w.some((w) => w[3] === 'B')) ? ensureMushafFont('QCF4_QBSML') : Promise.resolve()]).then(() => alive && setFontReady(true)).catch(() => alive && setFontReady(true)); return () => { alive = false; }; }, [pg.data?.p]);
  // Fit: start from the width-based size (or the user's), then shrink until no line overflows.
  useEffect(() => {
    if (!fontReady || !host.current) return;
    const w = host.current.clientWidth - 20;
    let px = settings.mushafSize || Math.max(16, Math.min(34, Math.floor(w / 14.2)));
    host.current.style.setProperty('--mushaf-size', px + 'px');
    for (let i = 0; i < 24; i++) {
      const over = [...host.current.querySelectorAll<HTMLElement>('.mline')].some((l) => l.scrollWidth > l.clientWidth + 1);
      if (!over) break;
      px -= 0.5; host.current.style.setProperty('--mushaf-size', px + 'px');
    }
    setSize(px);
  }, [fontReady, pg.data?.p, settings.mushafSize]);
  // Last-read position = first ayah on the page (after a short dwell)
  useEffect(() => {
    if (!pg.data || !meta.data) return;
    const first = pg.data.lines.flatMap((l) => l.w).find((w) => w[1] === 'w');
    if (!first) return;
    const [c, v] = String(first[2]).split(':').map(Number);
    const id = window.setTimeout(() => updateUser({ lastRead: { ch: c, v, page, at: Date.now(), kind: 'read' } }), 1500);
    return () => clearTimeout(id);
  }, [pg.data?.p]);
  // swipe
  useEffect(() => {
    let x0 = 0, y0 = 0;
    const down = (e: TouchEvent) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
    const up = (e: TouchEvent) => { const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 70 && Math.abs(dy) < 60) navigate(`/quran/page/${dx > 0 ? Math.min(604, page + 1) : Math.max(1, page - 1)}`, true); };
    const n = host.current; if (!n) return; n.addEventListener('touchstart', down, { passive: true }); n.addEventListener('touchend', up, { passive: true });
    return () => { n.removeEventListener('touchstart', down); n.removeEventListener('touchend', up); };
  }, [host.current, page]);
  useEffect(() => { setSel(null); setMulti(null); }, [page]);

  if (!chapters.data || !meta.data || !pg.data || !texts.data) return <main class="screen"><TopBar title={`${t('page')} ${num(page)}`} onBack /><Loading error={chapters.error || meta.error || pg.error} /></main>;
  const chs = chapters.data, m = meta.data, data: PageData = pg.data;
  const vk = (w: PageData['lines'][number]['w'][number]) => (w[1] === 'w' || w[1] === 'e') ? String(w[2]) : null;
  const inSel = (key: string | null) => { if (!key) return false; const [c, v] = key.split(':').map(Number); if (multi) return multi.ch === c && v >= multi.from && v <= multi.to; return !!sel && sel.ch === c && sel.v === v; };
  const isCur = (key: string | null) => { if (!key || !ap.playing) return false; const [c, v] = key.split(':').map(Number); return ap.ch === c && ap.v === v; };
  const tap = (key: string | null) => {
    if (!key) return; const [c, v] = key.split(':').map(Number);
    if (!multi) { setSel({ ch: c, v }); return; }
    if (multi.ch !== c) { setMulti({ ch: c, from: v, to: v }); return; }
    if (v === multi.from && v === multi.to) { setMulti(null); return; }
    if (v < multi.from) setMulti({ ...multi, from: v }); else if (v > multi.to) setMulti({ ...multi, to: v }); else if (v - multi.from <= multi.to - v) setMulti({ ...multi, from: v }); else setMulti({ ...multi, to: v });
  };
  const firstVerse = data.lines.flatMap((l) => l.w).find((w) => w[1] === 'w');
  const [fc, fv] = firstVerse ? String(firstVerse[2]).split(':').map(Number) : [1, 1];
  const juz = juzOf(m, fc, fv);
  const surahNames = data.surahs.map(([id]) => chs[id - 1].name).join(' · ');

  return (
    <main class="screen" style="padding-inline:8px">
      <TopBar title={surahNames} onBack right={<>
        <button class="icon-btn" aria-label={isAr() ? 'نص' : 'Text'} title={isAr() ? 'عرض نصي' : 'Text view'} onClick={() => navigate(`/quran/text/${page}`)}><Icon name="book" /></button>
        <button class="icon-btn" aria-label={t('settings')} onClick={() => navigate('/settings')}><Icon name="settings" /></button>
      </>}>
        <small class="muted num">{t('juz')} {num(juz)} · {t('page')} {num(page)}</small>
      </TopBar>
      <div ref={host} class={`mushaf ${fontReady ? '' : 'loading'}`} style={`--mushaf-size:${size || 22}px`}>
        {data.lines.map((l) => {
          const isHeader = l.w.some((w) => w[1] === 'h'); const isBsm = l.w.some((w) => w[1] === 'b');
          return (
            <div key={l.n} class={`mline ${isHeader || isBsm || page <= 2 ? 'center' : l.w.length <= 2 ? 'single' : ''}`}>
              {l.w.map((w, i) => {
                const key = vk(w);
                if (w[1] === 'h') return <span key={i} class="hdr" style={`font-family:'QCF4_QBSML'`}>{w[0]}</span>;
                if (w[1] === 'b') return <span key={i} class="bsm" style={`font-family:'${data.font}'`}>{w[0]}</span>;
                return <span key={i} class={`w ${inSel(key) ? 'sel' : ''} ${isCur(key) ? 'cur' : ''}`} style={`font-family:'${data.font}'`} data-vk={key || undefined} onClick={() => tap(key)}>{w[0]}</span>;
              })}
            </div>
          );
        })}
        <div class="mushaf-foot"><span>{surahNames}</span><span class="num">{num(page)}</span><span>{t('juz')} {num(juz)}</span></div>
      </div>
      <div class="mushaf-nav">
        <button class="btn secondary sm" disabled={page >= 604} onClick={() => navigate(`/quran/page/${page + 1}`)}><Icon name="back" />{isAr() ? 'التالية' : 'Next'}</button>
        <input class="input num" style="width:84px;text-align:center" inputMode="numeric" value={num(page)} onChange={(e) => { const n = Number((e.target as HTMLInputElement).value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))); if (n >= 1 && n <= 604) navigate(`/quran/page/${n}`); }} />
        <button class="btn secondary sm" disabled={page <= 1} onClick={() => navigate(`/quran/page/${page - 1}`)}>{isAr() ? 'السابقة' : 'Previous'}<Icon name="next" /></button>
      </div>
      {!fontReady && <p class="muted small" style="text-align:center">{isAr() ? 'يتم تحميل خط الصفحة من مجمع الملك فهد (مرة واحدة لكل ١٣ صفحة تقريبًا)…' : 'Loading the page font (once per ~13 pages)…'}</p>}
      <div class="row" style="justify-content:center;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="chip" onClick={() => updateSettings({ mushafSize: Math.max(14, (size || 22) - 1) })}>A−</button>
        <button class="chip" onClick={() => updateSettings({ mushafSize: 0 })}>{isAr() ? 'تلقائي' : 'Auto'}</button>
        <button class="chip" onClick={() => updateSettings({ mushafSize: Math.min(40, (size || 22) + 1) })}>A+</button>
        <button class="chip" onClick={() => void playFromReader(fc, settings.reciterId)}><Icon name="play" />{isAr() ? 'تلاوة السورة' : 'Surah audio'}</button>
      </div>
      <p class="muted small" style="margin-top:12px;text-align:center">{isAr() ? 'مصحف المدينة ١٤٤١هـ — خط عثمان طه، خطوط وتخطيط مجمع الملك فهد (QCF v4)' : 'Madani Mushaf 1441 AH — Uthman Taha script, KFGQPC page fonts (QCF v4)'} · <a href="#/library/sources">{t('sources')}</a></p>

      <AyahSheet sel={sel} onClose={() => setSel(null)} chs={chs} meta={m} texts={texts.data} tafsirId={settings.tafsirId} onMulti={() => { if (sel) { setMulti({ ch: sel.ch, from: sel.v, to: sel.v }); setSel(null); } }} />
      {multi && <SelectionBar multi={multi} texts={texts.data} chs={chs} onClear={() => setMulti(null)} />}
      {ap.playing && !multi && <AyahMiniBar />}
    </main>
  );
}

/** Bottom toolbar for a multi-ayah selection (shared by reader and mushaf). */
export function SelectionBar({ multi, texts, chs, onClear }: { multi: { ch: number; from: number; to: number }; texts: SurahText[]; chs: { name: string }[]; onClear: () => void }) {
  const { settings } = useStore();
  const st = texts.find((x) => x.ch === multi.ch)!; const c = chs[multi.ch - 1]; const n = multi.to - multi.from + 1;
  const joined = st.verses.slice(multi.from - 1, multi.to).map((v) => `${ayahDisplay(st, v)} ﴿${toArabicIndic(v.v)}﴾`).join(' ');
  const ref = `﴿${joined}﴾ [${c.name}: ${multi.from}${n > 1 ? `–${multi.to}` : ''}]`;
  const [open, setOpen] = useState(false);
  const ap = useAyahPlayer();
  const playingHere = ap.playing && ap.ch === multi.ch;
  return (
    <div class="multi-bar" role="toolbar" style="flex-wrap:wrap">
      <div class="grow"><strong>{c.name} · {n === 1 ? `${t('ayah')} ${num(multi.from)}` : `${t('ayah')} ${num(multi.from)}–${num(multi.to)}`}</strong><br /><small class="muted">{playingHere ? (isAr() ? `آية بآية · الآن: ${num(ap.v)}${ap.rep > 1 ? ` · تكرار ×${num(ap.rep)}` : ''}` : `ayah by ayah · now ${ap.v}`) : ap.error ? ap.error : (isAr() ? 'اضغط آية أخرى لتوسيع التحديد، أو الآية نفسها لإلغائه' : 'Tap another ayah to extend, the same one to clear')}</small></div>
      {playingHere ? <button class="btn sm secondary" onClick={stopAyahs}><Icon name="pause" />{t('stop')}</button> : <button class="btn sm" onClick={() => void playAyahs(multi.ch, multi.from, multi.to)}><Icon name="play" />{t('listen')}</button>}
      <button class="icon-btn" aria-label="more" onClick={() => setOpen(!open)}><Icon name="more" /></button>
      <button class="icon-btn" aria-label={t('cancel')} onClick={onClear}><Icon name="close" /></button>
      {open && (
        <div class="row" style="width:100%;gap:6px;flex-wrap:wrap;margin-top:6px">
          <button class="chip" onClick={() => void playFromReader(multi.ch, settings.reciterId, { from: multi.from, to: multi.to })}>{isAr() ? 'بتسجيل كامل (توقيتات)' : 'Full recording (timed)'}</button>
          {[1, 3, 5, 10].map((r) => <button key={r} class="chip" aria-pressed={settings.ayahRepeat === r} onClick={() => updateSettings({ ayahRepeat: r })}>{isAr() ? `تكرار ×${num(r)}` : `×${r}`}</button>)}
          <button class="chip" onClick={() => void copyText(ref)}><Icon name="copy" />{t('copy')}</button>
          <button class="chip" onClick={() => void shareText(`${ref}\n${isAr() ? 'المصدر: مشروع تنزيل، رواية حفص' : 'Source: Tanzil, Hafs'}`)}><Icon name="share" />{t('share')}</button>
        </div>
      )}
    </div>
  );
}

/** Small status bar while ayah-by-ayah audio plays. */
export function AyahMiniBar() {
  const ap = useAyahPlayer();
  const chapters = useAsync(getChapters, []);
  if (!ap.playing && !ap.error) return null;
  return (
    <div class="multi-bar" role="status">
      <div class="grow"><strong>{chapters.data ? chapters.data[ap.ch - 1].name : ''} · {t('ayah')} {num(ap.v)}</strong><br /><small class="muted">{ap.error ? ap.error : ap.loading ? '…' : (isAr() ? `آية بآية · ${num(ap.from)}–${num(ap.to)}${ap.rep > 1 ? ` · تكرار ×${num(ap.rep)}` : ''}` : `ayah by ayah ${ap.from}–${ap.to}`)}</small></div>
      <button class="icon-btn" aria-label={t('stop')} onClick={stopAyahs}><Icon name="close" /></button>
    </div>
  );
}
export { pageOf };
