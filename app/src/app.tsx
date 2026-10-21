import { useEffect } from 'preact/hooks';
import { useRoute, goTab, TABS, type Tab } from './lib/router';
import { useStore, applyTheme } from './lib/store';
import { t } from './lib/i18n';
import { Icon, TabIcon } from './components/ui';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { QuranIndex, QuranReader } from './screens/Quran';
import { MushafScreen, AyahDock } from './screens/Mushaf';
import { PrayerHome, PrayerSettingsScreen, QiblaScreen, DiagnosticsScreen, NawafilScreen, CityScreen } from './screens/Prayer';
import { AdhkarHome, DhikrSession, Tasbih } from './screens/Adhkar';
import { LibraryHome, HadithBook, HadithChapterScreen, SearchScreen, SourcesScreen, TafsirLibrary, TranslationsLibrary } from './screens/Library';
import { SettingsScreen } from './screens/Settings';
import { MiniPlayer } from './screens/Player';
import { ReciterLibrary, ReciterPage, DownloadsManager, AyahDownloads } from './screens/Audio';
import { TrackerScreen, HijriScreen, KhatmaScreen, AsmaScreen, MosquesScreen, WallpapersScreen, DuasScreen } from './screens/Tools';
import { RamadanScreen, FastingScreen, QiyamScreen, FajrAlarmScreen, TeachScreen, CardsScreen, HelpScreen, ZakatScreen } from './screens/More';
import { FloatingDhikr } from './components/FloatingDhikr';

export function App() {
  const route = useRoute();
  const { settings } = useStore();

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  if (!settings.onboarded || route.tab === 'onboarding') return <Onboarding />;

  const p = route.parts;
  let screen: preact.JSX.Element;
  switch (route.tab) {
    case 'quran':
      screen = p[1] === 'read' ? <QuranReader ch={Number(p[2]) || 1} v={Number(p[3]) || 1} />
        : p[1] === 'page' ? <MushafScreen page={Math.min(604, Math.max(1, Number(p[2]) || 1))} follow={route.query.get('follow') === '0' ? false : undefined} />
        : p[1] === 'text' ? <QuranReader page={Number(p[2]) || 1} />
        : p[1] === 'reciters' && p[2] ? <ReciterPage id={p[2]} playAfter={route.query.get('play') ? Number(route.query.get('play')) : undefined} range={route.query.get('from') ? { from: Number(route.query.get('from')), to: Number(route.query.get('to') || route.query.get('from')) } : undefined} />
        : p[1] === 'reciters' ? <ReciterLibrary playSurahAfter={route.query.get('play') ? Number(route.query.get('play')) : undefined} range={route.query.get('from') ? { from: Number(route.query.get('from')), to: Number(route.query.get('to') || route.query.get('from')) } : undefined} />
        : p[1] === 'downloads' ? <DownloadsManager />
        : p[1] === 'compact' ? <AyahDownloads reciter={p[2]} />
        : <QuranIndex />;
      break;
    case 'prayer':
      screen = p[1] === 'settings' ? <PrayerSettingsScreen /> : p[1] === 'qibla' ? <QiblaScreen /> : p[1] === 'diagnostics' ? <DiagnosticsScreen />
        : p[1] === 'nawafil' ? <NawafilScreen /> : p[1] === 'city' ? <CityScreen /> : <PrayerHome />;
      break;
    case 'adhkar':
      screen = p[1] === 'session' ? <DhikrSession catId={Number(p[2])} /> : p[1] === 'tasbih' ? <Tasbih /> : <AdhkarHome />;
      break;
    case 'library':
      screen = p[1] === 'hadith' && p[3] ? <HadithChapterScreen book={p[2]} chapter={Number(p[3])} focus={p[4] ? Number(p[4]) : undefined} />
        : p[1] === 'hadith' && p[2] ? <HadithBook book={p[2]} />
        : p[1] === 'search' ? <SearchScreen q={route.query.get('q') || ''} />
        : p[1] === 'tracker' ? <TrackerScreen /> : p[1] === 'hijri' ? <HijriScreen /> : p[1] === 'khatma' ? <KhatmaScreen />
        : p[1] === 'asma' ? <AsmaScreen /> : p[1] === 'mosques' ? <MosquesScreen /> : p[1] === 'wallpapers' ? <WallpapersScreen /> : p[1] === 'duas' ? <DuasScreen />
        : p[1] === 'ramadan' ? <RamadanScreen /> : p[1] === 'fasting' ? <FastingScreen /> : p[1] === 'qiyam' ? <QiyamScreen /> : p[1] === 'fajr-alarm' ? <FajrAlarmScreen />
        : p[1] === 'teach' ? <TeachScreen id={p[2]} /> : p[1] === 'cards' ? <CardsScreen /> : p[1] === 'help' ? <HelpScreen />
        : p[1] === 'tafsirs' ? <TafsirLibrary /> : p[1] === 'translations' ? <TranslationsLibrary /> : p[1] === 'zakat' ? <ZakatScreen />
        : p[1] === 'sources' ? <SourcesScreen /> : <LibraryHome />;
      break;
    case 'settings': screen = <SettingsScreen />; break;
    default: screen = <Today />;
  }
  const tab = (TABS.includes(route.tab as Tab) ? route.tab : 'today') as Tab;
  const icons: Record<Tab, string> = { today: 'today', quran: 'quran', prayer: 'prayer', adhkar: 'adhkar', library: 'library' };
  return (
    <div class="app">
      {screen}
      <FloatingDhikr />
      <AyahDock onMushaf={route.tab === 'quran' && p[1] === 'page'} />
      <MiniPlayer />
      <nav class="tabbar" aria-label="التنقل الرئيسي">
        {TABS.map((tb) => { const on = tab === tb && route.tab !== 'settings'; return (
          <button key={tb} aria-current={on ? 'page' : undefined} onClick={() => goTab(tb)}>
            <span class="tab-pill"><TabIcon name={icons[tb]} active={on} /></span><span class="tab-label">{t(tb)}</span>
          </button>); })}
      </nav>
    </div>
  );
}
