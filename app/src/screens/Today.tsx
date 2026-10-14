/** Section 06: three visible things — next prayer (+ source), continue reading, a chosen dhikr. Then the daily rows. */
import { useEffect, useState } from 'preact/hooks';
import { useStore, updateSettings, todayKey, updateUser } from '../lib/store';
import { t, num, fmtTime, fmtDate, isAr } from '../lib/i18n';
import { nextPrayer, methodByKey, isLocationStale, zonedParts } from '../lib/prayer';
import { toHijri, formatHijri, hijriFlags } from '../lib/hijri';
import { getChapters, getAdhkar, getHadithChapter, getHadithIndex } from '../lib/content';
import { navigate } from '../lib/router';
import { Icon, useAsync, useNow, Notice } from '../components/ui';
import { permissionState, isNative } from '../lib/notify';

function Countdown({ to }: { to: Date }) {
  const now = useNow(1000);
  const s = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return <div class="countdown num" aria-live="off">{num(String(h).padStart(2, '0'))}:{num(String(m).padStart(2, '0'))}:{num(String(sec).padStart(2, '0'))}</div>;
}

export function Today() {
  const { settings, user } = useStore();
  const loc = settings.location;
  const [perm, setPerm] = useState<string>('unavailable');
  useEffect(() => { permissionState().then(setPerm); }, []);
  const chapters = useAsync(getChapters, []);
  const adhkar = useAsync(getAdhkar, []);
  const nawawi = useAsync(async () => { const idx = await getHadithIndex('nawawi40'); const ch = await getHadithChapter('nawawi40', idx.chapters[0].id); return ch; }, []);

  const now = new Date();
  const tz = loc?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hour = loc ? zonedParts(now, tz).h : now.getHours();
  const isMorning = hour >= 4 && hour < 12;
  const hijri = toHijri(now, settings.hijriAdjust);
  const flags = hijriFlags(hijri);
  const next = loc ? nextPrayer(loc, settings.prayer, now) : null;
  const method = methodByKey(settings.prayer.method);
  const hidden = new Set(settings.hiddenCards);
  const dayLog = user.log[todayKey()] || {};
  const quiet = settings.quietMode;

  const morningCat = adhkar.data?.categories.find((c) => c.name.includes('الصباح'));
  const eveningCat = adhkar.data?.categories.find((c) => c.name.includes('المساء'));
  const dhikrCat = isMorning ? morningCat : eveningCat;
  const lastRead = user.lastRead;
  const lastCh = lastRead && chapters.data ? chapters.data[lastRead.ch - 1] : null;
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const hadith = nawawi.data ? nawawi.data.hadiths[dayOfYear % nawawi.data.hadiths.length] : null;

  return (
    <main class="screen">
      <header class="topbar">
        <div style="flex:1">
          <h1>{t('today')}</h1>
          <small class="muted">{fmtDate(now, tz)} · <span title={t('hijriNote')}>{formatHijri(hijri, isAr())}</span>{flags.length ? ` · ${flags.join(' · ')}` : ''}</small>
        </div>
        <button class="icon-btn" aria-label={t('search')} onClick={() => navigate('/library/search')}><Icon name="search" /></button>
        <button class="icon-btn" aria-label={t('settings')} onClick={() => navigate('/settings')}><Icon name="settings" /></button>
      </header>

      {loc && isLocationStale(loc) && <div style="margin-bottom:12px"><Notice action={t('update')} onAction={() => navigate('/prayer/city')}>{t('locationOld')}</Notice></div>}
      {isNative && loc && perm !== 'granted' && <div style="margin-bottom:12px"><Notice action={t('enable')} onAction={() => navigate('/prayer/diagnostics')}>{t('notificationsOff')}</Notice></div>}

      {/* 1 — Next prayer */}
      {next && loc ? (
        <section class="card primary" onClick={() => navigate('/prayer')} role="button" tabIndex={0}>
          <div class="row between"><span class="muted">{t('nextPrayer')}</span><span class="muted small">{loc.name}</span></div>
          <h2 style="font-size:1.6em;margin:4px 0">{t(next.name)} <span class="num" style="font-weight:500">{fmtTime(next.at, loc.tz)}</span></h2>
          <Countdown to={next.at} />
          <small class="muted">{t('calculated')} · {isAr() ? method.ar : method.en}</small>
        </section>
      ) : (
        <section class="card soft"><h2>{t('prayer')}</h2><p class="text-2 small">{t('chooseCity')}</p><button class="btn sm" style="margin-top:8px" onClick={() => navigate('/prayer/city')}>{t('chooseCity')}</button></section>
      )}

      {/* 2 — Continue reading */}
      <section class="card" style="margin-top:12px" onClick={() => navigate(lastRead ? `/quran/read/${lastRead.ch}/${lastRead.v}` : '/quran/read/1/1')} role="button" tabIndex={0}>
        <div class="row between">
          <div>
            <h2>{lastRead ? t('continueReading') : t('startReading')}</h2>
            <p class="text-2">{lastRead && lastCh ? `${t('surah')} ${lastCh.name} · ${t('ayah')} ${num(lastRead.v)} · ${t('page')} ${num(lastRead.page)}` : (isAr() ? 'سورة الفاتحة' : 'Al-Fatihah')}</p>
            {user.lastListen && <small class="muted">{t('listen')}: {num(user.lastListen.ch)}:{num(user.lastListen.v)}</small>}
          </div>
          <Icon name="quran" />
        </div>
      </section>

      {/* 3 — Dhikr of the moment */}
      {dhikrCat && (
        <section class="card" style="margin-top:12px" onClick={() => navigate(`/adhkar/session/${dhikrCat.id}`)} role="button" tabIndex={0}>
          <div class="row between"><h2>{dhikrCat.name}</h2>{(isMorning ? dayLog.adhkarMorning : dayLog.adhkarEvening) && <span class="badge ok">✓</span>}</div>
          <p class="dhikr-text" dir="rtl" style="text-align:start;font-size:1.05em;margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{dhikrCat.items[1]?.text || dhikrCat.items[0]?.text}</p>
          <small class="muted">{num(dhikrCat.items.length)} {isAr() ? 'ذكرًا' : 'adhkar'} · {isAr() ? 'نافذة الاقتراح: 4ص–12م للصباح، وبعدها المساء (يمكن تعديلها)' : 'Suggested window: 4am–12pm morning, then evening (editable)'}</small>
        </section>
      )}

      {!quiet && (
        <>
          <h2 style="margin:20px 0 8px">{isAr() ? 'رحلة اليوم' : 'Your day'}</h2>
          <div class="list">
            {!hidden.has('wird') && <button class="list-item" onClick={() => navigate('/quran')}><Icon name="book" /><span class="grow"><span class="title">{t('dailyWird')}</span><br /><span class="sub">{isAr() ? 'صفحة أو أكثر من حيث توقفت — بلا خطة إجبارية' : 'A page or more from where you stopped — no forced plan'}</span></span>{dayLog.wird && <span class="badge ok">✓</span>}</button>}
            {!hidden.has('nawafil') && <button class="list-item" onClick={() => navigate('/prayer/nawafil')}><Icon name="sun" /><span class="grow"><span class="title">{t('nawafil')}</span><br /><span class="sub">{isAr() ? 'الضحى، منتصف الليل، الثلث الأخير — بمصدر الحساب' : 'Duha, midnight, last third — with the calculation source'}</span></span></button>}
            {!hidden.has('hadith') && hadith && (
              <button class="list-item" onClick={() => navigate(`/library/hadith/nawawi40/${nawawi.data!.chapter}/${hadith.id}`)}><Icon name="library" />
                <span class="grow"><span class="title">{t('hadithOfDay')}</span><br /><span class="sub" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{hadith.ar}</span><br /><span class="sub">{t('nawawi')} · {num(hadith.id)}</span></span>
              </button>
            )}
            {!hidden.has('qibla') && <button class="list-item" onClick={() => navigate('/prayer/qibla')}><Icon name="compass" /><span class="grow"><span class="title">{t('qibla')}</span></span></button>}
          </div>
          {settings.showProgress && (
            <p class="muted small" style="margin-top:12px">
              {isAr() ? 'التقدم شخصي ومحلي ويمكن إخفاؤه من الإعدادات.' : 'Progress is private, on-device, and can be hidden in Settings.'}
            </p>
          )}
        </>
      )}
      <div class="row" style="margin-top:16px;justify-content:center;gap:16px">
        <button class="btn ghost sm" onClick={() => updateSettings({ quietMode: !quiet })}>{quiet ? (isAr() ? 'إظهار رحلة اليوم' : 'Show my day') : t('quietMode')}</button>
        {!quiet && !dayLog.wird && <button class="btn ghost sm" onClick={() => updateUser((u) => ({ log: { ...u.log, [todayKey()]: { ...dayLog, wird: true } } }))}>{isAr() ? 'قرأت وردي اليوم' : 'Mark wird done'}</button>}
      </div>
    </main>
  );
}
