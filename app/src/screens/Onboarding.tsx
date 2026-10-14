/** Section 05: short, skippable. Quran & adhkar are reachable before any permission. */
import { useState } from 'preact/hooks';
import { Geolocation } from '@capacitor/geolocation';
import { updateSettings, updatePrayer, useStore, type Location } from '../lib/store';
import { t, isAr } from '../lib/i18n';
import { CITIES, METHODS, suggestMethod } from '../lib/prayer';
import { requestPermission, reschedule, isNative } from '../lib/notify';
import { navigate } from '../lib/router';
import { Seg } from '../components/ui';

export function Onboarding() {
  const { settings } = useStore();
  const [step, setStep] = useState(0);
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState<Location | null>(settings.location);
  const [cc, setCc] = useState('EG');
  const [method, setMethod] = useState(settings.prayer.method);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (goal: typeof settings.goal = null) => {
    updateSettings({ onboarded: true, goal, location: loc });
    updatePrayer({ method });
    await reschedule(loc, { ...settings.prayer, method });
    navigate('/', true);
  };
  const useGps = async () => {
    setBusy(true); setGpsErr(null);
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 12000 });
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      setLoc({ name: isAr() ? 'موقعي الحالي' : 'My location', lat: pos.coords.latitude, lng: pos.coords.longitude, tz, source: 'gps', updatedAt: Date.now() });
      setStep(2);
    } catch (e) {
      setGpsErr(isAr() ? 'تعذّر الحصول على الموقع. اختر مدينتك يدويًا.' : 'Could not get location. Pick your city manually.');
    } finally { setBusy(false); }
  };
  const filtered = CITIES.filter((c) => !q || c.name.includes(q) || c.en.toLowerCase().includes(q.toLowerCase()) || c.country.includes(q));

  return (
    <div class="onb">
      {step === 0 && (
        <>
          <div class="art-host" style="margin:-16px -20px 8px;padding:28px 20px 36px;border-radius:0 0 28px 28px;background:var(--primary-soft)">
            <span class="art-layer pattern-star" aria-hidden="true" />
            <span class="art-layer arch-band" aria-hidden="true" />
            <img class="logo-mark only-light" src="logo-mark.svg" alt="" width="96" height="96" /><img class="logo-mark only-dark" src="logo-mark-dark.svg" alt="" width="96" height="96" />
            <div class="logo-word">سكينة</div>
          </div>
          <h1 style="text-align:center">{t('welcome')}</h1>
          <p class="text-2" style="text-align:center">{t('welcomeSub')}</p>
          <div class="field"><label>{t('language')}</label>
            <Seg value={settings.lang} options={[{ v: 'ar', label: 'العربية' }, { v: 'en', label: 'English' }]} onChange={(v) => updateSettings({ lang: v })} />
          </div>
          <div class="spacer" />
          <button class="btn block" onClick={() => setStep(1)}>{t('next')}</button>
          <button class="btn ghost block" onClick={() => finish()}>{t('skip')}</button>
          <p class="muted small" style="text-align:center">{t('guest')}</p>
        </>
      )}
      {step === 1 && (
        <>
          <h1>{t('chooseCity')}</h1>
          <p class="text-2 small">{t('whyLocation')}</p>
          <button class="btn secondary block" disabled={busy} onClick={useGps}>{busy ? '…' : t('useGps')}</button>
          {gpsErr && <p class="notice">{gpsErr}</p>}
          <input class="input" placeholder={isAr() ? 'ابحث عن مدينة' : 'Search city'} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <div class="list" style="max-height:40vh;overflow:auto">
            {filtered.map((c) => (
              <button key={c.en} class="list-item" onClick={() => { setLoc({ name: isAr() ? c.name : c.en, lat: c.lat, lng: c.lng, tz: c.tz, source: 'manual', updatedAt: Date.now() }); setCc(c.cc); setMethod(suggestMethod(c.cc)); setStep(2); }}>
                <span class="grow"><span class="title">{isAr() ? c.name : c.en}</span><br /><span class="sub">{c.country} · {c.tz}</span></span>
              </button>
            ))}
          </div>
          <div class="spacer" />
          <button class="btn ghost block" onClick={() => finish()}>{t('skip')}</button>
        </>
      )}
      {step === 2 && (
        <>
          <h1>{t('confirmMethod')}</h1>
          <p class="text-2 small">{t('methodNote')}</p>
          <div class="list" style="max-height:48vh;overflow:auto">
            {METHODS.map((m) => (
              <button key={m.key} class="list-item" aria-pressed={method === m.key} onClick={() => setMethod(m.key)}>
                <span class="grow"><span class="title">{isAr() ? m.ar : m.en}</span><br /><span class="sub">{m.authority}</span></span>
                {method === m.key && <span class="badge ok">✓</span>}
              </button>
            ))}
          </div>
          <p class="muted small">{loc ? `${t('city')}: ${loc.name} · ${loc.tz}` : ''}{cc === 'EG' ? '' : ''}</p>
          <div class="spacer" />
          <button class="btn block" onClick={() => setStep(3)}>{t('next')}</button>
        </>
      )}
      {step === 3 && (
        <>
          <h1>{t('notifications')}</h1>
          <p class="text-2 small">{t('whyNotify')}</p>
          {!isNative && <p class="notice">{isAr() ? 'التنبيهات تعمل في تطبيق الهاتف فقط، لا في المتصفح.' : 'Notifications work in the phone app only, not in a browser.'}</p>}
          <div class="spacer" />
          <button class="btn block" onClick={async () => { await requestPermission(); setStep(4); }}>{t('enable')}</button>
          <button class="btn ghost block" onClick={() => setStep(4)}>{t('later')}</button>
        </>
      )}
      {step === 4 && (
        <>
          <h1>{t('goal')}</h1>
          <div class="stack">
            {([['prayer', t('goalPrayer')], ['reading', t('goalReading')], ['hifz', t('goalHifz')], ['adhkar', t('goalAdhkar')], ['general', t('goalGeneral')]] as const).map(([g, label]) => (
              <button key={g} class="btn secondary block" onClick={() => finish(g)}>{label}</button>
            ))}
          </div>
          <div class="spacer" />
          <button class="btn ghost block" onClick={() => finish()}>{t('skip')}</button>
        </>
      )}
    </div>
  );
}
