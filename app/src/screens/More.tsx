/** Reference-app parity, second pass: رمضان، صائمون، قيام الليل، منبه الفجر، التعليم الإسلامي، كروت التهنئة/حالة، المساعدة.
 *  All local-first; reminders go through the same notification planner (lib/notify.ts). */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore, updateSettings, updateUser, todayKey, getSettings, type Settings } from '../lib/store';
import { t, num, isAr, fmtTime } from '../lib/i18n';
import { navigate } from '../lib/router';
import { TopBar, Icon, Seg, Toggle, Notice, useNow, useAsync, shareText } from '../components/ui';
import { toHijri, formatHijri, HIJRI_MONTHS } from '../lib/hijri';
import { computeDay, civilDate, nightTimes } from '../lib/prayer';
import { ramadanInfo, upcomingFasts, fastingFor, addDays, OCCASIONS, nextOccasion } from '../lib/calendar';
import { reschedule, isNative, playChime, permissionState } from '../lib/notify';
import { LESSONS } from '../data/teach';
import { getAdhkar } from '../lib/content';

const ar = () => isAr();
const dateLabel = (d: Date) => d.toLocaleDateString(ar() ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function NativeNote() {
  return !isNative ? <p class="muted small" style="margin-top:8px">{ar() ? 'التنبيهات المجدولة تعمل في تطبيق الهاتف (Android/iOS)، لا في نسخة المتصفح. الحسابات والجداول تعمل هنا.' : 'Scheduled alerts run in the phone app (Android/iOS), not in the browser build. Tables and calculations work here.'}</p> : null;
}
async function saveAndReschedule(patch: Partial<Settings>) {
  updateSettings(patch);
  const s = getSettings();
  await reschedule(s.location, s.prayer);
}

/* ------------------------------------------------------------------ Ramadan */
export function RamadanScreen() {
  const { settings } = useStore();
  const now = useNow(1000);
  const loc = settings.location;
  const info = useMemo(() => ramadanInfo(now, settings.hijriAdjust), [todayKey(now), settings.hijriAdjust]);
  const rows = useMemo(() => loc ? info.days.map((d) => ({ d, h: toHijri(d, settings.hijriAdjust), t: computeDay(loc, settings.prayer, d) })) : [], [loc?.lat, loc?.lng, settings.prayer.method, info.start.getTime()]);
  const today = loc && info.inRamadan ? rows[info.dayIndex] : null;
  const r = settings.ramadan;
  const setR = (p: Partial<typeof r>) => saveAndReschedule({ ramadan: { ...r, ...p } });
  const remaining = (to: Date) => { const s = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000)); return `${num(String(Math.floor(s / 3600)).padStart(2, '0'))}:${num(String(Math.floor((s % 3600) / 60)).padStart(2, '0'))}:${num(String(s % 60).padStart(2, '0'))}`; };
  const shareTable = () => shareText(`إمساكية رمضان ${num(info.year)}هـ — ${loc?.name}\n` + rows.map((x) => `${num(x.h.d)} رمضان · ${x.d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })} · الفجر ${fmtTime(x.t.times.fajr, loc!.tz)} · المغرب ${fmtTime(x.t.times.maghrib, loc!.tz)}`).join('\n') + `\n(محسوب — ${t('calculated')}; اتبع إعلان بلدك)`);
  return (
    <main class="screen">
      <TopBar title={ar() ? 'رمضان' : 'Ramadan'} onBack />
      <section class="hero-card scene-evening art-host" style="text-align:center">
        <span class="art-layer pattern-star" aria-hidden="true" style="opacity:.08" />
        <div class="muted small">{ar() ? `رمضان ${num(info.year)}هـ (حسابيًا)` : `Ramadan ${info.year} AH (calculated)`}</div>
        {info.inRamadan && today ? (
          <>
            <div style="font-size:1.6em;font-weight:700;margin:6px 0">{ar() ? `اليوم ${num(info.dayIndex + 1)} من رمضان` : `Day ${info.dayIndex + 1} of Ramadan`}</div>
            {now < today.t.times.maghrib && now > today.t.times.fajr ? <><div class="muted">{ar() ? 'المتبقي على الإفطار' : 'Until iftar'}</div><div class="countdown num">{remaining(today.t.times.maghrib)}</div></>
              : <><div class="muted">{ar() ? 'المتبقي على الإمساك (الفجر)' : 'Until imsak (Fajr)'}</div><div class="countdown num">{remaining(now < today.t.times.fajr ? today.t.times.fajr : rows[info.dayIndex + 1]?.t.times.fajr || today.t.times.fajr)}</div></>}
            <small class="muted">{ar() ? `الفجر ${fmtTime(today.t.times.fajr, loc!.tz)} · المغرب ${fmtTime(today.t.times.maghrib, loc!.tz)}` : `Fajr ${fmtTime(today.t.times.fajr, loc!.tz)} · Maghrib ${fmtTime(today.t.times.maghrib, loc!.tz)}`}</small>
          </>
        ) : (
          <>
            <div style="font-size:1.6em;font-weight:700;margin:6px 0">{ar() ? `بقي ${num(info.daysUntil)} يومًا` : `${info.daysUntil} days to go`}</div>
            <small class="muted">{ar() ? `أول رمضان المتوقع: ${info.start.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — يُحدَّد فعليًا برؤية الهلال` : `Expected 1 Ramadan: ${info.start.toDateString()} (moon sighting decides)`}</small>
          </>
        )}
      </section>

      <section class="card" style="margin-top:12px">
        <h2>{ar() ? 'تنبيهات رمضان' : 'Ramadan alerts'}</h2>
        <Toggle label={ar() ? 'مدفع الإفطار (عند المغرب)' : 'Iftar alert (at Maghrib)'} sub={ar() ? 'تنبيه عند أذان المغرب، مع نغمة قصيرة مولَّدة داخل التطبيق (بلا ملفات صوت خارجية)' : 'Notification at Maghrib with a short generated chime'} checked={r.iftar} onChange={(v) => setR({ iftar: v })} />
        <Toggle label={ar() ? 'المسحراتي (قبل الفجر)' : 'Suhoor alert (before Fajr)'} checked={r.suhoor} onChange={(v) => setR({ suhoor: v })} />
        {r.suhoor && <div class="chips" style="margin:4px 0 8px">{[30, 45, 60, 90].map((m) => <button key={m} class="chip" aria-pressed={r.suhoorMin === m} onClick={() => setR({ suhoorMin: m })}>{num(m)} {ar() ? 'د' : 'min'}</button>)}</div>}
        <Toggle label={ar() ? 'الليالي الوترية من العشر الأواخر' : 'Odd nights of the last ten'} sub={ar() ? 'تذكير بعد المغرب في ليالي ٢١، ٢٣، ٢٥، ٢٧، ٢٩' : 'Reminder after Maghrib on nights 21–29 (odd)'} checked={r.qadr} onChange={(v) => setR({ qadr: v })} />
        <div class="row" style="gap:8px;margin-top:8px"><button class="btn secondary sm" onClick={() => playChime('iftar')}>{ar() ? 'تجربة نغمة المدفع' : 'Try the chime'}</button></div>
        <NativeNote />
      </section>

      {loc ? (
        <section class="card" style="margin-top:12px">
          <div class="row between"><h2>{ar() ? `إمساكية رمضان ${num(info.year)}هـ` : `Imsakiya ${info.year} AH`}</h2><button class="btn ghost sm" onClick={shareTable}><Icon name="share" /></button></div>
          <p class="muted small">{loc.name} · {ar() ? 'الإمساك = الفجر بطريقة الحساب المختارة؛ لا يُضاف احتياط' : 'Imsak = Fajr with your chosen method; no extra margin added'}</p>
          <div style="overflow:auto;margin-top:8px">
            <table class="table">
              <thead><tr><th>{ar() ? 'اليوم' : 'Day'}</th><th>{ar() ? 'ميلادي' : 'Date'}</th><th>{ar() ? 'الإمساك' : 'Imsak'}</th><th>{t('maghrib')}</th></tr></thead>
              <tbody>{rows.map((x, i) => <tr key={i} class={info.inRamadan && i === info.dayIndex ? 'today' : ''}><td class="num">{num(x.h.d)}</td><td>{dateLabel(x.d)}</td><td class="num">{fmtTime(x.t.times.fajr, loc.tz)}</td><td class="num">{fmtTime(x.t.times.maghrib, loc.tz)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : <div style="margin-top:12px"><Notice action={t('chooseCity')} onAction={() => navigate('/prayer/city')}>{t('chooseCity')}</Notice></div>}

      <section class="card" style="margin-top:12px">
        <h2>{ar() ? 'في رمضان' : 'During Ramadan'}</h2>
        <div class="list" style="margin-top:8px">
          <button class="list-item" onClick={() => navigate('/library/khatma')}><Icon name="book" /><span class="grow"><span class="title">{ar() ? 'ختمة رمضان' : 'Ramadan khatma'}</span><br /><span class="sub">{ar() ? 'خطة ٣٠ يومًا ≈ ٢٠ صفحة يوميًا (جزء)' : '30-day plan ≈ one juz a day'}</span></span></button>
          <button class="list-item" onClick={() => navigate('/library/search?q=' + encodeURIComponent('الصائم'))}><Icon name="adhkar" /><span class="grow"><span class="title">{ar() ? 'أدعية الصائم والإفطار' : 'Fasting & iftar duas'}</span><br /><span class="sub">{ar() ? 'من الأذكار بمصادرها' : 'From adhkar, with sources'}</span></span></button>
          <button class="list-item" onClick={() => navigate('/library/qiyam')}><Icon name="star" /><span class="grow"><span class="title">{ar() ? 'قيام الليل والتراويح' : 'Qiyam & Taraweeh'}</span><br /><span class="sub">{ar() ? 'أوقات الليل وتذكيراتك' : 'Night times and reminders'}</span></span></button>
          <button class="list-item" onClick={() => navigate('/library/tracker')}><Icon name="check" /><span class="grow"><span class="title">{ar() ? 'متتبع الصيام' : 'Fasting tracker'}</span></span></button>
          <button class="list-item" onClick={() => navigate('/library/cards')}><Icon name="share" /><span class="grow"><span class="title">{ar() ? 'كرت تهنئة رمضان' : 'Ramadan greeting card'}</span></span></button>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ Fasting days (صائمون) */
export function FastingScreen() {
  const { settings, user } = useStore();
  const now = useNow(1000);
  const loc = settings.location;
  const [offset, setOffset] = useState(0);
  const day = addDays(now, offset);
  const f = fastingFor(day, settings.hijriAdjust);
  const key = todayKey(day);
  const rec = user.tracker?.[key] || {};
  const times = loc ? computeDay(loc, settings.prayer, day) : null;
  const list = useMemo(() => upcomingFasts(addDays(now, 1), 60, settings.hijriAdjust), [todayKey(now), settings.hijriAdjust]);
  const remaining = (to: Date) => { const s = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000)); return `${num(String(Math.floor(s / 3600)).padStart(2, '0'))}:${num(String(Math.floor((s % 3600) / 60)).padStart(2, '0'))}`; };
  return (
    <main class="screen">
      <TopBar title={ar() ? 'صائمون' : 'Fasting days'} onBack />
      <section class="card primary">
        <div class="row between">
          <button class="icon-btn" aria-label="prev" onClick={() => setOffset(offset - 1)}><Icon name="next" /></button>
          <div style="text-align:center"><strong>{day.toLocaleDateString(ar() ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong><br /><small class="muted">{formatHijri(f.hijri, ar())}</small></div>
          <button class="icon-btn" aria-label="next" onClick={() => setOffset(offset + 1)}><Icon name="back" /></button>
        </div>
        {f.forbidden ? <p style="margin-top:10px;text-align:center"><span class="badge">{f.forbidden}</span></p>
          : f.reasons.length ? <div style="margin-top:10px;text-align:center"><div style="font-size:1.3em;font-weight:700">{f.reasons.map((r) => r.title).join(' · ')}</div>{offset === 0 && times && now < times.times.maghrib && <small class="muted">{ar() ? 'باقي على المغرب' : 'Until Maghrib'} <span class="num">{remaining(times.times.maghrib)}</span></small>}</div>
          : <p class="muted" style="margin-top:10px;text-align:center">{ar() ? 'لا صيام مسنون خاص بهذا اليوم (الصيام التطوعي المطلق جائز في غير الأيام المنهي عنها).' : 'No specific sunnah fast on this day.'}</p>}
        {offset === 0 && !f.forbidden && (
          <div style="margin-top:12px;text-align:center">
            <div class="muted small">{ar() ? 'هل أتممت صيام هذا اليوم؟' : 'Did you complete today’s fast?'}</div>
            <div class="row" style="justify-content:center;gap:8px;margin-top:6px">
              <button class={`btn sm ${rec.fast ? '' : 'secondary'}`} onClick={() => updateUser((u) => ({ tracker: { ...(u.tracker || {}), [key]: { ...(u.tracker?.[key] || {}), fast: true } } }))}>{ar() ? 'نعم' : 'Yes'}</button>
              <button class={`btn sm ${rec.fast === false ? '' : 'secondary'}`} onClick={() => updateUser((u) => ({ tracker: { ...(u.tracker || {}), [key]: { ...(u.tracker?.[key] || {}), fast: false } } }))}>{ar() ? 'لا' : 'No'}</button>
            </div>
          </div>
        )}
      </section>
      {f.reasons.map((r) => (
        <section key={r.id} class="card" style="margin-top:12px">
          <h3>{ar() ? `فضل صيام ${r.title}` : r.title}</h3>
          <p class="body-text" style="margin-top:6px">{r.virtue}</p>
          <small class="muted">{r.source} · {t('notReviewed')}</small>
        </section>
      ))}
      <section class="card" style="margin-top:12px">
        <Toggle label={ar() ? 'تذكير مساء اليوم السابق' : 'Remind me the evening before'} sub={ar() ? 'بعد العشاء بعشرين دقيقة في ليلة أي يوم صيام مسنون' : '20 min after Isha before any sunnah fast'} checked={settings.reminders.fastEve} onChange={(v) => saveAndReschedule({ reminders: { ...settings.reminders, fastEve: v } })} />
        <NativeNote />
      </section>
      <h2 style="margin:20px 0 8px">{ar() ? 'الأيام القادمة (٦٠ يومًا)' : 'Upcoming (60 days)'}</h2>
      <div class="list">
        {list.map((x) => (
          <button key={x.date.getTime()} class="list-item" onClick={() => setOffset(Math.round((x.date.getTime() - addDays(now, 0).getTime()) / 86400000))}>
            <Icon name={x.forbidden ? 'close' : 'sun'} />
            <span class="grow"><span class="title">{x.forbidden ? x.forbidden.split(' — ')[0] : x.reasons.map((r) => r.title).join(' · ')}</span><br /><span class="sub">{dateLabel(x.date)} · {num(x.hijri.d)} {HIJRI_MONTHS[x.hijri.m - 1]}</span></span>
          </button>
        ))}
      </div>
      <p class="muted small" style="margin-top:12px">{ar() ? 'الأيام محسوبة من التقويم الهجري الحسابي مع تصحيحك؛ يوم عرفة وعاشوراء والعيد تتبع إعلان بلدك.' : 'Days come from the arithmetic Hijri calendar with your correction; Arafah, Ashura and Eid follow your country’s announcement.'}</p>
    </main>
  );
}

/* ------------------------------------------------------------------ Qiyam al-layl */
export function QiyamScreen() {
  const { settings, user } = useStore();
  const now = useNow(30000);
  const loc = settings.location;
  const q = settings.qiyam;
  const setQ = (p: Partial<typeof q>) => saveAndReschedule({ qiyam: { ...q, ...p } });
  const nt = loc ? nightTimes(loc, settings.prayer, civilDate(loc.tz, 0, now)) : null;
  const night = nt ? nt.nextFajr.getTime() - nt.maghrib.getTime() : 0;
  const key = todayKey(now); const rec = user.tracker?.[key] || {};
  const setRec = (p: Record<string, boolean>) => updateUser((u) => ({ tracker: { ...(u.tracker || {}), [key]: { ...(u.tracker?.[key] || {}), ...p } } }));
  return (
    <main class="screen">
      <TopBar title={ar() ? 'قيام الليل' : 'Qiyam al-layl'} onBack />
      {loc && nt ? (
        <section class="hero-card scene-night art-host">
          <span class="art-layer pattern-star" aria-hidden="true" style="opacity:.08" />
          <h2 style="text-align:center">{ar() ? 'ليلة اليوم' : 'Tonight'}</h2>
          <p class="muted small" style="text-align:center">{ar() ? 'الليل = من المغرب إلى الفجر التالي (حسابيًا)' : 'Night = Maghrib → next Fajr (calculated)'}</p>
          <div class="list" style="margin-top:8px">
            {[[t('maghrib'), nt.maghrib], [t('isha'), computeDay(loc, settings.prayer, civilDate(loc.tz, 0, now)).times.isha], [ar() ? 'نهاية الثلث الأول' : 'End of first third', new Date(nt.maghrib.getTime() + night / 3)], [t('midnight'), nt.midnight], [t('lastThird'), nt.lastThird], [ar() ? 'الفجر التالي' : 'Next Fajr', nt.nextFajr]].map(([l, d]) => (
              <div key={l as string} class="row between" style="padding:6px 4px"><span>{l as string}</span><span class="num">{fmtTime(d as Date, loc.tz)}</span></div>
            ))}
          </div>
        </section>
      ) : <Notice action={t('chooseCity')} onAction={() => navigate('/prayer/city')}>{t('chooseCity')}</Notice>}
      <section class="card" style="margin-top:12px">
        <h2>{ar() ? 'تذكير القيام' : 'Qiyam reminder'}</h2>
        <p class="muted small" style="margin:4px 0 8px">{ar() ? 'اختر الجزء من الليل الذي تريد التنبيه عند بدايته.' : 'Choose which part of the night to be reminded at.'}</p>
        <Seg value={q.third} options={[{ v: 'off', label: ar() ? 'إيقاف' : 'Off' }, { v: 'first', label: ar() ? 'الثلث الأول' : 'First third' }, { v: 'second', label: ar() ? 'منتصف الليل' : 'Midnight' }, { v: 'last', label: ar() ? 'الثلث الأخير' : 'Last third' }]} onChange={(v) => setQ({ third: v })} />
        <div class="field" style="margin-top:12px"><label>{ar() ? 'تذكير التهجد قبل الفجر' : 'Tahajjud reminder before Fajr'}</label>
          <div class="chips">{[0, 30, 45, 60, 90].map((m) => <button key={m} class="chip" aria-pressed={q.beforeFajrMin === m} onClick={() => setQ({ beforeFajrMin: m })}>{m === 0 ? (ar() ? 'إيقاف' : 'Off') : `${num(m)} ${ar() ? 'د' : 'min'}`}</button>)}</div></div>
        <Toggle label={ar() ? 'تذكير الوتر بعد العشاء' : 'Witr reminder after Isha'} sub={ar() ? 'بعد العشاء بـ٤٥ دقيقة لمن لا يقوم آخر الليل' : '45 min after Isha'} checked={q.witr} onChange={(v) => setQ({ witr: v })} />
        <NativeNote />
      </section>
      <section class="card" style="margin-top:12px">
        <h2>{ar() ? 'سجل الليلة (خاص)' : 'Tonight’s log (private)'}</h2>
        <Toggle label={ar() ? 'قمتُ الليل' : 'I prayed qiyam'} checked={!!rec.qiyam} onChange={(v) => setRec({ qiyam: v })} />
        <Toggle label={ar() ? 'صليتُ الوتر' : 'I prayed Witr'} checked={!!rec.witr} onChange={(v) => setRec({ witr: v })} />
      </section>
      <section class="card" style="margin-top:12px">
        <h2>{ar() ? 'يعينك على القيام' : 'Helps for qiyam'}</h2>
        <div class="list" style="margin-top:8px">
          <button class="list-item" onClick={() => navigate('/library/search?q=' + encodeURIComponent('الوتر'))}><Icon name="adhkar" /><span class="grow"><span class="title">{ar() ? 'دعاء القنوت وأذكار الوتر' : 'Qunut & Witr adhkar'}</span></span></button>
          <button class="list-item" onClick={() => navigate('/library/search?q=' + encodeURIComponent('من تعار من الليل'))}><Icon name="star" /><span class="grow"><span class="title">{ar() ? 'ذكر من تعارّ من الليل' : 'Dhikr on waking at night'}</span></span></button>
          <button class="list-item" onClick={() => navigate('/library/fajr-alarm')}><Icon name="bell" /><span class="grow"><span class="title">{ar() ? 'منبه الفجر' : 'Fajr alarm'}</span></span></button>
          <button class="list-item" onClick={() => navigate('/quran/reciters')}><Icon name="play" /><span class="grow"><span class="title">{ar() ? 'تلاوة هادئة للقيام' : 'Recitation for the night'}</span></span></button>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ Fajr alarm */
export function FajrAlarmScreen() {
  const { settings } = useStore();
  const loc = settings.location;
  const a = settings.fajrAlarm;
  const setA = (p: Partial<typeof a>) => saveAndReschedule({ fajrAlarm: { ...a, ...p } });
  const [perm, setPerm] = useState('unavailable'); useEffect(() => { permissionState().then(setPerm); }, []);
  const fajr = loc ? computeDay(loc, settings.prayer, civilDate(loc.tz, 1)).times.fajr : null;
  return (
    <main class="screen">
      <TopBar title={ar() ? 'منبه الفجر' : 'Fajr alarm'} onBack />
      <section class="card">
        <Toggle label={ar() ? 'تفعيل منبه الفجر' : 'Enable Fajr alarm'} sub={ar() ? 'تنبيه يومي عند الفجر (أو قبله/بعده بدقائق) يتبع موقعك تلقائيًا' : 'Daily at Fajr (± minutes), follows your location'} checked={a.on} onChange={(v) => setA({ on: v })} />
        <div class="field" style="margin-top:12px"><label>{ar() ? 'الإزاحة عن الفجر' : 'Offset from Fajr'}</label>
          <div class="chips">{[-30, -15, 0, 10, 20].map((m) => <button key={m} class="chip" aria-pressed={a.offsetMin === m} onClick={() => setA({ offsetMin: m })}>{m === 0 ? (ar() ? 'عند الفجر' : 'At Fajr') : m < 0 ? `${num(-m)} ${ar() ? 'د قبل' : 'min before'}` : `${num(m)} ${ar() ? 'د بعد' : 'min after'}`}</button>)}</div></div>
        <div class="field"><label>{ar() ? 'تكرار التنبيه' : 'Repeat'}</label>
          <div class="chips">{[0, 5, 10].map((m) => <button key={m} class="chip" aria-pressed={a.repeatMin === m} onClick={() => setA({ repeatMin: m })}>{m === 0 ? (ar() ? 'مرة واحدة' : 'Once') : `${ar() ? 'بعد' : 'after'} ${num(m)} ${ar() ? 'د' : 'min'}`}</button>)}</div></div>
        {fajr && loc && <p class="text-2">{ar() ? `فجر الغد: ${fmtTime(fajr, loc.tz)} → المنبه ${fmtTime(new Date(fajr.getTime() + a.offsetMin * 60000), loc.tz)}` : `Tomorrow’s Fajr ${fmtTime(fajr, loc.tz)} → alarm ${fmtTime(new Date(fajr.getTime() + a.offsetMin * 60000), loc.tz)}`}</p>}
        {isNative && perm !== 'granted' && <Notice action={t('enable')} onAction={() => navigate('/prayer/diagnostics')}>{t('notificationsOff')}</Notice>}
      </section>
      <section class="card" style="margin-top:12px">
        <h3>{ar() ? 'بصراحة' : 'Honest note'}</h3>
        <p class="text-2 small" style="margin-top:6px">{ar() ? 'هذا منبه قائم على تنبيهات النظام: يصدر صوت التنبيه الافتراضي ويظهر على شاشة القفل. المنبه الكامل الذي يتجاوز الوضع الصامت ويرنّ حتى الإيقاف يحتاج كود النظام الأصلي (AlarmManager على أندرويد / AlarmKit على iOS 26+) وهو ضمن مرحلة التطبيق الأصلي. في المتصفح لا تعمل التنبيهات المجدولة.' : 'This is a notification-based alarm (default sound, lock screen). A full alarm that overrides silent mode needs native code (AlarmManager / AlarmKit) — planned for the native build. Scheduled alerts do not run in the browser.'}</p>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ Islamic teaching */
export function TeachScreen({ id }: { id?: string }) {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) return (
    <main class="screen">
      <TopBar title={ar() ? 'التعليم الإسلامي' : 'Islamic basics'} onBack />
      <div class="grid-2">
        {LESSONS.map((l) => <button key={l.id} class="card" style="text-align:center;padding:20px 8px" onClick={() => navigate(`/library/teach/${l.id}`)}><span class="tool-ic" style="margin:0 auto 8px"><Icon name={l.id === 'salah' ? 'prayer' : 'sun'} /></span><strong>{ar() ? l.title : l.en}</strong><br /><small class="muted">{num(l.steps.length)} {ar() ? 'خطوة' : 'steps'}</small></button>)}
      </div>
      <p class="muted small" style="margin-top:12px">{ar() ? 'شرح مختصر عملي بألفاظ التطبيق، مع ذكر الفرائض والفروق المذهبية الكبرى. لم يُراجع علميًا بعد — يُعرض بهذه الصفة.' : 'Short practical explanations written for the app, noting obligations and major school differences. Not yet scholar-reviewed.'}</p>
    </main>
  );
  return (
    <main class="screen">
      <TopBar title={ar() ? lesson.title : lesson.en} onBack={() => navigate('/library/teach')} />
      <section class="card"><p class="body-text">{lesson.intro}</p><small class="muted">{t('notReviewed')}</small></section>
      <ol class="stack" style="margin-top:12px;padding:0;list-style:none">
        {lesson.steps.map((s, i) => (
          <li key={i} class="card" style="display:flex;gap:12px;align-items:flex-start">
            <span class="tool-ic" style="width:40px;height:40px;border-radius:12px;flex:none;font-weight:700">{num(i + 1)}</span>
            <div class="grow"><div class="row between"><strong>{s.t}</strong>{s.note && <span class="badge ok">{s.note}</span>}</div><p class="body-text small" style="margin-top:4px">{s.d}</p></div>
          </li>
        ))}
      </ol>
      {lesson.outro && <section class="card" style="margin-top:12px"><p class="body-text small">{lesson.outro}</p></section>}
    </main>
  );
}

/* ------------------------------------------------------------------ Greeting cards & WhatsApp status (canvas, our own art) */
const BGS = [
  { id: 'p-light', ar: 'محراب — فاتح', f: 'art/hero-portrait-1080.webp', dark: false },
  { id: 'p-dark', ar: 'محراب — داكن', f: 'art/hero-portrait-dark-1080.webp', dark: true },
  { id: 'emerald', ar: 'زمردي', f: '', dark: true },
  { id: 'ivory', ar: 'عاجي', f: '', dark: false },
];
async function renderCard(opts: { w: number; h: number; bg: typeof BGS[number]; title: string; body: string; from: string; brand: string }): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas'); c.width = opts.w; c.height = opts.h; const ctx = c.getContext('2d')!;
  try { await Promise.all([document.fonts.load('700 80px "Noto Naskh Arabic"'), document.fonts.load('400 48px "Noto Naskh Arabic"'), document.fonts.load('400 48px "Noto Sans Arabic"')]); } catch { /* fallback fonts */ }
  if (opts.bg.f) {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = opts.bg.f; });
    const s = Math.max(opts.w / img.width, opts.h / img.height); const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, (opts.w - dw) / 2, (opts.h - dh) / 2, dw, dh);
    const g = ctx.createLinearGradient(0, opts.h * 0.35, 0, opts.h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, opts.bg.dark ? 'rgba(16,28,24,.85)' : 'rgba(23,75,60,.75)'); ctx.fillStyle = g; ctx.fillRect(0, 0, opts.w, opts.h);
  } else { ctx.fillStyle = opts.bg.id === 'emerald' ? '#174B3C' : '#F7F4EC'; ctx.fillRect(0, 0, opts.w, opts.h); }
  const ink = opts.bg.f ? '#FFFFFF' : opts.bg.dark ? '#F7F4EC' : '#174B3C';
  const gold = '#C9A24D';
  if (opts.bg.f) { // readable text block over artwork: a soft panel in the brand colour
    const px = opts.w * 0.1, py = opts.h * 0.24, pw = opts.w * 0.8, ph = opts.h * 0.62, r = opts.w * 0.04;
    ctx.beginPath(); ctx.moveTo(px + r, py); ctx.arcTo(px + pw, py, px + pw, py + ph, r); ctx.arcTo(px + pw, py + ph, px, py + ph, r); ctx.arcTo(px, py + ph, px, py, r); ctx.arcTo(px, py, px + pw, py, r); ctx.closePath();
    ctx.fillStyle = opts.bg.dark ? 'rgba(16,28,24,.62)' : 'rgba(23,75,60,.80)'; ctx.fill();
  }
  // ornament: a thin gold frame + small eight-point star
  ctx.strokeStyle = gold; ctx.lineWidth = Math.round(opts.w * 0.006); ctx.strokeRect(opts.w * 0.06, opts.h * 0.05, opts.w * 0.88, opts.h * 0.9);
  const star = (cx: number, cy: number, r: number) => { ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = (Math.PI / 8) * i; const rr = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); } ctx.closePath(); ctx.fillStyle = gold; ctx.fill(); };
  star(opts.w / 2, opts.h * 0.14, opts.w * 0.035);
  ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillStyle = ink;
  const wrap = (text: string, size: number, font: string, y: number, maxW: number, lh: number) => {
    ctx.font = `${font} ${size}px "Noto Naskh Arabic", "Noto Sans Arabic", serif`;
    const words = text.split(/\s+/); const lines: string[] = []; let cur = '';
    for (const w of words) { const tr = cur ? cur + ' ' + w : w; if (ctx.measureText(tr).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tr; }
    if (cur) lines.push(cur);
    lines.forEach((l, i) => ctx.fillText(l, opts.w / 2, y + i * lh));
    return y + lines.length * lh;
  };
  let y = wrap(opts.title, Math.round(opts.w * 0.085), '700', opts.h * 0.32, opts.w * 0.8, Math.round(opts.w * 0.11));
  if (opts.body) y = wrap(opts.body, Math.round(opts.w * 0.045), '400', y + opts.h * 0.04, opts.w * 0.78, Math.round(opts.w * 0.07));
  if (opts.from) { ctx.fillStyle = gold; wrap(opts.from, Math.round(opts.w * 0.045), '400', Math.max(y + opts.h * 0.06, opts.h * 0.78), opts.w * 0.8, Math.round(opts.w * 0.07)); }
  ctx.fillStyle = ink; ctx.globalAlpha = 0.7; ctx.font = `400 ${Math.round(opts.w * 0.03)}px "Noto Sans Arabic", sans-serif`; ctx.fillText(opts.brand, opts.w / 2, opts.h * 0.92); ctx.globalAlpha = 1;
  return c;
}
async function shareCanvas(c: HTMLCanvasElement, name: string) {
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) { try { await nav.share({ files: [file], title: 'سكينة' }); return; } catch { /* fall through to download */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
export function CardsScreen() {
  const { settings } = useStore();
  const [mode, setMode] = useState<'card' | 'status'>('card');
  const [occ, setOcc] = useState(() => nextOccasion(new Date(), settings.hijriAdjust)?.id || 'ramadan');
  const [bg, setBg] = useState(BGS[0]);
  const [from, setFrom] = useState('');
  const [body, setBody] = useState('');
  const [dhikrIdx, setDhikrIdx] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const adhkar = useAsync(getAdhkar, []);
  const shortDhikr = useMemo(() => adhkar.data ? adhkar.data.categories.filter((c) => /الصباح|المساء|النوم|الاستيقاظ/.test(c.name)).flatMap((c) => c.items).filter((i) => i.text.length > 20 && i.text.length <= 160).slice(0, 60) : [], [adhkar.data]);
  const o = OCCASIONS.find((x) => x.id === occ) || OCCASIONS[0];
  const d = shortDhikr[dhikrIdx % Math.max(1, shortDhikr.length)];
  const build = async () => {
    setBusy(true);
    try {
      const c = mode === 'card'
        ? await renderCard({ w: 1080, h: 1350, bg, title: ar() ? o.ar : o.en, body: body || (ar() ? 'تقبّل الله منا ومنكم صالح الأعمال' : ''), from: from ? (ar() ? `من ${from}` : `From ${from}`) : '', brand: 'سكينة' })
        : await renderCard({ w: 1080, h: 1920, bg, title: d ? d.text : '', body: d?.ref ? `[${d.ref}]` : '', from: '', brand: 'سكينة' });
      canvasRef.current = c; setPreview(c.toDataURL('image/jpeg', 0.85));
    } finally { setBusy(false); }
  };
  useEffect(() => { void build(); }, [mode, occ, bg.id, dhikrIdx, adhkar.data]);
  return (
    <main class="screen">
      <TopBar title={ar() ? 'كروت التهنئة والحالة' : 'Greeting cards & status'} onBack />
      <Seg value={mode} options={[{ v: 'card', label: ar() ? 'كرت تهنئة' : 'Greeting card' }, { v: 'status', label: ar() ? 'حالة (ذكر)' : 'Status (dhikr)' }]} onChange={setMode} />
      <section class="card" style="margin-top:12px">
        {mode === 'card' ? (
          <>
            <div class="chips scroll">{OCCASIONS.map((x) => <button key={x.id} class="chip" aria-pressed={occ === x.id} onClick={() => setOcc(x.id)}>{ar() ? x.ar.split(' — ')[0] : x.en}</button>)}</div>
            <input class="input" style="margin-top:8px" placeholder={ar() ? 'اسمك (اختياري)' : 'Your name (optional)'} value={from} onInput={(e) => setFrom((e.target as HTMLInputElement).value)} onChange={build} />
            <input class="input" style="margin-top:8px" placeholder={ar() ? 'رسالة قصيرة (اختياري)' : 'Short message (optional)'} value={body} onInput={(e) => setBody((e.target as HTMLInputElement).value)} onChange={build} />
          </>
        ) : (
          <div class="row" style="gap:8px"><button class="btn secondary sm" onClick={() => setDhikrIdx(dhikrIdx + 1)}><Icon name="refresh" />{ar() ? 'ذكر آخر' : 'Another dhikr'}</button><small class="muted">{d?.ref || ''}</small></div>
        )}
        <div class="chips" style="margin-top:8px">{BGS.map((b) => <button key={b.id} class="chip" aria-pressed={bg.id === b.id} onClick={() => setBg(b)}>{b.ar}</button>)}</div>
      </section>
      {preview && <div class="card" style="margin-top:12px;padding:8px"><img src={preview} alt="" style="width:100%;border-radius:10px;display:block" /></div>}
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn" disabled={busy || !canvasRef.current} onClick={() => canvasRef.current && shareCanvas(canvasRef.current, `sakina-${mode}-${Date.now()}.png`)}><Icon name="share" />{ar() ? 'مشاركة / حفظ الصورة' : 'Share / save image'}</button><button class="btn ghost" disabled={busy} onClick={build}>{ar() ? 'تحديث' : 'Refresh'}</button></div>
      <p class="muted small" style="margin-top:12px">{ar() ? 'الصور تُرسم على جهازك من جرافيكس الهوية الأصلية. نصوص الحالة من الأذكار بمصادرها؛ لا آيات على الصور حفاظًا على حرمة النص.' : 'Rendered on your device from our own artwork. Status texts come from adhkar with their sources; no Quranic verses are placed on images.'}</p>
    </main>
  );
}

/* ------------------------------------------------------------------ Help: notifications not working? */
export function HelpScreen() {
  const steps = ar() ? [
    ['١. تحقق من إذن التنبيهات', 'الإعدادات ← التطبيقات ← سكينة ← الإشعارات: فعّل كل الفئات. ثم افتح «تشخيص التنبيهات» في التطبيق واضغط «اختبار تنبيه».'],
    ['٢. أندرويد: أوقف تحسين البطارية', 'الإعدادات ← البطارية ← تحسين/تقييد البطارية ← سكينة ← «غير مقيد». هواوي/شاومي/أوبو/سامسونج تقتل التطبيقات في الخلفية افتراضيًا.'],
    ['٣. أندرويد: التشغيل التلقائي', 'في بعض الهواتف: الإعدادات ← التطبيقات ← التشغيل التلقائي / إدارة التطبيقات ← فعّل سكينة.'],
    ['٤. أندرويد: المنبهات والتذكيرات', 'أندرويد ١٢ فأعلى: الإعدادات ← التطبيقات ← الوصول الخاص ← المنبهات والتذكيرات ← سكينة.'],
    ['٥. آيفون: أنماط التركيز', 'تأكد أن وضع «عدم الإزعاج/التركيز» يسمح بتنبيهات سكينة، وأن الصوت غير مكتوم من الإعدادات ← الإشعارات ← سكينة.'],
    ['٦. الوقت والمنطقة الزمنية', 'إذا سافرت، حدّث المدينة من الإعدادات؛ تُحسب التنبيهات لمنطقة المدينة المختارة لا منطقة الجهاز.'],
    ['٧. نسخة المتصفح', 'التنبيهات المجدولة لا تعمل في نسخة الويب (PWA)؛ تعمل في تطبيق الهاتف من المتجر.'],
  ] : [
    ['1. Notification permission', 'Settings → Apps → Sakina → Notifications: enable all. Then open Diagnostics and tap “Test notification”.'],
    ['2. Android: battery optimisation', 'Settings → Battery → Unrestricted for Sakina. Huawei/Xiaomi/Oppo/Samsung kill background apps by default.'],
    ['3. Android: autostart', 'Some phones: Settings → Apps → Autostart → enable Sakina.'],
    ['4. Android: alarms & reminders', 'Android 12+: Settings → Apps → Special access → Alarms & reminders → Sakina.'],
    ['5. iPhone: Focus modes', 'Make sure Focus/Do Not Disturb allows Sakina and sound is on in Settings → Notifications → Sakina.'],
    ['6. Time zone', 'After travelling, update the city; alerts follow the chosen city’s zone.'],
    ['7. Browser build', 'Scheduled alerts do not run in the web (PWA) build; they run in the store app.'],
  ];
  return (
    <main class="screen">
      <TopBar title={ar() ? 'هل لا تعمل التنبيهات؟' : 'Notifications not working?'} onBack />
      <div class="stack">
        {steps.map(([h, b]) => <section key={h} class="card"><strong>{h}</strong><p class="text-2 small" style="margin-top:4px">{b}</p></section>)}
      </div>
      <div class="row" style="gap:8px;margin-top:12px"><button class="btn" onClick={() => navigate('/prayer/diagnostics')}>{t('diagnostics')}</button><button class="btn ghost" onClick={() => navigate('/prayer/settings')}>{t('notifications')}</button></div>
    </main>
  );
}
