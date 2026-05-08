/**
 * 小學古詩文重組 — 按篇組織為獨立資料夾
 * resources/primary/{num}-{title}/
 *   ├── original.pdf
 *   └── text.md
 * 用法：npx tsx scripts/reorganize-primary.ts
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const PRIMARY = join(ROOT, 'resources', 'primary')

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

function main() {
  console.log('積累與感興（小學）— 重組\n')

  const poems = safeReadJson(join(ROOT, 'site', 'public', 'data', 'poems.json'))
  const authors = safeReadJson(join(ROOT, 'site', 'public', 'data', 'authors.json'))
  const dynasties = safeReadJson(join(ROOT, 'site', 'public', 'data', 'dynasties.json'))
  if (!poems) { console.log('  ⚠ 無 poems data'); return }

  const authorMap = new Map<string, any>()
  if (authors) for (const a of authors) authorMap.set(a.id ?? a.name, a)

  let count = 0
  for (const poem of poems) {
    const dirName = `${String(poem.num).padStart(3, '0')}-${sanitize(poem.title)}`
    const itemDir = join(PRIMARY, dirName)
    mkdirSync(itemDir, { recursive: true })

    // Move PDF
    const oldPdf = join(ROOT, 'pdfs', `jilei_shi_${String(poem.num).padStart(3, '0')}.pdf`)
    moveIfExists(oldPdf, join(itemDir, 'original.pdf'))

    // Build text.md
    const lines = [
      `# ${poem.title}`,
      '',
      `> 積累與感興—小學古詩文誦讀材料選編 第 ${poem.num} 篇`,
      `> 作者：${poem.author}${poem.dynasty ? `（${poem.dynasty}）` : ''}`,
    ]
    if (poem.source) lines.push(`> 出處：${poem.source}`)
    lines.push('')

    // Original text from verses
    if (poem.verses?.length) {
      lines.push('## 原文')
      lines.push('')
      for (const verse of poem.verses) {
        lines.push(verse.text)
      }
      lines.push('')
    }

    // Annotations
    if (poem.annotations?.length) {
      lines.push('## 注釋')
      lines.push('')
      for (const ann of poem.annotations) {
        const note = ann.notes?.map((n: any) => n.text ?? n).join('；') ?? ann.text ?? ''
        lines.push(`- **${ann.word}**：${note}`)
      }
      lines.push('')
    }

    writeFileSync(join(itemDir, 'text.md'), lines.join('\n'), 'utf-8')
    count++
  }

  console.log(`  完成：${count} 個篇章資料夾`)
}

main()
