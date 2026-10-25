// App Store screenshots, iPhone 6.9" (1320×2868). Run from app/: node ../store/make-screenshots.mjs (needs `npx vite preview --port 4173`)
import { chromium } from '../app/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = new URL('./screenshots-6.9/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, locale: 'ar-EG', timezoneId: 'Africa/Cairo' });
await ctx.route(/upload\.wikimedia\.org/, (r) => r.abort());
const p = await ctx.newPage();
await p.goto(BASE + '/#/'); await p.waitForSelector('.onb');
await p.click('text=التالي'); await p.fill('input.input', 'القاهرة'); await p.click('.list-item:has-text("القاهرة")');
await p.waitForSelector('text=تأكيد طريقة الحساب'); await p.click('text=التالي'); await p.click('.btn:has-text("لاحقًا")'); await p.click('.btn:has-text("التالي")');
await p.click('.btn:has-text("قراءة")'); await p.waitForSelector('.hero-card');
const shots = [['01-today', '/#/'], ['02-mushaf', '/#/quran/page/3'], ['03-prayer', '/#/prayer'], ['04-reader', '/#/quran/read/2/255'], ['05-adhkar', '/#/adhkar']];
for (const [n, h] of shots) { await p.goto(BASE + h); await p.waitForTimeout(2500); await p.screenshot({ path: OUT + n + '.png' }); console.log(n); }
await b.close();
