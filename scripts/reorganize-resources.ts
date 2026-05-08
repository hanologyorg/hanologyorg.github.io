/**
 * 資源重組腳本 — 將資源按篇章組織為獨立資料夾
 *
 * 每個篇章一個資料夾：
 *   resources/{collection}/{num}-{title}/
 *     ├── original.pdf
 *     ├── audio_taici.mp3
 *     ├── audio_yinsong.mp3
 *     ├── audio_mandarin.mp3
 *     └── text.md
 *
 * 用法：npx tsx scripts/reorganize-resources.ts
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, renameSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const RESOURCES = join(ROOT, 'resources')

function safeReadJson(path: string): any {
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return null }
}

function sanitize(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[（(]/g, '_').replace(/[）)]/g, '')
    .replace(/‧/g, '_').replace(/·/g, '_')
    .replace(/，/g, '_').replace(/、/g, '_')
    .replace(/__/g, '_')
    .slice(0, 60)
}

function moveIfExists(src: string, dest: string) {
  if (existsSync(src)) {
    mkdirSync(dirname(dest), { recursive: true })
    renameSync(src, dest)
  }
}

// ─── Secondary (積學與涵泳) ─────────────────────────

function reorganizeSecondary() {
  console.log('\n📁 積學與涵泳 — 重組')

  const manifest = safeReadJson(join(ROOT, 'output', 'secondary-manifest.json'))
  const texts = safeReadJson(join(ROOT, 'output', 'secondary-texts.json'))
  if (!manifest) { console.log('  ⚠ 無 manifest'); return }

  const textMap = new Map<number, any>()
  if (texts) for (const t of texts) if (t.num) textMap.set(t.num, t)

  let count = 0
  for (const poem of manifest.poems) {
    const dirName = `${String(poem.num).padStart(3, '0')}-${sanitize(poem.title)}`
    const itemDir = join(RESOURCES, 'secondary', dirName)
    mkdirSync(itemDir, { recursive: true })

    // Move PDF
    const oldPdf = join(RESOURCES, 'secondary', 'pdf', `secondary_${String(poem.num).padStart(3, '0')}.pdf`)
    moveIfExists(oldPdf, join(itemDir, 'original.pdf'))

    // Move audio
    const audioTypes = [
      { old: '_taici.mp3', new: 'audio_taici.mp3' },
      { old: '_yinsong.mp3', new: 'audio_yinsong.mp3' },
      { old: '_mandarin.mp3', new: 'audio_mandarin.mp3' },
    ]
    for (const { old, new: newName } of audioTypes) {
      const oldAudio = join(RESOURCES, 'secondary', 'audio', `secondary_${String(poem.num).padStart(3, '0')}${old}`)
      moveIfExists(oldAudio, join(itemDir, newName))
    }

    // Write text.md
    const textData = textMap.get(poem.num)
    if (textData?.text) {
      const md = buildSecondaryMd(poem, textData.text)
      writeFileSync(join(itemDir, 'text.md'), md, 'utf-8')
    }

    count++
  }

  // Clean up empty dirs
  cleanupDir(join(RESOURCES, 'secondary', 'pdf'))
  cleanupDir(join(RESOURCES, 'secondary', 'audio'))
  console.log(`  完成：${count} 個篇章資料夾`)
}

function buildSecondaryMd(poem: any, rawText: string): string {
  const lines = [
    `# ${poem.title}`,
    '',
    `> 積學與涵泳—中學古詩文誦讀材料選編 第 ${poem.num} 篇`,
    '',
  ]

  // Try to parse sections from raw text
  const sections: [string, RegExp][] = [
    ['原文', /^([\s\S]*?)(?=一、作者簡介|$)/],
    ['作者簡介', /一、作者簡介\s*\n([\s\S]*?)(?=二、|$)/],
    ['背景資料', /二、背景資料\s*\n([\s\S]*?)(?=三、|$)/],
    ['注釋', /三、注釋\s*\n([\s\S]*?)(?=四、|$)/],
    ['賞析', /四、賞析重點\s*\n([\s\S]*?)(?=$)/],
  ]

  for (const [heading, regex] of sections) {
    const match = rawText.match(regex)
    if (match && match[1].trim()) {
      lines.push(`## ${heading}`, '', match[1].trim(), '')
    }
  }

  return lines.join('\n')
}

// ─── Culture (郁文華章) ──────────────────────────────

function reorganizeCulture() {
  console.log('\n📁 郁文華章 — 重組')

  const data = safeReadJson(join(ROOT, 'site', 'public', 'data', 'culture-articles.json'))
  const articleTexts = safeReadJson(join(ROOT, 'output', 'culture-articles-text.json'))
  const essayTexts = safeReadJson(join(ROOT, 'output', 'culture-essays-text.json'))
  const teachingTexts = safeReadJson(join(ROOT, 'output', 'culture-teaching-text.json'))
  if (!data) { console.log('  ⚠ 無 culture data'); return }

  let count = 0

  // Articles
  const articleTextMap = new Map<number, string>()
  if (articleTexts) for (const t of articleTexts) if (t.num) articleTextMap.set(t.num, t.text)

  for (const article of (data.articles ?? [])) {
    const dirName = `${String(article.num).padStart(2, '0')}-${sanitize(article.title)}`
    const itemDir = join(RESOURCES, 'culture', dirName)
    mkdirSync(itemDir, { recursive: true })

    // Move PDF from articles directory
    const patterns = [
      join(RESOURCES, 'culture', 'articles', `articles_${String(article.num).padStart(2, '0')}.pdf`),
    ]
    for (const p of patterns) moveIfExists(p, join(itemDir, 'analysis.pdf'))

    // Write text.md
    const text = articleTextMap.get(article.num)
    if (text) {
      const categoryLabel = { self_cultivation: '修身和處世', family_nation: '家國與人倫', beauty_goodness: '美與善', nature: '人與自然' }[article.category] ?? article.category
      const md = [
        `# ${article.title}`,
        '',
        `> 郁文華章—選篇分析 #${article.num}`,
        `> 分類：${categoryLabel}`,
        `> 作者/出處：${article.author}`,
        '',
        text,
      ].join('\n')
      writeFileSync(join(itemDir, 'text.md'), md, 'utf-8')
    }
    count++
  }

  // Essays
  const essayTextMap = new Map<number, string>()
  if (essayTexts) for (const t of essayTexts) if (t.num) essayTextMap.set(t.num, t.text)

  for (const essay of (data.essays ?? [])) {
    const dirName = `essay-${String(essay.num).padStart(2, '0')}-${sanitize(essay.title)}`
    const itemDir = join(RESOURCES, 'culture', dirName)
    mkdirSync(itemDir, { recursive: true })

    const patterns = [
      join(RESOURCES, 'culture', 'essays', `essays_${String(essay.num).padStart(2, '0')}.pdf`),
    ]
    for (const p of patterns) moveIfExists(p, join(itemDir, 'essay.pdf'))

    const text = essayTextMap.get(essay.num)
    if (text) {
      writeFileSync(join(itemDir, 'text.md'),
        `# ${essay.title}\n\n> 郁文華章—文化集思 #${essay.num}\n> 作者：${essay.author}\n\n${text}`, 'utf-8')
    }
    count++
  }

  // Teaching designs
  const teachingTextMap = new Map<number, string>()
  if (teachingTexts) for (const t of teachingTexts) if (t.num) teachingTextMap.set(t.num, t.text)

  for (const design of (data.teachingDesigns ?? [])) {
    const dirName = `teaching-${String(design.num).padStart(2, '0')}-${sanitize(design.title)}`
    const itemDir = join(RESOURCES, 'culture', dirName)
    mkdirSync(itemDir, { recursive: true })

    const patterns = [
      join(RESOURCES, 'culture', 'teaching', `teaching_${String(design.num).padStart(2, '0')}.pdf`),
    ]
    for (const p of patterns) moveIfExists(p, join(itemDir, 'design.pdf'))

    const text = teachingTextMap.get(design.num)
    if (text) {
      writeFileSync(join(itemDir, 'text.md'),
        `# ${design.title}\n\n> 郁文華章—教學設計 #${design.num}\n\n${text}`, 'utf-8')
    }
    count++
  }

  // Clean up
  cleanupDir(join(RESOURCES, 'culture', 'articles'))
  cleanupDir(join(RESOURCES, 'culture', 'essays'))
  cleanupDir(join(RESOURCES, 'culture', 'teaching'))
  console.log(`  完成：${count} 個篇章資料夾`)
}

// ─── NSS (指定篇章) ──────────────────────────────────

function reorganizeNSS() {
  console.log('\n📁 NSS 指定篇章 — 重組')

  const data = safeReadJson(join(ROOT, 'site', 'public', 'data', 'nss-settexts.json'))
  const texts = safeReadJson(join(ROOT, 'output', 'nss-texts.json'))
  if (!data) { console.log('  ⚠ 無 NSS data'); return }

  const textMap = new Map<number, string>()
  if (texts) for (const t of texts) if (t.num) textMap.set(t.num, t.text)

  let count = 0

  for (const text of data.texts) {
    const dirName = `${String(text.num).padStart(2, '0')}-${sanitize(text.title)}`
    const itemDir = join(RESOURCES, 'nss', dirName)
    mkdirSync(itemDir, { recursive: true })

    // Move PDF
    const oldPdf = join(RESOURCES, 'nss', 'pdf', `nss_${String(text.num).padStart(2, '0')}.pdf`)
    moveIfExists(oldPdf, join(itemDir, 'original.pdf'))

    // Move audio
    const num = String(text.num).padStart(2, '0')
    const audioTypes = [
      { old: `_taici.mp3`, new: 'audio_taici.mp3' },
      { old: `_yinsong.mp3`, new: 'audio_yinsong.mp3' },
      { old: `_mandarin.mp3`, new: 'audio_mandarin.mp3' },
    ]
    for (const { old, new: newName } of audioTypes) {
      moveIfExists(join(RESOURCES, 'nss', 'audio', `nss_${num}${old}`), join(itemDir, newName))
    }

    // Write text.md
    const extractedText = textMap.get(text.num)
    const md = [
      `# ${text.title}`,
      '',
      `> NSS 指定文言經典學習材料 #${text.num}`,
      `> 作者：${text.author}（${text.dynasty}）`,
      text.source ? `> 出處：${text.source}` : '',
      text.excerptRange ? `> ${text.excerptRange}` : '',
      '',
      extractedText ?? '',
    ].filter(Boolean).join('\n')
    writeFileSync(join(itemDir, 'text.md'), md, 'utf-8')

    count++
  }

  // Clean up
  cleanupDir(join(RESOURCES, 'nss', 'pdf'))
  cleanupDir(join(RESOURCES, 'nss', 'audio'))
  console.log(`  完成：${count} 個篇章資料夾`)
}

// ─── Helpers ──────────────────────────────────────────

function cleanupDir(dir: string) {
  if (!existsSync(dir)) return
  const files = readdirSync(dir)
  if (files.length === 0) {
    // Remove empty directory (sync, non-recursive)
    try { const { rmdirSync } = require('node:fs'); rmdirSync(dir) } catch { /* keep */ }
  }
}

function main() {
  console.log('古典詩文圖書館 — 資源重組')
  reorganizeSecondary()
  reorganizeCulture()
  reorganizeNSS()
  console.log('\n✓ 重組完成')
}

main()
