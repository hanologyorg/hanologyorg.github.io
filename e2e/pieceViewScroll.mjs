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
await new Promise(r => server.listen(8768, r));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto('http://localhost:8768/nss/1.html', { waitUntil: 'networkidle0' });
await page.waitForSelector('.v-page, .h-page', { timeout: 10000 });
await new Promise(r => setTimeout(r, 2000));

const result = await page.evaluate(() => {
  const vPage = document.querySelector('.v-page');
  if (!vPage) return { error: 'no .v-page' };

  const style = getComputedStyle(vPage);
  const rect = vPage.getBoundingClientRect();

  // Scroll dimensions
  const info = {
    scrollWidth: vPage.scrollWidth,
    clientWidth: vPage.clientWidth,
    scrollHeight: vPage.scrollHeight,
    clientHeight: vPage.clientHeight,
    scrollLeft: vPage.scrollLeft,
    maxScrollLeft: vPage.scrollWidth - vPage.clientWidth,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
    writingMode: style.writingMode,
    direction: style.direction,
    display: style.display,
    elRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
  };

  // Children positions
  const children = Array.from(vPage.children);
  const childInfo = children.map(c => {
    const r = c.getBoundingClientRect();
    return {
      tag: c.tagName,
      class: c.className.split(' ').slice(0, 2).join(' '),
      x: r.x.toFixed(0), y: r.y.toFixed(0),
      w: r.width.toFixed(0), h: r.height.toFixed(0),
      right: r.right.toFixed(0),
    };
  });

  // Try scrolling to leftmost
  vPage.scrollLeft = vPage.scrollWidth;
  const afterScrollRight = vPage.scrollLeft;
  vPage.scrollLeft = 0;
  const afterScrollLeft = vPage.scrollLeft;

  // Check if there's content past the left edge
  const leftmostChild = children.reduce((min, c) => {
    const r = c.getBoundingClientRect();
    return r.x < min ? r.x : min;
  }, Infinity);

  return { ...info, afterScrollRight, afterScrollLeft, childPositions: childInfo };
});

console.log(JSON.stringify(result, null, 2));

// Now scroll to leftmost and check what's visible
const scrollResult = await page.evaluate(() => {
  const vPage = document.querySelector('.v-page');
  // Try to scroll to show leftmost content
  vPage.scrollLeft = vPage.scrollWidth;

  const children2 = Array.from(vPage.children);
  return children2.map(c => {
    const r = c.getBoundingClientRect();
    return {
      class: c.className.split(' ').slice(0, 2).join(' '),
      x: r.x.toFixed(0), right: r.right.toFixed(0),
      visible: r.right > 0 && r.left < 1200,
    };
  });
});

console.log('\nAfter scrolling to max scrollLeft:');
console.log(JSON.stringify(scrollResult, null, 2));

await browser.close();
server.close();
