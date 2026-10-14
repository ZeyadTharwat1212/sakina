/** Section 11: streaming player (MP3Quran catalogue). No ayah-level sync claimed; no offline download until rights are confirmed. */
import { useEffect, useState } from 'preact/hooks';
import { getReciters, getChapters, type Reciter, type Chapter } from '../lib/content';
import { getSettings, updateSettings, updateUser } from '../lib/store';
import { t, num, isAr } from '../lib/i18n';
import { Icon, Sheet } from '../components/ui';

interface PlayerState { reciter: Reciter | null; ch: number; playing: boolean; error: string | null; pos: number; dur: number; open: boolean; pickReciter: boolean }
let state: PlayerState = { reciter: null, ch: 0, playing: false, error: null, pos: 0, dur: 0, open: false, pickReciter: false };
const subs = new Set<() => void>();
const set = (p: Partial<PlayerState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
let audio: HTMLAudioElement | null = null;
let reciters: Reciter[] = [];

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  audio.addEventListener('timeupdate', () => set({ pos: audio!.currentTime, dur: audio!.duration || 0 }));
  audio.addEventListener('play', () => set({ playing: true, error: null }));
  audio.addEventListener('pause', () => set({ playing: false }));
  audio.addEventListener('ended', () => { if (state.ch < 114) void playSurah(state.ch + 1); else set({ playing: false }); });
  audio.addEventListener('error', () => set({ playing: false, error: isAr() ? 'تعذّر تشغيل التلاوة — تحقق من الاتصال بالإنترنت.' : 'Could not play — check your internet connection.' }));
  return audio;
}

export async function playSurah(ch: number, _ayah?: number) {
  if (!reciters.length) reciters = (await getReciters()).reciters;
  const id = getSettings().reciterId;
  let r = reciters.find((x) => x.id === id) || null;
  if (!r) { set({ open: true, pickReciter: true, ch }); return; }
  const a = ensureAudio();
  const url = `${r.server}${String(ch).padStart(3, '0')}.mp3`;
  if (state.ch !== ch || a.src !== url) { a.src = url; set({ ch, reciter: r, pos: 0, dur: 0 }); }
  set({ open: true, pickReciter: false, reciter: r, ch });
  try { await a.play(); } catch { /* error event handles it */ }
  updateUser({ lastListen: { ch, v: _ayah || 1, page: 0, at: Date.now(), kind: 'listen' } });
}
export function pause() { audio?.pause(); }
export function stop() { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } set({ playing: false, open: false, ch: 0, pos: 0, dur: 0 }); }

const fmt = (s: number) => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '–';

export function MiniPlayer() {
  const [, force] = useState(0);
  const [chs, setChs] = useState<Chapter[] | null>(null);
  const [full, setFull] = useState(false);
  const [filter, setFilter] = useState<'all' | 'complete'>('complete');
  const [q, setQ] = useState('');
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  useEffect(() => { getChapters().then(setChs); getReciters().then((r) => { reciters = r.reciters; force((n) => n + 1); }); }, []);
  if (!state.open) return null;
  const name = chs && state.ch ? chs[state.ch - 1].name : '';
  const list = reciters.filter((r) => (filter === 'all' || r.complete) && (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.recitation.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      {!state.pickReciter && (
        <div class="miniplayer" role="region" aria-label={t('listen')}>
          <button class="icon-btn" aria-label={state.playing ? t('pause') : t('play')} onClick={() => (state.playing ? pause() : playSurah(state.ch))}><Icon name={state.playing ? 'pause' : 'play'} /></button>
          <button class="grow" style="text-align:start;min-width:0" onClick={() => setFull(true)}>
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{name} · {state.reciter?.name}</div>
            <small class="muted num">{fmt(state.pos)} / {fmt(state.dur)}{state.error ? ` · ${state.error}` : ''}</small>
          </button>
          <button class="icon-btn" aria-label={t('stop')} onClick={stop}><Icon name="close" /></button>
        </div>
      )}
      <Sheet open={full || state.pickReciter} onClose={() => { setFull(false); if (state.pickReciter) stop(); }} title={state.pickReciter ? t('reciter') : `${name} · ${state.reciter?.name ?? ''}`}>
        {state.pickReciter || full ? (
          <>
            {!state.pickReciter && (
              <div style="margin-bottom:12px">
                <div class="progress" aria-hidden="true"><div style={`width:${state.dur ? (state.pos / state.dur) * 100 : 0}%`} /></div>
                <div class="row between" style="margin-top:12px">
                  <button class="btn secondary sm" disabled={state.ch >= 114} onClick={() => playSurah(state.ch + 1)}>{isAr() ? 'التالية' : 'Next'}</button>
                  <button class="btn" onClick={() => (state.playing ? pause() : playSurah(state.ch))}>{state.playing ? t('pause') : t('play')}</button>
                  <button class="btn secondary sm" disabled={state.ch <= 1} onClick={() => playSurah(state.ch - 1)}>{isAr() ? 'السابقة' : 'Previous'}</button>
                </div>
                <p class="muted small" style="margin-top:12px">{t('noSync')} · {t('streamNote')}</p>
                <hr />
                <h3 style="margin-bottom:8px">{t('reciter')}</h3>
              </div>
            )}
            <div class="row" style="margin-bottom:8px">
              <input class="input" placeholder={t('search')} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
              <button class="chip" aria-pressed={filter === 'complete'} onClick={() => setFilter(filter === 'complete' ? 'all' : 'complete')}>{t('complete114')}</button>
            </div>
            <div class="list" style="max-height:45vh;overflow:auto">
              {list.map((r) => (
                <button key={r.id} class="list-item" onClick={() => { updateSettings({ reciterId: r.id }); set({ pickReciter: false }); setFull(false); void playSurah(state.ch || 1); }}>
                  <span class="grow"><span class="title">{r.name}</span><br /><span class="sub">{r.recitation}</span></span>
                  <span class={`badge ${r.complete ? 'ok' : 'warn'}`}>{r.complete ? t('complete114') : `${num(r.surahTotal)}/114 · ${t('incomplete')}`}</span>
                </button>
              ))}
            </div>
            <p class="muted small" style="margin-top:8px">{isAr() ? 'الفهرس من MP3Quran · البث عبر الإنترنت' : 'Catalogue from MP3Quran · streamed'} · <a href="#/library/sources">{t('sources')}</a></p>
          </>
        ) : null}
      </Sheet>
    </>
  );
}
