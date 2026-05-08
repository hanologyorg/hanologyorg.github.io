/**
 * PDF 文本提取管線 — 從所有下載的 PDF 提取文本
 *
 * 用法：npx tsx scripts/extract-text.ts [collection]
 *   collection: secondary | culture | nss | all
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const RESOURCES = join(ROOT, 'library/resources')
const OUTPUT = join(ROOT, 'output')

// Use the existing PdfExtractor
let extractor: any = null
async function getExtractor() {
  if (!extractor) {
    const { PdfExtractor } = await import('../src/extractors/PdfExtractor.js')
    extractor = new PdfExtractor()
  }
  return extractor
}

async function extractCollection(
  name: string,
  pdfDir: string,
  outFile: string,
  idPrefix: string,
  extraFields?: (filename: string) => Record<string, any>
) {
  console.log(`\n📄 ${name} — 提取文本`)
  const files = readdirSync(pdfDir).filter(f => f.endsWith('.pdf')).sort()
  console.log(`  找到 ${files.length} 個 PDF`)

  const results: any[] = []
  let extracted = 0, failed = 0

  for (const file of files) {
    const pdfPath = join(pdfDir, file)
    const id = file.replace(/\.pdf$/i, '')

    try {
      const ext = await getExtractor()
      const pages = await ext.extract(pdfPath)
      const fullText = pages.join('\n')
      const entry: any = {
        id: `${idPrefix}:${id}`,
        file,
        pages: pages.length,
        chars: fullText.length,
        text: fullText,
        ...(extraFields?.(file) ?? {}),
      }
      results.push(entry)
      extracted++
      process.stdout.write(`  ✓ ${file} (${pages.length}p, ${fullText.length}c)\n`)
    } catch (err: any) {
      failed++
      process.stdout.write(`  ✗ ${file}: ${err.message}\n`)
      results.push({ id: `${idPrefix}:${id}`, file, error: err.message })
    }
  }

  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`  完成：${extracted} 成功, ${failed} 失敗 → ${outFile}`)
}

// ─── Secondary ──────────────────────────────────────

async function extractSecondary() {
  const pdfDir = join(RESOURCES, 'secondary', 'pdf')
  const outFile = join(OUTPUT, 'secondary-texts.json')

  // Load manifest for title mapping
  const manifest = JSON.parse(readFileSync(join(ROOT, 'output', 'secondary-manifest.json'), 'utf-8'))
  const titleMap = new Map<number, string>()
  for (const p of manifest.poems) titleMap.set(p.num, p.title)

  await extractCollection('積學與涵泳', pdfDir, outFile, 'secondary', (file) => {
    const num = parseInt(file.match(/\d+/)?.[0] ?? '0', 10)
    return { num, title: titleMap.get(num) ?? '' }
  })
}

// ─── Culture ────────────────────────────────────────

async function extractCulture() {
  // Extract articles
  const articlesDir = join(RESOURCES, 'culture', 'articles')
  const articlesOut = join(OUTPUT, 'culture-articles-text.json')

  if (existsSync(articlesDir)) {
    await extractCollection('郁文華章—選篇分析', articlesDir, articlesOut, 'culture:article', (file) => {
      const num = parseInt(file.match(/\d+/)?.[0] ?? '0', 10)
      return { num }
    })
  }

  // Extract essays
  const essaysDir = join(RESOURCES, 'culture', 'essays')
  const essaysOut = join(OUTPUT, 'culture-essays-text.json')

  if (existsSync(essaysDir)) {
    await extractCollection('郁文華章—文化集思', essaysDir, essaysOut, 'culture:essay', (file) => {
      const num = parseInt(file.match(/\d+/)?.[0] ?? '0', 10)
      return { num }
    })
  }

  // Extract teaching designs
  const teachDir = join(RESOURCES, 'culture', 'teaching')
  const teachOut = join(OUTPUT, 'culture-teaching-text.json')

  if (existsSync(teachDir)) {
    await extractCollection('郁文華章—教學設計', teachDir, teachOut, 'culture:teaching', (file) => {
      const num = parseInt(file.match(/\d+/)?.[0] ?? '0', 10)
      return { num }
    })
  }
}

// ─── NSS ────────────────────────────────────────────

async function extractNSS() {
  const pdfDir = join(RESOURCES, 'nss', 'pdf')
  const outFile = join(OUTPUT, 'nss-texts.json')

  const nssInfo = [
    { num: 1, title: '論仁、論孝、論君子' },
    { num: 2, title: '魚我所欲也' },
    { num: 3, title: '逍遙遊' },
    { num: 4, title: '勸學' },
    { num: 5, title: '廉頗藺相如列傳' },
    { num: 6, title: '出師表' },
    { num: 7, title: '師說' },
    { num: 8, title: '始得西山宴遊記' },
    { num: 9, title: '岳陽樓記' },
    { num: 10, title: '六國論' },
    { num: 11, title: '唐詩三首' },
    { num: 12, title: '詞三首' },
  ]

  await extractCollection('NSS 指定篇章', pdfDir, outFile, 'nss', (file) => {
    const num = parseInt(file.match(/\d+/)?.[0] ?? '0', 10)
    const info = nssInfo.find(n => n.num === num)
    return { num, title: info?.title ?? '' }
  })
}

// ─── Main ────────────────────────────────────────────

const collection = process.argv[2] || 'all'

async function main() {
  console.log('古典詩文圖書館 — PDF 文本提取')

  switch (collection) {
    case 'secondary': await extractSecondary(); break
    case 'culture': await extractCulture(); break
    case 'nss': await extractNSS(); break
    case 'all':
      await extractSecondary()
      await extractCulture()
      await extractNSS()
      break
    default:
      console.log(`未知集合：${collection}`)
      process.exit(1)
  }

  console.log('\n✓ 文本提取完成')
}

main().catch(console.error)
