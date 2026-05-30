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
await new Promise(r => server.listen(8770, r));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto('http://localhost:8770/nss/1.html', { waitUntil: 'networkidle0', timeout: 15000 });
await new Promise(r => setTimeout(r, 3000));

// Step 1: Check initial state
const initial = await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  return {
    scrollLeft: vp.scrollLeft,
    scrollWidth: vp.scrollWidth,
    clientWidth: vp.clientWidth,
  };
});
console.log('Initial:', initial);

// Step 2: Scroll using wheel events (like user would)
await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  // Scroll left by dispatching wheel events (simulating user scrolling down = moving left)
  for (let i = 0; i < 50; i++) {
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: 500, bubbles: true, cancelable: true }));
  }
});
await new Promise(r => setTimeout(r, 500));

const afterWheel = await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  const children = Array.from(vp.children);
  return {
    scrollLeft: vp.scrollLeft,
    childPositions: children.map(c => {
      const r = c.getBoundingClientRect();
      const cls = c.className.split(' ').slice(0, 2).join(' ');
      return `${cls}: x=${r.x.toFixed(0)} right=${r.right.toFixed(0)} vis=${r.right > 0 && r.left < 1200}`;
    }),
  };
});
console.log('\nAfter wheel scrolling:', afterWheel);

// Step 3: Try direct scrollLeft assignment
await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  vp.scrollLeft = 99999;
});
await new Promise(r => setTimeout(r, 200));

const afterDirect = await page.evaluate(() => ({
  scrollLeft: document.querySelector('.v-page').scrollLeft,
}));
console.log('\nAfter direct scrollLeft=99999:', afterDirect);

// Step 4: Try scrollTo
await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  vp.scrollTo({ left: 99999, behavior: 'instant' });
});
await new Promise(r => setTimeout(r, 200));

const afterScrollTo = await page.evaluate(() => ({
  scrollLeft: document.querySelector('.v-page').scrollLeft,
}));
console.log('\nAfter scrollTo left=99999:', afterScrollTo);

await browser.close();
server.close();
