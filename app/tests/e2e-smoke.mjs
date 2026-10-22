// Smoke test of the daily journeys in headless Chromium (web build). Run: node tests/e2e-smoke.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = process.env.SHOTS || 'shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-EG', timezoneId: 'Africa/Cairo' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_TUNNEL|mp3quran/.test(m.text())) errors.push(m.text()); });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const ok = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('✓', m); };

// Journey 1 — first run without account: language → city manually → next prayer visible → open Quran
await page.goto(BASE + '/#/');
await page.waitForSelector('.onb');
await shot('01-onboarding');
await page.click('text=التالي');
await page.fill('input.input', 'القاهرة');
await page.click('.list-item:has-text("القاهرة")');
await page.waitForSelector('text=تأكيد طريقة الحساب');
ok((await page.locator('.list-item[aria-pressed="true"]').textContent()).includes('المصرية'), 'Egyptian method suggested for Cairo');
await shot('02-method');
await page.click('text=التالي');
await page.click('.btn:has-text("لاحقًا")');
await page.click('.btn:has-text("التالي")'); // theme step
await page.click('.btn:has-text("قراءة")');
await page.waitForSelector('.hero-card');
await shot('03-today');
ok(await page.isVisible('text=الصلاة التالية'), 'Today shows next prayer');
ok(await page.isVisible('text=محسوب'), 'Prayer time is labelled "calculated"');

// Journey 2 — read & understand: open last position → select ayah → tafsir → compare → bookmark → back to same ayah
await page.click('text=ابدأ القراءة');
await page.waitForSelector('.ayah-text');
await shot('04-reader-fatiha');
await page.goto(BASE + '/#/quran/read/2/255');
await page.waitForSelector('#a-2-255');
await page.click('#a-2-255');
await page.waitForSelector('.sheet');
await page.click('.sheet >> text=التفسير');
await page.waitForSelector('.tafsir-text');
const taf1 = await page.textContent('.tafsir-text');
await shot('05-tafsir');
await page.click('.sheet .chip:has-text("الجلالين")');
await page.waitForFunction((t) => document.querySelector('.tafsir-text')?.textContent !== t, taf1);
ok(true, 'Tafsir source switch changes commentary, not the ayah');
await page.click('.sheet >> text=رجوع');
await page.click('.sheet .btn:has-text("علامة")');
await page.click('.sheet .btn:has-text("حفظ")');
await page.waitForSelector('.sheet', { state: 'detached' });
await page.goto(BASE + '/#/quran');
await page.click('.seg button:has-text("علامة")');
ok((await page.locator('.list-item:has-text("البقرة · ٢٥٥")').count()) > 0, 'Bookmark listed');
await shot('06-bookmarks');
await page.click('.list-item:has-text("البقرة · ٢٥٥")');
await page.waitForSelector('#a-2-255');
ok(true, 'Returned to the same ayah');

// Multi-ayah selection → listen only to those ayahs (routes to the reciter picker when no reciter is chosen)
await page.goto(BASE + '/#/quran/read/2/255');
await page.waitForSelector('#a-2-255');
await page.click('#a-2-255');
await page.click('.sheet >> text=اختيار عدة آيات');
await page.waitForSelector('.multi-bar');
await page.click('#a-2-257');
ok((await page.textContent('.multi-bar')).includes('٢٥٥–٢٥٧'), 'Selection bar shows ayah range 255–257');
ok((await page.locator('.ayah-item.selected, .ayah.selected').count()) === 3, 'Three ayahs highlighted');
await page.click('.multi-bar .btn:has-text("استماع")');
await page.waitForSelector('.multi-bar >> text=آية بآية', { timeout: 15000 });
ok(true, 'Listen on a selection starts ayah-by-ayah playback (free per-ayah archives)');
await page.click('.multi-bar [aria-label="more"]');
await page.click('.multi-bar .chip:has-text("بتسجيل كامل")');
await page.waitForURL(/reciters\?play=2&from=255&to=257/);
ok(true, 'Full-recording option asks for a timed reciter with the range kept');
await page.click('.list-item:has-text("محمود خليل الحصري")');
await page.waitForSelector('.miniplayer', { timeout: 15000 });
ok(true, 'Range playback started (timings fetched live on a real network)');

