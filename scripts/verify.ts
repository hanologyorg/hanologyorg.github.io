import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { parse } from '@hanology/cham'
import { parse as yamlParse } from 'yaml'

const CONTENT_DIR = 'library/content'
const AUTHORS_DIR = 'library/authors'

let totalFiles = 0
let ok = 0
let fail = 0
const errors: string[] = []
const warnings: string[] = []
const allContributorRefs = new Set<string>()

// ─── Scan all text.cham.md across all collections ────────────

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

      // Collect contributor refs
      if (doc.meta.type === 'primary' && doc.meta.contributors) {
        for (const c of doc.meta.contributors) {
          if (c.ref) allContributorRefs.add(c.ref)
        }
      }

      if (doc.meta.type === 'primary') {
        if (doc.meta.id === undefined || doc.meta.id === null) errors.push(`${label}: missing id`)

        // Check marker ↔ annotation consistency
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

        // Check annotation value brackets
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

// ─── Author library checks ──────────────────────────────────

const indexPath = join(AUTHORS_DIR, '_index.yaml')
if (existsSync(indexPath)) {
  const index = yamlParse(readFileSync(indexPath, 'utf-8'))
  const authorDirs = index.authors as Record<string, string>

  // Check: every text.cham.md contributor ref exists in _index
  for (const ref of allContributorRefs) {
    if (!authorDirs[ref]) {
      errors.push(`author library: ref "${ref}" used in text.cham.md but not in _index.yaml`)
    }
  }

  // Check: every _index directory exists and has author.yaml
  const checkedDirs = new Set<string>()
  for (const [ref, dirName] of Object.entries(authorDirs)) {
    if (checkedDirs.has(dirName)) continue
    checkedDirs.add(dirName)

    const dirPath = join(AUTHORS_DIR, dirName)
    if (!existsSync(dirPath)) {
      errors.push(`author library: directory ${dirName} (ref ${ref}) does not exist`)
      continue
    }

    const yamlPath = join(dirPath, 'author.yaml')
    if (!existsSync(yamlPath)) {
      errors.push(`author library: ${dirName}/author.yaml missing`)
      continue
    }

    try {
      const data = yamlParse(readFileSync(yamlPath, 'utf-8'))
      if (!data.label) errors.push(`author library: ${dirName}/author.yaml missing label`)
      if (!data.ref) errors.push(`author library: ${dirName}/author.yaml missing ref`)

      // Check bio_sources files exist
      for (const bs of (data.bio_sources || [])) {
        const bsPath = join(dirPath, bs.file)
        if (!existsSync(bsPath)) {
          errors.push(`author library: ${dirName}/${bs.file} referenced but missing`)
        }
      }
    } catch (e: any) {
      errors.push(`author library: ${dirName}/author.yaml parse error: ${e.message.substring(0, 100)}`)
    }
  }

  console.log(`\nAuthor library: ${checkedDirs.size} directories, ${Object.keys(authorDirs).length} refs (${allContributorRefs.size} used by text.cham.md)`)
}

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
