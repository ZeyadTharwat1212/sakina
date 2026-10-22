import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { back } from '../lib/router';
import { t } from '../lib/i18n';

export function TopBar({ title, onBack, right, children }: { title: string; onBack?: boolean | (() => void); right?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <header class="topbar">
      {onBack && <button class="back" aria-label={t('back')} onClick={() => (typeof onBack === 'function' ? onBack() : back())}><Icon name="back" /></button>}
      <h1>{title}</h1>
      {children}
      {right}
    </header>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ComponentChildren }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="handle" />
        {title && <h2 style="margin-bottom:12px">{title}</h2>}
        {children}
      </div>
    </>
  );
}

export function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button class="switch" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span><span style="font-weight:600">{label}</span>{sub && <><br /><small class="muted">{sub}</small></>}</span>
      <span class="knob" aria-hidden="true" />
    </button>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="group">
      {options.map((o) => <button key={o.v} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.label}</button>)}
    </div>
  );
}

export function Notice({ kind = 'warn', children, action, onAction }: { kind?: 'warn' | 'info'; children: ComponentChildren; action?: string; onAction?: () => void }) {
  return (
    <div class={`notice ${kind === 'info' ? 'info' : ''}`} role="status">
      <span>{children}</span>
      {action && <button class="act" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function Icon({ name }: { name: string }) {
  const p: Record<string, string> = {
    "headphones": "M4 13m0 2a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2z M15 13m0 2a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2z M4 15v-3a8 8 0 0 1 16 0v3",
    "checklist": "M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8 M14 19l2 2l4 -4 M9 8h4 M9 12h2",
    "calmonth": "M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z M16 3v4 M8 3v4 M4 11h16 M8 14v4 M12 14v4 M16 14v4",
    "book2": "M19 4v16h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12z M19 16h-12a2 2 0 0 0 -2 2 M9 8h6",
    "sparkles": "M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z",
    "mosque": "M3 21h7v-2a2 2 0 1 1 4 0v2h7 M4 21v-10 M20 21v-10 M4 16h3v-3h10v3h3 M17 13a5 5 0 0 0 -10 0 M21 10.5c0 -.329 -.077 -.653 -.224 -.947l-.776 -1.553l-.776 1.553a2.118 2.118 0 0 0 -.224 .947a.5 .5 0 0 0 .5 .5h1a.5 .5 0 0 0 .5 -.5z M5 10.5c0 -.329 -.077 -.653 -.224 -.947l-.776 -1.553l-.776 1.553a2.118 2.118 0 0 0 -.224 .947a.5 .5 0 0 0 .5 .5h1a.5 .5 0 0 0 .5 -.5z M12 2a2 2 0 1 0 2 2 M12 6v2",
    "moonstars": "M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2 M19 11h2m-1 -1v2",
    "calheart": "M11.5 21h-5.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4 M16 3v4 M8 3v4 M4 11h16 M18 22l3.35 -3.284a2.143 2.143 0 0 0 .005 -3.071a2.242 2.242 0 0 0 -3.129 -.006l-.224 .22l-.223 -.22a2.242 2.242 0 0 0 -3.128 -.006a2.143 2.143 0 0 0 -.006 3.071l3.355 3.296z",
    "moon2": "M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z",
    "alarm": "M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M12 10l0 3l2 0 M7 4l-2.75 2 M17 4l2.75 2",
    "school": "M22 9l-10 -4l-10 4l10 4l10 -4v6 M6 10.6v5.4a6 3 0 0 0 12 0v-5.4",
    "gift": "M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z M12 8l0 13 M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7 M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5",
    "coins": "M9 14c0 1.657 2.686 3 6 3s6 -1.343 6 -3s-2.686 -3 -6 -3s-6 1.343 -6 3z M9 14v4c0 1.656 2.686 3 6 3s6 -1.344 6 -3v-4 M3 6c0 1.072 1.144 2.062 3 2.598s4.144 .536 6 0c1.856 -.536 3 -1.526 3 -2.598c0 -1.072 -1.144 -2.062 -3 -2.598s-4.144 -.536 -6 0c-1.856 .536 -3 1.526 -3 2.598z M3 6v10c0 .888 .772 1.45 2 2 M3 11c0 .888 .772 1.45 2 2",
    "notebook": "M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-11a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1m3 0v18 M13 8l2 0 M13 12l2 0",
    "duas": "M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572 M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25 M12.5 15.5l2 2 M15 13l2 2",
    "photo": "M15 8h.01 M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5 M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3",
    "books": "M5 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z M9 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z M5 8h4 M9 16h4 M13.803 4.56l2.184 -.53c.562 -.135 1.133 .19 1.282 .732l3.695 13.418a1.02 1.02 0 0 1 -.634 1.219l-.133 .041l-2.184 .53c-.562 .135 -1.133 -.19 -1.282 -.732l-3.695 -13.418a1.02 1.02 0 0 1 .634 -1.219l.133 -.041z M14 9l4 -1 M16 16l3.923 -.98",
    "sunrise": "M3 17h1m16 0h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7m-9.7 5.7a4 4 0 0 1 8 0 M3 21l18 0 M12 9v-6l3 3m-6 0l3 -3",
    "help": "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0 M12 16v.01 M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483",

    "back": "M15 6l-6 6l6 6",
    "next": "M9 6l6 6l-6 6",
    "chevron-down": "M6 9l6 6l6 -6",
    "today": "M4 5m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z M16 3l0 4 M8 3l0 4 M4 11l16 0 M8 15h2v2h-2z",
    "quran": "M19 4v16h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12z M19 16h-12a2 2 0 0 0 -2 2 M9 8h6",
    "prayer": "M3 21h7v-2a2 2 0 1 1 4 0v2h7 M4 21v-10 M20 21v-10 M4 16h3v-3h10v3h3 M17 13a5 5 0 0 0 -10 0 M21 10.5c0 -.329 -.077 -.653 -.224 -.947l-.776 -1.553l-.776 1.553a2.118 2.118 0 0 0 -.224 .947a.5 .5 0 0 0 .5 .5h1a.5 .5 0 0 0 .5 -.5z M5 10.5c0 -.329 -.077 -.653 -.224 -.947l-.776 -1.553l-.776 1.553a2.118 2.118 0 0 0 -.224 .947a.5 .5 0 0 0 .5 .5h1a.5 .5 0 0 0 .5 -.5z M12 2a2 2 0 1 0 2 2 M12 6v2",
    "adhkar": "M5 7.2a2.2 2.2 0 0 1 2.2 -2.2h1a2.2 2.2 0 0 0 1.55 -.64l.7 -.7a2.2 2.2 0 0 1 3.12 0l.7 .7c.412 .41 .97 .64 1.55 .64h1a2.2 2.2 0 0 1 2.2 2.2v1c0 .58 .23 1.138 .64 1.55l.7 .7a2.2 2.2 0 0 1 0 3.12l-.7 .7a2.2 2.2 0 0 0 -.64 1.55v1a2.2 2.2 0 0 1 -2.2 2.2h-1a2.2 2.2 0 0 0 -1.55 .64l-.7 .7a2.2 2.2 0 0 1 -3.12 0l-.7 -.7a2.2 2.2 0 0 0 -1.55 -.64h-1a2.2 2.2 0 0 1 -2.2 -2.2v-1a2.2 2.2 0 0 0 -.64 -1.55l-.7 -.7a2.2 2.2 0 0 1 0 -3.12l.7 -.7a2.2 2.2 0 0 0 .64 -1.55v-1",
    "library": "M5 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z M9 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z M5 8h4 M9 16h4 M13.803 4.56l2.184 -.53c.562 -.135 1.133 .19 1.282 .732l3.695 13.418a1.02 1.02 0 0 1 -.634 1.219l-.133 .041l-2.184 .53c-.562 .135 -1.133 -.19 -1.282 -.732l-3.695 -13.418a1.02 1.02 0 0 1 .634 -1.219l.133 -.041z M14 9l4 -1 M16 16l3.923 -.98",
    "settings": "M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",
    "play": "M7 4v16l13 -8z",
    "pause": "M6 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z M14 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z",
    "close": "M18 6l-12 12 M6 6l12 12",
    "search": "M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M21 21l-6 -6",
    "star": "M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z",
    "more": "M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
    "share": "M8 9h-1a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-8a2 2 0 0 0 -2 -2h-1 M12 14v-11 M9 6l3 -3l3 3",
    "copy": "M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1",
    "check": "M5 12l5 5l10 -10",
    "undo": "M9 14l-4 -4l4 -4 M5 10h11a4 4 0 1 1 0 8h-1",
    "compass": "M8 16l2 -6l6 -2l-2 6l-6 2 M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 3l0 2 M12 19l0 2 M3 12l2 0 M19 12l2 0",
    "pin": "M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0 M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z",
    "bell": "M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6 M9 17v1a3 3 0 0 0 6 0v-1",
    "sun": "M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7",
    "book": "M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0 M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0 M3 6l0 13 M12 6l0 13 M21 6l0 13",
    "info": "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0 M12 9h.01 M11 12h1v4h1",
    "download": "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2 M7 11l5 5l5 -5 M12 4l0 12",
    "refresh": "M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4 M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4",
    "moon": "M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2 M19 11h2m-1 -1v2"
};
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="24" height="24"><path d={p[name] || ''} /></svg>;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; loading: boolean } {
  const [s, set] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    set((x) => ({ ...x, loading: true, error: null }));
    fn().then((d) => alive && set({ data: d, error: null, loading: false })).catch((e) => alive && set({ data: null, error: String(e?.message || e), loading: false }));
    return () => { alive = false; };
  }, deps);
  return s;
}

export function Loading({ error }: { error?: string | null }) {
  if (error) return <div class="notice">تعذّر تحميل المحتوى: {error}</div>;
  return <p class="muted" style="padding:24px;text-align:center">…</p>;
}

export async function shareText(text: string, title = 'سكينة') {
  const nav = navigator as Navigator & { share?: (d: { text: string; title: string }) => Promise<void> };
  if (nav.share) { try { await nav.share({ text, title }); return true; } catch { return false; } }
  return copyText(text);
}
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

/** Bottom-tab icons: hand-drawn duotone set (soft fill + 1.7px line), designed for the five sections. */
export function TabIcon({ name, active }: { name: string; active: boolean }) {
  const fill = active ? 'currentColor' : 'none';
  const fo = active ? 0.2 : 0;
  const parts: Record<string, preact.JSX.Element> = {
    today: (<>
      <path d="M5 21V11.5a7 7 0 0 1 14 0V21z" fill={fill} fill-opacity={fo} />
      <path d="M5 21V11.5a7 7 0 0 1 14 0V21" />
      <path d="M13.6 10.2a2.6 2.6 0 1 0 0 3.6 3.2 3.2 0 0 1 0-3.6z" fill={active ? 'currentColor' : 'none'} />
      <path d="M3 21h18" /><path d="M12 2.6v1.6" />
    </>),
    quran: (<>
      <path d="M12 6.2C9.8 4.7 6.9 4.2 4 4.6v11.2c2.9-.4 5.8.1 8 1.6 2.2-1.5 5.1-2 8-1.6V4.6c-2.9-.4-5.8.1-8 1.6z" fill={fill} fill-opacity={fo} />
      <path d="M12 6.2C9.8 4.7 6.9 4.2 4 4.6v11.2c2.9-.4 5.8.1 8 1.6 2.2-1.5 5.1-2 8-1.6V4.6c-2.9-.4-5.8.1-8 1.6z" />
      <path d="M12 6.2v11.2" /><path d="M7 21.2l10-3.6M17 21.2L7 17.6" />
    </>),
    prayer: (<>
      <path d="M6.5 13a5.5 5.5 0 0 1 11 0z M6 13h12v8H6z" fill={fill} fill-opacity={fo} />
      <path d="M6.5 13a5.5 5.5 0 0 1 11 0" /><path d="M6 13h12v8H6z" />
      <path d="M12 5.2V7.5" /><circle cx="12" cy="4.2" r="1" fill="currentColor" stroke="none" />
      <path d="M10.4 21v-2.6a1.6 1.6 0 0 1 3.2 0V21" />
      <path d="M20.5 21V10.5M19.5 10.5h2M20.5 10.5V8.8M3.5 21V10.5M2.5 10.5h2M3.5 10.5V8.8" />
    </>),
    adhkar: (<>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = (a * Math.PI) / 180; return <circle key={a} cx={12 + 5.6 * Math.cos(r)} cy={9.6 + 5.6 * Math.sin(r)} r="1.55" fill={active ? 'currentColor' : 'none'} fill-opacity={active ? 0.9 : 0} />; })}
      <path d="M12 15.2v2.6" /><path d="M10.3 21.4l1.7-3.4 1.7 3.4" />
    </>),
    library: (<>
      <path d="M4 4.5h3.6v15.5H4z M9.2 6.5h3.6V20H9.2z M14.6 6.2l3.4-.9 3.3 13.8-3.4.9z" fill={fill} fill-opacity={fo} />
      <path d="M4 4.5h3.6v15.5H4z" /><path d="M9.2 6.5h3.6V20H9.2z" /><path d="M14.6 6.2l3.4-.9 3.3 13.8-3.4.9z" />
      <path d="M4 8h3.6M9.2 9.5h3.6M2.5 20.5h19" />
    </>),
  };
  return <svg class="tab-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="26" height="26">{parts[name]}</svg>;
}