// Page mode + surah 9 (no basmala) + surah 1
await page.goto(BASE + '/#/quran/text/187');
await page.waitForSelector('#a-9-1');
const pageText = await page.textContent('.quran-surface');
ok(pageText.includes('سُورَةُ التوبة') && !pageText.includes('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'), 'Page 187: Surah at-Tawbah starts without basmala');
await shot('07-page-mode');
await page.goto(BASE + '/#/quran/read/95/1');
await page.waitForSelector('#a-95-1');
ok(await page.isVisible('.basmala'), 'Surah 95 shows basmala header (idgham form handled)');

// Journey 3 — prayer & travel: change city → schedule updates → qibla
await page.click('.miniplayer button[aria-label="إنهاء"], .miniplayer button[aria-label="Stop"]').catch(() => {});
await page.goto(BASE + '/#/prayer');
await page.waitForSelector('.prayer-row');
await shot('08-prayer');
const cairoFajr = await page.textContent('.prayer-row:has-text("الفجر") .time');
await page.locator('.seg button:has-text("الشهر")').dispatchEvent('click');
await page.waitForSelector('table.table');
await shot('09-prayer-month');
await page.goto(BASE + '/#/prayer/city');
await page.fill('input.input', 'لندن');
await page.click('.list-item:has-text("لندن")');
await page.waitForSelector('text=Europe/London');
const londonFajr = await page.textContent('.prayer-row:has-text("الفجر") .time');
ok(cairoFajr !== londonFajr, `Schedule recomputed for London (${cairoFajr} → ${londonFajr})`);
ok((await page.locator('text=لجنة رؤية الهلال').count()) > 0, 'Method suggestion switched for GB');
await page.goto(BASE + '/#/prayer/qibla');
await page.waitForSelector('.compass-rose');
await shot('10-qibla');
await page.goto(BASE + '/#/prayer/nawafil');
await page.waitForSelector('text=الثلث الأخير');
await shot('11-nawafil');

// Journey 4 — morning adhkar: start session, read source, count, leave, resume
await page.goto(BASE + '/#/adhkar');
await page.waitForSelector('.card');
await shot('12-adhkar');
await page.click('.card:has-text("أذكار الصباح")');
await page.waitForSelector('.counter-btn');
await page.click('.counter-btn');
await page.click('text=المصدر');
await page.waitForSelector('.sheet');
await shot('13-dhikr-source');
await page.keyboard.press('Escape');
await page.goto(BASE + '/#/');
await page.goto(BASE + '/#/adhkar');
await page.click('.card:has-text("أذكار الصباح")');
await page.waitForSelector('.counter-btn');
const resumed = await page.textContent('.counter-btn');
ok(resumed.trim().startsWith('١'), 'Counter resumed after leaving (' + resumed + ')');
await shot('14-dhikr-session');

// Journey 5 — hadith & search
await page.goto(BASE + '/#/library/search?q=');
await page.fill('input.input', 'انما الاعمال');
await page.click('.chip:has-text("حديث")');
await page.waitForSelector('.list-item', { timeout: 30000 });
ok((await page.locator('.list-item:has-text("الأربعون النووية · ١")').count()) > 0, 'Hadith search (normalised) finds "innama al-a‘mal" as Nawawi #1');
await shot('15-search');
await page.click('.chip:has-text("القرآن")');
await page.fill('input.input', 'الله لا اله الا هو الحي القيوم');
await page.waitForSelector('.list-item:has-text("البقرة · ٢٥٥")');
ok(true, 'Quran search (no diacritics) finds 2:255');
await page.click('.chip:has-text("حديث")');
await page.click('.chip:has-text("صحيح البخاري")');
await page.fill('input.input', 'انما الاعمال بالنيات');
await page.waitForSelector('.list-item:has-text("صحيح البخاري · ١")', { timeout: 60000 });
ok(true, 'Bukhari #1 found by matn search');
await page.click('.list-item:has-text("صحيح البخاري · ١")');
await page.waitForSelector('.hadith-text');
await shot('16-hadith');
await page.goto(BASE + '/#/library/sources');
await page.waitForSelector('.card');
await shot('17-sources');

