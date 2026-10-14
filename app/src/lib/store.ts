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
  quranMode: 'ayah' | 'page';
  reciterId: string | null;
  location: Location | null;
  prayer: PrayerSettings;
  hiddenCards: string[];
  showProgress: boolean;
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
  tasbih: { count: number; target: number };
  log: Record<string, { adhkarMorning?: boolean; adhkarEvening?: boolean; wird?: boolean }>; // private daily log
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
};
export const DEFAULT_USER: UserData = {
  lastRead: null, lastListen: null, bookmarks: [], favAdhkar: [], favHadith: [], sessions: {},
  tasbih: { count: 0, target: 33 }, log: {},
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
  if (s) { try { settings = { ...DEFAULT_SETTINGS, ...JSON.parse(s), prayer: { ...DEFAULT_SETTINGS.prayer, ...(JSON.parse(s).prayer || {}) } }; } catch { /* keep defaults */ } }
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
  root.setAttribute('dir', settings.lang === 'ar' ? 'rtl' : 'ltr');
  root.style.setProperty('--ui-scale', String(settings.simpleMode ? Math.max(1.2, settings.uiScale) : settings.uiScale));
  root.style.setProperty('--quran-size', `${settings.quranSize}px`);
  root.style.setProperty('--body-size', `${settings.bodySize}px`);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#101C18' : t === 'paper' ? '#F1E8D6' : '#F7F4EC');
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
