/** Sections 20–21: adhkar library, counted session (resumable), source sheet, favourites, tasbih. */
import { useState } from 'preact/hooks';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getAdhkar, type Dhikr } from '../lib/content';
import { useStore, updateUser, todayKey } from '../lib/store';
import { t, num, isAr } from '../lib/i18n';
import { navigate } from '../lib/router';
import { TopBar, Sheet, Icon, useAsync, Loading, shareText, Toggle } from '../components/ui';

const tap = () => { Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); };

export function AdhkarHome() {
  const { user } = useStore();
  const pack = useAsync(getAdhkar, []);
  const [q, setQ] = useState('');
  const [showFav, setShowFav] = useState(false);
  if (!pack.data) return <main class="screen"><TopBar title={t('adhkar')} /><Loading error={pack.error} /></main>;
  const cats = pack.data.categories;
  const PINNED = ['أذكار الصباح', 'أذكار المساء', 'الأذكار بعد السلام من الصلاة', 'أذكار النوم', 'أذكار الاستيقاظ من النوم'];
  const pinned = PINNED.map((n) => cats.find((c) => c.name === n)).filter((c): c is NonNullable<typeof c> => !!c);
  const filtered = cats.filter((c) => !q || c.name.includes(q) || c.items.some((i) => i.text.includes(q)));
  const favItems = cats.flatMap((c) => c.items.filter((i) => user.favAdhkar.includes(i.id)).map((i) => ({ ...i, cat: c })));
  return (
    <main class="screen">
      <TopBar title={t('adhkar')} right={<button class="icon-btn" aria-label={t('tasbih')} onClick={() => navigate('/adhkar/tasbih')}><Icon name="adhkar" /></button>} />
      <div class="grid-2" style="margin-bottom:16px">
        {pinned.map((c) => <button key={c.id} class="card" style="text-align:start" onClick={() => navigate(`/adhkar/session/${c.id}`)}><strong>{c.name}</strong><br /><small class="muted">{num(c.items.length)} {isAr() ? 'ذكرًا' : 'items'}</small></button>)}
      </div>
      <div class="row" style="margin-bottom:12px">
        <input class="input" placeholder={t('search')} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <button class="chip" aria-pressed={showFav} onClick={() => setShowFav(!showFav)}><Icon name="star" />{num(user.favAdhkar.length)}</button>
      </div>
      {showFav ? (
        favItems.length ? <div class="list">{favItems.map((i) => <button key={i.id} class="list-item" onClick={() => navigate(`/adhkar/session/${i.cat.id}`)}><span class="grow"><span class="dhikr-text" style="font-size:1em;text-align:start;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{i.text}</span><span class="sub">{i.cat.name}</span></span></button>)}</div>
          : <p class="muted" style="text-align:center;padding:24px">{isAr() ? 'لا مفضلة بعد.' : 'No favourites yet.'}</p>
      ) : (
        <div class="list">
          {filtered.map((c) => (
            <button key={c.id} class="list-item" onClick={() => navigate(`/adhkar/session/${c.id}`)}>
              <span class="grow"><span class="title">{c.name}</span><br /><span class="sub">{num(c.items.length)} · {c.items.filter((i) => i.ref).length === c.items.length ? (isAr() ? 'كل الأذكار بمرجع' : 'all referenced') : `${num(c.items.filter((i) => i.ref).length)}/${num(c.items.length)} ${isAr() ? 'بمرجع' : 'referenced'}`}</span></span>
            </button>
          ))}
        </div>
      )}
      <p class="muted small" style="margin-top:16px;text-align:center">{isAr() ? 'المصدر: مجموعة azkar-db المستندة إلى حصن المسلم · التخريج قيد المراجعة' : 'Source: azkar-db (Hisn al-Muslim based) · takhrij under review'} · <a href="#/library/sources">{t('sources')}</a></p>
    </main>
  );
}

export function DhikrSession({ catId }: { catId: number }) {
  const { user, settings } = useStore();
  const pack = useAsync(getAdhkar, []);
  const [idx, setIdx] = useState(0);
  const [src, setSrc] = useState<Dhikr | null>(null);
  const [listMode, setListMode] = useState(false);
  if (!pack.data) return <main class="screen"><TopBar title={t('adhkar')} onBack /><Loading error={pack.error} /></main>;
  const cat = pack.data.categories.find((c) => c.id === catId);
  if (!cat) return <main class="screen"><TopBar title={t('adhkar')} onBack /><p class="muted">—</p></main>;
  const key = `${catId}:${todayKey()}`;
  const session = user.sessions[key] || { catId, progress: {}, startedAt: Date.now() };
  const item = cat.items[idx];
  const done = session.progress[item.id] || 0;
  const total = cat.items.reduce((a, i) => a + i.count, 0);
  const doneTotal = cat.items.reduce((a, i) => a + Math.min(session.progress[i.id] || 0, i.count), 0);
  const allDone = cat.items.every((i) => (session.progress[i.id] || 0) >= i.count);
  const save = (progress: Record<number, number>) => {
    const complete = cat.items.every((i) => (progress[i.id] || 0) >= i.count);
    updateUser((u) => ({
      sessions: { ...u.sessions, [key]: { ...session, progress, completedAt: complete ? Date.now() : session.completedAt } },
      log: complete && /الصباح|المساء/.test(cat.name) ? { ...u.log, [todayKey()]: { ...(u.log[todayKey()] || {}), [cat.name.includes('الصباح') ? 'adhkarMorning' : 'adhkarEvening']: true } } : u.log,
    }));
  };
  const inc = () => {
    tap();
    const next = Math.min(done + 1, item.count);
    const progress = { ...session.progress, [item.id]: next };
    save(progress);
    if (next >= item.count && idx < cat.items.length - 1) setTimeout(() => setIdx(idx + 1), 250);
  };
  const dec = () => save({ ...session.progress, [item.id]: Math.max(0, done - 1) });
  const isFav = user.favAdhkar.includes(item.id);
  const toggleFav = () => updateUser((u) => ({ favAdhkar: isFav ? u.favAdhkar.filter((x) => x !== item.id) : [...u.favAdhkar, item.id] }));

  return (
    <main class="screen">
      <TopBar title={cat.name} onBack right={<button class="chip" aria-pressed={listMode} onClick={() => setListMode(!listMode)}>{listMode ? t('counter') : (isAr() ? 'قائمة' : 'List')}</button>} />
      {settings.showProgress && <div class="progress" style="margin-bottom:12px" role="progressbar" aria-valuenow={doneTotal} aria-valuemax={total}><div style={`width:${(doneTotal / total) * 100}%`} /></div>}
      {listMode ? (
        <div class="stack">
          {cat.items.map((i) => (
            <section key={i.id} class="card">
              <p class="dhikr-text" style="text-align:start">{i.text}</p>
              <div class="row between" style="margin-top:8px"><small class="muted">{t('count')}: {num(i.count)}{i.ref ? ` · ${i.ref}` : ''}</small><button class="btn ghost sm" onClick={() => setSrc(i)}>{t('source')}</button></div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <section class="card" style="text-align:center">
            <small class="muted num">{num(idx + 1)} / {num(cat.items.length)}</small>
            <p class="dhikr-text" style="margin:12px 0">{item.text}</p>
            <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">
              <span class="badge">{t('count')}: {num(item.count)}</span>
              {item.ref ? <span class="badge ok">{item.ref}</span> : <span class="badge warn">{isAr() ? 'المرجع قيد المراجعة' : 'reference pending'}</span>}
            </div>
          </section>
          <button class="counter-btn" onClick={inc} aria-label={`${t('counter')} ${done} / ${item.count}`}>{num(done)}<span style="font-size:.4em;opacity:.8">/{num(item.count)}</span></button>
          <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">
            <button class="btn secondary sm" disabled={!done} onClick={dec}><Icon name="undo" />{t('undo')}</button>
            <button class="btn secondary sm" onClick={() => setSrc(item)}><Icon name="info" />{t('source')}</button>
            <button class="btn secondary sm" aria-pressed={isFav} onClick={toggleFav}><Icon name="star" />{isFav ? '★' : '☆'}</button>
            <button class="btn secondary sm" onClick={() => shareText(`${item.text}\n${item.ref ? `[${item.ref}]` : ''}`)}><Icon name="share" />{t('share')}</button>
          </div>
          <div class="row between" style="margin-top:16px">
            <button class="btn ghost sm" disabled={idx >= cat.items.length - 1} onClick={() => setIdx(idx + 1)}>{isAr() ? 'التالي' : 'Next'} ›</button>
            <button class="btn ghost sm" disabled={idx <= 0} onClick={() => setIdx(idx - 1)}>‹ {isAr() ? 'السابق' : 'Previous'}</button>
          </div>
          {allDone && <p class="card soft" style="text-align:center;margin-top:16px">{t('complete')} ✓ <br /><small class="muted">{isAr() ? 'الجلسة محفوظة محليًا لهذا اليوم فقط.' : 'Saved locally for today only.'}</small></p>}
          <p class="muted small" style="margin-top:16px;text-align:center">{isAr() ? 'العدد الوارد من المصدر؛ أي هدف شخصي يختلف عنه ليس سُنّة. يُستكمل العدّاد إذا خرجت وعدت اليوم.' : 'Counts come from the source; a different personal target is not a sunnah. The counter resumes if you leave and return today.'}</p>
        </>
      )}
      <Sheet open={!!src} onClose={() => setSrc(null)} title={t('source')}>
        {src && (
          <>
            <p class="dhikr-text" style="text-align:start;font-size:1.05em">{src.text}</p>
            <hr />
            <dl class="kv">
              <dt>{t('count')}</dt><dd>{num(src.count)}</dd>
              <dt>{isAr() ? 'التخريج' : 'Reference'}</dt><dd>{src.ref || <span class="badge warn">{isAr() ? 'غير مُسجَّل في المصدر الرقمي — يحتاج مراجعة' : 'not recorded in the digital source — needs review'}</span>}</dd>
              {src.note && <><dt>{isAr() ? 'ملاحظة' : 'Note'}</dt><dd class="body-text" style="font-size:1em">{src.note}</dd></>}
              <dt>{isAr() ? 'المجموعة' : 'Pack'}</dt><dd>azkar-db ← حصن المسلم (القحطاني) · <span class="badge warn">{t('notReviewed')}</span></dd>
            </dl>
            <p class="muted small" style="margin-top:12px">{isAr() ? 'الفضل المذكور في الملاحظة منقول من المصدر الرقمي ولم تُراجع نسبته بعد.' : 'Any virtue in the note is quoted from the digital source and not yet verified.'}</p>
          </>
        )}
      </Sheet>
    </main>
  );
}

export function Tasbih() {
  const { user } = useStore();
  const { count, target } = user.tasbih;
  const [hapt, setHapt] = useState(true);
  const set = (p: Partial<typeof user.tasbih>) => updateUser((u) => ({ tasbih: { ...u.tasbih, ...p } }));
  return (
    <main class="screen">
      <TopBar title={t('tasbih')} onBack />
      <section class="card" style="text-align:center">
        <div class="chips" style="justify-content:center;margin-bottom:8px">{[33, 99, 100, 1000].map((x) => <button key={x} class="chip" aria-pressed={target === x} onClick={() => set({ target: x })}>{num(x)}</button>)}</div>
        <small class="muted">{t('target')} — {isAr() ? 'اختيار شخصي، ليس عددًا مسنونًا بذاته' : 'your own choice, not a prescribed count'}</small>
        <button class="counter-btn" onClick={() => { if (hapt) tap(); set({ count: count + 1 }); }}>{num(count)}<span style="font-size:.4em;opacity:.8">/{num(target)}</span></button>
        <div class="row" style="justify-content:center;gap:8px">
          <button class="btn secondary sm" disabled={!count} onClick={() => set({ count: count - 1 })}><Icon name="undo" />{t('undo')}</button>
          <button class="btn secondary sm" onClick={() => set({ count: 0 })}>{t('reset')}</button>
        </div>
        <div style="margin-top:12px"><Toggle label={isAr() ? 'اهتزاز' : 'Haptics'} checked={hapt} onChange={setHapt} /></div>
      </section>
    </main>
  );
}
