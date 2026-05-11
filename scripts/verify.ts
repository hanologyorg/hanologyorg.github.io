import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parse } from '@hanology/cham'
import { loadLibrary, checkCorrespondence } from '../src/library/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = join(__dirname, '..', 'library', 'content')

let totalFiles = 0
let ok = 0
let fail = 0
const errors: string[] = []
const warnings: string[] = []
const allContributorRefs = new Set<string>()

// ─── Scan all text.cham.md across all collections ────────────

import { readdirSync, statSync, readFileSync, existsSync } from 'fs'

const collections = readdirSync(CONTENT_DIR).filter(d =>
  statSync(join(CONTENT_DIR, d)).isDirectory() && d !== '.DS_Store'
)

for (const coll of collections.sort()) {
  const collDir = join(CONTENT_DIR, coll)
  const bookYaml = join(collDir, 'book.yaml')
  if (!existsSync(bookYaml)) continue

  const pieces = readdirSync(collDir).filter(d => {
    const p = join(collDir, d)
    return statSync(p).isDirectory() && existsSync(join(p, 'text.cham.md'))
  }).sort()

  for (const piece of pieces) {
    totalFiles++
    const piecePath = join(collDir, piece)
    const chamPath = join(piecePath, 'text.cham.md')
    const label = `${coll}/${piece}`

    try {
      const src = readFileSync(chamPath, 'utf-8')
      const doc = parse(src)

      if (!doc.meta.title) errors.push(`${label}: missing title`)

      if (doc.meta.contributors) {
        for (const c of doc.meta.contributors) {
          if (c.ref) allContributorRefs.add(c.ref)
        }
      }

      if (doc.meta.type === 'primary') {
        if (doc.meta.id === undefined || doc.meta.id === null) errors.push(`${label}: missing id`)

        const markerIds = new Set(doc.markers.keys())
        const annoMarkerIds = new Set<number>()
        for (const section of doc.sections) {
          for (const entry of section.entries) {
            if (entry.target.type === 'marker') annoMarkerIds.add(entry.target.markerId)
          }
        }

        const orphanMarkers = [...markerIds].filter(id => !annoMarkerIds.has(id))
        const orphanAnnos = [...annoMarkerIds].filter(id => !markerIds.has(id))

        if (orphanMarkers.length > 0)
          warnings.push(`${label}: ${orphanMarkers.length} markers without annotations (${orphanMarkers.slice(0, 5).join(',')}${orphanMarkers.length > 5 ? '...' : ''})`)
        if (orphanAnnos.length > 0)
          warnings.push(`${label}: ${orphanAnnos.length} annotations without markers (${orphanAnnos.join(',')})`)

        for (const section of doc.sections) {
          for (const entry of section.entries) {
            if (entry.value && entry.value.startsWith('。')) {
              warnings.push(`${label}: annotation starts with 。 (marker ${entry.target.type === 'marker' ? entry.target.markerId : '?'})`)
            }
          }
        }
      }

      ok++
    } catch (e: any) {
      fail++
      errors.push(`${label}: PARSE ERROR: ${e.message.substring(0, 200)}`)
    }
  }
}

console.log(`CHAM verification: ${ok} OK, ${fail} FAIL out of ${totalFiles} total`)

// ─── Author library correspondence check ─────────────────────

const libraryDir = join(__dirname, '..', 'library')
const libraryData = loadLibrary(libraryDir)
const result = checkCorrespondence(libraryData)

console.log(`\nAuthor library: ${libraryData.personDirs} directories, ${Object.keys(libraryData.personIndex).length} refs (${allContributorRefs.size} used by text.cham.md)`)

for (const e of result.errors) errors.push(`correspondence: ${e}`)
for (const w of result.warnings) warnings.push(`correspondence: ${w}`)

// ─── Report ──────────────────────────────────────────────────

if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`)
  for (const w of warnings) console.log(`  ⚠ ${w}`)
}

if (errors.length > 0) {
  console.log(`\nErrors (${errors.length}):`)
  for (const e of errors) console.log(`  ✗ ${e}`)
}

if (fail === 0 && errors.length === 0) {
  console.log('\nAll checks passed.')
}