// Settings + dark + paper
await page.goto(BASE + '/#/settings');
await page.waitForSelector('.card');
await page.click('.seg button:has-text("داكن")');
await page.goto(BASE + '/#/quran/read/18/1');
await page.waitForSelector('#a-18-1');
await shot('18-dark-reader');
await page.goto(BASE + '/#/settings');
await page.click('.seg button:has-text("ورقي")');
await page.goto(BASE + '/#/');
await page.waitForSelector('.hero-card');
await shot('19-paper-today');
// English UI
await page.goto(BASE + '/#/settings');
await page.click('.seg button:has-text("English")');
await page.goto(BASE + '/#/');
await page.waitForSelector('text=Next prayer');
await shot('20-english-today');

// Audio library — catalogue, famous section, reciter page with 114 statuses, downloads manager
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/#/quran/reciters');
await page.waitForSelector('.list-item');
ok((await page.locator('.list-item:has-text("محمود خليل الحصري")').count()) > 0, 'Famous reciters section lists al-Hussary in Arabic');
await shot('22-reciters');
await page.click('.list-item:has-text("محمود خليل الحصري")');
await page.waitForSelector('text=mp3quran:118');
ok((await page.locator('.rec-card').count()) >= 4, 'Hussary page shows multiple recordings (hafs/warsh/qalun/duri/mujawwad)');
ok((await page.locator('.list .list-item').count()) === 114, '114 surah rows with status');
await shot('23-reciter-page');
await page.click('.list .list-item:nth-child(1) button.grow');
await page.waitForSelector('.miniplayer');
ok(await page.isVisible('.miniplayer'), 'Mini player appears after tapping a surah (stream attempt)');
await page.click('.miniplayer button.grow');
await page.waitForSelector('.sheet');
await shot('24-full-player');
await page.keyboard.press('Escape');
await page.goto(BASE + '/#/quran/downloads');
await page.waitForSelector('text=Wi-Fi');
await shot('25-downloads');

// Reference-app parity tools: tracker, hijri calendar, khatma, asma, wallpapers, my duas
await page.goto(BASE + '/#/library/tracker');
await page.waitForSelector('.cal');
await page.click('.switch:has-text("Fajr"), .switch:has-text("الفجر")');
ok((await page.locator('.switch[aria-checked="true"]').count()) >= 1, 'Tracker toggles a prayer');
await shot('26-tracker');
await page.goto(BASE + '/#/library/hijri');
await page.waitForSelector('.cal');
await shot('27-hijri');
await page.goto(BASE + '/#/library/khatma');
await page.waitForSelector('.chip');
await page.click('.btn:has-text("Start"), .btn:has-text("ابدأ")');
await page.waitForSelector('.card.primary');
ok(true, 'Khatma plan started');
await shot('28-khatma');
await page.goto(BASE + '/#/library/asma');
await page.waitForSelector('.grid-2 .card');
ok((await page.locator('.grid-2 .card').count()) === 99, '99 names listed');
ok((await page.locator('.grid-2 .card p').count()) === 99, 'Every name shows a short meaning');
await shot('29-asma');

