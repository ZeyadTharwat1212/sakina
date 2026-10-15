/** "الأذكار العائمة" of the reference app, done the honest way: a gentle in-app banner at a chosen frequency while the
 *  app is open (a system-wide overlay needs the native build and the "draw over apps" permission). */
import { useEffect, useState } from 'preact/hooks';
import { useStore } from '../lib/store';
import { getAdhkar, type Dhikr } from '../lib/content';
import { navigate } from '../lib/router';
import { Icon } from './ui';

const INTERVAL: Record<string, number> = { off: 0, rare: 90, low: 45, medium: 20, high: 8 }; // minutes
export function FloatingDhikr() {
  const { settings } = useStore();
  const [item, setItem] = useState<{ d: Dhikr; cat: number } | null>(null);
  const mins = INTERVAL[settings.floatingDhikr] || 0;
  useEffect(() => {
    if (!mins) { setItem(null); return; }
    let alive = true; let timer = 0;
    const show = async () => {
      try {
        const pack = await getAdhkar();
        const cats = pack.categories.filter((c) => /الصباح|المساء|التسبيح|الاستغفار|النوم/.test(c.name));
        const cat = cats[Math.floor(Math.random() * cats.length)];
        const short = cat.items.filter((i) => i.text.length <= 220);
        const d = (short.length ? short : cat.items)[Math.floor(Math.random() * (short.length ? short.length : cat.items.length))];
        if (alive) setItem({ d, cat: cat.id });
      } catch { /* content missing: stay quiet */ }
    };
    timer = window.setInterval(show, mins * 60000);
    const first = window.setTimeout(show, 45000);
    return () => { alive = false; clearInterval(timer); clearTimeout(first); };
  }, [mins]);
  if (!item) return null;
  return (
    <div class="floating-dhikr" role="status">
      <button class="icon-btn" aria-label="close" onClick={() => setItem(null)}><Icon name="close" /></button>
      <div class="grow" onClick={() => { navigate(`/adhkar/session/${item.cat}`); setItem(null); }}>
        <p class="dhikr-text" dir="rtl" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin:0;font-size:.95em">{item.d.text}</p>
        {item.d.ref && <small class="muted">{item.d.ref}</small>}
      </div>
    </div>
  );
}
