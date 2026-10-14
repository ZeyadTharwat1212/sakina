/** Tiny hash router that remembers the last route per tab (section 02: keep state when switching tabs). */
import { useEffect, useState } from 'preact/hooks';

export type Tab = 'today' | 'quran' | 'prayer' | 'adhkar' | 'library';
export const TABS: Tab[] = ['today', 'quran', 'prayer', 'adhkar', 'library'];

export interface Route { path: string; parts: string[]; tab: Tab | 'settings' | 'onboarding'; query: URLSearchParams }

const lastPerTab = new Map<string, string>();

export function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [p, q] = raw.split('?');
  const parts = p.split('/').filter(Boolean);
  const tab = (parts[0] || 'today') as Route['tab'];
  return { path: p, parts, tab, query: new URLSearchParams(q || '') };
}
export function navigate(path: string, replace = false) {
  const h = '#' + path;
  if (replace) history.replaceState(null, '', h); else location.hash = path;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}
export function back() { if (history.length > 1) history.back(); else navigate('/'); }
export function goTab(tab: Tab) { navigate(lastPerTab.get(tab) ?? (tab === 'today' ? '/' : `/${tab}`)); }

export function useRoute(): Route {
  const [r, setR] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => { const nr = parse(location.hash); if (TABS.includes(nr.tab as Tab)) lastPerTab.set(nr.tab, nr.path); setR(nr); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    on();
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
