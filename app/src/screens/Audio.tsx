/** Sections 11–12 UI: reciter library (famous + all), reciter page with recordings and 114-surah status, downloads manager. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { getCatalog, refreshCatalog, recordingsOf, displayName, hasSurah, STYLE_AR, SOURCE_AR, RIWAYAH_SHORT, RIWAYAH_EN, RIWAYAH_AR, fileUrl, hasTimings, timedRecordingFor, type Catalog, type Recording } from '../lib/audio/catalog';
import * as DL from '../lib/audio/downloads';
import { playSurah, playAyahRange, getPlayer, subscribePlayer } from '../lib/audio/player';
import { getChapters, getAyahAudioSources, type Chapter } from '../lib/content';
import { ayahUrls, cacheAyahs, cachedCount, deleteCached, type AyahReciter } from '../lib/audio/ayah';
import { useStore, updateSettings } from '../lib/store';
import { t, num, isAr } from '../lib/i18n';
import { navigate } from '../lib/router';
import { TopBar, Icon, useAsync, Loading, Seg, Toggle, Sheet, Notice } from '../components/ui';

function useDownloads() { const [, f] = useState(0); useEffect(() => DL.subscribe(() => f((n) => n + 1)), []); return DL.getState(); }
function usePlayer() { const [, f] = useState(0); useEffect(() => subscribePlayer(() => f((n) => n + 1)), []); return getPlayer(); }

/* ------------------------------------------------------------------ */
export function ReciterLibrary({ playSurahAfter, range }: { playSurahAfter?: number; range?: { from: number; to: number } }) {
  const { settings } = useStore();
  const cat = useAsync(getCatalog, []);
  const [q, setQ] = useState('');
  const [riw, setRiw] = useState<string>('all');
  const [sty, setSty] = useState<'all' | Recording['style']>('all');
  const [onlyComplete, setOnlyComplete] = useState(false);
  const [moreRiw, setMoreRiw] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);
  if (!cat.data) return <main class="screen"><TopBar title={isAr() ? 'القراء' : 'Reciters'} onBack /><Loading error={cat.error} /></main>;
  const c = cat.data;
  const matches = (r: { name: string; nameAr: string | null }) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.nameAr || '').includes(q);
  const recFilter = (rec: Recording) => (riw === 'all' || rec.riwayah === riw) && (sty === 'all' || rec.style === sty) && (!onlyComplete || rec.complete);
  // riwayah counts (recordings), most common first — drives the filter strip
  const riwCount = new Map<string, number>();
  for (const r of c.recordings) if ((sty === 'all' || r.style === sty) && (!onlyComplete || r.complete)) riwCount.set(r.riwayah, (riwCount.get(r.riwayah) || 0) + 1);
  const riwOrder = [...riwCount.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const MAIN = ['hafs', 'warsh', 'qalun'];
  const shown = [...MAIN.filter((k) => riwCount.has(k)), ...(riw !== 'all' && !MAIN.includes(riw) ? [riw] : [])];
  const extra = riwOrder.filter((k) => !MAIN.includes(k));
  const rLabel = (k: string) => (isAr() ? RIWAYAH_SHORT[k] : RIWAYAH_EN[k]) || k;
  const total = c.recordings.filter((r) => (sty === 'all' || r.style === sty) && (!onlyComplete || r.complete)).length;
  const reciterOk = (id: string) => recordingsOf(c, id).some(recFilter) && (!range || recordingsOf(c, id).some(hasTimings));
  const famous = c.famousOrder.map((id) => c.reciters.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r && matches(r) && reciterOk(r.id));
  const taraweeh = c.reciters.filter((r) => r.kind === 'taraweeh' && matches(r) && reciterOk(r.id));
  const others = c.reciters.filter((r) => !r.famous && r.kind !== 'taraweeh' && matches(r) && reciterOk(r.id)).sort((a, b) => displayName(a).localeCompare(displayName(b), 'ar'));
  const doRefresh = async () => {
    setRefreshing(true);
    const r = await refreshCatalog();
    setMsg(r.ok ? (isAr() ? `تم التحديث: ${num(r.added)} تسجيل جديد، ${num(r.updated)} محدَّث` : `Updated: ${r.added} new, ${r.updated} refreshed`) : (isAr() ? `تعذّر التحديث (${r.error}) — الفهرس المضمّن ما زال يعمل` : `Refresh failed (${r.error}) — bundled catalogue still works`));
    setRefreshing(false); setTick(tick + 1);
  };
  const Row = ({ r }: { r: typeof famous[number] }) => {
    const recs = recordingsOf(c, r.id);
    const complete = recs.filter((x) => x.complete).length;
    const dl = recs.reduce((a, x) => a + Object.values(DL.getState().items).filter((i) => i.recId === x.id && i.status === 'done').length, 0);
    return (
      <button class="list-item" onClick={() => navigate(`/quran/reciters/${r.id}${playSurahAfter ? `?play=${playSurahAfter}${range ? `&from=${range.from}&to=${range.to}` : ''}` : ''}`)}>
        <Avatar name={displayName(r)} id={r.id} />
        <span class="grow"><span class="title">{displayName(r)}</span>{r.nameAr && r.name !== r.nameAr && <span class="sub"> · {r.name}</span>}<br />
          <span class="sub">{num(recs.length)} {isAr() ? 'تسجيل' : 'recordings'} · {num(complete)} {isAr() ? 'مصحف كامل' : 'complete'}{dl ? ` · ${num(dl)} ${isAr() ? 'سورة منزّلة' : 'downloaded'}` : ''}</span></span>
        {recs.some(hasTimings) && <span class="badge" title={isAr() ? 'توقيتات آيات' : 'ayah timings'}>{isAr() ? 'آيات' : 'ayahs'}</span>}
        {settings.reciterId && recs.some((x) => x.id === settings.reciterId) && <span class="badge ok">{isAr() ? 'الافتراضي' : 'default'}</span>}
      </button>
    );
  };
  return (
    <main class="screen">
      <TopBar title={isAr() ? 'القراء' : 'Reciters'} onBack right={<button class="icon-btn" aria-label={isAr() ? 'التنزيلات' : 'Downloads'} onClick={() => navigate('/quran/downloads')}><Icon name="library" /></button>} />
      {playSurahAfter && <div style="margin-bottom:12px"><Notice kind="info">{range ? (isAr() ? `اختر قارئًا لتشغيل الآيات ${num(range.from)}–${num(range.to)} فقط — تُعرض هنا التسجيلات التي تحوي توقيتات آيات` : `Choose a reciter to play ayahs ${range.from}–${range.to} only — only recordings with ayah timings are listed`) : (isAr() ? 'اختر قارئًا لتشغيل السورة' : 'Choose a reciter to play the surah')}</Notice></div>}
      <input class="input" placeholder={isAr() ? 'ابحث باسم القارئ (عربي/إنجليزي)' : 'Search reciter'} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="flt-label">{isAr() ? 'الرواية' : 'Riwayah'}</div>
      <div class="riw-strip" role="group" aria-label={isAr() ? 'الرواية' : 'Riwayah'}>
        <button class="riw" aria-pressed={riw === 'all'} onClick={() => setRiw('all')}><span>{isAr() ? 'الكل' : 'All'}</span><span class="rc num">{num(total)}</span></button>
        {shown.map((k) => <button key={k} class="riw" aria-pressed={riw === k} onClick={() => setRiw(riw === k ? 'all' : k)}><span>{rLabel(k)}</span><span class="rc num">{num(riwCount.get(k) || 0)}</span></button>)}
        {extra.length > 0 && <button class="riw more" onClick={() => setMoreRiw(true)}><span>{isAr() ? `روايات أخرى` : 'More'}</span><span class="rc num">{num(extra.filter((k) => k !== riw).length)}</span><Icon name="chevron-down" /></button>}
      </div>
      <div class="flt-row">
        <Seg value={sty} onChange={(v) => setSty(v)} options={[{ v: 'all', label: isAr() ? 'كل الأساليب' : 'All styles' }, { v: 'murattal', label: STYLE_AR.murattal }, { v: 'mujawwad', label: STYLE_AR.mujawwad }, { v: 'muallim', label: STYLE_AR.muallim }, { v: 'taraweeh', label: STYLE_AR.taraweeh }]} />
        <button class="pill-toggle" aria-pressed={onlyComplete} onClick={() => setOnlyComplete(!onlyComplete)}>{onlyComplete && <Icon name="check" />}{isAr() ? 'كامل ١١٤' : '114 only'}</button>
      </div>
      <Sheet open={moreRiw} onClose={() => setMoreRiw(false)} title={isAr() ? 'القراءات والروايات' : 'Riwayat'}>
        <p class="muted small" style="margin-bottom:10px">{isAr() ? 'العدد = تسجيلات متاحة لهذه الرواية' : 'Count = recordings available'}</p>
        <div class="list">
          {riwOrder.map((k) => (
            <button key={k} class={`list-item ${riw === k ? 'selected' : ''}`} onClick={() => { setRiw(k); setMoreRiw(false); }}>
              <span class="grow"><span class="title">{isAr() ? RIWAYAH_AR[k] : RIWAYAH_EN[k]}</span></span>
              <span class="badge num">{num(riwCount.get(k) || 0)}</span>{riw === k && <Icon name="check" />}
            </button>
          ))}
        </div>
      </Sheet>
      {taraweeh.length > 0 && <><h2 style="margin:8px 0">{isAr() ? 'تراويح الحرمين' : 'Haramain taraweeh'} <span class="badge">{num(taraweeh.reduce((a, r) => a + recordingsOf(c, r.id).length, 0))}</span></h2><div class="list" style="margin-bottom:12px">{taraweeh.map((r) => <Row key={r.id} r={r} />)}</div></>}
      <h2 style="margin:8px 0">{isAr() ? 'القراء المشهورون' : 'Famous reciters'} <span class="badge">{num(famous.length)}</span></h2>
      <div class="list">{famous.map((r) => <Row key={r.id} r={r} />)}</div>
      <h2 style="margin:20px 0 8px">{isAr() ? 'جميع القراء' : 'All reciters'} <span class="badge">{num(others.length)}</span></h2>
      <div class="list">{others.map((r) => <Row key={r.id} r={r} />)}</div>
      <div class="card" style="margin-top:16px">
        <div class="row between"><span class="small text-2">{isAr() ? 'الفهرس: MP3Quran + QuranicAudio' : 'Catalogue: MP3Quran + QuranicAudio'} · {c.refreshedAt ? new Date(c.refreshedAt).toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB') : (isAr() ? 'نسخة مضمّنة' : 'bundled')}</span>
          <button class="btn secondary sm" disabled={refreshing} onClick={doRefresh}>{refreshing ? '…' : (isAr() ? 'تحديث الفهرس' : 'Refresh')}</button></div>
        {msg && <p class="muted small" style="margin-top:6px">{msg}</p>}
        <p class="muted small" style="margin-top:6px">{isAr() ? 'التحديث يجلب الأسماء العربية وقوائم السور والقراء الجدد، ولا يمسح ملفاتك أو اختياراتك.' : 'Refresh fetches Arabic names, surah lists and new reciters; it never deletes your files or choices.'}</p>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
export function ReciterPage({ id, playAfter, range }: { id: string; playAfter?: number; range?: { from: number; to: number } }) {
  const { settings } = useStore();
  const cat = useAsync(getCatalog, []);
  const chapters = useAsync(getChapters, []);
  const dls = useDownloads();
  const player = usePlayer();
  const [recId, setRecId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [estimate, setEstimate] = useState<{ bytes: number | null; n: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (cat.data && !recId) { const recs = recordingsOf(cat.data, id); const pref = (range && timedRecordingFor(cat.data, id, recs.find((r) => r.id === settings.reciterId))) || recs.find((r) => r.id === settings.reciterId) || recs.find((r) => r.complete && r.riwayah === 'hafs' && r.style === 'murattal') || recs[0]; setRecId(pref?.id || null); } }, [cat.data]);
  if (!cat.data || !chapters.data) return <main class="screen"><TopBar title="" onBack /><Loading error={cat.error || chapters.error} /></main>;
  const c = cat.data, chs = chapters.data;
  const reciter = c.reciters.find((r) => r.id === id);
  const recs = recordingsOf(c, id);
  const rec = recs.find((r) => r.id === recId) || recs[0];
  if (!reciter || !rec) return <main class="screen"><TopBar title="" onBack /><p class="muted">—</p></main>;
  const status = (n: number): 'downloaded' | 'downloading' | 'queued' | 'available' | 'unavailable' | 'unknown' => {
    const it = DL.itemOf(rec.id, n);
    if (it?.status === 'done') return 'downloaded';
    if (it?.status === 'downloading') return 'downloading';
    if (it?.status === 'queued' || it?.status === 'paused') return 'queued';
    const h = hasSurah(rec, n); return h === true ? 'available' : h === false ? 'unavailable' : 'unknown';
  };
  const availableList = Array.from({ length: 114 }, (_, i) => i + 1).filter((n) => hasSurah(rec, n) !== false);
  const missing = rec.complete ? [] : rec.surahList ? Array.from({ length: 114 }, (_, i) => i + 1).filter((n) => !rec.surahList!.includes(n)) : null;
  const doneCount = availableList.filter((n) => status(n) === 'downloaded').length;
  const playNow = (n: number) => { void playSurah(rec.id, n); };
  const askDownload = async (list: number[]) => {
    const todo = list.filter((n) => !DL.isDownloaded(rec.id, n));
    if (!todo.length) return;
    setConfirm(true); setEstimate(null);
    const sample = todo.slice(0, 3);
    const sizes = await Promise.all(sample.map((n) => DL.headSize(fileUrl(rec, n))));
    const known = sizes.filter((x): x is number => x != null);
    setEstimate({ bytes: known.length ? Math.round((known.reduce((a, b) => a + b, 0) / known.length) * todo.length) : null, n: todo.length });
    setSel(new Set(todo));
  };
  const startDownload = async () => { await DL.enqueue(rec, [...sel]); setConfirm(false); setSelecting(false); };
  const isCurrent = (n: number) => player.queue[player.index]?.recId === rec.id && player.queue[player.index]?.surah === n;
  useEffect(() => { if (playAfter && rec) { updateSettings({ reciterId: rec.id }); if (range) void playAyahRange(rec.id, playAfter, range.from, range.to); else void playSurah(rec.id, playAfter); navigate(`/quran/reciters/${id}`, true); } }, [rec?.id]);

  return (
    <main class="screen">
      <TopBar title={displayName(reciter)} onBack />
      <CompactBanner nameAr={reciter.nameAr} />
      {recs.length > 1 && (
        <>
          <div class="flt-label">{isAr() ? `التسجيلات (${num(recs.length)})` : `Recordings (${recs.length})`}</div>
          <div class={`rec-grid ${recs.length > 3 ? 'two' : ''}`} role="radiogroup">
            {sortRecs(recs).map((r) => (
              <button key={r.id} class="rec-card" role="radio" aria-checked={r.id === rec.id} onClick={() => setRecId(r.id)}>
                <span class="rt">{r.style === 'taraweeh' && r.year ? `${r.year} هـ` : (isAr() ? RIWAYAH_SHORT[r.riwayah] : RIWAYAH_EN[r.riwayah])}{r.style !== 'taraweeh' && <span class="rs"> · {STYLE_AR[r.style]}</span>}</span>
                <span class="rm">{r.recitationAr && r.style !== 'taraweeh' && !/^(Rewayat|Almusshaf)/.test(r.recitationAr) ? `${r.recitationAr} · ` : ''}{r.complete ? (isAr() ? '١١٤ سورة' : '114 surahs') : `${num(r.surahTotal)}/114`}{r.kbps ? ` · ${num(r.kbps)} ${isAr() ? 'ك.ب/ث' : 'kbps'}` : ''}{r.sizeMB ? ` · ≈${r.sizeMB >= 1024 ? num(+(r.sizeMB / 1024).toFixed(1)) + (isAr() ? ' ج.ب' : ' GB') : num(r.sizeMB) + (isAr() ? ' م.ب' : ' MB')}` : ''}</span>
                <span class="rb">{SOURCE_AR[r.source]}{hasTimings(r) ? ' · ⏱' : ''}{settings.reciterId === r.id ? (isAr() ? ' · الافتراضي' : ' · default') : ''}</span>
                {r.id === rec.id && <span class="ck"><Icon name="check" /></span>}
              </button>
            ))}
          </div>
        </>
      )}
      <section class="card">
        <div class="row between" style="flex-wrap:wrap;gap:6px">
          <div><strong>{STYLE_AR[rec.style]}</strong> · {rec.riwayahAr}<br /><small class="muted">{reciter.nameAr ? `${reciter.name} · ` : ''}{rec.recitationAr || rec.recitation} · {rec.id}</small></div>
          <span class={`badge ${rec.complete ? 'ok' : 'warn'}`}>{rec.complete ? t('complete114') : `${num(rec.surahTotal)}/114 ${t('incomplete')}`}</span>
        </div>
        {rec.rights === 'needs-permission' && <p class="small" style="margin:8px 0 0;padding:8px 10px;border-radius:10px;background:var(--surface-2,rgba(0,0,0,.04))">{isAr() ? 'تلاوات مختارة كاملة السور، جمعناها من أرشيف الإنترنت (archive.org) مرتبة حسب ترتيب المصحف. لم يصدر بعد إذن صريح من الشيخ؛ تُشغَّل من مصدرها دون إعادة استضافة.' : 'Selected complete surahs gathered from archive.org in mushaf order. No explicit permission from the reciter yet; streamed from the source, never re-hosted.'}</p>}
        <button class="chip" style="margin-top:8px" aria-pressed={settings.reciterId === rec.id} onClick={() => updateSettings({ reciterId: rec.id })}>{settings.reciterId === rec.id ? (isAr() ? 'القارئ الافتراضي ✓' : 'Default reciter ✓') : (isAr() ? 'اجعله القارئ الافتراضي' : 'Set as default reciter')}</button>
        {rec.files && <p class="muted small" style="margin-top:6px">{isAr() ? `السور المتاحة (${num(rec.surahTotal)}):` : 'Available:'} {(rec.surahList || []).map((n) => chs[n - 1].name).join('، ')}</p>}
        {!rec.files && missing && missing.length > 0 && <p class="muted small" style="margin-top:6px">{isAr() ? 'السور الناقصة:' : 'Missing:'} {missing.map((n) => chs[n - 1].name).join('، ')}</p>}
        {missing === null && <p class="muted small" style="margin-top:6px">{isAr() ? 'قائمة السور المتاحة لهذا التسجيل الجزئي غير معروفة في النسخة المضمّنة — حدّث الفهرس من شاشة القراء.' : 'Surah list for this partial set is unknown in the bundled catalogue — refresh the catalogue.'}</p>}
        <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
          <button class="btn sm" onClick={() => playNow(availableList[0] || 1)}><Icon name="play" />{isAr() ? 'تشغيل من البداية' : 'Play from start'}</button>
          <button class="btn secondary sm" onClick={() => askDownload(availableList)} disabled={doneCount === availableList.length}>{isAr() ? `تنزيل الكل (${num(availableList.length - doneCount)})` : `Download all (${availableList.length - doneCount})`}</button>
          <button class="btn secondary sm" aria-pressed={selecting} onClick={() => { setSelecting(!selecting); setSel(new Set()); }}>{isAr() ? 'اختيار سور' : 'Select surahs'}</button>
          {doneCount > 0 && <button class="btn ghost sm" onClick={() => navigate('/quran/downloads')}>{num(doneCount)} {isAr() ? 'منزّلة' : 'downloaded'}</button>}
        </div>
        {selecting && <div class="row" style="margin-top:8px"><button class="btn sm" disabled={!sel.size} onClick={() => askDownload([...sel])}>{isAr() ? `تنزيل المحدد (${num(sel.size)})` : `Download selected (${sel.size})`}</button></div>}
      </section>
      <div class="list" style="margin-top:12px">
        {chs.filter((ch) => !rec.files || hasSurah(rec, ch.id)).map((ch) => {
          const st = status(ch.id); const it = DL.itemOf(rec.id, ch.id);
          const badge = st === 'downloaded' ? <span class="badge ok">{isAr() ? 'منزّلة' : 'offline'}</span> : st === 'downloading' ? <span class="badge">{it?.total ? `${Math.round((it.received / it.total) * 100)}٪` : '…'}</span> : st === 'queued' ? <span class="badge">{isAr() ? 'في الطابور' : 'queued'}</span> : st === 'unavailable' ? <span class="badge warn">{isAr() ? 'غير متاحة' : 'n/a'}</span> : st === 'unknown' ? <span class="badge">?</span> : null;
          return (
            <div key={ch.id} class={`list-item ${isCurrent(ch.id) ? 'selected' : ''}`} style={isCurrent(ch.id) ? 'background:var(--primary-soft)' : ''}>
              {selecting && st !== 'unavailable' && <input type="checkbox" checked={sel.has(ch.id)} onChange={() => { const n = new Set(sel); n.has(ch.id) ? n.delete(ch.id) : n.add(ch.id); setSel(n); }} style="width:22px;height:22px" />}
              <span class="badge num">{num(ch.id)}</span>
              <button class="grow" style="text-align:start" disabled={st === 'unavailable'} onClick={() => playNow(ch.id)}><span class="title" style="font-family:var(--font-quran);font-size:1.15em">{ch.name}</span> <span class="sub">{num(ch.verses)} {t('ayah')}</span></button>
              {badge}
              {st === 'available' && <button class="icon-btn" aria-label={isAr() ? 'تنزيل' : 'Download'} onClick={() => askDownload([ch.id])}><Icon name="download" /></button>}
              {st === 'downloading' && <button class="icon-btn" aria-label={t('pause')} onClick={() => DL.pause(it!.key)}><Icon name="pause" /></button>}
              {st === 'queued' && it?.status === 'paused' && <button class="icon-btn" aria-label={t('resume')} onClick={() => DL.resume(it!.key)}><Icon name="play" /></button>}
            </div>
          );
        })}
      </div>
      <p class="muted small" style="margin-top:12px">{isAr() ? `المصدر: ${SOURCE_AR[rec.source]}. البث والتنزيل بطلب المستخدم إلى جهازه فقط؛ لا تُعاد استضافة الملفات.` : `Source: ${SOURCE_AR[rec.source]}. Streaming and user-initiated download to this device only; files are never re-hosted.`}</p>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title={isAr() ? 'تأكيد التنزيل' : 'Confirm download'}>
        <p>{isAr() ? `${num(sel.size)} سورة · ${displayName(reciter)} · ${STYLE_AR[rec.style]} (${rec.riwayahAr})` : `${sel.size} surahs · ${displayName(reciter)} · ${rec.style}`}</p>
        <dl class="kv" style="margin:10px 0">
          <dt>{isAr() ? 'الحجم المتوقع' : 'Estimated size'}</dt><dd>{estimate ? (estimate.bytes != null ? `≈ ${DL.fmtBytes(estimate.bytes)}` : (isAr() ? 'الخادم لا يصرّح بالحجم' : 'server does not report size')) : '…'}</dd>
          <dt>{isAr() ? 'المساحة المستخدمة' : 'Used so far'}</dt><dd>{DL.fmtBytes(DL.usageBytes())}</dd>
          <dt>Wi-Fi</dt><dd>{dls.wifiOnly ? (isAr() ? 'Wi-Fi فقط (يمكن تغييره في التنزيلات)' : 'Wi-Fi only') : (isAr() ? 'أي شبكة' : 'any network')}</dd>
        </dl>
        <div class="row"><button class="btn" onClick={startDownload}>{isAr() ? 'ابدأ التنزيل' : 'Start'}</button><button class="btn ghost" onClick={() => setConfirm(false)}>{t('cancel')}</button></div>
      </Sheet>
    </main>
  );
}

/* ------------------------------------------------------------------ */
export function DownloadsManager() {
  const dls = useDownloads();
  const cat = useAsync(getCatalog, []);
  const chapters = useAsync(getChapters, []);
  const [confirmRec, setConfirmRec] = useState<string | null>(null);
  if (!cat.data || !chapters.data) return <main class="screen"><TopBar title={isAr() ? 'التنزيلات' : 'Downloads'} onBack /><Loading /></main>;
  const c = cat.data, chs = chapters.data;
  const items = dls.order.map((k) => dls.items[k]).filter(Boolean);
  const byRec = new Map<string, DL.DlItem[]>();
  for (const it of items) (byRec.get(it.recId) || byRec.set(it.recId, []).get(it.recId)!).push(it);
  const active = items.filter((i) => i.status === 'downloading' || i.status === 'queued' || i.status === 'paused');
  const label = (it: DL.DlItem) => it.status === 'done' ? (isAr() ? 'مكتمل' : 'done') : it.status === 'downloading' ? (isAr() ? 'جارٍ' : 'downloading') : it.status === 'queued' ? (isAr() ? 'في الطابور' : 'queued') : it.status === 'paused' ? (isAr() ? 'متوقف' : 'paused') : (it.error === 'network-or-cors' ? (isAr() ? 'فشل الشبكة أو المصدر يمنع التنزيل من المتصفح' : 'network error or source blocks browser download') : it.error === 'size-mismatch' ? (isAr() ? 'ملف ناقص' : 'incomplete file') : it.error === 'not-playable' ? (isAr() ? 'ملف غير قابل للتشغيل' : 'not playable') : it.error === 'missing-file' ? (isAr() ? 'الملف مفقود — أعد التنزيل' : 'file missing') : `${isAr() ? 'خطأ' : 'error'}: ${it.error}`);
  return (
    <main class="screen">
      <TopBar title={isAr() ? 'التنزيلات' : 'Downloads'} onBack />
      <button class="card soft" style="width:100%;text-align:start;margin-bottom:12px" onClick={() => navigate('/quran/compact')}><strong>{isAr() ? 'تنزيل مضغوط (أصغر حتى ٨ مرات)' : 'Compact downloads (up to 8× smaller)'}</strong><br /><small class="muted">{isAr() ? '٤٨ قارئًا آية بآية بجودة مختارة — مع متابعة المصحف' : '48 reciters ayah-by-ayah — with mushaf follow'}</small></button>
      <section class="card">
        <dl class="kv">
          <dt>{isAr() ? 'المساحة المستخدمة' : 'Storage used'}</dt><dd>{DL.fmtBytes(DL.usageBytes())}</dd>
          <dt>{isAr() ? 'نشط' : 'Active'}</dt><dd>{num(active.length)}</dd>
        </dl>
        <Toggle label={isAr() ? 'التنزيل عبر Wi-Fi فقط' : 'Wi-Fi only'} checked={dls.wifiOnly} onChange={(v) => DL.setWifiOnly(v)} />
        <p class="muted small">{isAr() ? 'الملفات المكتملة تعمل في وضع الطيران. حذف الملفات لا يمس المفضلة ولا مواضع الاستماع.' : 'Completed files play in airplane mode. Deleting never touches favourites or listening positions.'}</p>
      </section>
      {items.length === 0 && <p class="muted" style="text-align:center;padding:32px">{isAr() ? 'لا تنزيلات بعد. افتح قارئًا واختر سورة أو المصحف كاملًا.' : 'No downloads yet.'}</p>}
      {[...byRec.entries()].map(([recId, list]) => {
        const rec = c.recordings.find((r) => r.id === recId);
        const done = list.filter((i) => i.status === 'done').length;
        return (
          <section key={recId} class="card" style="margin-top:12px">
            <div class="row between"><div><strong>{rec ? displayName(rec) : recId}</strong><br /><small class="muted">{rec ? `${STYLE_AR[rec.style]} · ${rec.riwayahAr}` : ''} · {num(done)}/{num(list.length)} · {DL.fmtBytes(list.reduce((a, i) => a + (i.status === 'done' ? (i.total || i.received) : 0), 0))}</small></div>
              <button class="btn ghost sm" onClick={() => setConfirmRec(recId)}>{isAr() ? 'حذف الكل' : 'Delete all'}</button></div>
            <div class="list" style="margin-top:8px">
              {list.map((it) => (
                <div key={it.key} class="list-item">
                  <span class="grow"><span class="title">{chs[it.surah - 1]?.name}</span><br /><span class="sub">{label(it)}{it.total ? ` · ${DL.fmtBytes(it.total)}` : ''}</span>
                    {(it.status === 'downloading' || it.status === 'paused') && it.total ? <div class="progress" style="margin-top:4px"><div style={`width:${(it.received / it.total) * 100}%`} /></div> : null}</span>
                  {it.status === 'downloading' && <button class="icon-btn" aria-label={t('pause')} onClick={() => DL.pause(it.key)}><Icon name="pause" /></button>}
                  {(it.status === 'paused' || it.status === 'error') && <button class="icon-btn" aria-label={t('resume')} onClick={() => DL.resume(it.key)}><Icon name="play" /></button>}
                  {it.status === 'done' && <button class="icon-btn" aria-label={t('play')} onClick={() => playSurah(it.recId, it.surah, false)}><Icon name="play" /></button>}
                  <button class="icon-btn" aria-label={isAr() ? 'حذف' : 'Delete'} onClick={() => DL.remove(it.key)}><Icon name="close" /></button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <Sheet open={!!confirmRec} onClose={() => setConfirmRec(null)} title={isAr() ? 'حذف ملفات القارئ' : 'Delete reciter files'}>
        <p>{isAr() ? 'ستُحذف الملفات الصوتية لهذا التسجيل من جهازك. تبقى المفضلة ومواضع الاستماع.' : 'Audio files for this recording will be deleted from this device. Favourites and positions stay.'}</p>
        <div class="row" style="margin-top:12px"><button class="btn danger" onClick={async () => { await DL.removeRecording(confirmRec!); setConfirmRec(null); }}>{isAr() ? 'حذف' : 'Delete'}</button><button class="btn ghost" onClick={() => setConfirmRec(null)}>{t('cancel')}</button></div>
      </Sheet>
    </main>
  );
}

/* Used by the Quran reader: play with the default recording or go choose one. */
export async function playFromReader(surah: number, reciterId: string | null, range?: { from: number; to: number }) {
  if (reciterId) { const c = await getCatalog(); if (c.recordings.some((r) => r.id === reciterId)) { if (range) await playAyahRange(reciterId, surah, range.from, range.to); else await playSurah(reciterId, surah); return; } }
  navigate(`/quran/reciters?play=${surah}${range ? `&from=${range.from}&to=${range.to}` : ''}`);
}
export type { Catalog, Chapter };
export { Seg };

/* ------------------------------------------------------------------ Compact (ayah-by-ayah) downloads: same recordings, ½–⅛ the size */
const mbPerHour = (kbps: number) => Math.round((kbps * 1000 / 8) * 3600 / 1048576);
const lastWord = (s: string) => s.split(' —')[0].trim().split(/\s+/).pop()!.replace(/^ال/, '');
/** Best ayah-by-ayah reciter matching an MP3Quran reciter (by family name + first name). */
export function matchAyahReciter(list: AyahReciter[], nameAr: string | null): AyahReciter | null {
  if (!nameAr) return null;
  const n = nameAr.replace(/[ـ]/g, ''); const first = n.split(/\s+/)[0];
  return list.find((r) => { const base = r.ar.split(' —')[0]; return n.includes(lastWord(base)) && base.startsWith(first) && !r.riwayah; }) || null;
}
export function AyahDownloads({ reciter: initial }: { reciter?: string }) {
  const { settings } = useStore();
  const src = useAsync(getAyahAudioSources, []);
  const chapters = useAsync(getChapters, []);
  const [rid, setRid] = useState(initial || settings.ayahReciter);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [job, setJob] = useState<{ label: string; done: number; total: number; bytes: number } | null>(null);
  const [est, setEst] = useState<number | null>(null);
  const [usage, setUsage] = useState<string>('');
  const signal = useState({ cancel: false })[0];
  const refresh = async () => { if (!chapters.data) return; const c: Record<number, number> = {}; for (const ch of chapters.data) c[ch.id] = await cachedCount(rid, ch.id); setCounts(c); try { const e = await navigator.storage.estimate(); setUsage(`${Math.round((e.usage || 0) / 1048576)} MB`); } catch { /* ignore */ } };
  useEffect(() => { void refresh(); }, [rid, chapters.data, settings.audioQuality]);
  // whole-Quran size estimate: HEAD 12 ayahs spread over the mushaf
  useEffect(() => { let alive = true; setEst(null); (async () => { const sample: [number, number][] = [[1, 1], [2, 255], [3, 190], [6, 59], [12, 4], [18, 10], [24, 35], [36, 1], [55, 13], [67, 2], [78, 40], [112, 1]]; let tot = 0, n = 0; for (const [c, v] of sample) { try { const u = (await ayahUrls(c, v, rid))[0]; const r = await fetch(u, { method: 'HEAD' }); const l = Number(r.headers.get('content-length')); if (l) { tot += l; n++; } } catch { /* offline */ } } if (alive && n) setEst((tot / n) * 6236); })(); return () => { alive = false; }; }, [rid, settings.audioQuality]);
  if (!src.data || !chapters.data) return <main class="screen"><TopBar title={isAr() ? 'تنزيل مضغوط' : 'Compact downloads'} onBack /><Loading /></main>;
  const list = src.data.reciters as unknown as AyahReciter[];
  const r = list.find((x) => x.id === rid) || list[0];
  const chs = chapters.data;
  const run = async (label: string, items: number[]) => {
    signal.cancel = false; let bytes = 0;
    try {
      for (const ch of items) { const total = chs[ch - 1].verses; await cacheAyahs(ch, 1, total, r.id, (d, tt, b) => setJob({ label: `${label} · ${chs[ch - 1].name}`, done: d, total: tt, bytes: bytes + b }), signal).then((b) => { bytes += b; }); }
    } catch { /* cancelled or offline */ } finally { setJob(null); void refresh(); }
  };
  const doneSurahs = chs.filter((c) => counts[c.id] === c.verses).length;
  return (
    <main class="screen">
      <TopBar title={isAr() ? 'تنزيل مضغوط (آية بآية)' : 'Compact downloads'} onBack />
      <section class="card">
        <label class="small">{t('reciter')}</label>
        <select class="input" value={rid} onChange={(e) => setRid((e.target as HTMLSelectElement).value)}>
          {list.map((x) => <option key={x.id} value={x.id}>{isAr() ? x.ar : x.en}{x.tm ? (isAr() ? ' · كلمة بكلمة' : ' · word follow') : ''}</option>)}
        </select>
        <div class="field" style="margin-top:12px"><label>{isAr() ? 'الجودة' : 'Quality'}</label>
          <Seg value={settings.audioQuality} options={[{ v: 'lite', label: isAr() ? `مضغوطة · ${num(r.liteKbps)} ك.ب/ث` : `Compact · ${r.liteKbps} kbps` }, { v: 'hq', label: isAr() ? `عالية · ${num(r.kbps)} ك.ب/ث` : `High · ${r.kbps} kbps` }]} onChange={(v) => updateSettings({ audioQuality: v })} /></div>
        <p class="muted small">{isAr() ? `≈ ${num(mbPerHour(settings.audioQuality === 'lite' ? r.liteKbps : r.kbps))} م.ب لكل ساعة تلاوة` : `≈ ${mbPerHour(settings.audioQuality === 'lite' ? r.liteKbps : r.kbps)} MB per hour`}{r.lite === r.ea ? (isAr() ? ' · لهذا القارئ نسخة واحدة فقط' : ' · single quality for this reciter') : (isAr() ? ` · المضغوطة أصغر ${num(Math.round(r.kbps / r.liteKbps))}× بنفس التلاوة` : ` · compact is ${Math.round(r.kbps / r.liteKbps)}× smaller, same recording`)}</p>
        <p class="small" style="margin-top:6px">{isAr() ? 'المصحف كاملًا بهذه الجودة: ' : 'Whole Quran at this quality: '}<strong class="num">{est ? `≈ ${num(Math.round(est / 1048576))} ${isAr() ? 'م.ب' : 'MB'}` : '…'}</strong> · {isAr() ? `منزَّل: ${num(doneSurahs)}/١١٤ سورة` : `${doneSurahs}/114 downloaded`}{usage ? ` · ${isAr() ? 'المستخدم على الجهاز' : 'used'} ${usage}` : ''}</p>
        {r.tm && <p class="small" style="margin-top:6px"><span class="badge ok">{isAr() ? 'متابعة كلمة بكلمة دقيقة' : 'Exact word follow'}</span> {isAr() ? 'لهذا القارئ توقيتات لكل كلمة (quran-align)' : 'word timings available'}</p>}
        <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
          {!job ? <button class="btn" onClick={() => void run(isAr() ? 'المصحف كاملًا' : 'Whole Quran', chs.map((c) => c.id).filter((id) => counts[id] !== chs[id - 1].verses))}><Icon name="download" />{isAr() ? 'تنزيل المصحف كاملًا' : 'Download whole Quran'}</button>
            : <button class="btn secondary" onClick={() => { signal.cancel = true; }}>{isAr() ? 'إيقاف' : 'Stop'}</button>}
          <button class="btn ghost" onClick={() => updateSettings({ ayahReciter: r.id })} disabled={settings.ayahReciter === r.id}>{settings.ayahReciter === r.id ? (isAr() ? 'القارئ الافتراضي ✓' : 'Default ✓') : (isAr() ? 'اجعله الافتراضي' : 'Make default')}</button>
        </div>
        {job && <div style="margin-top:10px"><small>{job.label} — {num(job.done)}/{num(job.total)} · {num(Math.round(job.bytes / 1048576 * 10) / 10)} {isAr() ? 'م.ب' : 'MB'}</small><div class="progress"><div style={`width:${(job.done / job.total) * 100}%`} /></div></div>}
      </section>
      <div class="list" style="margin-top:12px">
        {chs.map((c) => { const n = counts[c.id] || 0; const full = n === c.verses; return (
          <div key={c.id} class="list-item">
            <span class="badge num">{num(c.id)}</span>
            <span class="grow"><span class="title">{c.name}</span><br /><span class="sub">{full ? (isAr() ? 'منزّلة — تعمل دون إنترنت' : 'downloaded') : n ? `${num(n)}/${num(c.verses)}` : `${num(c.verses)} ${t('ayah')}`}</span></span>
            {full ? <button class="icon-btn" aria-label={isAr() ? 'حذف' : 'Delete'} onClick={async () => { await deleteCached(r.id, c.id); void refresh(); }}><Icon name="close" /></button>
              : <button class="icon-btn" aria-label={isAr() ? 'تنزيل' : 'Download'} disabled={!!job} onClick={() => void run(c.name, [c.id])}><Icon name="download" /></button>}
          </div>); })}
      </div>
      <p class="muted small" style="margin-top:12px">{isAr() ? 'الملفات من everyayah.com (أرشيف مجاني) وتُحفظ داخل التطبيق فقط. التلاوة آية بآية تتيح التكرار ومتابعة المصحف.' : 'Files from everyayah.com, stored inside the app only.'}</p>
    </main>
  );
}

function CompactBanner({ nameAr }: { nameAr: string | null }) {
  const src = useAsync(getAyahAudioSources, []);
  const m = src.data ? matchAyahReciter(src.data.reciters as unknown as AyahReciter[], nameAr) : null;
  if (!m) return null;
  return (
    <button class="card soft" style="width:100%;text-align:start;margin-bottom:12px;display:flex;gap:10px;align-items:center" onClick={() => navigate(`/quran/compact/${m.id}`)}>
      <span class="tool-ic" style="width:42px;height:42px;flex:none"><Icon name="download" /></span>
      <span class="grow"><strong>{isAr() ? 'نسخة مضغوطة متاحة لهذا القارئ' : 'Compact copy available'}</strong><br /><small class="muted">{isAr() ? `آية بآية بـ ${num(m.liteKbps)} ك.ب/ث (≈ ${num(mbPerHour(m.liteKbps))} م.ب/ساعة)${m.tm ? ' · متابعة كلمة بكلمة في المصحف' : ' · متابعة الآيات في المصحف'}` : `${m.liteKbps} kbps ayah-by-ayah${m.tm ? ' · word follow' : ''}`}</small></span>
    </button>
  );
}

/** Monogram avatar for reciters (no photo download; colour derived from the id). */
const AV = ['#2F6A59', '#7D5F22', '#3E5C76', '#6B4E71', '#4F6B3A', '#8A4B3A', '#2E6470', '#5B5F2A'];
export function Avatar({ name, id, size = 44 }: { name: string; id: string; size?: number }) {
  const words = name.replace(/^(الشيخ|الشيخ\s)/, '').split(/\s+/).filter((w) => w.length > 1);
  const a = (words[0] || '?')[0]; const b = words.length > 1 ? words[words.length - 1].replace(/^ال/, '')[0] : '';
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const col = AV[h % AV.length];
  return <span class="avatar" style={`width:${size}px;height:${size}px;--av:${col}`} aria-hidden="true"><span>{a}{b ? '‌' + b : ''}</span></span>;
}

/** Recordings order on a reciter page: Hafs murattal complete first, then other riwayat, styles; taraweeh newest year first. */
function sortRecs(recs: Recording[]): Recording[] {
  const sw = (r: Recording) => (r.riwayah === 'hafs' ? 0 : 1) * 10 + ({ murattal: 0, mujawwad: 1, muallim: 2, taraweeh: 3 }[r.style] ?? 4);
  return [...recs].sort((a, b) => (a.style === 'taraweeh' && b.style === 'taraweeh' ? String(b.year || '').localeCompare(String(a.year || '')) : 0) || sw(a) - sw(b) || Number(b.complete) - Number(a.complete) || (a.source === b.source ? 0 : a.source === 'mp3quran' ? -1 : 1));
}
