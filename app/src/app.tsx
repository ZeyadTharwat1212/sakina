import { useEffect } from 'preact/hooks';
import { useRoute, goTab, TABS, type Tab } from './lib/router';
import { useStore, applyTheme } from './lib/store';
import { t } from './lib/i18n';
import { Icon } from './components/ui';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { QuranIndex, QuranReader } from './screens/Quran';
import { PrayerHome, PrayerSettingsScreen, QiblaScreen, DiagnosticsScreen, NawafilScreen, CityScreen } from './screens/Prayer';
import { AdhkarHome, DhikrSession, Tasbih } from './screens/Adhkar';
import { LibraryHome, HadithBook, HadithChapterScreen, SearchScreen, SourcesScreen } from './screens/Library';
import { SettingsScreen } from './screens/Settings';
import { MiniPlayer } from './screens/Player';

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
        : p[1] === 'page' ? <QuranReader page={Number(p[2]) || 1} />
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
      <MiniPlayer />
      <nav class="tabbar" aria-label="التنقل الرئيسي">
        {TABS.map((tb) => (
          <button key={tb} aria-current={tab === tb && route.tab !== 'settings' ? 'page' : undefined} onClick={() => goTab(tb)}>
            <Icon name={icons[tb]} /><span>{t(tb)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
