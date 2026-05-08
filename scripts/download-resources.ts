/**
 * 資源下載腳本 — 統一下載所有集合的 PDF 和音頻
 *
 * 用法：npx tsx scripts/download-resources.ts [collection]
 *   collection: secondary | culture | nss | training | all
 *
 * 特性：
 * - 速率控制（每次請求間隔 500ms）
 * - 斷點續傳（跳過已下載檔案）
 * - 進度報告
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const RESOURCES = join(ROOT, 'library/resources')
const DATA = join(ROOT, 'site', 'public', 'data')

const DELAY_MS = 500
const MAX_RETRIES = 3

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) {
    return false // already downloaded
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': '*/*',
        },
        redirect: 'follow',
      })

      if (!res.ok) {
        if (res.status === 404) {
          console.log(`  ⚠ 404: ${url}`)
          return false
        }
        throw new Error(`HTTP ${res.status}`)
      }

      const buffer = Buffer.from(await res.arrayBuffer())
      mkdirSync(join(dest, '..'), { recursive: true })
      writeFileSync(dest, buffer)
      return true
    } catch (err: any) {
      if (attempt < MAX_RETRIES) {
        console.log(`  ↻ 重試 ${attempt}/${MAX_RETRIES}: ${basename(dest)}`)
        await sleep(2000)
      } else {
        console.log(`  ✗ 失敗: ${basename(dest)} — ${err.message}`)
        return false
      }
    }
  }
  return false
}

// ─── Secondary Collection ───────────────────────────

async function downloadSecondary() {
  console.log('\n📚 積學與涵泳 — 下載 PDF 和音頻')

  const manifest = JSON.parse(readFileSync(join(ROOT, 'output', 'secondary-manifest.json'), 'utf-8'))
  const poems = manifest.poems.filter((p: any) => p.pdfUrl || p.audio.cantonese_taici || p.audio.mandarin)

  let pdfCount = 0, audioCount = 0, skipCount = 0

  for (const poem of poems) {
    const num = String(poem.num).padStart(3, '0')

    // PDF
    if (poem.pdfUrl) {
      const dest = join(RESOURCES, 'secondary', 'pdf', `secondary_${num}.pdf`)
      const downloaded = await downloadFile(poem.pdfUrl, dest)
      if (downloaded) {
        pdfCount++
        console.log(`  ✓ PDF ${num}: ${poem.title}`)
      } else if (existsSync(dest)) {
        skipCount++
      }
      await sleep(DELAY_MS)
    }

    // Audio
    const audioTypes = [
      { key: 'cantonese_taici', suffix: '_taici.mp3' },
      { key: 'cantonese_yinsong', suffix: '_yinsong.mp3' },
      { key: 'mandarin', suffix: '_mandarin.mp3' },
    ]

    for (const { key, suffix } of audioTypes) {
      const url = poem.audio?.[key]
      if (url) {
        const dest = join(RESOURCES, 'secondary', 'audio', `secondary_${num}${suffix}`)
        const downloaded = await downloadFile(url, dest)
        if (downloaded) {
          audioCount++
          console.log(`  ✓ 音頻 ${num}${suffix}: ${poem.title}`)
        } else if (existsSync(dest)) {
          skipCount++
        }
        await sleep(DELAY_MS)
      }
    }
  }

  console.log(`\n  完成：${pdfCount} PDF + ${audioCount} 音頻（${skipCount} 已存在）`)
}

// ─── NSS Collection ─────────────────────────────────

async function downloadNSS() {
  console.log('\n🎓 NSS 指定篇章 — 下載 PDF 和音頻')

  // First, fetch the NSS settext page to get actual URLs
  const nssData = JSON.parse(readFileSync(join(DATA, 'nss-settexts.json'), 'utf-8'))

  // Parse the NSS settext page for PDF and audio URLs
  const html = await fetchNSSPageHTML()
  if (!html) {
    console.log('  ⚠ 無法獲取 NSS 頁面，嘗試直接下載已知 URL 模式...')
  }

  // Known URL patterns from EDB:
  // PDF: https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/nss-lang/settext-text/...pdf
  // Audio: embedded in <object> tags

  let pdfCount = 0, audioCount = 0

  for (const text of nssData.texts) {
    const num = String(text.num).padStart(3, '0')

    // Try known PDF URL patterns
    const pdfPatterns = [
      `https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/nss-lang/settext-text/settext${text.num}.pdf`,
      `https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/nss-lang/settext-text/settext_${String(text.num).padStart(2, '0')}.pdf`,
    ]

    for (const url of pdfPatterns) {
      const dest = join(RESOURCES, 'nss', 'pdf', `nss_${num}.pdf`)
      if (existsSync(dest)) break
      const downloaded = await downloadFile(url, dest)
      if (downloaded) {
        pdfCount++
        console.log(`  ✓ PDF ${num}: ${text.title}`)
        break
      }
      await sleep(DELAY_MS)
    }

    // Handle sub-items
    if (text.subItems) {
      for (const sub of text.subItems) {
        const subId = sub.id.split(':')[1]
        console.log(`  📄 子篇章: ${sub.title} (${sub.author})`)
      }
    }
  }

  console.log(`\n  完成：${pdfCount} PDF`)
  console.log('  ⚠ 音頻 URL 嵌入在頁面 <object> 標籤中，需手動提取或使用瀏覽器下載')
}

