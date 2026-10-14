/**
 * Download manager (section 12). Web: Cache Storage (origin-private, offline-capable in the PWA).
 * Native (Capacitor): Filesystem.downloadFile into the app's Data directory.
 * Rules: user-initiated only; queue; pause/resume (Range when the server allows); limited retry; Wi-Fi-only option;
 * integrity (byte count + playability probe); removing files never touches favourites or listening positions.
 */
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { fileUrl, type Recording } from './catalog';

export type DlStatus = 'queued' | 'downloading' | 'paused' | 'done' | 'error';
export interface DlItem { key: string; recId: string; surah: number; url: string; status: DlStatus; received: number; total: number | null; error?: string; attempts: number; doneAt?: number }
interface DlState { items: Record<string, DlItem>; wifiOnly: boolean; order: string[] }

const KEY = 'sakina.downloads';
const CACHE = 'sakina-audio-v1';
const native = Capacitor.isNativePlatform();
const MAX_ATTEMPTS = 3;
let state: DlState = { items: {}, wifiOnly: true, order: [] };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
export const getState = () => state;
export const dlKey = (recId: string, surah: number) => `${recId}#${surah}`;

const partial = new Map<string, Uint8Array[]>();   // web: chunks received for paused/in-flight items (session only)
const controllers = new Map<string, AbortController>();
let active = 0; const CONCURRENCY = 2;

async function persist() {
  const raw = JSON.stringify(state);
  try { if (native) await Preferences.set({ key: KEY, value: raw }); else localStorage.setItem(KEY, raw); } catch { /* ignore */ }
}
export async function initDownloads() {
  try {
    const raw = native ? (await Preferences.get({ key: KEY })).value : localStorage.getItem(KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch { /* fresh */ }
  // Anything that was mid-flight when the app died becomes paused (not "done", not lost).
  for (const it of Object.values(state.items)) if (it.status === 'downloading' || it.status === 'queued') { it.status = 'paused'; it.received = 0; }
  // Verify "done" items still exist (user may have cleared storage).
  for (const it of Object.values(state.items)) if (it.status === 'done' && !(await exists(it))) { it.status = 'error'; it.error = 'missing-file'; }
  emit(); void persist();
}

const localPath = (it: DlItem) => `audio/${it.recId.replace(/[^a-z0-9]/gi, '_')}/${String(it.surah).padStart(3, '0')}.mp3`;
async function exists(it: DlItem): Promise<boolean> {
  try {
    if (native) { await Filesystem.stat({ path: localPath(it), directory: Directory.Data }); return true; }
    const c = await caches.open(CACHE); return !!(await c.match(it.url));
  } catch { return false; }
}
/** Playable source for a downloaded item (file URI on native, blob URL on web) or null if not downloaded. */
export async function localSource(recId: string, surah: number): Promise<string | null> {
  const it = state.items[dlKey(recId, surah)];
  if (!it || it.status !== 'done') return null;
  try {
    if (native) { const { uri } = await Filesystem.getUri({ path: localPath(it), directory: Directory.Data }); return Capacitor.convertFileSrc(uri); }
    const c = await caches.open(CACHE); const r = await c.match(it.url); if (!r) return null; return URL.createObjectURL(await r.blob());
  } catch { return null; }
}
export const isDownloaded = (recId: string, surah: number) => state.items[dlKey(recId, surah)]?.status === 'done';
export const itemOf = (recId: string, surah: number) => state.items[dlKey(recId, surah)] || null;

async function wifiOk(): Promise<boolean> {
  if (!state.wifiOnly) return true;
  try { const s = await Network.getStatus(); return s.connected && (s.connectionType === 'wifi' || s.connectionType === 'unknown'); } catch { return true; }
}
export async function setWifiOnly(v: boolean) { state.wifiOnly = v; emit(); await persist(); void pump(); }

/** Estimate size with HEAD (Content-Length). Returns bytes or null if the server does not tell us. */
export async function headSize(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { method: 'HEAD', mode: 'cors' });
    const len = r.headers.get('content-length'); return len ? Number(len) : null;
  } catch { return null; }
}

