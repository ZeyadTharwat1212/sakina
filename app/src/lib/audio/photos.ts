/** Reciter photos (Wikimedia Commons, free licences) — content/audio/reciter-photos.json. */
export interface ReciterPhoto { src: string; page: string; w: number; h: number; crop: [number, number, number]; licence: string; author: string }
let photosP: Promise<Record<string, ReciterPhoto>> | null = null;
let photosNow: Record<string, ReciterPhoto> | null = null;
export function loadPhotos() { return (photosP ||= fetch('content/audio/reciter-photos.json').then((r) => r.json()).then((j) => (photosNow = j.photos || {})).catch(() => (photosNow = {}))); }
export const photosSync = () => photosNow;

/** Square, face-cropped artwork for the lock screen (data URL), cached per reciter; null when the image can't be read. */
const artCache = new Map<string, Promise<string | null>>();
export function squareArtwork(id: string, size = 512): Promise<string | null> {
  if (!artCache.has(id)) artCache.set(id, (async () => {
    const p = (await loadPhotos())[id]; if (!p) return null;
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = p.src;
    await img.decode();
    const [x, y, w] = p.crop; const side = w * img.naturalWidth;
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    cv.getContext('2d')!.drawImage(img, x * img.naturalWidth - side / 2, y * img.naturalHeight - side / 2, side, side, 0, 0, size, size);
    return cv.toDataURL('image/jpeg', 0.88);
  })().catch(() => null));
  return artCache.get(id)!;
}
