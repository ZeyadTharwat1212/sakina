/** Sections 11–12 UI: reciter library (famous + all), reciter page with recordings and 114-surah status, downloads manager. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { getCatalog, refreshCatalog, recordingsOf, displayName, hasSurah, STYLE_AR, fileUrl, hasTimings, timedRecordingFor, type Catalog, type Recording } from '../lib/audio/catalog';
import * as DL from '../lib/audio/downloads';
import { playSurah, playAyahRange, getPlayer, subscribePlayer } from '../lib/audio/player';
import { getChapters, type Chapter } from '../lib/content';
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
  const [riw, setRiw] = useState<'all' | 'hafs' | 'warsh' | 'qalun' | 'other'>('all');
  const [onlyComplete, setOnlyComplete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);
  if (!cat.data) return <main class="screen"><TopBar title={isAr() ? 'القراء' : 'Reciters'} onBack /><Loading error={cat.error} /></main>;
  const c = cat.data;
  const matches = (r: { name: string; nameAr: string | null }) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.nameAr || '').includes(q);
  const recFilter = (rec: Recording) => (riw === 'all' || (riw === 'other' ? !['hafs', 'warsh', 'qalun'].includes(rec.riwayah) : rec.riwayah === riw)) && (!onlyComplete || rec.complete);
  const reciterOk = (id: string) => recordingsOf(c, id).some(recFilter) && (!range || recordingsOf(c, id).some(hasTimings));
  const famous = c.famousOrder.map((id) => c.reciters.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r && matches(r) && reciterOk(r.id));
  const others = c.reciters.filter((r) => !r.famous && matches(r) && reciterOk(r.id)).sort((a, b) => displayName(a).localeCompare(displayName(b), 'ar'));
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
        <span class="icon-btn" style="background:var(--primary-soft);color:var(--primary);border-radius:12px"><Icon name="play" /></span>
        <span class="grow"><span class="title">{displayName(r)}</span>{r.nameAr && <span class="sub"> · {r.name}</span>}<br />
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
      <div class="chips scroll" style="margin:10px 0">
        {(['all', 'hafs', 'warsh', 'qalun', 'other'] as const).map((k) => <button key={k} class="chip" aria-pressed={riw === k} onClick={() => setRiw(k)}>{k === 'all' ? (isAr() ? 'كل الروايات' : 'All') : k === 'hafs' ? 'حفص' : k === 'warsh' ? 'ورش' : k === 'qalun' ? 'قالون' : (isAr() ? 'روايات أخرى' : 'Other')}</button>)}
        <button class="chip" aria-pressed={onlyComplete} onClick={() => setOnlyComplete(!onlyComplete)}>{isAr() ? 'مصحف كامل فقط' : 'Complete only'}</button>
      </div>
      <h2 style="margin:8px 0">{isAr() ? 'القراء المشهورون' : 'Famous reciters'} <span class="badge">{num(famous.length)}</span></h2>
      <div class="list">{famous.map((r) => <Row key={r.id} r={r} />)}</div>
      <h2 style="margin:20px 0 8px">{isAr() ? 'جميع القراء' : 'All reciters'} <span class="badge">{num(others.length)}</span></h2>
      <div class="list">{others.map((r) => <Row key={r.id} r={r} />)}</div>
      <div class="card" style="margin-top:16px">
        <div class="row between"><span class="small text-2">{isAr() ? 'الفهرس: MP3Quran' : 'Catalogue: MP3Quran'} · {c.refreshedAt ? new Date(c.refreshedAt).toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB') : (isAr() ? 'نسخة مضمّنة' : 'bundled')}</span>
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
      {recs.length > 1 && (
        <div class="chips scroll" style="margin-bottom:12px">
          {recs.map((r) => <button key={r.id} class="chip" style="white-space:nowrap" aria-pressed={r.id === rec.id} onClick={() => setRecId(r.id)}>{STYLE_AR[r.style]} · {r.riwayahAr.split(' ')[0]}{r.complete ? '' : ` · ${num(r.surahTotal)}/114`}{hasTimings(r) ? ' · ⏱' : ''}</button>)}
        </div>
      )}
      <section class="card">
        <div class="row between" style="flex-wrap:wrap;gap:6px">
          <div><strong>{STYLE_AR[rec.style]}</strong> · {rec.riwayahAr}<br /><small class="muted">{reciter.nameAr ? `${reciter.name} · ` : ''}{rec.recitationAr || rec.recitation} · {rec.id}</small></div>
          <span class={`badge ${rec.complete ? 'ok' : 'warn'}`}>{rec.complete ? t('complete114') : `${num(rec.surahTotal)}/114 ${t('incomplete')}`}</span>
        </div>
        <button class="chip" style="margin-top:8px" aria-pressed={settings.reciterId === rec.id} onClick={() => updateSettings({ reciterId: rec.id })}>{settings.reciterId === rec.id ? (isAr() ? 'القارئ الافتراضي ✓' : 'Default reciter ✓') : (isAr() ? 'اجعله القارئ الافتراضي' : 'Set as default reciter')}</button>
        {missing && missing.length > 0 && <p class="muted small" style="margin-top:6px">{isAr() ? 'السور الناقصة:' : 'Missing:'} {missing.map((n) => chs[n - 1].name).join('، ')}</p>}
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
        {chs.map((ch) => {
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
      <p class="muted small" style="margin-top:12px">{isAr() ? 'المصدر: MP3Quran. البث والتنزيل بطلب المستخدم إلى جهازه فقط؛ لا تُعاد استضافة الملفات.' : 'Source: MP3Quran. Streaming and user-initiated download to this device only; files are never re-hosted.'}</p>
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
