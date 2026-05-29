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
await new Promise(r => server.listen(8767, r));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto('http://localhost:8767/', { waitUntil: 'networkidle0' });
await page.waitForSelector('.v-root', { timeout: 10000 });
await new Promise(r => setTimeout(r, 1000));

const result = await page.evaluate(() => {
  const sections = document.querySelectorAll('.v-section');
  return Array.from(sections).map((s, i) => {
    const header = s.querySelector('.v-section-header');
    const cards = s.querySelector('.v-section-cards');
    const hR = header?.getBoundingClientRect();
    const cR = cards?.getBoundingClientRect();
    const sR = s.getBoundingClientRect();
    return {
      section: { x: sR.x, y: sR.y, w: sR.width, h: sR.height },
      header: hR ? { x: hR.x, y: hR.y, w: hR.width, h: hR.height, right: hR.right } : null,
      cards: cR ? { x: cR.x, y: cR.y, w: cR.width, h: cR.height, right: cR.right } : null,
      overlap: hR && cR ? (hR.x < cR.right && cR.x < hR.right) : false,
      gap: hR && cR ? Math.abs(hR.x - cR.right) : null,
      // header text
      headerTitle: header?.querySelector('.v-section-title')?.textContent || '',
      headerFontSize: header?.querySelector('.v-section-title') ? getComputedStyle(header.querySelector('.v-section-title')).fontSize : '',
      headerComputedStyle: header ? {
        width: getComputedStyle(header).width,
        height: getComputedStyle(header).height,
        writingMode: getComputedStyle(header).writingMode,
        borderLeft: getComputedStyle(header).borderLeft,
      } : null,
    };
  });
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
server.close();
