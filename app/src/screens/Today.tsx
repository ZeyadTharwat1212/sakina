/** Home (section 06 + reference-app parity): hero scene with next prayer, 5-prayer row, quick tools, continue reading,
 *  dhikr of the moment, ayah of the day, daily rows. Calm, no photos, no verses on images. */
import { useEffect, useState } from 'preact/hooks';
import { useStore, updateSettings, todayKey, updateUser } from '../lib/store';
import { t, num, fmtTime, fmtDate, isAr } from '../lib/i18n';
import { nextPrayer, methodByKey, isLocationStale, zonedParts, PRAYERS } from '../lib/prayer';
import { toHijri, formatHijri, hijriFlags } from '../lib/hijri';
import { getChapters, getAdhkar, getHadithChapter, getHadithIndex, getSurah, getMeta, ayahDisplay } from '../lib/content';
import { navigate } from '../lib/router';
import { Icon, useAsync, useNow, Notice, shareText } from '../components/ui';
import { permissionState, isNative } from '../lib/notify';
import { ToolsGrid } from './Tools';

function Countdown({ to }: { to: Date }) {
  const now = useNow(1000);
  const s = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return <div class="countdown num" aria-live="off">{num(String(h).padStart(2, '0'))}:{num(String(m).padStart(2, '0'))}:{num(String(sec).padStart(2, '0'))}</div>;
}

/** Deterministic "ayah of the day": walks the mushaf one ayah per day (no random verses, no generated text). */
function useAyahOfDay() {
  return useAsync(async () => {
    const [chs, meta] = await Promise.all([getChapters(), getMeta()]);
    const dayN = Math.floor(Date.now() / 86400000);
    // pick a surah by day, then an ayah within it — stable for the whole day
    const ch = chs[dayN % 114]; const v = (dayN * 7) % ch.verses + 1;
    const s = await getSurah(ch.id);
    return { ch, v, text: ayahDisplay(s, s.verses[v - 1]), page: meta.pages.find(([, sc, sv, ec, ev]) => (sc < ch.id || (sc === ch.id && sv <= v)) && (ec > ch.id || (ec === ch.id && ev >= v)))?.[0] };
  }, []);
}

