// Google Play phone screenshots 1080×1920 (9:16). Run from app/ with `npx vite preview --port 4173` running.
import { chromium } from '../app/node_modules/playwright/index.mjs';
const BASE = process.env.BASE || 'http://localhost:4173';
const OUT = new URL('../app/fastlane/metadata/android/ar/images/phoneScreenshots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: 'ar-EG', timezoneId: 'Africa/Cairo' });
await ctx.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
const p = await ctx.newPage();
await p.goto(BASE + '/#/'); await p.waitForSelector('.onb');
await p.click('text=التالي'); await p.fill('input.input', 'القاهرة'); await p.click('.list-item:has-text("القاهرة")');
await p.waitForSelector('text=تأكيد طريقة الحساب'); await p.click('text=التالي'); await p.click('.btn:has-text("لاحقًا")'); await p.click('.btn:has-text("التالي")'); await p.click('.btn:has-text("قراءة")'); await p.waitForSelector('.hero-card');
const shots = [['1-today', '/#/'], ['2-mushaf', '/#/quran/page/3'], ['3-prayer', '/#/prayer'], ['4-reader', '/#/quran/read/2/255'], ['5-adhkar', '/#/adhkar'], ['6-library', '/#/library']];
for (const [n, h] of shots) { await p.goto(BASE + h); await p.waitForTimeout(2500); await p.screenshot({ path: OUT + n + '.png' }); console.log(n); }
await b.close();
