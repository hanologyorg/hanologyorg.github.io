import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, symlinkSync, lstatSync } from 'fs'
import { join, basename } from 'path'

const ROOT = '/Users/mulgogi/src/chinese/primary'
const RESOURCES = join(ROOT, 'resources')
const LIBRARY = join(ROOT, 'library')

type Category = 'primary' | 'secondary' | 'nss' | 'culture' | 'training'

interface LibraryEntry {
  id: string
  title: string
  category: Category
  series: string
  source: string
  files: string[]
}

function migrate(): void {
  mkdirSync(LIBRARY, { recursive: true })

  const index: LibraryEntry[] = []

  const categories: Array<{ dir: string; cat: Category; series: string }> = [
    { dir: join(RESOURCES, 'primary'), cat: 'primary', series: '積累與感興' },
    { dir: join(RESOURCES, 'secondary'), cat: 'secondary', series: '積學與涵泳' },
    { dir: join(RESOURCES, 'nss'), cat: 'nss', series: 'NSS 指定文言經典' },
    { dir: join(RESOURCES, 'culture'), cat: 'culture', series: '文化專題' },
    { dir: join(RESOURCES, 'training'), cat: 'training', series: '教師培訓' },
  ]

  for (const { dir, cat, series } of categories) {
    if (!existsSync(dir)) continue
    const entries = readdirSync(dir).sort()

    for (const entry of entries) {
      const entryPath = join(dir, entry)
      if (!lstatSync(entryPath).isDirectory()) continue

      const files = readdirSync(entryPath)
      const textFile = files.find(f => f === 'text.md')
      const pdfFile = files.find(f => f.endsWith('.pdf'))
      const audioFiles = files.filter(f => f.endsWith('.mp3'))

      // Read title from text.md
      let title = entry
      if (textFile) {
        const content = readFileSync(join(entryPath, textFile), 'utf-8')
        const titleMatch = content.match(/^#\s+(.+)/m)
        if (titleMatch) title = titleMatch[1].trim()
      }

      // Build library ID
      const id = `${cat}-${entry}`

      // Create library directory
      const libDir = join(LIBRARY, cat, entry)
      mkdirSync(libDir, { recursive: true })

      // Copy/symlink files
      for (const f of files) {
        const src = join(entryPath, f)
        const dst = join(libDir, f)
        if (!existsSync(dst)) {
          symlinkSync(src, dst)
        }
      }

      index.push({
        id,
        title,
        category: cat,
        series,
        source: entryPath.replace(ROOT + '/', ''),
        files: files.sort(),
      })
    }
  }

  // Write index
  writeFileSync(join(LIBRARY, 'index.json'), JSON.stringify(index, null, 2), 'utf-8')

  // Summary
  const byCat = new Map<string, number>()
  for (const e of index) byCat.set(e.category, (byCat.get(e.category) || 0) + 1)

  console.log(`Library index: ${index.length} entries`)
  for (const [cat, count] of byCat) {
    console.log(`  ${cat}: ${count}`)
  }
}

migrate()
