import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { stat, readFile } from 'fs/promises';
import path from 'path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const dist = path.resolve('dist');
const server = createServer(async (req, res) => {
  let fp = path.join(dist, req.url === '/' ? '/index.html' : req.url);
  try { const s = await stat(fp); if (s.isDirectory()) fp += '/index.html'; } catch {}
  try { const data = await readFile(fp); res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(data); } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8778, r));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto('http://localhost:8778/nss/1.html', { waitUntil: 'networkidle0', timeout: 15000 });
await new Promise(r => setTimeout(r, 3000));

// Record scroll behavior
const log = [];

// Scroll to full left (40 events)
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 20));
  const sl = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
  if (i < 3 || i > 37) log.push(`  step ${i}: scrollLeft=${sl}`);
}
const fullLeft = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
log.push(`\nFull left: ${fullLeft}`);

// Now try to scroll back right (40 events)
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 20));
  const sl = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
  if (i < 3 || i > 37) log.push(`  back ${i}: scrollLeft=${sl}`);
}
const fullRight = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
log.push(`\nFull right attempt: ${fullRight}`);

// Check: can we even set scrollLeft = 0?
await page.evaluate(() => { document.querySelector('.v-page').scrollLeft = 0; });
await new Promise(r => setTimeout(r, 100));
const direct = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
log.push(`Direct scrollLeft=0: ${direct}`);

// Check scroll-snap effect
await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  vp.scrollLeft = -5000;
});
await new Promise(r => setTimeout(r, 100));
const afterSet = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
log.push(`\nSet scrollLeft=-5000: ${afterSet}`);

await page.evaluate(() => {
  document.querySelector('.v-page').scrollTo({ left: 0, behavior: 'instant' });
});
await new Promise(r => setTimeout(r, 100));
const afterScrollTo = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
log.push(`scrollTo(0): ${afterScrollTo}`);

// Now disable snap and retest
await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  vp.style.scrollSnapType = 'none';
});
await page.evaluate(() => { document.querySelector('.v-page').scrollLeft = 0; });
await new Promise(r => setTimeout(r, 100));

for (let i = 0; i < 40; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 20));
}
const noSnapFullLeft = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
log.push(`\nNo snap - full left: ${noSnapFullLeft}`);

for (let i = 0; i < 45; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 20));
}
const noSnapFullRight = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
log.push(`No snap - full right: ${noSnapFullRight}`);

console.log(log.join('\n'));

await browser.close();
server.close();
