import { useEffect, useState } from 'preact/hooks';
import { getNowPlaying, subscribeNowPlaying } from '../lib/audio/nowplaying';
import { num } from '../lib/i18n';

/** The ayah being recited right now (only when known), fading in as the recitation moves on. */
export function NowAyah() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); const u = subscribeNowPlaying(f); addEventListener('hashchange', f); return () => { u(); removeEventListener('hashchange', f); }; }, []);
  const n = getNowPlaying();
  if (!n || !n.text || !n.v) return null;
  if (/^#\/quran\/(read|page|text)\//.test(location.hash)) return null; // the page itself highlights the ayah there
  return <div class="np-ayah" key={`${n.ch}:${n.v}`} dir="rtl" lang="ar"><span class="np-orn">﴿</span>{n.text}<span class="np-orn">﴾</span><span class="np-no num">{num(n.v)}</span></div>;
}
