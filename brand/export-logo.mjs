// Exports PNG (transparent, 4096 & 1024) and vector PDF from the SVGs, plus a rendered test sheet. Uses headless Chromium.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('brand/out');
const SVG = path.join(ROOT, 'svg'), PNG = path.join(ROOT, 'png'), PDF = path.join(ROOT, 'pdf'), PREVIEW = path.join(ROOT, 'preview');
for (const d of [PNG, PDF, PREVIEW]) fs.mkdirSync(d, { recursive: true });
const fontCss = `@font-face{font-family:'Amiri Quran';src:url('file://${path.resolve('app/public/fonts/AmiriQuran.ttf')}')}@font-face{font-family:'Noto Sans Arabic';src:url('file://${path.resolve('app/public/fonts/NotoSansArabic-VF.ttf')}')}`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
async function render(svgFile, sizes, pdf) {
  const src = fs.readFileSync(path.join(SVG, svgFile), 'utf8');
  const m = src.match(/viewBox="0 0 (\d+) (\d+)"/); const W = Number(m[1]), H = Number(m[2]);
  for (const size of sizes) {
    const scale = size / Math.max(W, H);
    const w = Math.round(W * scale), h = Math.round(H * scale);
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><head><style>${fontCss}html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style></head><body>${src}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(PNG, svgFile.replace('.svg', `-${size}.png`)), omitBackground: true, type: 'png' });
  }
  if (pdf) {
    await page.setViewportSize({ width: W, height: H });
    await page.setContent(`<html><head><style>${fontCss}@page{size:${W}px ${H}px;margin:0}html,body{margin:0}svg{display:block;width:${W}px;height:${H}px}</style></head><body>${src}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(PDF, svgFile.replace('.svg', '.pdf')), width: `${W}px`, height: `${H}px`, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  }
}
const files = fs.readdirSync(SVG);
for (const f of files) {
  if (f.startsWith('sakina-mark') || f.startsWith('sakina-lockup')) await render(f, [4096, 1024], true);
  else if (f.startsWith('appicon')) await render(f, [1024], false);
  else if (f.startsWith('concept')) await render(f, [512], false);
  else if (f === 'test-sheet.svg') { const src = fs.readFileSync(path.join(SVG, f), 'utf8'); const m = src.match(/viewBox="0 0 (\d+) (\d+)"/); await page.setViewportSize({ width: Number(m[1]), height: Number(m[2]) }); await page.setContent(`<html><head><style>${fontCss}html,body{margin:0}</style></head><body>${src}</body></html>`); await page.screenshot({ path: path.join(PREVIEW, 'test-sheet.png') }); }
}
await browser.close();
console.log('png', fs.readdirSync(PNG).length, 'pdf', fs.readdirSync(PDF).length);
