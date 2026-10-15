/** Tools that the reference app offers, rebuilt local-first: prayer & fasting tracker, Hijri calendar + converter,
 *  personal khatma planner, Asmaa al-Husna, nearby mosques (OpenStreetMap), wallpapers (our own art), my duas. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useStore, updateUser, todayKey } from '../lib/store';
import { t, num, isAr, fmtTime } from '../lib/i18n';
import { navigate } from '../lib/router';
import { TopBar, Icon, Seg, Toggle, useAsync, Loading, Notice, shareText, Sheet } from '../components/ui';
import { toHijri, formatHijri, HIJRI_MONTHS, hijriFlags } from '../lib/hijri';
import { getMeta, getChapters, getAsma, pageOf } from '../lib/content';
import { computeDay, civilDate } from '../lib/prayer';

export const TOOLS = [
  { id: 'reciters', ar: 'القراء والتلاوات', en: 'Reciters', icon: 'play', go: '/quran/reciters' },
  { id: 'tracker', ar: 'متتبع الصلوات والصيام', en: 'Prayer & fasting tracker', icon: 'check', go: '/library/tracker' },
  { id: 'hijri', ar: 'التقويم الهجري', en: 'Hijri calendar', icon: 'today', go: '/library/hijri' },
  { id: 'khatma', ar: 'خطة الختمة', en: 'Khatma plan', icon: 'book', go: '/library/khatma' },
  { id: 'qibla', ar: 'اتجاه القبلة', en: 'Qibla', icon: 'compass', go: '/prayer/qibla' },
  { id: 'tasbih', ar: 'السبحة الإلكترونية', en: 'Tasbih', icon: 'adhkar', go: '/adhkar/tasbih' },
  { id: 'asma', ar: 'أسماء الله الحسنى', en: 'Names of Allah', icon: 'star', go: '/library/asma' },
  { id: 'mosques', ar: 'المساجد القريبة', en: 'Nearby mosques', icon: 'pin', go: '/library/mosques' },
  { id: 'duas', ar: 'أدعيتي', en: 'My duas', icon: 'info', go: '/library/duas' },
  { id: 'wallpapers', ar: 'خلفيات', en: 'Wallpapers', icon: 'sun', go: '/library/wallpapers' },
  { id: 'hadith', ar: 'الحديث', en: 'Hadith', icon: 'library', go: '/library/hadith/bukhari' },
  { id: 'nawafil', ar: 'النوافل والأوقات', en: 'Nawafil', icon: 'sun', go: '/prayer/nawafil' },
];
export function ToolsGrid({ ids }: { ids?: string[] }) {
  const list = ids ? TOOLS.filter((x) => ids.includes(x.id)) : TOOLS;
  return (
    <div class="tools-grid">
      {list.map((x) => (
        <button key={x.id} class="tool" onClick={() => navigate(x.go)}><span class="tool-ic"><Icon name={x.icon} /></span><span>{isAr() ? x.ar : x.en}</span></button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Tracker */
