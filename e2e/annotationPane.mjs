// E2E test: Puppeteer + Node.js, no vitest dependency
// Usage: node e2e/annotationPane.mjs
//
// Prerequisites: npm run build (dist/ must exist)

import puppeteer from 'puppeteer'
import { createServer } from 'http'
import handler from 'serve-handler'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '../dist')

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

// Start a static file server
async function startServer() {
  return new Promise((resolve, reject) => {
    const srv = createServer((req, res) =>
      handler(req, res, { public: distDir, cleanUrls: true })
    )
    srv.listen(0, () => {
      const addr = srv.address()
      if (typeof addr === 'object' && addr) {
        resolve({ server: srv, url: `http://127.0.0.1:${addr.port}` })
      } else reject(new Error('Failed to start server'))
    })
  })
}

async function makeMobilePage(browser, width = 375, height = 812) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.setRequestInterception(true)
  page.on('request', req => {
    if (req.resourceType() === 'font') req.abort()
    else req.continue()
  })
  return page
}

async function run() {
  if (!existsSync(resolve(distDir, 'nss/15.html'))) {
    console.error('Run `npm run build` first — dist/nss/15.html not found')
    process.exit(1)
  }

  const { server, url: baseUrl } = await startServer()
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  try {
    // ── Test 1: Mobile horizontal sheet shows content ──
    console.log('\nTest 1: Mobile horizontal sheet shows content')
    {
      const page = await makeMobilePage(browser)
      await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })
      await page.evaluate(() => { localStorage.setItem('layout', 'horizontal') })
      await page.reload({ waitUntil: 'networkidle0', timeout: 15000 })

      const annTarget = await page.$('.ann-target')
      assert(!!annTarget, 'annotation target exists on page')

      if (annTarget) {
        const box = await annTarget.boundingBox()
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
        const sheet = await page.waitForSelector('.ann-sheet', { timeout: 5000 })

        const layout = await page.evaluate(el => {
          const rect = el.getBoundingClientRect()
          const entries = el.querySelectorAll('.ann-entry')
          const firstText = entries[0]?.textContent?.trim() || ''
          return {
            width: rect.width, height: rect.height,
            entryCount: entries.length,
            firstEntryLen: firstText.length,
          }
        }, sheet)

        assert(layout.width > 0 && layout.height > 0, `sheet visible: ${Math.round(layout.width)}×${Math.round(layout.height)}`)
        assert(layout.entryCount > 0, `has ${layout.entryCount} annotation entries`)
        assert(layout.firstEntryLen > 0, `entry has text content (${layout.firstEntryLen} chars)`)
      }
      await page.close()
    }

    // ── Test 2: Mobile vertical sheet shows content and drag bar ──
    console.log('\nTest 2: Mobile vertical sheet shows content and drag bar')
    {
      const page = await makeMobilePage(browser)
      await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })
      await page.evaluate(() => { localStorage.setItem('layout', 'vertical') })
      await page.reload({ waitUntil: 'networkidle0', timeout: 15000 })

      const annTarget = await page.$('.ann-target')
      assert(!!annTarget, 'annotation target exists in vertical mode')

      if (annTarget) {
        const box = await annTarget.boundingBox()
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
        const sheet = await page.waitForSelector('.ann-sheet.vertical', { timeout: 5000 })

        const layout = await page.evaluate(el => {
          const rect = el.getBoundingClientRect()
          const body = el.querySelector('.ann-sheet-body')
          const bodyRect = body ? body.getBoundingClientRect() : null
          const dragBar = el.querySelector('.ann-sheet-drag-bar')
          const dragBarRect = dragBar ? dragBar.getBoundingClientRect() : null
          const entries = el.querySelectorAll('.ann-entry')
          const firstText = entries[0]?.textContent?.trim() || ''
          return {
            sheetW: rect.width, sheetH: rect.height,
            bodyW: bodyRect?.width || 0, bodyH: bodyRect?.height || 0,
            dragW: dragBarRect?.width || 0, dragH: dragBarRect?.height || 0,
            entryCount: entries.length,
            firstEntryLen: firstText.length,
          }
        }, sheet)

        assert(layout.sheetW > 200, `sheet width ${Math.round(layout.sheetW)} > 200`)
        assert(layout.sheetH >= 800, `sheet height ${Math.round(layout.sheetH)} >= 800`)
        assert(layout.bodyW > 100, `body width ${Math.round(layout.bodyW)} > 100 (content visible)`)
        assert(layout.bodyH > 100, `body height ${Math.round(layout.bodyH)} > 100 (content visible)`)
        assert(layout.dragW > 0, `drag bar width ${Math.round(layout.dragW)} > 0`)
        assert(layout.dragH > 0, `drag bar height ${Math.round(layout.dragH)} > 0`)
        assert(layout.entryCount > 0, `${layout.entryCount} annotation entries`)
        assert(layout.firstEntryLen > 0, `entry text: ${layout.firstEntryLen} chars`)
      }
      await page.close()
    }

    // ── Test 3: Swipe dismisses vertical sheet ──
    console.log('\nTest 3: Swipe on drag bar dismisses vertical sheet')
    {
      const page = await makeMobilePage(browser)
      await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })
      await page.evaluate(() => { localStorage.setItem('layout', 'vertical') })
      await page.reload({ waitUntil: 'networkidle0', timeout: 15000 })

      const annTarget = await page.$('.ann-target')
      if (annTarget) {
        const box = await annTarget.boundingBox()
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForSelector('.ann-sheet.vertical', { timeout: 5000 })

        const dragBar = await page.$('.ann-sheet-drag-bar')
        assert(!!dragBar, 'drag bar element found')

        if (dragBar) {
          const db = await dragBar.boundingBox()
          const startX = db.x + db.width / 2
          const startY = db.y + db.height / 2

          // Simulate right-swipe via CDP
          const client = await page.createCDPSession()
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: startX, y: startY }],
          })
          for (let i = 1; i <= 8; i++) {
            await client.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [{ x: startX + i * 30, y: startY }],
            })
          }
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
          })

          await new Promise(r => setTimeout(r, 600))

          const stillVisible = await page.evaluate(() => {
            const el = document.querySelector('.ann-sheet.vertical')
            if (!el) return false
            const r = el.getBoundingClientRect()
            return r.width > 0 && r.left >= 0
          })
          assert(!stillVisible, 'sheet dismissed after swipe')
        }
      }
      await page.close()
    }

    // ── Test 4: Non-vertical sheet dismisses on outside tap ──
    console.log('\nTest 4: Non-vertical sheet dismisses on outside tap')
    {
      const page = await makeMobilePage(browser)
      await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })
      await page.evaluate(() => { localStorage.setItem('layout', 'horizontal') })
      await page.reload({ waitUntil: 'networkidle0', timeout: 15000 })

      const annTarget = await page.$('.ann-target')
      if (annTarget) {
        const box = await annTarget.boundingBox()
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForSelector('.ann-sheet', { timeout: 5000 })

        // Tap outside (top-left corner)
        await page.touchscreen.tap(20, 20)
        await new Promise(r => setTimeout(r, 300))

        const visible = await page.evaluate(() => {
          const el = document.querySelector('.ann-sheet')
          if (!el) return false
          const r = el.getBoundingClientRect()
          return r.height > 0
        })
        assert(!visible, 'sheet dismissed after outside tap')
      }
      await page.close()
    }

  } finally {
    await browser.close()
    server.close()
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
