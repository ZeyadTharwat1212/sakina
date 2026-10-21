/**
 * Local-first state. Everything lives on the device (section 32):
 * settings, last reading position, bookmarks, adhkar sessions, favourites.
 * No account, no sync in Phase 1. Export/delete are provided in Settings.
 */
import { useEffect, useState } from 'preact/hooks';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export type Theme = 'auto' | 'light' | 'dark' | 'paper';
export type Lang = 'ar' | 'en';

export interface Location {
  name: string;          // display name (city)
  lat: number;
  lng: number;
  tz: string;            // IANA zone of the *city* (section 14: never the device zone for a saved city)
  source: 'gps' | 'manual';
  updatedAt: number;     // epoch ms — shown as "آخر تحديث للموقع"
}

export interface PrayerSettings {
  method: string;        // key in prayer.ts METHODS
  madhab: 'shafi' | 'hanafi';
  highLat: 'MiddleOfTheNight' | 'SeventhOfTheNight' | 'TwilightAngle';
  adjust: { fajr: number; sunrise: number; dhuhr: number; asr: number; maghrib: number; isha: number };
  duhaOffsetMin: number; // user-chosen minutes after sunrise for *their* Duha reminder (not a ruling)
  notify: { fajr: boolean; dhuhr: boolean; asr: boolean; maghrib: boolean; isha: boolean };
  notifyMode: 'notification' | 'silent';
  preMinutes: number;    // reminder before prayer (0 = off)
}

export interface Settings {
  lang: Lang;
  theme: Theme;
  uiScale: number;       // 1 .. 1.4
  quranSize: number;     // px
  bodySize: number;      // px
  reduceMotion: boolean;
  simpleMode: boolean;   // كبار السن
  quietMode: boolean;    // الوضع الهادئ على صفحة اليوم
  keepAwake: boolean;
  onboarded: boolean;
  goal: 'prayer' | 'reading' | 'hifz' | 'adhkar' | 'general' | null;
  hijriAdjust: number;   // ±days, user correction (section 26)
  hijriAuthority: string; // free text: which announcement they follow
  tafsir: 'jalalayn' | 'muyassar';
  showTranslation: boolean;
  quranMode: 'ayah' | 'page' | 'mushaf';
  reciterId: string | null;
  location: Location | null;
  prayer: PrayerSettings;
  hiddenCards: string[];
  showProgress: boolean;
  reminders: { fridayKahf: boolean; fridaySalawat: boolean; sunrise: boolean; duha: boolean; lastThird: boolean; trackerEvening: boolean; fastEve: boolean };
  numerals: 'auto' | 'ar' | 'en';
  kahfTime: string;              // "HH:MM" local time for the Friday Kahf reminder
  salawat: { perDay: number; fridayOnly: boolean }; // salawat reminders spread between sunrise and isha
  adhkarReminders: { morning: boolean; morningAt: string; evening: boolean; eveningAt: string; sleep: boolean; sleepAt: string };
  floatingDhikr: 'off' | 'rare' | 'low' | 'medium' | 'high'; // in-app gentle dhikr banner while the app is open
  qiyam: { third: 'off' | 'first' | 'second' | 'last'; beforeFajrMin: number; witr: boolean };
  fajrAlarm: { on: boolean; offsetMin: number; repeatMin: number };
  ramadan: { iftar: boolean; suhoor: boolean; suhoorMin: number; qadr: boolean; chime: boolean };
  uiFont: 'readex' | 'plex' | 'noto';
  quranFont: 'kfgqpc' | 'hafs' | 'amiri';
  quranLine: number;           // line-height multiplier for ayah text
  tajweed: boolean;            // colour tajweed rules in ayah/text modes
  translationId: string;       // which translation shows under ayahs (translations/catalog.json)
  tafsirId: string;            // any id from tafsir/catalog.json (replaces the 2-value `tafsir` when set)
  mushafSize: number;          // px, page mode
  ayahReciter: string;         // per-ayah audio reciter id (audio/ayah-sources.json)
  ayahRepeat: number;          // repeat each ayah N times in ayah-by-ayah playback
  audioQuality: 'hq' | 'lite'; // lite = smallest copy of the same recording (½–⅛ size)
  followMode: 'word' | 'ayah'; // how the mushaf follows the recitation
}