export async function enqueue(rec: Recording, surahs: number[]) {
  for (const s of surahs) {
    const key = dlKey(rec.id, s);
    const ex = state.items[key];
    if (ex && (ex.status === 'done' || ex.status === 'downloading' || ex.status === 'queued')) continue;
    state.items[key] = { key, recId: rec.id, surah: s, url: fileUrl(rec, s), status: 'queued', received: 0, total: ex?.total ?? null, attempts: 0 };
    if (!state.order.includes(key)) state.order.push(key);
  }
  emit(); await persist(); void pump();
}
export async function pause(key: string) {
  const it = state.items[key]; if (!it) return;
  controllers.get(key)?.abort(); controllers.delete(key);
  if (it.status === 'downloading' || it.status === 'queued') { it.status = 'paused'; emit(); await persist(); }
}
export async function resume(key: string) {
  const it = state.items[key]; if (!it) return;
  if (it.status === 'paused' || it.status === 'error') { it.status = 'queued'; it.error = undefined; if (it.attempts >= MAX_ATTEMPTS) it.attempts = 0; emit(); await persist(); void pump(); }
}
export async function remove(key: string) {
  const it = state.items[key]; if (!it) return;
  controllers.get(key)?.abort(); controllers.delete(key); partial.delete(key);
  try {
    if (native) await Filesystem.deleteFile({ path: localPath(it), directory: Directory.Data });
    else { const c = await caches.open(CACHE); await c.delete(it.url); }
  } catch { /* already gone */ }
  delete state.items[key]; state.order = state.order.filter((k) => k !== key);
  emit(); await persist();
}
export async function removeRecording(recId: string) { for (const k of Object.keys(state.items)) if (state.items[k].recId === recId) await remove(k); }
export function usageBytes() { return Object.values(state.items).filter((i) => i.status === 'done').reduce((a, i) => a + (i.total || i.received || 0), 0); }

async function pump() {
  if (!(await wifiOk())) return;
  for (const key of state.order) {
    if (active >= CONCURRENCY) return;
    const it = state.items[key];
    if (it && it.status === 'queued') { active++; void run(it).finally(() => { active--; void pump(); }); }
  }
}

async function run(it: DlItem) {
  it.status = 'downloading'; it.attempts++; it.error = undefined; emit();
  try {
    if (native) await runNative(it); else await runWeb(it);
    // integrity: byte count (when known) and playability probe
    if (it.total && it.received !== it.total) throw new Error('size-mismatch');
    if (!(await probePlayable(it))) throw new Error('not-playable');
    it.status = 'done'; it.doneAt = Date.now(); partial.delete(it.key);
  } catch (e) {
    const msg = String((e as Error)?.name === 'AbortError' ? 'paused' : (e as Error)?.message || e);
    if (msg === 'paused') { it.status = 'paused'; }
    else {
      it.status = it.attempts < MAX_ATTEMPTS ? 'queued' : 'error';
      it.error = /cors|failed to fetch|networkerror/i.test(msg) ? 'network-or-cors' : msg;
      if (it.status === 'queued') await new Promise((r) => setTimeout(r, 1500 * it.attempts));
    }
  }
  emit(); await persist();
}

async function runWeb(it: DlItem) {
  const ctrl = new AbortController(); controllers.set(it.key, ctrl);
  const chunks = partial.get(it.key) || [];
  const have = chunks.reduce((a, c) => a + c.byteLength, 0);
  const headers: Record<string, string> = have ? { Range: `bytes=${have}-` } : {};
  const r = await fetch(it.url, { signal: ctrl.signal, headers, mode: 'cors' });
  if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status}`);
  if (have && r.status !== 206) { chunks.length = 0; it.received = 0; } // server ignored Range → start over
  const len = Number(r.headers.get('content-length') || 0);
  if (len) it.total = (r.status === 206 ? have : 0) + len;
  const reader = r.body!.getReader();
  it.received = chunks.reduce((a, c) => a + c.byteLength, 0);
  let last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); it.received += value.byteLength; partial.set(it.key, chunks);
    if (Date.now() - last > 250) { last = Date.now(); emit(); }
  }
  controllers.delete(it.key);
  const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
  const c = await caches.open(CACHE);
  await c.put(it.url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size) } }));
  it.received = blob.size; if (!it.total) it.total = blob.size;
}
async function runNative(it: DlItem) {
  const path = localPath(it);
  const listener = await Filesystem.addListener('progress', (p) => { if (p.url === it.url) { it.received = p.bytes; it.total = p.contentLength || it.total; emit(); } });
  try {
    await Filesystem.downloadFile({ url: it.url, path, directory: Directory.Data, recursive: true, progress: true });
    const st = await Filesystem.stat({ path, directory: Directory.Data });
    it.received = st.size; if (!it.total) it.total = st.size;
  } finally { await listener.remove(); }
}
async function probePlayable(it: DlItem): Promise<boolean> {
  const src = await localSource(it.recId, it.surah);
  if (!src) return false;
  return new Promise((res) => {
    const a = new Audio(); a.preload = 'metadata';
    const t = setTimeout(() => { cleanup(); res(true); }, 8000); // slow devices: don't fail integrity on a timeout alone
    const cleanup = () => { clearTimeout(t); a.removeAttribute('src'); a.load(); if (src.startsWith('blob:')) URL.revokeObjectURL(src); };
    a.addEventListener('loadedmetadata', () => { const ok = isFinite(a.duration) && a.duration > 1; cleanup(); res(ok); });
    a.addEventListener('error', () => { cleanup(); res(false); });
    a.src = src;
  });
}
export const fmtBytes = (n: number | null) => n == null ? '—' : n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;