async function fetchNSSPageHTML(): Promise<string | null> {
  try {
    const res = await fetch('https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/nss-lang/settext-text.html')
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

// ─── Culture Collection ─────────────────────────────

async function downloadCulture() {
  console.log('\n📜 郁文華章 — 下載 PDF')

  // Fetch the culture page HTML to extract actual PDF URLs
  const html = await fetchCulturePageHTML()
  if (html) {
    const urls = extractCulturePDFUrls(html)
    console.log(`  找到 ${urls.length} 個資源 URL`)

    let count = 0
    for (const { url, filename, section } of urls) {
      const dir = section === 'essays' ? 'essays' : section === 'teaching' ? 'teaching' : 'articles'
      const dest = join(RESOURCES, 'culture', dir, filename)
      const downloaded = await downloadFile(url, dest)
      if (downloaded) {
        count++
        console.log(`  ✓ ${filename}`)
      }
      await sleep(DELAY_MS)
    }
    console.log(`\n  完成：${count} PDF`)
  } else {
    console.log('  ⚠ 無法獲取郁文華章頁面')
  }
}

async function fetchCulturePageHTML(): Promise<string | null> {
  try {
    const res = await fetch('https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/culture.html')
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

function extractCulturePDFUrls(html: string): { url: string; filename: string; section: string }[] {
  const results: { url: string; filename: string; section: string }[] = []

  // Match all href attributes with .pdf or external links
  const hrefRegex = /href="([^"]*?\.pdf[^"]*?)"/gi
  let match

  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1]
    if (url.includes('/attachment/')) {
      const fullUrl = url.startsWith('http') ? url : `https://www.edb.gov.hk${url}`
      const filename = basename(new URL(fullUrl).pathname)
      // Determine section from surrounding context
      const beforeIndex = match.index
      const beforeText = html.substring(Math.max(0, beforeIndex - 2000), beforeIndex)
      const section = beforeText.includes('文化集思') ? 'essays' :
                      beforeText.includes('教學設計') ? 'teaching' : 'articles'
      results.push({ url: fullUrl, filename, section })
    }
  }

  return results
}

// ─── Training Collection ────────────────────────────

async function downloadTraining() {
  console.log('\n👩‍🏫 教師培訓 — 下載簡報 PDF')

  const html = await fetchTrainingPageHTML()
  if (html) {
    const urls = extractTrainingPDFUrls(html)
    console.log(`  找到 ${urls.length} 個 PDF URL`)

    let count = 0
    for (const { url, filename } of urls) {
      const dest = join(RESOURCES, 'training', 'pdf', filename)
      const downloaded = await downloadFile(url, dest)
      if (downloaded) {
        count++
        console.log(`  ✓ ${filename}`)
      }
      await sleep(DELAY_MS)
    }
    console.log(`\n  完成：${count} PDF`)
  } else {
    console.log('  ⚠ 無法獲取培訓頁面')
  }
}

async function fetchTrainingPageHTML(): Promise<string | null> {
  try {
    const res = await fetch('https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/teacher-training.html')
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

function extractTrainingPDFUrls(html: string): { url: string; filename: string }[] {
  const results: { url: string; filename: string }[] = []
  const hrefRegex = /href="([^"]*?\.pdf[^"]*?)"/gi
  let match

  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1]
    if (url.includes('/attachment/')) {
      const fullUrl = url.startsWith('http') ? url : `https://www.edb.gov.hk${url}`
      const filename = basename(new URL(fullUrl).pathname)
      results.push({ url: fullUrl, filename })
    }
  }

  return results
}

// ─── Main ────────────────────────────────────────────

async function main() {
  const collection = process.argv[2] || 'all'

  console.log('古典詩文圖書館 — 資源下載器')
  console.log(`目標：${collection}`)
  console.log(`目錄：${RESOURCES}`)

  switch (collection) {
    case 'secondary':
      await downloadSecondary()
      break
    case 'nss':
      await downloadNSS()
      break
    case 'culture':
      await downloadCulture()
      break
    case 'training':
      await downloadTraining()
      break
    case 'all':
      await downloadSecondary()
      await downloadCulture()
      await downloadNSS()
      await downloadTraining()
      break
    default:
      console.log(`未知集合：${collection}`)
      console.log('用法：npx tsx scripts/download-resources.ts [secondary|culture|nss|training|all]')
      process.exit(1)
  }

  console.log('\n✓ 下載完成')
}

main().catch(console.error)