export interface ReadingPosition { ch: number; v: number; page: number; at: number; kind: 'read' | 'listen' }
export interface Bookmark { id: string; ch: number; v: number; tag: 'reading' | 'hifz' | 'review'; note?: string; at: number }
export interface DhikrSession { catId: number; progress: Record<number, number>; startedAt: number; completedAt?: number }
export interface UserData {
  lastRead: ReadingPosition | null;
  lastListen: ReadingPosition | null;
  bookmarks: Bookmark[];
  favAdhkar: number[];
  favHadith: string[];       // "bukhari:123"
  sessions: Record<string, DhikrSession>; // key = `${catId}:${yyyy-mm-dd}`
  tasbih: { count: number; target: number; label?: string; total?: number };
  log: Record<string, { adhkarMorning?: boolean; adhkarEvening?: boolean; wird?: boolean }>; // private daily log
  listenPos?: Record<string, number>; // `${recordingId}#${surah}` → seconds
  tracker?: Record<string, { fajr?: boolean; dhuhr?: boolean; asr?: boolean; maghrib?: boolean; isha?: boolean; duha?: boolean; witr?: boolean; qiyam?: boolean; fast?: boolean; skipped?: string[] }>; // yyyy-mm-dd → private log
  khatma?: { startDate: string; days: number; startPage: number; createdAt: number } | null;
  myDuas?: { id: string; text: string; at: number }[];
  zakat?: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'ar', theme: 'auto', uiScale: 1, quranSize: 28, bodySize: 18, reduceMotion: false, simpleMode: false,
  quietMode: false, keepAwake: false, onboarded: false, goal: null, hijriAdjust: 0, hijriAuthority: '',
  tafsir: 'muyassar', showTranslation: false, quranMode: 'ayah', reciterId: null, location: null,
  prayer: {
    method: 'Egyptian', madhab: 'shafi', highLat: 'MiddleOfTheNight',
    adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
    duhaOffsetMin: 20, notify: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
    notifyMode: 'notification', preMinutes: 0,
  },
  hiddenCards: [], showProgress: true,
  reminders: { fridayKahf: false, fridaySalawat: false, sunrise: false, duha: false, lastThird: false, trackerEvening: false, fastEve: false },
  numerals: 'auto', kahfTime: '09:00', salawat: { perDay: 3, fridayOnly: true },
  adhkarReminders: { morning: false, morningAt: '07:00', evening: false, eveningAt: '17:30', sleep: false, sleepAt: '22:30' },
  floatingDhikr: 'off',
  qiyam: { third: 'off', beforeFajrMin: 0, witr: false },
  fajrAlarm: { on: false, offsetMin: 0, repeatMin: 5 },
  ramadan: { iftar: false, suhoor: false, suhoorMin: 45, qadr: false, chime: true },
  uiFont: 'readex', quranFont: 'kfgqpc', quranLine: 2.15, tajweed: false, translationId: 'en-saheeh', tafsirId: 'muyassar', mushafSize: 0, ayahReciter: 'alafasy', ayahRepeat: 1, audioQuality: 'lite', followMode: 'word',
};
export const DEFAULT_USER: UserData = {
  lastRead: null, lastListen: null, bookmarks: [], favAdhkar: [], favHadith: [], sessions: {},
  tasbih: { count: 0, target: 33 }, log: {}, listenPos: {}, tracker: {}, khatma: null, myDuas: [],
};

type Listener = () => void;
const listeners = new Set<Listener>();
let settings: Settings = structuredClone(DEFAULT_SETTINGS);
let user: UserData = structuredClone(DEFAULT_USER);
let ready = false;

const native = Capacitor.isNativePlatform();
async function readKey(key: string): Promise<string | null> {
  if (native) return (await Preferences.get({ key })).value;
  try { return localStorage.getItem(key); } catch { return null; }
}
async function writeKey(key: string, value: string) {
  if (native) { await Preferences.set({ key, value }); return; }
  try { localStorage.setItem(key, value); } catch { /* storage unavailable: state stays in memory */ }
}

export async function initStore() {
  const [s, u] = await Promise.all([readKey('sakina.settings'), readKey('sakina.user')]);
  if (s) { try { const j = JSON.parse(s); settings = { ...DEFAULT_SETTINGS, ...j };
      for (const k of ['prayer', 'reminders', 'salawat', 'adhkarReminders', 'qiyam', 'fajrAlarm', 'ramadan'] as const) (settings as unknown as Record<string, unknown>)[k] = { ...(DEFAULT_SETTINGS[k] as object), ...((j[k] as object) || {}) }; } catch { /* keep defaults */ } }
  if (u) { try { user = { ...DEFAULT_USER, ...JSON.parse(u) }; } catch { /* keep defaults */ } }
  ready = true;
  applyTheme();
  emit();
}

function emit() { listeners.forEach((l) => l()); }
export function getSettings() { return settings; }
export function getUser() { return user; }
export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  void writeKey('sakina.settings', JSON.stringify(settings));
  applyTheme();
  emit();
}
export function updatePrayer(patch: Partial<PrayerSettings>) {
  updateSettings({ prayer: { ...settings.prayer, ...patch } });
}
export function updateUser(patch: Partial<UserData> | ((u: UserData) => Partial<UserData>)) {
  const p = typeof patch === 'function' ? patch(user) : patch;
  user = { ...user, ...p };
  void writeKey('sakina.user', JSON.stringify(user));
  emit();
}
export async function wipeAll() {
  settings = structuredClone(DEFAULT_SETTINGS);
  user = structuredClone(DEFAULT_USER);
  await writeKey('sakina.settings', JSON.stringify(settings));
  await writeKey('sakina.user', JSON.stringify(user));
  applyTheme();
  emit();
}
export function exportAll() {
  return JSON.stringify({ exportedAt: new Date().toISOString(), settings, user }, null, 2);
}

export function applyTheme() {
  const root = document.documentElement;
  const t = settings.theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.theme;
  root.setAttribute('data-theme', t);
  root.setAttribute('data-motion', settings.reduceMotion ? 'reduce' : 'normal');
  root.setAttribute('data-simple', settings.simpleMode ? '1' : '0');
  root.setAttribute('lang', settings.lang);
  root.setAttribute('data-ui-font', settings.uiFont);
  root.setAttribute('data-quran-font', settings.quranFont);
  root.style.setProperty('--quran-line', String(settings.quranLine));
  root.setAttribute('dir', settings.lang === 'ar' ? 'rtl' : 'ltr');
  root.style.setProperty('--ui-scale', String(settings.simpleMode ? Math.max(1.2, settings.uiScale) : settings.uiScale));
  root.style.setProperty('--quran-size', `${settings.quranSize}px`);
  root.style.setProperty('--body-size', `${settings.bodySize}px`);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#141917' : t === 'paper' ? '#F3EEE3' : '#F6F5F1');
}

/** Hook: re-render when settings/user change. */
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return { settings, user, ready };
}

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
