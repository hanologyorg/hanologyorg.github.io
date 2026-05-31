import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { stat, readFile } from 'fs/promises';
import path from 'path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const dist = path.resolve('dist');
const server = createServer(async (req, res) => {
  let fp = path.join(dist, req.url === '/' ? '/index.html' : req.url);
  try { const s = await stat(fp); if (s.isDirectory()) fp += '/index.html'; } catch {}
  try { const data = await readFile(fp); res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(data); } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8775, r));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto('http://localhost:8775/nss/1.html', { waitUntil: 'networkidle0', timeout: 15000 });
await new Promise(r => setTimeout(r, 3000));

// Check initial state
const initial = await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  if (!vp) return { error: 'no .v-page' };
  return {
    scrollLeft: vp.scrollLeft,
    scrollWidth: vp.scrollWidth,
    clientWidth: vp.clientWidth,
    maxScrollLeft: vp.scrollWidth - vp.clientWidth,
    minScrollLeft: -(vp.scrollWidth - vp.clientWidth),
    children: Array.from(vp.children).length,
  };
});
console.log('Initial state:', initial);

// Test 1: Scroll down (deltaY positive) 10 times — should go left
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 50));
}
const afterDown = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After 10 scroll-downs:', afterDown);

// Test 2: Scroll up (deltaY negative) 10 times — should go back right
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 50));
}
const afterUp = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After 10 scroll-ups:', afterUp);

// Test 3: Try scrollTo 0
await page.evaluate(() => {
  document.querySelector('.v-page').scrollLeft = 0;
});
await new Promise(r => setTimeout(r, 100));
const afterReset = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After scrollLeft=0:', afterReset);

// Test 4: Scroll down then try direct scrollLeft = 0
for (let i = 0; i < 20; i++) {
  await page.evaluate(() => {
    document.querySelector('.v-page').dispatchEvent(new WheelEvent('wheel', { deltaY: 500, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 30));
}
const deepScroll = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After 20 scroll-downs:', deepScroll);

// Try to go back with scrollLeft = 0
await page.evaluate(() => {
  document.querySelector('.v-page').scrollLeft = 0;
});
await new Promise(r => setTimeout(r, 200));
const backToStart = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After direct scrollLeft=0 from deep:', backToStart);

// Test 5: Check if content at right edge is visible
const rightEdge = await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  vp.scrollLeft = 0;
  const children = Array.from(vp.children);
  const first = children[0];
  const last = children[children.length - 1];
  const fr = first.getBoundingClientRect();
  const lr = last.getBoundingClientRect();
  return {
    firstChild: { class: first.className.slice(0, 30), x: fr.x.toFixed(0), right: fr.right.toFixed(0), visible: fr.right > 0 && fr.left < 1200 },
    lastChild: { class: last.className.slice(0, 30), x: lr.x.toFixed(0), right: lr.right.toFixed(0), visible: lr.right > 0 && lr.left < 1200 },
  };
});
console.log('Right edge content:', rightEdge);

await browser.close();
server.close();
