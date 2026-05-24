import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import puppeteer, { type Browser, type Page } from 'puppeteer'
import { createServer, type Server } from 'http'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import handler from 'serve-handler'

let browser: Browser
let page: Page
let server: Server
let baseUrl: string

// Serve the built dist directory
function startServer(): Promise<{ server: Server; url: string }> {
  const distDir = resolve(__dirname, '../dist')
  return new Promise((resolve, reject) => {
    const srv = createServer((req, res) =>
      handler(req, res, { public: distDir, cleanUrls: true }),
    )
    srv.listen(0, () => {
      const addr = srv.address()
      if (typeof addr === 'object' && addr) {
        resolve({ server: srv, url: `http://127.0.0.1:${addr.port}` })
      } else {
        reject(new Error('Failed to start server'))
      }
    })
  })
}

async function setupPage(width: number, height: number) {
  page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.setRequestInterception(true)
  page.on('request', req => {
    if (req.resourceType() === 'font') req.abort()
    else req.continue()
  })
  return page
}

describe('Annotation pane E2E', () => {
  beforeAll(async () => {
    const distDir = resolve(__dirname, '../dist')
    if (!existsSync(distDir) || !existsSync(resolve(distDir, 'nss/15.html'))) {
      throw new Error('Run `npm run build` first — dist/ not found')
    }
    const result = await startServer()
    server = result.server
    baseUrl = result.url
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    })
  }, 30000)

  afterAll(async () => {
    await browser?.close()
    await new Promise<void>((res) => server?.close(() => res()))
  })

  it('mobile annotation sheet shows content when tapping an annotation', async () => {
    page = await setupPage(375, 812)
    await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })

    // Find an annotation target
    const annTarget = await page.$('.ann-target')
    expect(annTarget).toBeTruthy()

    // Tap the annotation target
    const box = await annTarget!.boundingBox()
    expect(box).toBeTruthy()

    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForSelector('.ann-sheet', { timeout: 5000 })

    // Verify the sheet is visible and has annotation entries
    const sheetVisible = await page.$eval('.ann-sheet', el => {
      const rect = el.getBoundingClientRect()
      return {
        visible: rect.width > 0 && rect.height > 0,
        width: rect.width,
        height: rect.height,
      }
    })
    expect(sheetVisible.visible).toBe(true)

    // Verify annotation entries exist and have content
    const entries = await page.$$eval('.ann-sheet .ann-entry', els =>
      els.map(el => ({
        hasKind: el.querySelector('.ann-kind') !== null,
        textContent: el.textContent?.trim().length || 0,
      }))
    )
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0].hasKind).toBe(true)
    expect(entries[0].textContent).toBeGreaterThan(0)
  }, 20000)

  it('mobile vertical sheet shows content and drag bar side-by-side', async () => {
    page = await setupPage(375, 812)
    await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })

    // Set vertical layout via localStorage before page loads
    await page.evaluate(() => {
      localStorage.setItem('layout', 'vertical')
    })
    await page.reload({ waitUntil: 'networkidle0', timeout: 15000 })

    const annTarget = await page.$('.ann-target')
    expect(annTarget).toBeTruthy()

    const box = await annTarget!.boundingBox()
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForSelector('.ann-sheet.vertical', { timeout: 5000 })

    // Sheet must be full viewport height and have content
    const layout = await page.$eval('.ann-sheet.vertical', el => {
      const rect = el.getBoundingClientRect()
      const body = el.querySelector('.ann-sheet-body')
      const bodyRect = body ? body.getBoundingClientRect() : null
      const dragBar = el.querySelector('.ann-sheet-drag-bar')
      const dragBarRect = dragBar ? dragBar.getBoundingClientRect() : null
      const entries = el.querySelectorAll('.ann-entry')
      const firstEntryText = entries[0]?.textContent?.trim() || ''
      return {
        sheetWidth: rect.width,
        sheetHeight: rect.height,
        bodyWidth: bodyRect?.width || 0,
        bodyHeight: bodyRect?.height || 0,
        dragBarWidth: dragBarRect?.width || 0,
        entryCount: entries.length,
        firstEntryLength: firstEntryText.length,
      }
    })

    // Sheet fills viewport
    expect(layout.sheetWidth).toBeGreaterThan(200)
    expect(layout.sheetHeight).toBeGreaterThanOrEqual(800)

    // Body has visible dimensions (not pushed off screen)
    expect(layout.bodyWidth).toBeGreaterThan(100)
    expect(layout.bodyHeight).toBeGreaterThan(100)

    // Drag bar exists
    expect(layout.dragBarWidth).toBeGreaterThan(0)

    // Annotation entries have content
    expect(layout.entryCount).toBeGreaterThan(0)
    expect(layout.firstEntryLength).toBeGreaterThan(0)
  }, 20000)

  it('swipe on drag bar dismisses vertical sheet', async () => {
    page = await setupPage(375, 812)
    await page.evaluate(() => {
      localStorage.setItem('layout', 'vertical')
    })
    await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })

    const annTarget = await page.$('.ann-target')
    const box = await annTarget!.boundingBox()
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForSelector('.ann-sheet.vertical', { timeout: 5000 })

    // Find drag bar and simulate swipe
    const dragBar = await page.$('.ann-sheet-drag-bar')
    expect(dragBar).toBeTruthy()
    const dragBox = await dragBar!.boundingBox()
    expect(dragBox).toBeTruthy()

    // Swipe right on the drag bar
    const startX = dragBox!.x + dragBox!.width / 2
    const startY = dragBox!.y + dragBox!.height / 2
    await page.touchscreen.tap(startX, startY)

    // Simulate touch drag
    const touchPoint = { x: startX, y: startY }
    await page.touchscreen.touchStart(touchPoint)
    for (let i = 1; i <= 5; i++) {
      await page.touchscreen.touchMove({ x: startX + i * 30, y: startY })
    }
    await page.touchscreen.touchEnd()

    await page.waitForTimeout(500)

    // Sheet should be dismissed (no longer visible or hidden)
    const sheetExists = await page.$('.ann-sheet.vertical')
    // After dismiss, the sheet element may still exist but not be visible
    if (sheetExists) {
      const isVisible = await page.$eval('.ann-sheet.vertical', el => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.left >= 0
      })
      // Sheet either removed from DOM or pushed off-screen
      expect(isVisible).toBe(false)
    }
    // If sheetExists is null, it was removed — also passes
    expect(true).toBe(true)
  }, 20000)

  it('non-vertical mobile sheet dismisses on outside tap', async () => {
    page = await setupPage(375, 812)
    await page.evaluate(() => {
      localStorage.setItem('layout', 'horizontal')
    })
    await page.goto(`${baseUrl}/nss/15.html`, { waitUntil: 'networkidle0', timeout: 15000 })

    const annTarget = await page.$('.ann-target')
    const box = await annTarget!.boundingBox()
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForSelector('.ann-sheet:not(.vertical)', { timeout: 5000 })

    // Tap outside the sheet (top-left corner)
    await page.touchscreen.tap(20, 20)
    await page.waitForTimeout(300)

    const sheetVisible = await page.evaluate(() => {
      const sheet = document.querySelector('.ann-sheet')
      if (!sheet) return false
      const rect = sheet.getBoundingClientRect()
      return rect.height > 0
    })
    expect(sheetVisible).toBe(false)
  }, 20000)
})
