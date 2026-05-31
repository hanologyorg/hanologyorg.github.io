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
await new Promise(r => server.listen(8776, r));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });

// Test LibraryHome
await page.goto('http://localhost:8776/nss/', { waitUntil: 'networkidle0', timeout: 15000 });
await new Promise(r => setTimeout(r, 3000));

const libState = await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  if (!vp) return { error: 'no .v-page', body: document.body.innerHTML.slice(0, 200) };
  const style = getComputedStyle(vp);
  return {
    scrollLeft: vp.scrollLeft,
    scrollWidth: vp.scrollWidth,
    clientWidth: vp.clientWidth,
    display: style.display,
    flexDirection: style.flexDirection,
    overflowX: style.overflowX,
    writingMode: style.writingMode,
    children: Array.from(vp.children).map(c => c.className.slice(0, 40)).slice(0, 5),
  };
});
console.log('Library /nss/ state:', libState);

// Test PieceView
await page.goto('http://localhost:8776/nss/1.html', { waitUntil: 'networkidle0', timeout: 15000 });
await new Promise(r => setTimeout(r, 3000));

const pieceState = await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  if (!vp) return { error: 'no .v-page' };
  return {
    scrollLeft: vp.scrollLeft,
    scrollWidth: vp.scrollWidth,
    clientWidth: vp.clientWidth,
    children: Array.from(vp.children).map(c => ({ cls: c.className.slice(0, 30), w: c.offsetWidth })).slice(0, 5),
  };
});
console.log('Piece /nss/1 state:', pieceState);

// Simulate realistic trackpad: mixed deltaX/deltaY
console.log('\n--- Trackpad simulation on PieceView ---');
// Start at 0, scroll down with slight deltaX
for (let i = 0; i < 30; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: 400, deltaX: 50, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 20));
}
const afterMixed = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After 30 mixed scrolls (dy=400, dx=50):', afterMixed);

// Try scrolling back up with slight deltaX
for (let i = 0; i < 30; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, deltaX: -50, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 20));
}
const afterBack = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After 30 mixed scrolls back (dy=-400, dx=-50):', afterBack);

// Simulate trackpad where deltaX > deltaY (horizontal swipe)
console.log('\n--- Horizontal swipe simulation ---');
await page.evaluate(() => { document.querySelector('.v-page').scrollLeft = -5000; });
await new Promise(r => setTimeout(r, 100));

for (let i = 0; i < 20; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    // deltaX > deltaY, swipe right (positive)
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, deltaX: 300, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 20));
}
const afterHSwipe = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After horizontal swipes (dx=300, dy=30) from -5000:', afterHSwipe);

await browser.close();
server.close();
