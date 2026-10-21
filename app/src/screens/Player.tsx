/** Mini player (fixed above the tab bar) that expands into the full player sheet. */
import { useEffect, useState } from 'preact/hooks';
import { getMeta, pageOf } from '../lib/content';
import { getPlayer, subscribePlayer, toggle, next, prev, seekTo, seekBy, setRate, setRepeat, setSleep, setOpen, stop, setAyahRange, removeFromQueue, playQueue } from '../lib/audio/player';
import { getCatalog, recordingById, displayName, STYLE_AR, type Catalog } from '../lib/audio/catalog';
import { getChapters, type Chapter } from '../lib/content';
import { t, num, isAr } from '../lib/i18n';
import { navigate } from '../lib/router';
import { Icon, Sheet } from '../components/ui';
import * as DL from '../lib/audio/downloads';

const fmt = (s: number) => isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '–:––';

export function MiniPlayer() {
  const [, force] = useState(0);
  const [chs, setChs] = useState<Chapter[] | null>(null);
  const [cat, setCat] = useState<Catalog | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  useEffect(() => { const u = subscribePlayer(() => force((n) => n + 1)); getChapters().then(setChs); getCatalog().then(setCat); return u; }, []);
  const p = getPlayer();
  const tr = p.queue[p.index];
  if (p.open === 'none' || !tr || !chs || !cat) return null;
  const rec = recordingById(cat, tr.recId);
  const name = chs[tr.surah - 1].name;
  const who = rec ? displayName(rec) : tr.recId;
  const pct = p.dur ? (p.pos / p.dur) * 100 : 0;
  const downloaded = DL.isDownloaded(tr.recId, tr.surah);
  const dl = DL.itemOf(tr.recId, tr.surah);
  return (
    <>
      {p.open === 'mini' && (
        <div class="miniplayer" role="region" aria-label={t('listen')}>
          <button class="icon-btn" aria-label={p.playing ? t('pause') : t('play')} onClick={() => void toggle()}><Icon name={p.loading ? 'more' : p.playing ? 'pause' : 'play'} /></button>
          <button class="grow" style="text-align:start;min-width:0" onClick={() => setOpen('full')}>
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">سورة {name} · {who}</div>
            <small class="muted num">{fmt(p.pos)} / {fmt(p.dur)}{p.local ? ` · ${isAr() ? 'من الجهاز' : 'offline'}` : ''}{p.currentAyah ? ` · ${t('ayah')} ${num(p.currentAyah)}` : ''}{p.error ? ` · ${p.error}` : ''}</small>
            <div class="progress" style="height:3px;margin-top:4px"><div style={`width:${pct}%`} /></div>
          </button>
          <button class="icon-btn" aria-label={isAr() ? 'التالية' : 'Next'} onClick={() => void next()}><Icon name="next" /></button>
          <button class="icon-btn" aria-label={t('stop')} onClick={stop}><Icon name="close" /></button>
        </div>
      )}
      <Sheet open={p.open === 'full'} onClose={() => setOpen('mini')} title={`سورة ${name}`}>
        <p class="text-2" style="margin-top:-8px">{who}{rec ? ` · ${STYLE_AR[rec.style]} · ${rec.riwayahAr}` : ''}</p>
        {p.error && <p class="notice" style="margin:8px 0">{p.error}</p>}
        {p.rangeNote && <p class="notice" style="margin:8px 0">{p.rangeNote}</p>}
        {p.ayahRange && <p class="small" style="margin:8px 0;text-align:center"><span class="badge ok">{isAr() ? `الآيات ${num(p.ayahRange.from)}–${num(p.ayahRange.to)} فقط` : `Ayahs ${p.ayahRange.from}–${p.ayahRange.to} only`}</span> <small class="muted">{p.repeat === 'off' ? (isAr() ? 'يتوقف عند نهايتها؛ فعّل التكرار لإعادتها' : 'Stops at the end; turn on repeat to loop') : (isAr() ? 'تتكرر' : 'looping')}</small></p>}
        <input type="range" min={0} max={p.dur || 0} step={1} value={p.pos} onInput={(e) => seekTo(Number((e.target as HTMLInputElement).value))} style="width:100%;margin:12px 0 4px" aria-label={isAr() ? 'الموضع' : 'Position'} />
        <div class="row between num small muted"><span>{fmt(p.pos)}</span><span>{fmt(p.dur)}</span></div>
        <div class="row" style="justify-content:center;gap:6px;margin:8px 0">
          <button class="icon-btn" aria-label={isAr() ? 'السابقة' : 'Previous'} onClick={() => void prev()}><Icon name="back" /></button>
          <button class="chip" onClick={() => seekBy(-10)}>−١٠</button>
          <button class="counter-btn" style="width:72px;height:72px;font-size:1em;margin:0" aria-label={p.playing ? t('pause') : t('play')} onClick={() => void toggle()}><Icon name={p.playing ? 'pause' : 'play'} /></button>
          <button class="chip" onClick={() => seekBy(10)}>+١٠</button>
          <button class="icon-btn" aria-label={isAr() ? 'التالية' : 'Next'} onClick={() => void next()}><Icon name="next" /></button>
        </div>
        <div class="chips" style="justify-content:center">
          {(['off', 'one', 'all'] as const).map((r) => <button key={r} class="chip" aria-pressed={p.repeat === r} onClick={() => setRepeat(r)}>{r === 'off' ? (isAr() ? 'بلا تكرار' : 'No repeat') : r === 'one' ? (isAr() ? 'تكرار السورة' : 'Repeat surah') : (isAr() ? 'تكرار القائمة' : 'Repeat all')}</button>)}
          {[0.75, 1, 1.25, 1.5].map((r) => <button key={r} class="chip" aria-pressed={p.rate === r} onClick={() => setRate(r)}>{r}×</button>)}
        </div>
        <div class="chips" style="justify-content:center;margin-top:8px">
          <span class="muted small" style="align-self:center">{isAr() ? 'مؤقت النوم:' : 'Sleep:'}</span>
          {[null, 10, 20, 30, 60].map((m) => <button key={String(m)} class="chip" aria-pressed={m == null ? !p.sleepAt : !!p.sleepAt && Math.abs(p.sleepAt - Date.now() - m * 60000) < 60000 * 2} onClick={() => setSleep(m)}>{m == null ? (isAr() ? 'إيقاف' : 'off') : `${num(m)} ${isAr() ? 'د' : 'min'}`}</button>)}
        </div>
        <hr />
        {p.timings ? (
          <div>
            <p class="small text-2">{isAr() ? 'توقيتات الآيات متاحة لهذا التسجيل من المصدر.' : 'Ayah timings are available for this recording.'} {p.currentAyah ? `${t('ayah')} ${num(p.currentAyah)}` : ''}</p>
            <div class="row" style="margin-top:6px;gap:8px">
              <button class="btn sm" onClick={async () => { const m = await getMeta(); setOpen('mini'); navigate(`/quran/page/${pageOf(m, tr.surah, p.currentAyah || 1)}?follow=1`); }}><Icon name="quran" />{isAr() ? 'تابع في المصحف' : 'Follow in mushaf'}</button>
              {p.currentAyah && <button class="btn secondary sm" aria-pressed={!!p.ayahRange} onClick={() => setAyahRange(p.ayahRange ? null : { from: p.currentAyah!, to: p.currentAyah! })}>{p.ayahRange ? (isAr() ? 'إيقاف تكرار الآية' : 'Stop ayah loop') : (isAr() ? 'تكرار هذه الآية' : 'Loop this ayah')}</button>}
              {p.ayahRange && <button class="btn ghost sm" onClick={() => setAyahRange({ from: p.ayahRange!.from, to: p.ayahRange!.to + 1 })}>{isAr() ? 'وسّع النطاق +١' : 'Extend +1'}</button>}
            </div>
          </div>
        ) : <p class="muted small">{t('noSync')} {isAr() ? 'للمتابعة في المصحف كلمة بكلمة استخدم «استمع مع المتابعة» من صفحة المصحف.' : 'For word-by-word following use “Listen & follow” on a mushaf page.'}</p>}
        <hr />
        <div class="row between">
          <span class="small">{downloaded ? <span class="badge ok">{isAr() ? 'منزّلة — تعمل دون إنترنت' : 'downloaded'}</span> : dl?.status === 'downloading' ? <span class="badge">{isAr() ? 'جارٍ التنزيل' : 'downloading'}</span> : <button class="btn ghost sm" onClick={() => rec && DL.enqueue(rec, [tr.surah])}>{isAr() ? 'تنزيل هذه السورة' : 'Download this surah'}</button>}</span>
          <button class="btn ghost sm" onClick={() => setShowQueue(!showQueue)}>{isAr() ? `قائمة الانتظار (${num(p.queue.length)})` : `Queue (${p.queue.length})`}</button>
        </div>
        {showQueue && (
          <div class="list" style="margin-top:8px;max-height:36vh;overflow:auto">
            {p.queue.map((q, i) => (
              <div key={i} class="list-item" style={i === p.index ? 'background:var(--primary-soft)' : ''}>
                <button class="grow" style="text-align:start" onClick={() => void playQueue(p.queue, i)}><span class="title">{chs[q.surah - 1].name}</span></button>
                <button class="icon-btn" aria-label={isAr() ? 'إزالة' : 'Remove'} onClick={() => removeFromQueue(i)}><Icon name="close" /></button>
              </div>
            ))}
          </div>
        )}
        <div class="row" style="margin-top:12px;gap:8px">
          <button class="btn secondary sm" onClick={() => { setOpen('mini'); navigate(`/quran/reciters/${rec?.reciterId || ''}`); }}>{isAr() ? 'صفحة القارئ' : 'Reciter page'}</button>
          <button class="btn secondary sm" onClick={() => { setOpen('mini'); navigate('/quran/reciters'); }}>{isAr() ? 'تغيير القارئ' : 'Change reciter'}</button>
        </div>
      </Sheet>
    </>
  );
}