const PR = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export function TrackerScreen() {
  const { user, settings } = useStore();
  const [day, setDay] = useState(new Date());
  const [tab, setTab] = useState<'prayer' | 'fast'>('prayer');
  const key = todayKey(day);
  const rec = user.tracker?.[key] || {};
  const setRec = (patch: Record<string, boolean>) => updateUser((u) => ({ tracker: { ...(u.tracker || {}), [key]: { ...(u.tracker?.[key] || {}), ...patch } } }));
  const month = day.getMonth(), year = day.getFullYear();
  const first = new Date(year, month, 1); const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 1) % 7; // week starts Saturday
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const doneCount = (d: number) => { const r = user.tracker?.[todayKey(new Date(year, month, d))]; return r ? PR.filter((p) => r[p]).length : 0; };
  const fastDays = Object.entries(user.tracker || {}).filter(([k, v]) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) && v.fast).length;
  const hijri = toHijri(day, settings.hijriAdjust);
  return (
    <main class="screen">
      <TopBar title={isAr() ? 'متتبع الصلوات والصيام' : 'Prayer & fasting tracker'} onBack />
      <section class="card">
        <div class="row between">
          <button class="icon-btn" aria-label="prev" onClick={() => setDay(new Date(year, month - 1, 1))}><Icon name="next" /></button>
          <div style="text-align:center"><strong>{day.toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' })}</strong><br /><small class="muted">{formatHijri(hijri, isAr())}</small></div>
          <button class="icon-btn" aria-label="next" onClick={() => setDay(new Date(year, month + 1, 1))}><Icon name="back" /></button>
        </div>
        <div class="cal">
          {(isAr() ? ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'] : ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr']).map((d) => <span key={d} class="cal-h">{d}</span>)}
          {cells.map((d, i) => d === null ? <span key={'e' + i} /> : (
            <button key={d} class={`cal-d ${d === day.getDate() ? 'sel' : ''} ${todayKey(new Date(year, month, d)) === todayKey() ? 'today' : ''}`} onClick={() => setDay(new Date(year, month, d))}>
              <span>{num(d)}</span>
              <span class="dots">{tab === 'prayer' ? Array.from({ length: doneCount(d) }).map((_, k) => <i key={k} />) : (user.tracker?.[todayKey(new Date(year, month, d))]?.fast ? <i /> : null)}</span>
            </button>
          ))}
        </div>
      </section>
      <div style="margin:12px 0"><Seg value={tab} options={[{ v: 'prayer', label: t('prayer') }, { v: 'fast', label: isAr() ? 'الصيام' : 'Fasting' }]} onChange={setTab} /></div>
      {tab === 'prayer' ? (
        <section class="card">
          <p class="muted small" style="margin-bottom:8px">{day.toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {formatHijri(hijri, isAr())}</p>
          {PR.map((p) => <Toggle key={p} label={t(p)} checked={!!rec[p]} onChange={(v) => setRec({ [p]: v })} />)}
          <hr />
          <Toggle label={t('duha')} checked={!!rec.duha} onChange={(v) => setRec({ duha: v })} />
          <Toggle label={isAr() ? 'الوتر' : 'Witr'} checked={!!rec.witr} onChange={(v) => setRec({ witr: v })} />
          <p class="muted small" style="margin-top:8px">{isAr() ? 'سجل خاص على جهازك. لا يُحسب ثواب ولا يُقيَّم إيمان. يمكن إخفاء التقدم من الإعدادات.' : 'Private, on-device log. No reward counting or judgement.'}</p>
        </section>
      ) : (
        <section class="card">
          <Toggle label={isAr() ? 'صمتُ هذا اليوم' : 'I fasted this day'} checked={!!rec.fast} onChange={(v) => setRec({ fast: v })} />
          <p class="text-2 small" style="margin-top:8px">{isAr() ? `${num(fastDays)} يومًا هذا الشهر` : `${fastDays} days this month`} · {hijriFlags(hijri).join(' · ') || (isAr() ? 'لا مناسبة صيام موثقة لهذا اليوم في القائمة' : '')}</p>
          <p class="muted small" style="margin-top:8px">{isAr() ? 'تذكيرات الاثنين والخميس والأيام البيض وعرفة وعاشوراء: من الإعدادات ← التذكيرات (بعد المراجعة الفقهية للأيام المنهي عنها).' : 'Fast reminders are in Settings → Reminders.'}</p>
        </section>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ Hijri calendar */
export function HijriScreen() {
  const { settings } = useStore();
  const [view, setView] = useState(new Date());
  const [conv, setConv] = useState(todayKey());
  const y = view.getFullYear(), m = view.getMonth();
  const days = new Date(y, m + 1, 0).getDate(); const offset = (new Date(y, m, 1).getDay() + 1) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const h1 = toHijri(new Date(y, m, 1), settings.hijriAdjust), h2 = toHijri(new Date(y, m, days), settings.hijriAdjust);
  const convH = toHijri(new Date(conv + 'T12:00:00'), settings.hijriAdjust);
  return (
    <main class="screen">
      <TopBar title={t('hijri')} onBack />
      <section class="card">
        <div class="row between">
          <button class="icon-btn" aria-label="prev" onClick={() => setView(new Date(y, m - 1, 1))}><Icon name="next" /></button>
          <div style="text-align:center"><strong>{view.toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' })}</strong><br /><small class="muted">{HIJRI_MONTHS[h1.m - 1]}{h1.m !== h2.m ? ` – ${HIJRI_MONTHS[h2.m - 1]}` : ''} {num(h2.y)}هـ</small></div>
          <button class="icon-btn" aria-label="next" onClick={() => setView(new Date(y, m + 1, 1))}><Icon name="back" /></button>
        </div>
        <div class="cal">
          {(isAr() ? ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'] : ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr']).map((d) => <span key={d} class="cal-h">{d}</span>)}
          {cells.map((d, i) => { if (d === null) return <span key={'e' + i} />; const h = toHijri(new Date(y, m, d), settings.hijriAdjust); const fl = hijriFlags(h); return (
            <div key={d} class={`cal-d ${todayKey(new Date(y, m, d)) === todayKey() ? 'today' : ''} ${fl.length ? 'flag' : ''}`} title={fl.join(' · ')}>
              <span>{num(d)}</span><small class="muted">{num(h.d)}</small>
            </div>); })}
        </div>
        <p class="muted small" style="margin-top:8px">{t('hijriNote')} <a href="#/settings">{t('settings')}</a></p>
      </section>
      <section class="card" style="margin-top:12px">
        <h3>{isAr() ? 'محوّل التاريخ' : 'Date converter'}</h3>
        <input class="input" type="date" value={conv} onInput={(e) => setConv((e.target as HTMLInputElement).value)} style="margin:8px 0" />
        <p class="text-2">{formatHijri(convH, isAr())}{hijriFlags(convH).length ? ` · ${hijriFlags(convH).join(' · ')}` : ''}</p>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ Khatma planner (section 13) */
export function KhatmaScreen() {
  const { user } = useStore();
  const meta = useAsync(getMeta, []);
  const chapters = useAsync(getChapters, []);
  const [days, setDays] = useState(user.khatma?.days || 30);
  if (!meta.data || !chapters.data) return <main class="screen"><TopBar title={isAr() ? 'خطة الختمة' : 'Khatma plan'} onBack /><Loading /></main>;
  const total = meta.data.mushaf.pages;
  const plan = user.khatma;
  const start = () => updateUser({ khatma: { startDate: todayKey(), days, startPage: 1, createdAt: Date.now() } });
  const perDay = Math.ceil(total / (plan?.days || days));
  const dayIndex = plan ? Math.max(0, Math.floor((Date.now() - new Date(plan.startDate + 'T00:00:00').getTime()) / 86400000)) : 0;
  const todayFrom = plan ? Math.min(total, plan.startPage + dayIndex * perDay) : 1;
  const todayTo = Math.min(total, todayFrom + perDay - 1);
  const readPage = user.lastRead?.page || 0;
  const behind = plan ? Math.max(0, todayFrom - 1 - readPage) : 0;
  const chOf = (p: number) => chapters.data!.find((c, i, a) => c.page <= p && (!a[i + 1] || a[i + 1].page > p))?.name;
  return (
    <main class="screen">
      <TopBar title={isAr() ? 'خطة الختمة' : 'Khatma plan'} onBack />
      {!plan ? (
        <section class="card">
          <p class="text-2">{isAr() ? `اختر مدة الختمة؛ تُحسب الحصة اليومية من مصحف المدينة (${num(total)} صفحة).` : `Choose the duration; the daily share is computed from the Madani mushaf (${total} pages).`}</p>
          <div class="chips" style="margin:12px 0">{[7, 10, 15, 30, 60, 90].map((d) => <button key={d} class="chip" aria-pressed={days === d} onClick={() => setDays(d)}>{num(d)} {isAr() ? 'يومًا' : 'days'}</button>)}</div>
          <p class="small">{isAr() ? `≈ ${num(Math.ceil(total / days))} صفحة يوميًا` : `≈ ${Math.ceil(total / days)} pages/day`}</p>
          <button class="btn" style="margin-top:12px" onClick={start}>{isAr() ? 'ابدأ الخطة' : 'Start'}</button>
          <p class="muted small" style="margin-top:12px">{isAr() ? 'القراءة الحرة ممكنة دائمًا دون خطة. الخطة لا ترسل تنبيهات توبيخ، وتُعاد موازنة ما تبقى عند تعديلها.' : 'Free reading is always possible. No scolding reminders.'}</p>
        </section>
      ) : (
        <>
          <section class="card primary">
            <div class="row between"><span class="muted">{isAr() ? `اليوم ${num(dayIndex + 1)} من ${num(plan.days)}` : `Day ${dayIndex + 1} of ${plan.days}`}</span><span class="muted">{num(perDay)} {t('page')}/{isAr() ? 'يوم' : 'day'}</span></div>
            <h2 style="font-size:1.5em;margin:6px 0">{t('page')} {num(todayFrom)} – {num(todayTo)}</h2>
            <small class="muted">{chOf(todayFrom)} → {chOf(todayTo)}</small>
            <div class="progress" style="margin-top:10px;background:rgba(255,255,255,.2)"><div style={`width:${Math.min(100, (readPage / total) * 100)}%;background:var(--on-primary)`} /></div>
            <small class="muted">{isAr() ? `آخر موضع قراءة: صفحة ${num(readPage || 0)} · ${num(Math.round((readPage / total) * 100))}٪` : `Last read: page ${readPage} · ${Math.round((readPage / total) * 100)}%`}</small>
          </section>
          <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
            <button class="btn" onClick={() => navigate(`/quran/page/${Math.max(1, readPage >= todayFrom ? readPage : todayFrom)}`)}>{isAr() ? 'اقرأ حصة اليوم' : 'Read today'}</button>
            {behind > 0 && <button class="btn secondary" onClick={() => { const remaining = total - readPage; const left = Math.max(1, plan.days - dayIndex); updateUser({ khatma: { ...plan, startDate: todayKey(), days: left, startPage: readPage + 1 } }); void remaining; }}>{isAr() ? `إعادة توزيع المتبقي (${num(behind)} صفحة متأخرة)` : `Rebalance (${behind} pages behind)`}</button>}
            <button class="btn ghost" onClick={() => updateUser({ khatma: null })}>{isAr() ? 'إنهاء الخطة' : 'End plan'}</button>
          </div>
        </>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ Asmaa al-Husna */
export function AsmaScreen() {
  const d = useAsync(getAsma, []);
  if (!d.data) return <main class="screen"><TopBar title={isAr() ? 'أسماء الله الحسنى' : 'Names of Allah'} onBack /><Loading error={d.error} /></main>;
  return (
    <main class="screen">
      <TopBar title={isAr() ? 'أسماء الله الحسنى' : 'Names of Allah'} onBack />
      <div style="margin-bottom:12px"><Notice kind="info">{d.data.note}</Notice></div>
      <div class="grid-2 tablet-3">
        {d.data.names.map((n, i) => (
          <button key={i} class="card" style="text-align:center;padding:14px 8px" onClick={() => navigate(`/library/search?q=${encodeURIComponent(n.search)}`)}>
            <div class="muted small">{num(i + 1)}</div>
            <div style="font-family:var(--font-quran);font-size:1.7em;color:var(--primary)">{n.ar}</div>
            <div class="muted small" style="direction:ltr">{n.tr}</div>
            <div class="muted small">{isAr() ? 'ابحث في القرآن' : 'Find in Quran'}</div>
          </button>
        ))}
      </div>
      <p class="muted small" style="margin-top:12px">{d.data.source}</p>
    </main>
  );
}

/* ------------------------------------------------------------------ Nearby mosques (OpenStreetMap Overpass, no key) */
interface Mosque { id: number; name: string; lat: number; lon: number; dist: number; tags: Record<string, string> }
export function MosquesScreen() {
  const { settings } = useStore();
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [list, setList] = useState<Mosque[]>([]);
  const [err, setErr] = useState('');
  const loc = settings.location;
  const load = async () => {
    if (!loc) return;
    setState('loading');
    try {
      const q = `[out:json][timeout:20];(node["amenity"="place_of_worship"]["religion"="muslim"](around:3000,${loc.lat},${loc.lng});way["amenity"="place_of_worship"]["religion"="muslim"](around:3000,${loc.lat},${loc.lng}););out center 60;`;
      const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const dist = (a: number, b: number) => { const R = 6371000, dLat = (a - loc.lat) * Math.PI / 180, dLon = (b - loc.lng) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(loc.lat * Math.PI / 180) * Math.cos(a * Math.PI / 180) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
      const out: Mosque[] = (j.elements || []).map((e: { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }) => { const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon; return la != null && lo != null ? { id: e.id, name: e.tags?.['name:ar'] || e.tags?.name || (isAr() ? 'مسجد (بلا اسم في الخريطة)' : 'Mosque (unnamed)'), lat: la, lon: lo, dist: dist(la, lo), tags: e.tags || {} } : null; }).filter(Boolean).sort((a: Mosque, b: Mosque) => a.dist - b.dist);
      setList(out); setState('ok');
    } catch (e) { setErr(String((e as Error).message || e)); setState('error'); }
  };
  return (
    <main class="screen">
      <TopBar title={isAr() ? 'المساجد القريبة' : 'Nearby mosques'} onBack />
      {!loc ? <Notice action={t('chooseCity')} onAction={() => navigate('/prayer/city')}>{t('chooseCity')}</Notice> : (
        <>
          <section class="card">
            <p class="text-2 small">{isAr() ? `البحث حول: ${loc.name} (نصف قطر 3 كم). يُرسل موقعك إلى خادم OpenStreetMap عند الضغط فقط — لا يُحفظ.` : `Search around ${loc.name} (3 km). Your coordinates are sent to OpenStreetMap only when you tap.`}</p>
            <button class="btn" style="margin-top:8px" disabled={state === 'loading'} onClick={load}>{state === 'loading' ? '…' : (isAr() ? 'ابحث الآن' : 'Search')}</button>
          </section>
          {state === 'error' && <div style="margin-top:12px"><Notice action={isAr() ? 'إعادة المحاولة' : 'Retry'} onAction={load}>{isAr() ? `تعذّر الوصول إلى الخريطة (${err}). تحقق من الاتصال.` : `Map unavailable (${err}).`}</Notice></div>}
          {state === 'ok' && list.length === 0 && <p class="muted" style="text-align:center;padding:24px">{isAr() ? 'لا مساجد مسجلة في الخريطة ضمن 3 كم.' : 'No mosques mapped within 3 km.'}</p>}
          {list.length > 0 && (
            <div class="list" style="margin-top:12px">
              {list.map((mq) => (
                <a key={mq.id} class="list-item" href={`https://www.openstreetmap.org/?mlat=${mq.lat}&mlon=${mq.lon}#map=17/${mq.lat}/${mq.lon}`} target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
                  <Icon name="pin" /><span class="grow"><span class="title">{mq.name}</span><br /><span class="sub">{mq.dist < 1000 ? `${num(Math.round(mq.dist))} ${isAr() ? 'م' : 'm'}` : `${num((mq.dist / 1000).toFixed(1))} ${isAr() ? 'كم' : 'km'}`}{mq.tags['addr:street'] ? ` · ${mq.tags['addr:street']}` : ''}</span></span>
                </a>
              ))}
            </div>
          )}
          <p class="muted small" style="margin-top:12px">{isAr() ? 'البيانات من OpenStreetMap (ODbL) — أسماء ومواقع فقط؛ مواعيد الإقامة والخدمات لا تُؤكَّد من الخريطة.' : 'Data © OpenStreetMap contributors (ODbL). Names and positions only; iqama times and services are not confirmed by the map.'}</p>
        </>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ Wallpapers (our own art, free to share) */
export function WallpapersScreen() {
  const items = [
    { f: 'art/hero-portrait-1080.webp', ar: 'محراب ونور — فاتح', en: 'Mihrab & light — light' },
    { f: 'art/hero-portrait-dark-1080.webp', ar: 'محراب ونور — داكن', en: 'Mihrab & light — dark' },
    { f: 'art/hero-landscape-1280.webp', ar: 'أفقي — فاتح', en: 'Landscape — light' },
    { f: 'art/hero-landscape-dark-1280.webp', ar: 'أفقي — داكن', en: 'Landscape — dark' },
  ];
  return (
    <main class="screen">
      <TopBar title={isAr() ? 'خلفيات' : 'Wallpapers'} onBack />
      <p class="text-2 small" style="margin-bottom:12px">{isAr() ? 'جرافيكس أصلية من هوية التطبيق — بلا آيات داخل الصور، ويمكن حفظها كخلفية.' : 'Original artwork from the app identity — no verses inside images.'}</p>
      <div class="grid-2">
        {items.map((w) => (
          <div key={w.f} class="card" style="padding:8px">
            <img src={w.f} alt={isAr() ? w.ar : w.en} style="width:100%;border-radius:10px;display:block" loading="lazy" />
            <div class="row between" style="margin-top:6px"><small>{isAr() ? w.ar : w.en}</small><a class="btn ghost sm" href={w.f} download target="_blank" rel="noopener"><Icon name="download" /></a></div>
          </div>
        ))}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ My duas (private; the reference app's community is server-based) */
export function DuasScreen() {
  const { user } = useStore();
  const [text, setText] = useState('');
  const list = user.myDuas || [];
  return (
    <main class="screen">
      <TopBar title={isAr() ? 'أدعيتي' : 'My duas'} onBack />
      <section class="card">
        <textarea class="input" style="height:90px;padding:10px" placeholder={isAr() ? 'اكتب دعاءك الخاص (يبقى على جهازك)' : 'Write a private dua'} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
        <button class="btn sm" style="margin-top:8px" disabled={!text.trim()} onClick={() => { updateUser((u) => ({ myDuas: [{ id: String(Date.now()), text: text.trim(), at: Date.now() }, ...(u.myDuas || [])] })); setText(''); }}>{isAr() ? 'حفظ' : 'Save'}</button>
        <p class="muted small" style="margin-top:8px">{isAr() ? 'الدعاء الشخصي منفصل عن الأدعية المأثورة (في الأذكار). لا يُنشر ولا يُرفع.' : 'Personal duas are kept apart from narrated duas (in Adhkar). Never uploaded.'}</p>
      </section>
      <div class="stack" style="margin-top:12px">
        {list.map((d) => (
          <section key={d.id} class="card">
            <p class="body-text">{d.text}</p>
            <div class="row" style="margin-top:6px;gap:4px"><small class="muted" style="flex:1">{new Date(d.at).toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB')}</small><button class="btn ghost sm" onClick={() => shareText(d.text)}><Icon name="share" /></button><button class="btn ghost sm" onClick={() => updateUser((u) => ({ myDuas: (u.myDuas || []).filter((x) => x.id !== d.id) }))}><Icon name="close" /></button></div>
          </section>
        ))}
      </div>
    </main>
  );
}

/* Prayer times month table used by the reference app: exported helper for PrayerHome */
export function useMonthRows(loc: NonNullable<ReturnType<typeof useStore>['settings']['location']>, ps: ReturnType<typeof useStore>['settings']['prayer'], monthOffset: number) {
  return useMemo(() => {
    const now = new Date(); const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => computeDay(loc, ps, new Date(base.getFullYear(), base.getMonth(), i + 1, 12)));
  }, [loc.lat, loc.lng, ps.method, ps.madhab, ps.highLat, JSON.stringify(ps.adjust), monthOffset]);
}
export { civilDate, fmtTime, pageOf, Sheet };
