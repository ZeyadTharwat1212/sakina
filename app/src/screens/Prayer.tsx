/** Sections 14–17, 19: times, method settings, city, qibla, diagnostics, nawafil. All on-device. */
import { useEffect, useState } from 'preact/hooks';
import { Geolocation } from '@capacitor/geolocation';
import { useStore, updateSettings, updatePrayer, type Location, DEFAULT_SETTINGS } from '../lib/store';
import { t, num, fmtTime, fmtDate, isAr } from '../lib/i18n';
import { PRAYERS, computeDay, civilDate, nextPrayer, methodByKey, METHODS, CITIES, suggestMethod, qiblaBearing, nightTimes, isLocationStale, zonedParts, type PrayerName } from '../lib/prayer';
import { reschedule, permissionState, requestPermission, pendingCount, testNotification, isNative, type PermState } from '../lib/notify';
import { navigate } from '../lib/router';
import { TopBar, Seg, Toggle, Notice, useNow, Icon } from '../components/ui';
import { toHijri, formatHijri, HIJRI_MONTHS } from '../lib/hijri';
import { useMonthRows } from './Tools';

function NoLocation() {
  return <main class="screen"><TopBar title={t('prayer')} /><div class="card soft"><h2>{t('chooseCity')}</h2><p class="text-2 small" style="margin:8px 0">{t('whyLocation')}</p><button class="btn" onClick={() => navigate('/prayer/city')}>{t('chooseCity')}</button></div></main>;
}

