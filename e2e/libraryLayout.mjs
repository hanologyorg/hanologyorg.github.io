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
await new Promise(r => server.listen(8766, r));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
await page.goto('http://localhost:8766/', { waitUntil: 'networkidle0' });
await page.waitForSelector('.v-root', { timeout: 10000 });
await new Promise(r => setTimeout(r, 1000));

const result = await page.evaluate(() => {
  const pageEl = document.querySelector('.v-page');
  const pageRect = pageEl ? pageEl.getBoundingClientRect() : null;
  const pageStyle = pageEl ? getComputedStyle(pageEl) : null;

  const sections = document.querySelectorAll('.v-section');
  const sectionData = Array.from(sections).map(s => {
    const rect = s.getBoundingClientRect();
    const cardsContainer = s.querySelector('.v-section-cards');
    const cards = s.querySelectorAll('.v-card');
    return {
      sectionX: rect.x, sectionY: rect.y, sectionW: rect.width, sectionH: rect.height,
      containerW: cardsContainer?.getBoundingClientRect().width,
      containerH: cardsContainer?.getBoundingClientRect().height,
      cardCount: cards.length,
      firstCard: cards[0] ? {
        x: cards[0].getBoundingClientRect().x,
        y: cards[0].getBoundingClientRect().y,
        w: cards[0].getBoundingClientRect().width,
        h: cards[0].getBoundingClientRect().height
      } : null,
      lastCard: cards[cards.length - 1] ? {
        x: cards[cards.length - 1].getBoundingClientRect().x,
        y: cards[cards.length - 1].getBoundingClientRect().y,
      } : null,
      // Are cards stacked vertically (same X, different Y) or horizontal (same Y, different X)?
      cardsXY: Array.from(cards).map(c => ({ x: c.getBoundingClientRect().x.toFixed(0), y: c.getBoundingClientRect().y.toFixed(0), title: c.querySelector('.v-card-title')?.textContent?.slice(0,10) }))
    };
  });

  const scrollW = pageEl ? pageEl.scrollWidth : 0;
  const clientW = pageEl ? pageEl.clientWidth : 0;

  return { pageScrollWidth: scrollW, pageClientWidth: clientW, overflowX: scrollW > clientW, sections: sectionData };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
server.close();
