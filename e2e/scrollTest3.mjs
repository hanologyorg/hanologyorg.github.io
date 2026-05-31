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
await new Promise(r => server.listen(8777, r));

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto('http://localhost:8777/nss/1.html', { waitUntil: 'networkidle0', timeout: 15000 });
await new Promise(r => setTimeout(r, 3000));

// Check the flex-direction and scroll properties
const info = await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  const style = getComputedStyle(vp);
  return {
    flexDirection: style.flexDirection,
    direction: style.direction,
    writingMode: style.writingMode,
    overflowX: style.overflowX,
    scrollLeft: vp.scrollLeft,
    scrollWidth: vp.scrollWidth,
    clientWidth: vp.clientWidth,
    scrollSnapType: style.scrollSnapType,
  };
});
console.log('Container info:', info);

// Scroll via wheel to some position
for (let i = 0; i < 15; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 30));
}
const afterWheel = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After wheel scroll:', afterWheel);

// Try to set scrollLeft directly
await page.evaluate(() => { document.querySelector('.v-page').scrollLeft = 0; });
await new Promise(r => setTimeout(r, 100));
const afterDirect = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After direct scrollLeft=0:', afterDirect);

// Try scrollTo
await page.evaluate(() => {
  document.querySelector('.v-page').scrollTo({ left: 0, behavior: 'instant' });
});
await new Promise(r => setTimeout(r, 100));
const afterScrollTo = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After scrollTo(0):', afterScrollTo);

// Check if scrollTo negative works
await page.evaluate(() => {
  document.querySelector('.v-page').scrollTo({ left: -5000, behavior: 'instant' });
});
await new Promise(r => setTimeout(r, 100));
const afterNeg = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('After scrollTo(-5000):', afterNeg);

// Check if scrollLeft = 0 brings back to rightmost
await page.evaluate(() => {
  document.querySelector('.v-page').scrollLeft = 0;
});
await new Promise(r => setTimeout(r, 100));

// Check first child visibility
const vis = await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  const first = vp.children[0];
  const r = first.getBoundingClientRect();
  return { x: r.x.toFixed(0), right: r.right.toFixed(0), visible: r.right > 0 && r.left < 1200, cls: first.className.slice(0, 30) };
});
console.log('First child at scrollLeft=0:', vis);

// Check if the actual issue is with scroll-snap
// Remove scroll-snap and test
await page.evaluate(() => {
  const vp = document.querySelector('.v-page');
  vp.style.scrollSnapType = 'none';
  // Also remove snap from children
  vp.querySelectorAll('[style*="scroll-snap"]').forEach(el => el.style.scrollSnapAlign = 'none');
});

// Scroll away and try to come back
for (let i = 0; i < 20; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: 500, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 20));
}
const deepScroll = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('\nWithout snap, after deep scroll:', deepScroll);

for (let i = 0; i < 20; i++) {
  await page.evaluate(() => {
    const vp = document.querySelector('.v-page');
    vp.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 20));
}
const backScroll = await page.evaluate(() => document.querySelector('.v-page').scrollLeft);
console.log('Without snap, after scroll back:', backScroll);

await browser.close();
server.close();
