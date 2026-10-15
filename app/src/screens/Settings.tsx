/** Sections 32–33: settings, accessibility, privacy, export/delete. */
import { useState } from 'preact/hooks';
import { useStore, updateSettings, wipeAll, exportAll } from '../lib/store';
import { t, num, isAr } from '../lib/i18n';
import { navigate } from '../lib/router';
import { TopBar, Seg, Toggle, Sheet, shareText } from '../components/ui';
import { toHijri, formatHijri } from '../lib/hijri';
import { reschedule } from '../lib/notify';

export function SettingsScreen() {
  const { settings } = useStore();
  const [confirm, setConfirm] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const Range = ({ label, value, min, max, step, onChange, preview }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; preview?: preact.JSX.Element }) => (
    <div class="field" style="margin-top:12px">
      <label>{label} <span class="muted num">({num(value)})</span></label>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))} />
      {preview}
    </div>
  );
  return (
    <main class="screen">
      <TopBar title={t('settings')} onBack />
      <div class="stack">
        <section class="card">
          <h2>{t('language')}</h2>
          <Seg value={settings.lang} options={[{ v: 'ar', label: 'العربية' }, { v: 'en', label: 'English' }]} onChange={async (v) => { updateSettings({ lang: v }); await reschedule(settings.location, settings.prayer); }} />
          <p class="muted small" style="margin-top:8px">{isAr() ? 'لغة الواجهة فقط؛ القرآن والحديث والأذكار تبقى بنصها الأصلي.' : 'UI language only; Quran, hadith and adhkar stay in their original text.'}</p>
        </section>
        <section class="card">
          <h2>{t('theme')}</h2>
          <Seg value={settings.theme} options={[{ v: 'auto', label: t('auto') }, { v: 'light', label: t('light') }, { v: 'dark', label: t('dark') }, { v: 'paper', label: t('paper') }]} onChange={(v) => updateSettings({ theme: v })} />
          <Range label={t('textSize')} value={settings.uiScale} min={0.9} max={1.4} step={0.05} onChange={(v) => updateSettings({ uiScale: v })} />
          <Range label={t('quranSize')} value={settings.quranSize} min={20} max={48} step={1} onChange={(v) => updateSettings({ quranSize: v })} preview={<p class="ayah-text" style="text-align:start;text-align-last:start">ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ</p>} />
          <Range label={t('bodySize')} value={settings.bodySize} min={14} max={28} step={1} onChange={(v) => updateSettings({ bodySize: v })} />
          <hr />
          <Toggle label={t('simpleMode')} checked={settings.simpleMode} onChange={(v) => updateSettings({ simpleMode: v })} />
          <Toggle label={t('reduceMotion')} checked={settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
          <Toggle label={isAr() ? 'إظهار التقدم الشخصي' : 'Show personal progress'} sub={isAr() ? 'لا يُحسب ثواب ولا يُقيَّم إيمان — مجرد متابعة خاصة' : 'No reward counting, no judgement — private tracking only'} checked={settings.showProgress} onChange={(v) => updateSettings({ showProgress: v })} />
        </section>
        <section class="card">
          <h2>{t('prayer')}</h2>
          <div class="list" style="margin-top:8px">
            <button class="list-item" onClick={() => navigate('/prayer/city')}><span class="grow"><span class="title">{t('city')}</span><br /><span class="sub">{settings.location ? `${settings.location.name} · ${settings.location.tz}` : '—'}</span></span></button>
            <button class="list-item" onClick={() => navigate('/prayer/settings')}><span class="grow"><span class="title">{t('method')} · {t('notifications')} · {t('adjustments')}</span></span></button>
            <button class="list-item" onClick={() => navigate('/prayer/diagnostics')}><span class="grow"><span class="title">{t('diagnostics')}</span></span></button>
          </div>
        </section>
        <section class="card">
          <h2>{isAr() ? 'التذكيرات الاختيارية' : 'Optional reminders'}</h2>
          <p class="muted small" style="margin:4px 0 8px">{isAr() ? 'كلها معطّلة افتراضيًا. تُحسب من نفس محرك المواقيت وتعمل في تطبيق الهاتف.' : 'All off by default; computed from the same engine; native app only.'}</p>
          {([['sunrise', isAr() ? 'تنبيه الشروق (انتهاء وقت الفجر)' : 'Sunrise alert'], ['duha', isAr() ? 'تذكير الضحى' : 'Duha reminder'], ['lastThird', isAr() ? 'الثلث الأخير من الليل' : 'Last third of the night'], ['fridayKahf', isAr() ? 'الجمعة: سورة الكهف' : 'Friday: al-Kahf'], ['fridaySalawat', isAr() ? 'الجمعة: الصلاة على النبي' : 'Friday: salawat'], ['trackerEvening', isAr() ? 'تذكير تسجيل الصلوات مساءً' : 'Evening tracker reminder']] as const).map(([k, label]) => (
            <Toggle key={k} label={label} checked={settings.reminders[k]} onChange={async (v) => { updateSettings({ reminders: { ...settings.reminders, [k]: v } }); await reschedule(settings.location, settings.prayer); }} />
          ))}
        </section>
        <section class="card">
          <h2>{t('hijri')}</h2>
          <p class="text-2">{formatHijri(toHijri(new Date(), settings.hijriAdjust), isAr())}</p>
          <p class="muted small">{t('hijriNote')}</p>
          <div class="row between" style="margin-top:8px"><span>{t('hijriAdjust')}</span>
            <span class="row"><button class="chip" onClick={() => updateSettings({ hijriAdjust: Math.max(-2, settings.hijriAdjust - 1) })}>−</button><span class="num">{settings.hijriAdjust > 0 ? '+' : ''}{num(settings.hijriAdjust)}</span><button class="chip" onClick={() => updateSettings({ hijriAdjust: Math.min(2, settings.hijriAdjust + 1) })}>+</button></span></div>
          <input class="input" style="margin-top:8px" placeholder={isAr() ? 'الجهة التي تتبعها (مثال: دار الإفتاء المصرية)' : 'Authority you follow'} value={settings.hijriAuthority} onInput={(e) => updateSettings({ hijriAuthority: (e.target as HTMLInputElement).value })} />
        </section>
        <section class="card">
          <h2>{isAr() ? 'الخصوصية والبيانات' : 'Privacy & data'}</h2>
          <p class="text-2 small" style="margin:8px 0">{t('dataLocal')} {t('guest')} {isAr() ? 'لا تحليلات، لا إعلانات، لا خوادم.' : 'No analytics, no ads, no servers.'}</p>
          <div class="grid-2">
            <button class="btn secondary" onClick={() => setExported(exportAll())}>{t('exportData')}</button>
            <button class="btn danger" onClick={() => setConfirm(true)}>{t('deleteData')}</button>
          </div>
        </section>
        <section class="card">
          <div class="row" style="gap:12px;margin-bottom:8px"><img class="only-light" src="logo-mark.svg" alt="" width="40" height="40" /><img class="only-dark" src="logo-mark-dark.svg" alt="" width="40" height="40" /><h2>{t('about')}</h2></div>
          <p class="text-2 small" style="margin-top:8px">سكينة · {t('version')} 0.1.0 · {isAr() ? 'يعمل دون إنترنت بالكامل عدا بث التلاوات.' : 'Fully offline except streamed recitations.'}</p>
          <button class="btn ghost sm" style="margin-top:8px" onClick={() => navigate('/library/sources')}>{t('sources')}</button>
          <button class="btn ghost sm" style="margin-top:8px" onClick={() => updateSettings({ onboarded: false })}>{isAr() ? 'إعادة الترحيب' : 'Re-run welcome'}</button>
        </section>
      </div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title={t('deleteData')}>
        <p>{isAr() ? 'سيُحذف كل شيء على هذا الجهاز: الإعدادات، العلامات، الجلسات، المفضلة. لا يمكن التراجع.' : 'Everything on this device will be deleted: settings, bookmarks, sessions, favourites. This cannot be undone.'}</p>
        <div class="row" style="margin-top:16px"><button class="btn danger" onClick={async () => { await wipeAll(); await reschedule(null, settings.prayer); setConfirm(false); navigate('/', true); }}>{isAr() ? 'حذف نهائي' : 'Delete permanently'}</button><button class="btn ghost" onClick={() => setConfirm(false)}>{t('cancel')}</button></div>
      </Sheet>
      <Sheet open={!!exported} onClose={() => setExported(null)} title={t('exportData')}>
        <p class="muted small">{isAr() ? 'ملف JSON بكل بياناتك المحلية. شاركه مع نفسك أو انسخه.' : 'A JSON file of all your local data. Share it to yourself or copy it.'}</p>
        <textarea class="input" readOnly style="height:160px;margin:8px 0;direction:ltr;font-family:monospace;font-size:.8em" value={exported || ''} />
        <button class="btn" onClick={() => shareText(exported || '', 'sakina-export.json')}>{t('share')}</button>
      </Sheet>
    </main>
  );
}
