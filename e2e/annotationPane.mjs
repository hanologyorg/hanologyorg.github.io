// E2E test: Puppeteer + Node.js
// Usage: node e2e/annotationPane.mjs
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

async function startServer() {
  return new Promise((resolve, reject) => {
    const srv = createServer((req, res) =>
      handler(req, res, { public: distDir, cleanUrls: true })
    )
    srv.listen(0, () => {
      const addr = srv.address()
      if (typeof addr === 'object' && addr)
        resolve({ server: srv, url: `http://127.0.0.1:${addr.port}` })
      else reject(new Error('Failed to start server'))
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

async function tapElement(page, selector) {
  await page.evaluate(sel => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`Element not found: ${sel}`)
    el.click()
  }, selector)
  await new Promise(r => setTimeout(r, 200))
}

async function swipeLeft(page, selector, distance = 300) {
  await page.evaluate(({ sel, dist }) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`Element not found: ${sel}`)
    const rect = el.getBoundingClientRect()
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    const touch = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(cx, cy)], bubbles: true, cancelable: true }))
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      el.dispatchEvent(new TouchEvent('touchmove', {
        touches: [touch(cx - i * (dist / steps), cy)], bubbles: true, cancelable: true,
      }))
    }
    el.dispatchEvent(new TouchEvent('touchend', {
      touches: [], changedTouches: [touch(cx - dist, cy)], bubbles: true, cancelable: true,
    }))
  }, { sel: selector, dist: distance })
  await new Promise(r => setTimeout(r, 600))
}

async function run() {
  if (!existsSync(resolve(distDir, 'nss/15.html'))) {
    console.error('Run `npm run build` first — dist/nss/15.html not found')
    process.exit(1)
  }

  const { server, url: baseUrl } = await startServer()
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 60000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--touch-events=enabled'],
  })

  try {
    // ── Test 1: Mobile horizontal sheet shows content ──
    console.log('\nTest 1: Mobile horizontal sheet shows content')
    {
      const page = await makeMobilePage(browser)
      await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })
      await page.evaluate(() => { localStorage.setItem('layout', 'horizontal') })
      await page.reload({ waitUntil: 'networkidle0', timeout: 15000 })

      const hasTarget = (await page.$('.ann-target')) !== null
      assert(hasTarget, 'annotation target exists on page')

      if (hasTarget) {
        await tapElement(page, '.ann-target')
        await page.waitForSelector('.ann-sheet', { timeout: 5000 })

        const layout = await page.$eval('.ann-sheet', el => {
          const rect = el.getBoundingClientRect()
          const entries = el.querySelectorAll('.ann-entry')
          return {
            width: rect.width, height: rect.height,
            entryCount: entries.length,
            firstEntryLen: entries[0]?.textContent?.trim().length || 0,
          }
        })

        assert(layout.width > 0 && layout.height > 0,
          `sheet visible: ${Math.round(layout.width)}×${Math.round(layout.height)}`)
        assert(layout.entryCount > 0, `has ${layout.entryCount} annotation entries`)
        assert(layout.firstEntryLen > 0, `entry has text (${layout.firstEntryLen} chars)`)
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

      const hasTarget = (await page.$('.ann-target')) !== null
      assert(hasTarget, 'annotation target exists in vertical mode')

      if (hasTarget) {
        await tapElement(page, '.ann-target')
        const sheet = await page.waitForSelector('.ann-sheet.vertical', { timeout: 5000 })

        const layout = await page.evaluate(el => {
          const rect = el.getBoundingClientRect()
          const body = el.querySelector('.ann-sheet-body')
          const bodyRect = body ? body.getBoundingClientRect() : null
          const dragBar = el.querySelector('.ann-sheet-drag-bar')
          const dragBarRect = dragBar ? dragBar.getBoundingClientRect() : null
          const entries = el.querySelectorAll('.ann-entry')
          return {
            sheetW: rect.width, sheetH: rect.height,
            sheetL: rect.left,
            bodyW: bodyRect?.width || 0, bodyH: bodyRect?.height || 0,
            dragL: dragBarRect?.left || 0, dragW: dragBarRect?.width || 0, dragH: dragBarRect?.height || 0,
            entryCount: entries.length,
            firstEntryLen: entries[0]?.textContent?.trim().length || 0,
          }
        }, sheet)

        assert(layout.sheetW > 200, `sheet width ${Math.round(layout.sheetW)}`)
        assert(layout.sheetH >= 800, `sheet height ${Math.round(layout.sheetH)}`)
        assert(layout.bodyW > 100, `body width ${Math.round(layout.bodyW)} (content visible)`)
        assert(layout.bodyH > 100, `body height ${Math.round(layout.bodyH)} (content visible)`)
        assert(layout.dragW > 0, `drag bar exists (${Math.round(layout.dragW)}px wide)`)
        assert(layout.dragH > 0, `drag bar height ${Math.round(layout.dragH)}`)
        // Drag bar should be on the RIGHT side of the sheet
        assert(layout.dragL > layout.sheetL + layout.sheetW / 2,
          `drag bar on RIGHT side (left=${Math.round(layout.dragL)} > sheet mid=${Math.round(layout.sheetL + layout.sheetW / 2)})`)
        assert(layout.entryCount > 0, `${layout.entryCount} entries`)
        assert(layout.firstEntryLen > 0, `entry text: ${layout.firstEntryLen} chars`)
      }
      await page.close()
    }

    // ── Test 3: Swipe left dismisses vertical sheet ──
    console.log('\nTest 3: Swipe left on drag bar dismisses vertical sheet')
    {
      const page = await makeMobilePage(browser)
      await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })
      await page.evaluate(() => { localStorage.setItem('layout', 'vertical') })
      await page.reload({ waitUntil: 'networkidle0', timeout: 15000 })

      await tapElement(page, '.ann-target')
      await page.waitForSelector('.ann-sheet.vertical', { timeout: 5000 })

      const hasDragBar = (await page.$('.ann-sheet-drag-bar')) !== null
      assert(hasDragBar, 'drag bar found')

      if (hasDragBar) {
        await swipeLeft(page, '.ann-sheet-drag-bar', 10)
        await new Promise(r => setTimeout(r, 600))

        const stillVisible = await page.evaluate(() => {
          const el = document.querySelector('.ann-sheet.vertical')
          if (!el) return false
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.left >= 0
        })
        assert(!stillVisible, 'sheet dismissed after left-swipe')
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

      await tapElement(page, '.ann-target')
      await page.waitForSelector('.ann-sheet', { timeout: 5000 })

      // Use Puppeteer mouse click (not touch) at top-left area
      await page.mouse.click(20, 20)
      await new Promise(r => setTimeout(r, 300))

      const visible = await page.evaluate(() => {
        const el = document.querySelector('.ann-sheet')
        if (!el) return false
        const r = el.getBoundingClientRect()
        // Sheet is hidden if translated below viewport (top >= window.innerHeight)
        return r.height > 0 && r.top < window.innerHeight
      })
      assert(!visible, 'sheet dismissed after outside tap')
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