export function Today() {
  const { settings, user } = useStore();
  const loc = settings.location;
  const [perm, setPerm] = useState<string>('unavailable');
  useEffect(() => { permissionState().then(setPerm); }, []);
  const chapters = useAsync(getChapters, []);
  const adhkar = useAsync(getAdhkar, []);
  const nawawi = useAsync(async () => { const idx = await getHadithIndex('nawawi40'); return getHadithChapter('nawawi40', idx.chapters[0].id); }, []);
  const aod = useAyahOfDay();

  const now = new Date();
  const tz = loc?.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hour = loc ? zonedParts(now, tz).h : now.getHours();
  const isMorning = hour >= 4 && hour < 12;
  const scene = hour < 5 || hour >= 20 ? 'night' : hour < 8 ? 'dawn' : hour < 16 ? 'day' : 'evening';
  const hijri = toHijri(now, settings.hijriAdjust);
  const flags = hijriFlags(hijri);
  const next = loc ? nextPrayer(loc, settings.prayer, now) : null;
  const method = methodByKey(settings.prayer.method);
  const hidden = new Set(settings.hiddenCards);
  const dayLog = user.log[todayKey()] || {};
  const quiet = settings.quietMode;
  const morningCat = adhkar.data?.categories.find((c) => c.name === 'أذكار الصباح');
  const eveningCat = adhkar.data?.categories.find((c) => c.name === 'أذكار المساء');
  const dhikrCat = isMorning ? morningCat : eveningCat;
  const dayN = Math.floor(Date.now() / 86400000);
  const dhikrOfDay = dhikrCat?.items[dayN % (dhikrCat.items.length || 1)];
  const lastRead = user.lastRead;
  const lastCh = lastRead && chapters.data ? chapters.data[lastRead.ch - 1] : null;
  const hadith = nawawi.data ? nawawi.data.hadiths[dayN % nawawi.data.hadiths.length] : null;

  return (
    <main class="screen">
      {/* Hero: time-of-day scene, next prayer, date */}
      <section class={`hero-card scene-${scene} art-host`} onClick={() => navigate('/prayer')} role="button" tabIndex={0}>
        <span class="art-layer pattern-star" aria-hidden="true" style="opacity:.07" />
        <span class="art-layer arch-band" aria-hidden="true" style="opacity:.12" />
        <div class="row between" style="align-items:flex-start">
          <div>
            <div class="muted small">{fmtDate(now, tz)}</div>
            <div class="muted small">{formatHijri(hijri, isAr())}{flags.length ? ` · ${flags.join(' · ')}` : ''}</div>
          </div>
          <div class="row" style="gap:4px">
            <button class="icon-btn" aria-label={t('search')} onClick={(e) => { e.stopPropagation(); navigate('/library/search'); }}><Icon name="search" /></button>
            <button class="icon-btn" aria-label={t('settings')} onClick={(e) => { e.stopPropagation(); navigate('/settings'); }}><Icon name="settings" /></button>
          </div>
        </div>
        {next && loc ? (
          <div style="text-align:center;margin:10px 0 6px">
            <div class="muted">{t('nextPrayer')} · {loc.name}</div>
            <div style="font-size:2em;font-weight:700;line-height:1.2">{t(next.name)} <span class="num" style="font-weight:500">{fmtTime(next.at, loc.tz)}</span></div>
            <Countdown to={next.at} />
            <small class="muted">{t('calculated')} · {isAr() ? method.ar : method.en}</small>
          </div>
        ) : (
          <div style="text-align:center;margin:12px 0"><button class="btn" onClick={(e) => { e.stopPropagation(); navigate('/prayer/city'); }}>{t('chooseCity')}</button></div>
        )}
        {next && loc && (
          <div class="prayer-strip">
            {PRAYERS.map((p) => (
              <div key={p} class={`ps ${p === next.name ? 'on' : ''} ${p === 'sunrise' ? 'sunrise' : ''}`}>
                <span class="small">{t(p)}</span><span class="num small">{fmtTime(next.day.times[p], loc.tz)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {loc && isLocationStale(loc) && <div style="margin-top:12px"><Notice action={t('update')} onAction={() => navigate('/prayer/city')}>{t('locationOld')}</Notice></div>}
      {isNative && loc && perm !== 'granted' && <div style="margin-top:12px"><Notice action={t('enable')} onAction={() => navigate('/prayer/diagnostics')}>{t('notificationsOff')}</Notice></div>}

      {/* Quick tools */}
      {!hidden.has('tools') && <div style="margin-top:14px"><ToolsGrid ids={['qibla', 'tasbih', 'tracker', 'mosques', 'reciters', 'khatma', 'hijri', 'asma']} /></div>}

      {/* Continue reading */}
      <section class="card" style="margin-top:12px" onClick={() => navigate(lastRead ? `/quran/read/${lastRead.ch}/${lastRead.v}` : '/quran/read/1/1')} role="button" tabIndex={0}>
        <div class="row between">
          <div>
            <h2>{lastRead ? t('continueReading') : t('startReading')}</h2>
            <p class="text-2">{lastRead && lastCh ? `${t('surah')} ${lastCh.name} · ${t('ayah')} ${num(lastRead.v)} · ${t('page')} ${num(lastRead.page)}` : (isAr() ? 'سورة الفاتحة' : 'Al-Fatihah')}</p>
            {user.lastListen && chapters.data && <small class="muted">{t('listen')}: {chapters.data[user.lastListen.ch - 1].name}</small>}
          </div>
          <Icon name="quran" />
        </div>
      </section>

      {/* Dhikr of the moment */}
      {dhikrCat && dhikrOfDay && (
        <section class="card" style="margin-top:12px" onClick={() => navigate(`/adhkar/session/${dhikrCat.id}`)} role="button" tabIndex={0}>
          <div class="row between"><h2>{dhikrCat.name}</h2>{(isMorning ? dayLog.adhkarMorning : dayLog.adhkarEvening) ? <span class="badge ok">✓</span> : <span class="badge">{num(dhikrCat.items.length)}</span>}</div>
          <p class="dhikr-text" dir="rtl" style="text-align:start;font-size:1.05em;margin-top:6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">{dhikrOfDay.text}</p>
          <div class="row between" style="margin-top:6px"><small class="muted">{dhikrOfDay.ref || (isAr() ? 'المرجع قيد المراجعة' : 'reference pending')}</small><button class="btn ghost sm" onClick={(e) => { e.stopPropagation(); shareText(`${dhikrOfDay.text}${dhikrOfDay.ref ? `\n[${dhikrOfDay.ref}]` : ''}`); }}><Icon name="share" /></button></div>
        </section>
      )}

      {/* Ayah of the day */}
      {!hidden.has('ayah') && aod.data && (
        <section class="card quran-surface" style="margin-top:12px" onClick={() => navigate(`/quran/read/${aod.data!.ch.id}/${aod.data!.v}`)} role="button" tabIndex={0}>
          <div class="row between"><h2>{isAr() ? 'آية اليوم' : 'Ayah of the day'}</h2><small class="muted">{aod.data.ch.name} · {num(aod.data.v)}</small></div>
          <p class="ayah-text" style="font-size:calc(var(--quran-size) * .85);text-align:start;text-align-last:start;margin-top:8px">{aod.data.text}</p>
          <div class="row" style="margin-top:6px;gap:4px"><button class="btn ghost sm" onClick={(e) => { e.stopPropagation(); navigate(`/quran/read/${aod.data!.ch.id}/${aod.data!.v}`); }}>{isAr() ? 'اقرأ' : 'Read'}</button><button class="btn ghost sm" onClick={(e) => { e.stopPropagation(); shareText(`﴿${aod.data!.text}﴾ [${aod.data!.ch.name}: ${aod.data!.v}]`); }}><Icon name="share" />{t('share')}</button></div>
        </section>
      )}

      {!quiet && (
        <>
          <h2 style="margin:20px 0 8px">{isAr() ? 'رحلة اليوم' : 'Your day'}</h2>
          <div class="list">
            {!hidden.has('wird') && <button class="list-item" onClick={() => navigate(user.khatma ? '/library/khatma' : '/quran')}><Icon name="book" /><span class="grow"><span class="title">{t('dailyWird')}</span><br /><span class="sub">{user.khatma ? (isAr() ? 'حصة اليوم من خطة الختمة' : 'Today’s khatma share') : (isAr() ? 'صفحة أو أكثر من حيث توقفت — بلا خطة إجبارية' : 'A page or more from where you stopped')}</span></span>{dayLog.wird && <span class="badge ok">✓</span>}</button>}
            {!hidden.has('tracker') && <button class="list-item" onClick={() => navigate('/library/tracker')}><Icon name="check" /><span class="grow"><span class="title">{isAr() ? 'متتبع الصلوات' : 'Prayer tracker'}</span><br /><span class="sub">{(() => { const r = user.tracker?.[todayKey()] || {}; const n = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter((p) => (r as Record<string, boolean>)[p]).length; return isAr() ? `${num(n)} / ٥ اليوم` : `${n} / 5 today`; })()}</span></span></button>}
            {!hidden.has('nawafil') && <button class="list-item" onClick={() => navigate('/prayer/nawafil')}><Icon name="sun" /><span class="grow"><span class="title">{t('nawafil')}</span><br /><span class="sub">{isAr() ? 'الضحى، منتصف الليل، الثلث الأخير — بمصدر الحساب' : 'Duha, midnight, last third'}</span></span></button>}
            {!hidden.has('hadith') && hadith && (
              <button class="list-item" onClick={() => navigate(`/library/hadith/nawawi40/${nawawi.data!.chapter}/${hadith.id}`)}><Icon name="library" />
                <span class="grow"><span class="title">{t('hadithOfDay')}</span><br /><span class="sub" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{hadith.ar}</span><br /><span class="sub">{t('nawawi')} · {num(hadith.id)}</span></span>
              </button>
            )}
          </div>
          {settings.showProgress && <p class="muted small" style="margin-top:12px">{isAr() ? 'التقدم شخصي ومحلي ويمكن إخفاؤه من الإعدادات.' : 'Progress is private, on-device, and can be hidden in Settings.'}</p>}
        </>
      )}
      <div class="row" style="margin-top:16px;justify-content:center;gap:16px">
        <button class="btn ghost sm" onClick={() => updateSettings({ quietMode: !quiet })}>{quiet ? (isAr() ? 'إظهار رحلة اليوم' : 'Show my day') : t('quietMode')}</button>
        {!quiet && !dayLog.wird && <button class="btn ghost sm" onClick={() => updateUser((u) => ({ log: { ...u.log, [todayKey()]: { ...dayLog, wird: true } } }))}>{isAr() ? 'قرأت وردي اليوم' : 'Mark wird done'}</button>}
      </div>
    </main>
  );
}
