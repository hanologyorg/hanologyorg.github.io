import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '../dist');

// Start static server
import { createServer } from 'http';
import { stat, readFile } from 'fs/promises';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer(async (req, res) => {
  let fp = path.join(dist, req.url === '/' ? '/index.html' : req.url);
  try { const s = await stat(fp); if (s.isDirectory()) fp += '/index.html'; } catch {}
  try {
    const data = await readFile(fp);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8765, r));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });

// Check root index page (vertical mode)
await page.goto('http://localhost:8765/', { waitUntil: 'networkidle0' });

// Wait for Vue hydration
await page.waitForSelector('.v-root, .lib-root', { timeout: 10000 }).catch(() => null);
await new Promise(r => setTimeout(r, 1000));

const result = await page.evaluate(() => {
  const isVertical = !!document.querySelector('.v-root');

  // Check for cards
  const cards = document.querySelectorAll('.v-card, .lib-card');
  const cardCount = cards.length;

  // Check for section cards containers
  const cardContainers = document.querySelectorAll('.v-section-cards');

  // Check sections
  const sections = document.querySelectorAll('.v-section');
  const sectionInfo = Array.from(sections).map(s => ({
    sectionWidth: s.getBoundingClientRect().width,
    cardCount: s.querySelectorAll('.v-card').length,
    hasCardsContainer: !!s.querySelector('.v-section-cards'),
    cardsVisible: Array.from(s.querySelectorAll('.v-card')).map(c => ({
      width: c.getBoundingClientRect().width,
      height: c.getBoundingClientRect().height,
      title: c.querySelector('.v-card-title')?.textContent || '',
      visible: c.getBoundingClientRect().width > 50
    }))
  }));

  // Hero
  const hero = document.querySelector('.v-hero');
  const heroInfo = hero ? {
    height: hero.getBoundingClientRect().height,
    title: hero.querySelector('.v-title')?.textContent || '',
    visible: hero.getBoundingClientRect().height > 100
  } : null;

  return { isVertical, cardCount, cardContainersCount: cardContainers.length, sections: sectionInfo, hero: heroInfo };
});

console.log(JSON.stringify(result, null, 2));

await browser.close();
server.close();
