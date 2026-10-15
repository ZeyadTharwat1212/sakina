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
    back: 'M15 18l-6-6 6-6',
    today: 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4',
    quran: 'M4 19V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h12M9 7h6M9 11h4',
    prayer: 'M12 2v4M12 6a6 6 0 0 1 6 6v8H6v-8a6 6 0 0 1 6-6zM3 22h18',
    adhkar: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 3M20 3l1 1-2 2-1-1z',
    library: 'M3 4h5v16H3zM10 4h5v16h-5zM17 6l4-1 2 15-4 1z',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    play: 'M6 4l14 8-14 8z', pause: 'M7 4h4v16H7zM13 4h4v16h-4z', close: 'M6 6l12 12M18 6L6 18',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4', star: 'M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 9.9 9.1 9z',
    more: 'M12 6h.01M12 12h.01M12 18h.01', share: 'M4 12v8h16v-8M12 3v13M8 7l4-4 4 4', copy: 'M8 8h12v12H8zM4 16V4h12',
    check: 'M4 12l5 5L20 6', undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3', compass: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4-4l-3 7-7 3 3-7z',
    pin: 'M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
    sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5 5l-1.5-1.5M19 19l1.5 1.5M5 19l-1.5 1.5M19 5l1.5-1.5M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', book: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z',
    info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8h.01M12 12v5',
    download: 'M12 3v12M6 9l6 6 6-6M4 20h16', moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', next: 'M9 6l6 6-6 6', refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="24" height="24"><path d={p[name] || ''} /></svg>;
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
