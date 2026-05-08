/**
 * 培訓材料重組 — 按條目組織為獨立資料夾
 * resources/training/{num}-{title}/
 *   ├── slide_1.pdf
 *   ├── slide_2.pdf
 *   └── text.md
 * 用法：npx tsx scripts/reorganize-training.ts
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, renameSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const TRAINING = join(ROOT, 'resources', 'training')

function safeReadJson(path: string): any {
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return null }
}

function sanitize(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/&mdash;?/g, '—').replace(/&nbsp;?/g, '')
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

const CATEGORY_LABELS: Record<string, string> = {
  learning_teaching: '學與教資源',
  curriculum_assessment: '課程詮釋及學習評估',
  classical_texts: '文言經典學習材料系列',
}

function main() {
  console.log('培訓材料 — 重組\n')

  const data = safeReadJson(join(ROOT, 'site', 'public', 'data', 'training-materials.json'))
  if (!data) { console.log('  ⚠ 無 training data'); return }

  const pdfDir = join(TRAINING, 'pdf')
  let count = 0
  let filesMoved = 0
  let filesMissing = 0

  for (const entry of data.materials) {
    const num = parseInt(entry.id.split(':')[1])
    const dirName = `${String(num).padStart(3, '0')}-${sanitize(entry.title)}`
    const itemDir = join(TRAINING, dirName)
    mkdirSync(itemDir, { recursive: true })

    // Move PDF files
    for (let i = 0; i < entry.files.length; i++) {
      const file = entry.files[i]
      const filename = file.url.split('/').pop()?.split('?')[0] ?? ''
      const srcPath = join(pdfDir, filename)

      if (existsSync(srcPath)) {
        const ext = filename.match(/\.(\w+)$/)?.[1] ?? 'pdf'
        const destPath = join(itemDir, `slide_${i + 1}.${ext}`)
        moveIfExists(srcPath, destPath)
        filesMoved++
      } else {
        filesMissing++
      }
    }

    // Write text.md
    const categoryLabel = CATEGORY_LABELS[entry.category] ?? entry.category
    const lines = [
      `# ${entry.title.replace(/&mdash;?/g, '—').replace(/&nbsp;?/g, '')}`,
      '',
      `> 教師培訓 — ${categoryLabel}`,
      `> 日期：${entry.date}`,
      `> 講者：${entry.speakers.replace(/&nbsp;?/g, '').trim()}`,
    ]
    if (entry.series) lines.push(`> 系列：${entry.series}`)
    lines.push('')
    if (entry.files.length > 0) {
      lines.push('## 參考資料')
      lines.push('')
      for (let i = 0; i < entry.files.length; i++) {
        lines.push(`${i + 1}. [${entry.files[i].title.replace(/&nbsp;?/g, '').trim() || `講義 ${i+1}`}](slide_${i+1}.pdf)`)
      }
      lines.push('')
    }

    writeFileSync(join(itemDir, 'text.md'), lines.join('\n'), 'utf-8')
    count++
  }

  console.log(`  完成：${count} 個培訓資料夾`)
  console.log(`  移動：${filesMoved} 個 PDF`)
  if (filesMissing) console.log(`  缺少：${filesMissing} 個 PDF（未下載）`)
}

main()
