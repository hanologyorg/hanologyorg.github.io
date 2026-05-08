/**
 * 培訓材料解析器 — 直接解析 HTML 表格
 * 用法：npx tsx scripts/parse-training.ts
 */

import * as https from 'node:https'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const EDB_BASE = 'https://www.edb.gov.hk'

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'text/html,*/*' },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location
        if (loc) return fetchPage(loc.startsWith('http') ? loc : EDB_BASE + loc).then(resolve, reject)
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    }).on('error', reject)
  })
}

function resolveUrl(href: string): string {
  if (href.startsWith('http')) return href
  if (href.startsWith('//')) return 'https:' + href
  return EDB_BASE + href
}

type TrainingCategory = 'learning_teaching' | 'curriculum_assessment' | 'classical_texts'

interface TrainingEntry {
  id: string
  date: string
  title: string
  speakers: string
  category: TrainingCategory
  files: { title: string; url: string }[]
  series?: string
  collection: 'training'
}

const CATEGORY_MAP: Record<string, TrainingCategory> = {
  '學與教資源': 'learning_teaching',
  '課程詮釋及學習評估': 'curriculum_assessment',
  '文言經典學習材料系列': 'classical_texts',
}

function parseTrainingHTML(html: string): TrainingEntry[] {
  const entries: TrainingEntry[] = []
  let currentCategory: TrainingCategory = 'learning_teaching'
  let counter = 0

  // Detect category changes from headings
  const categoryHeadings: { text: string; category: TrainingCategory }[] = [
    { text: '學與教資源', category: 'learning_teaching' },
    { text: '課程詮釋及學習評估', category: 'curriculum_assessment' },
    { text: '文言經典學習材料系列', category: 'classical_texts' },
  ]

  // Parse each table row
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = m[1]
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1])

    // Check for category headings before this row
    const beforeText = html.substring(Math.max(0, m.index! - 1000), m.index!)
    for (const ch of categoryHeadings) {
      if (beforeText.includes(ch.text)) {
        currentCategory = ch.category
      }
    }

    if (cells.length < 3) continue

    const date = cells[0].replace(/<[^>]+>/g, '').trim()
    if (!date.match(/\d{4}/)) continue // Skip header rows

    const title = cells[1].replace(/<[^>]+>/g, '').trim()
    if (!title || title.length < 2) continue

    const speakers = cells[2].replace(/<[^>]+>/g, '').trim()

    // Extract files from the remaining cells
    const files: { title: string; url: string }[] = []
    for (let i = 3; i < cells.length; i++) {
      const cellText = cells[i].replace(/<[^>]+>/g, '').trim()
      for (const link of cells[i].matchAll(/href="([^"]+)"/g)) {
        const url = resolveUrl(link[1])
        const ext = url.match(/\.(\w+)$/)?.[1]?.toUpperCase() ?? ''
        files.push({ title: cellText || `講義 (${ext})`, url })
      }
    }

    counter++
    const entry: TrainingEntry = {
      id: `training:${String(counter).padStart(3, '0')}`,
      date,
      title,
      speakers,
      category: currentCategory,
      files,
      collection: 'training',
    }

    // Detect series from title
    if (title.includes('重讀經典')) {
      const seriesMatch = title.match(/重讀經典[（(]?([一二三四五六七八九十]+)[）)]?/)
      entry.series = seriesMatch ? `重讀經典（${seriesMatch[1]}）` : '重讀經典'
    } else if (title.includes('賞析與品味')) {
      const seriesMatch = title.match(/賞析與品味[（(]?([一二三四五六七八九十]+)[）)]?/)
      entry.series = seriesMatch ? `賞析與品味（${seriesMatch[1]}）` : '賞析與品味'
    }

    entries.push(entry)
  }

  return entries
}

async function main() {
  console.log('培訓材料 — 抓取 HTML 並解析\n')

  const html = await fetchPage('https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/teacher-training.html')
  console.log(`頁面大小：${html.length} bytes`)

  const entries = parseTrainingHTML(html)
  console.log(`解析到 ${entries.length} 條培訓材料`)

  const output = {
    source: '中學中國語文 — 研討會/工作坊參考資料',
    sourceUrl: 'https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/teacher-training.html',
    total: entries.length,
    byCategory: {
      learning_teaching: entries.filter(e => e.category === 'learning_teaching').length,
      curriculum_assessment: entries.filter(e => e.category === 'curriculum_assessment').length,
      classical_texts: entries.filter(e => e.category === 'classical_texts').length,
    },
    series: [...new Set(entries.filter(e => e.series).map(e => e.series!))],
    materials: entries,
  }

  const outPath = join(ROOT, 'site', 'public', 'data', 'training-materials.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n輸出: ${outPath}`)
  console.log(`  學與教資源: ${output.byCategory.learning_teaching}`)
  console.log(`  課程詮釋: ${output.byCategory.curriculum_assessment}`)
  console.log(`  文言經典: ${output.byCategory.classical_texts}`)
  console.log(`  系列: ${output.series.join(', ')}`)
}

main().catch(console.error)
