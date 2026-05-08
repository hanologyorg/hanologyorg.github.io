/**
 * 文化頁面資源下載器 — 直接解析 HTML 提取 PDF URL
 * 用法：npx tsx scripts/download-culture-raw.ts
 */

import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as https from 'node:https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'resources', 'culture')
const DATA = join(ROOT, 'site', 'public', 'data')

const EDB_BASE = 'https://www.edb.gov.hk'
const DELAY = 400

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function resolveUrl(href: string): string {
  if (href.startsWith('http')) return href
  if (href.startsWith('//')) return 'https:' + href
  return EDB_BASE + href
}

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const get = (target: string) => {
      https.get(target, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'text/html,*/*' },
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location
          if (loc) return get(loc.startsWith('http') ? loc : EDB_BASE + loc)
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      }).on('error', reject)
    }
    get(url)
  })
}

async function download(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) return false
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      redirect: 'follow',
    })
    if (!res.ok) return false
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
    return true
  } catch { return false }
}

interface CultureEntry {
  num: number
  title: string
  author: string
  category: string
  section: 'essays' | 'articles' | 'teaching'
  url: string | null
  format: 'pdf' | 'www'
}

function parseCultureHTML(html: string): CultureEntry[] {
  const entries: CultureEntry[] = []

  // Extract all PDF/www links from the page
  const allLinks: { url: string; text: string; isPdf: boolean }[] = []
  for (const m of html.matchAll(/href="([^"]+?\.(?:pdf|PDF)[^"]*)"/g)) {
    allLinks.push({ url: resolveUrl(m[1]), text: '', isPdf: true })
  }
  for (const m of html.matchAll(/href="(https?:\/\/(?!.*\.edb\.gov\.hk)[^"]+)"/g)) {
    allLinks.push({ url: m[1], text: '', isPdf: false })
  }

  // Find table rows in the HTML
  // The culture page has multiple tables: essays, articles (4 sub-tables), teaching designs
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let tableMatch

  // Parse sections based on HTML structure
  const sections = [
    { name: '文化集思', section: 'essays' as const },
    { name: '修身和處世', section: 'articles' as const, category: 'self_cultivation' },
    { name: '家國與人倫', section: 'articles' as const, category: 'family_nation' },
    { name: '美與善', section: 'articles' as const, category: 'beauty_goodness' },
    { name: '人與自然', section: 'articles' as const, category: 'nature' },
    { name: '教學設計', section: 'teaching' as const },
  ]

  let currentSection = 'essays'
  let currentCategory = ''

  // Walk through HTML and assign entries to sections
  const htmlLines = html.split('\n')
  let entryNum = 0

  // Simple approach: find all links and match with surrounding text
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = m[1]
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1])

    if (cells.length < 2) continue

    // Check if this row is a section header
    const rowText = cells.map(c => c.replace(/<[^>]+>/g, '').trim()).join(' ')
    for (const sec of sections) {
      if (rowText.includes(sec.name)) {
        currentSection = sec.section
        currentCategory = (sec as any).category ?? ''
        break
      }
    }

    // Check for section headings in h2/h3 tags before this row
    const beforeText = html.substring(Math.max(0, m.index! - 500), m.index!)
    for (const sec of sections) {
      if (beforeText.includes(sec.name)) {
        currentSection = sec.section
        currentCategory = (sec as any).category ?? ''
      }
    }

    // Extract number and title from cells
    const numText = cells[0].replace(/<[^>]+>/g, '').trim()
    const num = parseInt(numText, 10)
    if (isNaN(num) || num === 0) continue

    const title = cells.length > 1 ? cells[1].replace(/<[^>]+>/g, '').trim() : ''
    const author = cells.length > 2 ? cells[2].replace(/<[^>]+>/g, '').trim() : ''

    if (!title || title.length < 2) continue

    // Extract link from the last cell
    const lastCell = cells[cells.length - 1]
    const linkMatch = lastCell.match(/href="([^"]+)"/)
    const isWww = lastCell.includes('www.gif') || (linkMatch && !linkMatch[1].endsWith('.pdf'))

    entries.push({
      num,
      title,
      author: author || title,
      category: currentCategory,
      section: currentSection,
      url: linkMatch ? resolveUrl(linkMatch[1]) : null,
      format: isWww ? 'www' : 'pdf',
    })
  }

  return entries
}

async function main() {
  console.log('郁文華章 — 抓取 HTML 並下載資源\n')

  // Fetch the culture page HTML
  console.log('📡 抓取頁面...')
  const html = await fetchPage('https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/culture.html')
  console.log(`  頁面大小：${html.length} bytes`)

  // Parse entries
  const entries = parseCultureHTML(html)
  console.log(`  解析到 ${entries.length} 條記錄`)
  console.log(`    文化集思：${entries.filter(e => e.section === 'essays').length}`)
  console.log(`    選篇分析：${entries.filter(e => e.section === 'articles').length}`)
  console.log(`    教學設計：${entries.filter(e => e.section === 'teaching').length}`)

  // Download PDFs
  console.log('\n📥 下載 PDF...')
  let count = 0
  for (const entry of entries) {
    if (!entry.url || entry.format !== 'pdf') continue
    const dir = entry.section === 'essays' ? 'essays' :
                entry.section === 'teaching' ? 'teaching' : 'articles'
    const filename = `${entry.section}_${String(entry.num).padStart(2, '0')}.pdf`
    const dest = join(OUT, dir, filename)

    const ok = await download(entry.url, dest)
    if (ok) {
      count++
      console.log(`  ✓ ${dir}/${filename}: ${entry.title}`)
    }
    await sleep(DELAY)
  }
  console.log(`\n下載完成：${count} PDF`)

  // Update culture-articles.json with actual URLs
  const cultureData = JSON.parse(
    existsSync(join(DATA, 'culture-articles.json'))
      ? require('fs').readFileSync(join(DATA, 'culture-articles.json'), 'utf-8')
      : '{"articles":[],"essays":[],"teachingDesigns":[]}'
  )

  // Merge URLs into existing data
  for (const entry of entries) {
    if (entry.section === 'articles') {
      const article = cultureData.articles?.find((a: any) => a.num === entry.num)
      if (article && entry.url) {
        if (entry.format === 'pdf') article.pdfUrl = entry.url
        else article.externalUrl = entry.url
      }
    } else if (entry.section === 'essays') {
      const essay = cultureData.essays?.find((e: any) => e.num === entry.num)
      if (essay && entry.url) essay.pdfUrl = entry.url
    } else if (entry.section === 'teaching') {
      const design = cultureData.teachingDesigns?.find((d: any) => d.num === entry.num)
      if (design && entry.url) design.pdfUrl = entry.url
    }
  }

  const outPath = join(DATA, 'culture-articles.json')
  writeFileSync(outPath, JSON.stringify(cultureData, null, 2), 'utf-8')
  console.log(`\n更新 ${outPath}`)
}

main().catch(console.error)