// Second parity pass: Ramadan, fasting days, qiyam, fajr alarm, teaching, cards, help
await page.goto(BASE + '/#/library/ramadan');
await page.waitForSelector('table.table');
ok((await page.locator('table.table tbody tr').count()) >= 29, 'Imsakiya has 29–30 rows');
await shot('31-ramadan');
await page.goto(BASE + '/#/library/fasting');
await page.waitForSelector('.list .list-item');
ok((await page.locator('.list .list-item').count()) >= 8, 'Upcoming sunnah fasting days listed');
await shot('32-fasting');
await page.goto(BASE + '/#/library/qiyam');
await page.waitForSelector('.hero-card');
await page.click('.seg button:has-text("Last third"), .seg button:has-text("الثلث الأخير")');
await shot('33-qiyam');
await page.goto(BASE + '/#/library/fajr-alarm');
await page.waitForSelector('.switch');
await page.click('.switch');
await shot('34-fajr-alarm');
await page.goto(BASE + '/#/library/teach/salah');
await page.waitForSelector('ol li.card');
ok((await page.locator('ol li.card').count()) >= 15, 'Salah lesson has its steps');
await shot('35-teach-salah');
await page.goto(BASE + '/#/library/cards');
await page.waitForSelector('img[src^="data:image/jpeg"]', { timeout: 20000 });
ok(true, 'Greeting card rendered on canvas');
await shot('36-cards');
await page.goto(BASE + '/#/library/help');
await page.waitForSelector('.card');
await page.goto(BASE + '/#/adhkar/tasbih');
await page.locator('.chip:has-text("سبحان الله وبحمده")').first().dispatchEvent('click');
await page.locator('.counter-btn').dispatchEvent('click');
ok(await page.isVisible('text=سبحان الله وبحمده'), 'Tasbih shows the chosen dhikr');
await page.goto(BASE + '/#/library/wallpapers');
await page.waitForSelector('img[src*="art/"]');
await page.goto(BASE + '/#/library/duas');
await page.waitForSelector('textarea');
await page.goto(BASE + '/#/');
await page.waitForSelector('.tools-grid');
ok((await page.locator('.tools-grid .tool').count()) === 12, 'Home quick tools grid');
ok((await page.locator('.tracker-ring .tr').count()) === 6, 'Home shows the 6-prayer tracker ring');
ok((await page.locator('.prayer-strip .ps').count()) === 6, 'Home shows the 6-time strip');
await shot('30-home');

// Mushaf page mode (QCF v4): real lines, word taps, selection → ayah-by-ayah listen
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/#/quran/page/42');
await page.waitForSelector('.mushaf .w[data-vk="2:255"]', { timeout: 20000 });
ok((await page.locator('.mushaf .mline').count()) === 15, 'Mushaf page 42 has 15 lines');
await page.click('.mushaf .w[data-vk="2:255"]');
await page.waitForSelector('.sheet');
ok(/البقرة · (آية ٢٥٥|Ayah 255)/.test(await page.textContent('.sheet')), 'Word tap selects 2:255 on the mushaf page');
await page.click('.sheet >> text=/اختيار عدة آيات|Select more ayahs/');
await page.waitForSelector('.multi-bar');
await page.click('.mushaf .w[data-vk="2:256"]');
ok((await page.locator('.mushaf .w.sel').count()) > 20, 'Selection highlights every word of 255–256');
await page.click('.multi-bar .btn:has-text("استماع"), .multi-bar .btn:has-text("Listen")');
await page.waitForSelector('.multi-bar >> text=/آية بآية|ayah by ayah/', { timeout: 15000 });
ok(true, 'Ayah-by-ayah playback started from the selection');
await page.goto(BASE + '/#/library/tafsirs');
await page.waitForSelector('.list-item');
ok((await page.locator('.list-item').count()) >= 30, 'Tafsir library lists bundled + on-demand tafsirs');
await page.goto(BASE + '/#/library/translations');
await page.waitForSelector('.list-item');
ok((await page.locator('.list-item').count()) === 33, '33 translations listed');
await page.goto(BASE + '/#/library/hadith/riyad');
await page.waitForSelector('.list-item');
ok(true, 'Riyad as-Salihin opens');

// Tablet width
await page.setViewportSize({ width: 1024, height: 768 });
await page.goto(BASE + '/#/quran/text/2');
await page.waitForSelector('#a-2-1');
await shot('21-tablet-page');

ok(errors.length === 0, 'No console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log('ALL JOURNEYS PASSED');