export function PrayerHome() {
  const { settings } = useStore();
  const loc = settings.location;
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const [monthOffset, setMonthOffset] = useState(0);
  const now = useNow(30000);
  if (!loc) return <NoLocation />;
  const ps = settings.prayer;
  const method = methodByKey(ps.method);
  const next = nextPrayer(loc, ps, now);
  const today = next.day;
  const hijri = toHijri(now, settings.hijriAdjust);
  const monthRows = useMonthRows(loc, ps, monthOffset);
  const rows = range === 'day' ? [] : range === 'week' ? Array.from({ length: 7 }, (_, i) => computeDay(loc, ps, civilDate(loc.tz, i, now))) : monthRows;
  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const mh1 = toHijri(monthDate, settings.hijriAdjust), mh2 = toHijri(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0), settings.hijriAdjust);
  const todayParts = zonedParts(now, loc.tz);
  const isToday = (d: Date) => d.getDate() === todayParts.d && d.getMonth() + 1 === todayParts.m;

  return (
    <main class="screen">
      <TopBar title={t('prayer')} right={<>
        <button class="icon-btn" aria-label={t('qibla')} onClick={() => navigate('/prayer/qibla')}><Icon name="compass" /></button>
        <button class="icon-btn" aria-label={t('settings')} onClick={() => navigate('/prayer/settings')}><Icon name="settings" /></button>
      </>} />
      {isLocationStale(loc) && <div style="margin-bottom:12px"><Notice action={t('update')} onAction={() => navigate('/prayer/city')}>{t('locationOld')}</Notice></div>}
      <section class="card">
        <div class="row between">
          <button class="row" style="gap:6px" onClick={() => navigate('/prayer/city')}><Icon name="pin" /><strong>{loc.name}</strong></button>
          <small class="muted">{loc.tz}</small>
        </div>
        <small class="muted">{fmtDate(now, loc.tz)} · {formatHijri(hijri, isAr())}</small>
        <hr />
        <div>
          {PRAYERS.map((p) => (
            <div key={p} class={`prayer-row ${p === next.name && isToday(today.date) ? 'next' : ''} ${p === 'sunrise' ? 'sunrise' : ''}`}>
              <span>{t(p)}{p === 'sunrise' && <span class="badge sunrise" style="margin-inline-start:8px">{isAr() ? 'حدث فلكي — ليس صلاة' : 'astronomical — not a prayer'}</span>}</span>
              <span class="time num">{fmtTime(today.times[p], loc.tz)}</span>
            </div>
          ))}
        </div>
        <hr />
        <dl class="kv">
          <dt>{t('method')}</dt><dd>{isAr() ? method.ar : method.en} <span class="badge">{t('calculated')}</span></dd>
          <dt>{t('madhab')}</dt><dd>{ps.madhab === 'hanafi' ? t('hanafi') : t('shafi')}</dd>
          <dt>{isAr() ? 'المعلمات' : 'Parameters'}</dt><dd class="num">{isAr() ? 'الفجر' : 'Fajr'} {today.params.fajrAngle}° · {isAr() ? 'العشاء' : 'Isha'} {today.params.ishaInterval ? `${today.params.ishaInterval} ${isAr() ? 'دقيقة بعد المغرب' : 'min after Maghrib'}` : `${today.params.ishaAngle}°`}</dd>
          {Object.values(ps.adjust).some((x) => x) && <><dt>{t('adjustments')}</dt><dd class="num">{PRAYERS.filter((p) => ps.adjust[p]).map((p) => `${t(p)} ${ps.adjust[p] > 0 ? '+' : ''}${ps.adjust[p]}`).join(' · ')}</dd></>}
          <dt>{isAr() ? 'الموقع' : 'Location'}</dt><dd>{loc.source === 'gps' ? 'GPS' : (isAr() ? 'يدوي' : 'manual')} · {new Date(loc.updatedAt).toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB')}</dd>
        </dl>
        <p class="muted small" style="margin-top:8px">{isAr() ? 'وقت محسوب على جهازك من الإحداثيات والطريقة أعلاه، وليس جدولًا رسميًا معتمدًا. قارنه بجدول جهتك المحلية عند الحاجة.' : 'Calculated on your device from the coordinates and method above — not an official timetable. Compare with your local authority when needed.'}</p>
      </section>

      <div style="margin:16px 0 8px"><Seg value={range} options={[{ v: 'day', label: t('today') }, { v: 'week', label: t('week') }, { v: 'month', label: t('month') }]} onChange={setRange} /></div>
      {range !== 'day' && (
        <div class="card" style="overflow:auto;padding:8px">
          {range === 'month' && (
            <div class="row between" style="margin-bottom:6px">
              <button class="icon-btn" aria-label="prev" onClick={() => setMonthOffset(monthOffset - 1)}><Icon name="next" /></button>
              <div style="text-align:center"><strong>{monthDate.toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' })}</strong><br /><small class="muted">{HIJRI_MONTHS[mh1.m - 1]}{mh1.m !== mh2.m ? ` – ${HIJRI_MONTHS[mh2.m - 1]}` : ''} {num(mh2.y)}هـ</small></div>
              <button class="icon-btn" aria-label="next" onClick={() => setMonthOffset(monthOffset + 1)}><Icon name="back" /></button>
            </div>
          )}
          <table class="table">
            <thead><tr><th>{isAr() ? 'اليوم' : 'Day'}</th>{PRAYERS.map((p) => <th key={p}>{t(p)}</th>)}</tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.date.getTime()} class={isToday(d.date) ? 'today' : ''}>
                  <td>{d.date.toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })}<br /><small class="muted">{num(toHijri(d.date, settings.hijriAdjust).d)}</small></td>
                  {PRAYERS.map((p) => <td key={p} class={p === 'sunrise' ? 'muted' : ''}>{fmtTime(d.times[p], loc.tz)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div class="grid-2" style="margin-top:12px">
        <button class="btn secondary" onClick={() => navigate('/prayer/nawafil')}>{t('nawafil')}</button>
        <button class="btn secondary" onClick={() => navigate('/prayer/diagnostics')}>{t('diagnostics')}</button>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
export function CityScreen() {
  const { settings } = useStore();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lat, setLat] = useState(''); const [lng, setLng] = useState(''); const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const apply = async (loc: Location, method?: string) => {
    updateSettings({ location: loc });
    if (method) updatePrayer({ method });
    await reschedule(loc, { ...settings.prayer, ...(method ? { method } : {}) }); // old alerts cancelled, new ones scheduled
    navigate('/prayer', true);
  };
  const useGps = async () => {
    setBusy(true); setErr(null);
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 12000 });
      await apply({ name: isAr() ? 'موقعي الحالي' : 'My location', lat: pos.coords.latitude, lng: pos.coords.longitude, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', source: 'gps', updatedAt: Date.now() });
    } catch { setErr(isAr() ? 'تعذّر الحصول على الموقع (مرفوض أو غير متاح). اختر مدينة يدويًا.' : 'Location unavailable or denied. Pick a city manually.'); }
    finally { setBusy(false); }
  };
  const filtered = CITIES.filter((c) => !q || c.name.includes(q) || c.en.toLowerCase().includes(q.toLowerCase()) || c.country.includes(q));
  return (
    <main class="screen">
      <TopBar title={t('city')} onBack />
      <p class="text-2 small" style="margin-bottom:12px">{t('whyLocation')}</p>
      <button class="btn secondary block" disabled={busy} onClick={useGps}>{busy ? '…' : t('useGps')}</button>
      {err && <p class="notice" style="margin-top:8px">{err}</p>}
      <input class="input" style="margin:12px 0" placeholder={isAr() ? 'ابحث عن مدينة' : 'Search city'} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="list">
        {filtered.map((c) => (
          <button key={c.en} class="list-item" onClick={() => apply({ name: isAr() ? c.name : c.en, lat: c.lat, lng: c.lng, tz: c.tz, source: 'manual', updatedAt: Date.now() }, suggestMethod(c.cc))}>
            <span class="grow"><span class="title">{isAr() ? c.name : c.en}</span><br /><span class="sub">{c.country} · {c.tz} · {isAr() ? 'طريقة مقترحة:' : 'suggested:'} {isAr() ? methodByKey(suggestMethod(c.cc)).ar : methodByKey(suggestMethod(c.cc)).en}</span></span>
          </button>
        ))}
      </div>
      <h3 style="margin:20px 0 8px">{isAr() ? 'إحداثيات يدوية' : 'Manual coordinates'}</h3>
      <div class="grid-2">
        <input class="input" inputMode="decimal" placeholder="lat" value={lat} onInput={(e) => setLat((e.target as HTMLInputElement).value)} />
        <input class="input" inputMode="decimal" placeholder="lng" value={lng} onInput={(e) => setLng((e.target as HTMLInputElement).value)} />
      </div>
      <input class="input" style="margin-top:8px" placeholder="IANA time zone, e.g. Africa/Cairo" value={tz} onInput={(e) => setTz((e.target as HTMLInputElement).value)} />
      <button class="btn block" style="margin-top:8px" disabled={!lat || !lng || !tz} onClick={() => { try { Intl.DateTimeFormat('en', { timeZone: tz }); } catch { setErr('Invalid time zone'); return; } apply({ name: `${lat}, ${lng}`, lat: Number(lat), lng: Number(lng), tz, source: 'manual', updatedAt: Date.now() }); }}>{t('save')}</button>
    </main>
  );
}

/* ------------------------------------------------------------------ */
export function PrayerSettingsScreen() {
  const { settings } = useStore();
  const ps = settings.prayer;
  const set = async (patch: Partial<typeof ps>) => { updatePrayer(patch); await reschedule(settings.location, { ...ps, ...patch }); };
  return (
    <main class="screen">
      <TopBar title={`${t('prayer')} · ${t('settings')}`} onBack />
      <div class="stack">
        <section class="card">
          <h2>{t('method')}</h2>
          <p class="muted small" style="margin-bottom:8px">{isAr() ? 'اختر الجهة التي تتبعها. تظهر معلمات كل طريقة في شاشة المواقيت.' : 'Choose the authority you follow. Each method’s parameters are shown on the times screen.'}</p>
          <div class="list">
            {METHODS.map((m) => { const p = m.make(); return (
              <button key={m.key} class="list-item" aria-pressed={ps.method === m.key} onClick={() => set({ method: m.key })}>
                <span class="grow"><span class="title">{isAr() ? m.ar : m.en}</span><br /><span class="sub num">{m.authority} · {isAr() ? 'فجر' : 'Fajr'} {p.fajrAngle}° · {isAr() ? 'عشاء' : 'Isha'} {p.ishaInterval ? `${p.ishaInterval}′` : `${p.ishaAngle}°`}</span></span>
                {ps.method === m.key && <span class="badge ok">✓</span>}
              </button>); })}
          </div>
        </section>
        <section class="card">
          <h2>{t('madhab')}</h2>
          <Seg value={ps.madhab} options={[{ v: 'shafi', label: t('shafi') }, { v: 'hanafi', label: t('hanafi') }]} onChange={(v) => set({ madhab: v })} />
          <h2 style="margin-top:16px">{t('highLat')}</h2>
          <p class="muted small" style="margin-bottom:8px">{isAr() ? 'يُستخدم فقط حين لا يتحقق الشفق (الصيف في الشمال). تقدير وليس حكمًا؛ ارجع لمرجعك المحلي.' : 'Used only when twilight does not occur (northern summers). An estimate, not a ruling — consult your local authority.'}</p>
          <Seg value={ps.highLat} options={[{ v: 'MiddleOfTheNight', label: isAr() ? 'نصف الليل' : 'Middle of night' }, { v: 'SeventhOfTheNight', label: isAr() ? 'سُبع الليل' : '1/7 of night' }, { v: 'TwilightAngle', label: isAr() ? 'زاوية الشفق' : 'Twilight angle' }]} onChange={(v) => set({ highLat: v })} />
        </section>
        <section class="card">
          <h2>{t('adjustments')}</h2>
          <p class="muted small" style="margin-bottom:8px">{isAr() ? 'تعديل شخصي بالدقائق لكل وقت، يُحفظ منفصلًا عن الجدول الأصلي.' : 'Personal minute offsets per time, kept separate from the base schedule.'}</p>
          {PRAYERS.map((p) => (
            <div key={p} class="row between" style="min-height:44px">
              <span>{t(p)}</span>
              <span class="row">
                <button class="chip" onClick={() => set({ adjust: { ...ps.adjust, [p]: ps.adjust[p] - 1 } })}>−</button>
                <span class="num" style="min-width:3ch;text-align:center">{ps.adjust[p] > 0 ? '+' : ''}{num(ps.adjust[p])}</span>
                <button class="chip" onClick={() => set({ adjust: { ...ps.adjust, [p]: ps.adjust[p] + 1 } })}>+</button>
              </span>
            </div>
          ))}
          <button class="btn ghost sm" onClick={() => set({ adjust: { ...DEFAULT_SETTINGS.prayer.adjust } })}>{t('reset')}</button>
        </section>
        <section class="card">
          <h2>{t('notifications')}</h2>
          {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((p) => <Toggle key={p} label={t(p)} checked={ps.notify[p]} onChange={(v) => set({ notify: { ...ps.notify, [p]: v } })} />)}
          <hr />
          <Seg value={ps.notifyMode} options={[{ v: 'notification', label: isAr() ? 'تنبيه بصوت النظام' : 'System sound' }, { v: 'silent', label: isAr() ? 'صامت' : 'Silent' }]} onChange={(v) => set({ notifyMode: v })} />
          <div class="row between" style="margin-top:12px"><span>{isAr() ? 'تذكير قبل الصلاة (دقائق)' : 'Reminder before prayer (min)'}</span>
            <select class="input" style="width:auto" value={ps.preMinutes} onChange={(e) => set({ preMinutes: Number((e.target as HTMLSelectElement).value) })}>{[0, 5, 10, 15, 30].map((x) => <option value={x}>{x === 0 ? (isAr() ? 'عند الوقت' : 'At time') : num(x)}</option>)}</select></div>
          <p class="muted small" style="margin-top:8px">{isAr() ? 'هذا تنبيه نظام قصير وليس أذانًا كاملًا في الخلفية. الأذان الكامل على iOS يحتاج مسار AlarmKit (نظام 26+) ولم يُنفَّذ بعد؛ يحترم التطبيق وضع الصامت وعدم الإزعاج.' : 'This is a short system notification, not a full background adhan. A full adhan on iOS needs AlarmKit (iOS 26+), not implemented yet; silent and Do-Not-Disturb modes are respected.'}</p>
        </section>
        <section class="card">
          <h2>{t('duha')}</h2>
          <p class="muted small" style="margin-bottom:8px">{isAr() ? 'موعد تذكيرك الشخصي بعد الشروق. الشروق حدث فلكي؛ بداية وقت الضحى تقدير شرعي يختلف بحسب المرجع المحلي، فاضبط الدقائق وفق جهتك.' : 'Your personal reminder offset after sunrise. Sunrise is astronomical; the start of Duha is a juristic estimate that varies by local authority — set the minutes per your reference.'}</p>
          <div class="row between"><span>{isAr() ? 'دقائق بعد الشروق' : 'Minutes after sunrise'}</span>
            <span class="row"><button class="chip" onClick={() => set({ duhaOffsetMin: Math.max(5, ps.duhaOffsetMin - 5) })}>−</button><span class="num">{num(ps.duhaOffsetMin)}</span><button class="chip" onClick={() => set({ duhaOffsetMin: Math.min(60, ps.duhaOffsetMin + 5) })}>+</button></span></div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
export function QiblaScreen() {
  const { settings } = useStore();
  const loc = settings.location;
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'ok' | 'denied' | 'unsupported'>('idle');
  useEffect(() => {
    const w = window as Window & { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } };
    const handler = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const h = typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : e.absolute && e.alpha != null ? 360 - e.alpha : null;
      if (h != null) { setHeading(h); setStatus('ok'); }
    };
    const start = async () => {
      if (!('DeviceOrientationEvent' in window)) { setStatus('unsupported'); return; }
      try {
        if (w.DeviceOrientationEvent?.requestPermission) { const r = await w.DeviceOrientationEvent.requestPermission(); if (r !== 'granted') { setStatus('denied'); return; } }
        window.addEventListener('deviceorientationabsolute' as 'deviceorientation', handler as EventListener, true);
        window.addEventListener('deviceorientation', handler as EventListener, true);
        setTimeout(() => setStatus((s) => (s === 'idle' ? 'unsupported' : s)), 3000);
      } catch { setStatus('denied'); }
    };
    void start();
    return () => { window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', handler as EventListener, true); window.removeEventListener('deviceorientation', handler as EventListener, true); };
  }, []);
  if (!loc) return <NoLocation />;
  const bearing = qiblaBearing(loc.lat, loc.lng);
  const rel = heading != null ? (bearing - heading + 360) % 360 : null;
  const aligned = rel != null && (rel < 4 || rel > 356);
  return (
    <main class="screen">
      <TopBar title={t('qibla')} onBack />
      <section class="card" style="text-align:center">
        <p class="muted">{t('qiblaBearing')}</p>
        <div class="countdown num">{num(bearing.toFixed(1))}°</div>
        <small class="muted">{loc.name} · {isAr() ? 'محسوب من الإحداثيات (دائرة عظمى) — يعمل دون إنترنت' : 'computed from coordinates (great circle) — works offline'}</small>
        <QiblaRose bearing={bearing} heading={rel != null ? heading! : null} aligned={aligned} label={`${t('qiblaBearing')} ${bearing.toFixed(0)}`} />
        {status === 'ok' ? <p class={aligned ? 'badge ok' : 'muted small'}>{aligned ? (isAr() ? 'أنت متجه إلى القبلة' : 'Facing the qibla') : (isAr() ? `أدر الهاتف ${rel! < 180 ? 'يمينًا' : 'يسارًا'} ${num(Math.round(rel! < 180 ? rel! : 360 - rel!))}°` : `Turn ${rel! < 180 ? 'right' : 'left'} ${Math.round(rel! < 180 ? rel! : 360 - rel!)}°`)}</p>
          : <p class="notice" style="margin-top:8px">{t('compassUnavailable')}</p>}
        <p class="muted small" style="margin-top:12px">{isAr() ? 'دقة البوصلة تتأثر بالمعادن والمغناطيس والأغطية. حرّك الهاتف على شكل ٨ للمعايرة.' : 'Compass accuracy is affected by metal, magnets and cases. Move the phone in a figure-8 to calibrate.'}</p>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
export function DiagnosticsScreen() {
  const { settings } = useStore();
  const [perm, setPerm] = useState<PermState>('unavailable');
  const [pending, setPending] = useState(0);
  const [msg, setMsg] = useState('');
  const refresh = async () => { setPerm(await permissionState()); setPending(await pendingCount()); };
  useEffect(() => { void refresh(); }, []);
  const label: Record<PermState, string> = { granted: isAr() ? 'مسموح' : 'granted', denied: isAr() ? 'مرفوض — فعّله من إعدادات النظام' : 'denied — enable in system settings', prompt: isAr() ? 'لم يُطلب بعد' : 'not asked yet', unavailable: isAr() ? 'غير متاح (متصفح)' : 'unavailable (browser)' };
  return (
    <main class="screen">
      <TopBar title={t('diagnostics')} onBack />
      <section class="card">
        <dl class="kv">
          <dt>{t('permission')}</dt><dd><span class={`badge ${perm === 'granted' ? 'ok' : 'warn'}`}>{label[perm]}</span></dd>
          <dt>{t('scheduled')}</dt><dd class="num">{num(pending)} {isAr() ? 'تنبيهًا (الأيام العشرة القادمة)' : 'notifications (next 10 days)'}</dd>
          <dt>{t('city')}</dt><dd>{settings.location ? `${settings.location.name} · ${settings.location.tz}` : '—'}</dd>
          <dt>{isAr() ? 'المنصة' : 'Platform'}</dt><dd>{isNative ? (isAr() ? 'تطبيق' : 'native app') : (isAr() ? 'متصفح' : 'browser')}</dd>
        </dl>
        <hr />
        <div class="stack">
          {perm !== 'granted' && isNative && <button class="btn" onClick={async () => { await requestPermission(); await reschedule(settings.location, settings.prayer); await refresh(); }}>{t('enable')}</button>}
          <button class="btn secondary" disabled={!isNative} onClick={async () => { const n = await reschedule(settings.location, settings.prayer); setMsg(isAr() ? `أُعيدت الجدولة: ${n}` : `Rescheduled: ${n}`); await refresh(); }}>{isAr() ? 'إعادة الجدولة الآن' : 'Reschedule now'}</button>
          <button class="btn secondary" disabled={!isNative} onClick={async () => { await testNotification(); setMsg(isAr() ? 'سيصل تنبيه اختبار خلال 5 ثوانٍ' : 'A test notification arrives in 5 s'); }}>{t('testSound')}</button>
          {msg && <p class="muted small">{msg}</p>}
        </div>
      </section>
      <section class="card" style="margin-top:12px">
        <h3>{isAr() ? 'ما الذي يعمل على جهازك' : 'What works on your device'}</h3>
        <ul class="small text-2" style="padding-inline-start:20px;margin:8px 0">
          <li>{isAr() ? 'تنبيه نظام عند كل صلاة مختارة، بصوت النظام الافتراضي أو صامت.' : 'A system notification at each selected prayer, default sound or silent.'}</li>
          <li>{isAr() ? 'يُعاد ضبط الجدول عند تغيير المدينة أو الطريقة أو التعديلات (تُلغى التنبيهات القديمة).' : 'Schedule is rebuilt when city, method or adjustments change (old alerts cancelled).'}</li>
          <li>{isAr() ? 'لا يخترق التطبيق وضع الصامت أو عدم الإزعاج.' : 'The app never bypasses silent or Do-Not-Disturb.'}</li>
          <li>{isAr() ? 'أذان كامل في الخلفية: غير متاح بعد (iOS: AlarmKit — Android: منبه دقيق بإذن). سيُختبر على أجهزة حقيقية قبل الإعلان عنه.' : 'Full background adhan: not yet (iOS: AlarmKit — Android: exact alarm permission). To be tested on real devices before it is advertised.'}</li>
          <li>{isAr() ? 'بعد إعادة تشغيل الهاتف افتح التطبيق مرة لإعادة الجدولة.' : 'After a phone restart, open the app once to reschedule.'}</li>
        </ul>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
export function NawafilScreen() {
  const { settings } = useStore();
  const loc = settings.location;
  const now = useNow(60000);
  if (!loc) return <NoLocation />;
  const n = nightTimes(loc, settings.prayer, civilDate(loc.tz, 0, now));
  const Row = ({ name, at, note }: { name: string; at: Date; note: string }) => (
    <div class="prayer-row" style="flex-wrap:wrap"><span>{name}<br /><small class="muted">{note}</small></span><span class="time num">{fmtTime(at, loc.tz)}</span></div>
  );
  return (
    <main class="screen">
      <TopBar title={t('nawafil')} onBack />
      <section class="card">
        <Row name={t('sunrise')} at={n.sunrise} note={isAr() ? 'حدث فلكي — لا تُصلى النافلة عنده' : 'astronomical event — not a prayer time'} />
        <Row name={`${t('duha')} (${isAr() ? 'تذكيرك' : 'your reminder'})`} at={n.duhaReminder} note={isAr() ? `الشروق + ${settings.prayer.duhaOffsetMin} دقيقة — إعداد شخصي؛ بداية الوقت الشرعي بحسب مرجعك المحلي (مثال: فتوى دار الإفتاء المصرية لمصر)` : `Sunrise + ${settings.prayer.duhaOffsetMin} min — your setting; the juristic start follows your local authority`} />
        <Row name={t('maghrib')} at={n.maghrib} note={isAr() ? 'بداية الليل في الحساب' : 'start of night in this calculation'} />
        <Row name={t('midnight')} at={n.midnight} note={isAr() ? 'منتصف ما بين المغرب والفجر التالي (ليس 00:00)' : 'halfway between Maghrib and next Fajr (not 00:00)'} />
        <Row name={t('lastThird')} at={n.lastThird} note={isAr() ? 'بداية الثلث الأخير من الليل بالتعريف نفسه' : 'start of the last third, same definition'} />
        <Row name={`${t('fajr')} (${isAr() ? 'الغد' : 'tomorrow'})`} at={n.nextFajr} note={isAr() ? 'نهاية الليل' : 'end of night'} />
      </section>
      <section class="card" style="margin-top:12px">
        <h3>{isAr() ? 'الرواتب والوتر' : 'Sunnah prayers & Witr'}</h3>
        <p class="text-2 small" style="margin-top:8px">{isAr() ? 'محتوى تعليمي موثق (عدد الركعات والصيغ بحسب المذاهب) يُضاف في المرحلة الثانية بعد المراجعة العلمية. لم نضع أرقامًا هنا دون مصدر مراجَع.' : 'Documented teaching content (rak‘ah counts and forms per school) is scheduled for Phase 2 after scholarly review. No numbers are shown here without a reviewed source.'}</p>
        <span class="badge warn">{t('notReviewed')}</span>
      </section>
    </main>
  );
}

/** Compass rose: ticks every 5°, Arabic cardinals, Kaaba marker on the qibla bearing; rotates with the device heading. */
function QiblaRose({ bearing, heading, aligned, label }: { bearing: number; heading: number | null; aligned: boolean; label: string }) {
  const rot = heading != null ? -heading : 0;
  const pt = (deg: number, r: number) => { const a = ((deg - 90) * Math.PI) / 180; return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
  const ticks = Array.from({ length: 72 }, (_, i) => { const d = i * 5; const len = i % 18 === 0 ? 12 : i % 2 === 0 ? 7 : 4; const [x1, y1] = pt(d, 90); const [x2, y2] = pt(d, 90 - len); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 18 === 0 ? 'var(--text)' : 'var(--muted)'} stroke-width={i % 18 === 0 ? 2 : 1} stroke-linecap="round" />; });
  const card = [['ش', 0], ['ق', 90], ['ج', 180], ['غ', 270]] as const;
  const [kx, ky] = pt(bearing, 66); const [nx, ny] = pt(bearing, 54);
  return (
    <svg class="compass-rose" viewBox="0 0 200 200" role="img" aria-label={label}>
      <circle cx="100" cy="100" r="97" fill="var(--surface)" stroke="var(--line)" stroke-width="2" />
      <circle cx="100" cy="100" r="76" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 4" />
      <g style={`transform:rotate(${rot}deg);transform-origin:100px 100px;transition:transform 300ms ease-out`}>
        {ticks}
        {card.map(([l, d]) => { const [x, y] = pt(d, 62); return <text key={l} x={x} y={y + 5} text-anchor="middle" font-size="15" font-weight="700" fill={d === 0 ? 'var(--danger)' : 'var(--text-2)'} style="font-family:var(--font-ui)">{l}</text>; })}
        <line x1="100" y1="100" x2={nx} y2={ny} stroke={aligned ? 'var(--copper)' : 'var(--primary)'} stroke-width="5" stroke-linecap="round" />
        <g transform={`translate(${kx - 9} ${ky - 9}) rotate(${bearing} 9 9)`}><rect width="18" height="18" rx="2" fill="#1E1E1E" /><rect y="4" width="18" height="3" fill="#C9A24D" /></g>
      </g>
      <path d="M100 6 l7 12 h-14z" fill={aligned ? 'var(--copper)' : 'var(--primary)'} />
      <circle cx="100" cy="100" r="7" fill="var(--primary)" /><circle cx="100" cy="100" r="3" fill="var(--surface)" />
    </svg>
  );
}
