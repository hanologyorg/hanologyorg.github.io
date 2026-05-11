#!/usr/bin/env npx tsx
/**
 * Hanology Library Manager — CLI wrapper for src/library/.
 *
 * All logic lives in the library module (loader, registry, correspondence).
 * This script only handles CLI dispatch and output formatting.
 *
 * Commands:
 *   stats              Show library statistics
 *   correspond         Check CHAM ↔ register correspondence
 *   query <ref>        Query an entity by ref (e.g. A018, A203)
 *   registries [ref]   Output ChamRegistries summary
 *   dynasties          Show dynasty register
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  loadLibrary,
  buildRegistries,
  checkCorrespondence,
} from '../src/library/index.js'
import type { LibraryData } from '../src/library/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LIBRARY_DIR = join(__dirname, '..', 'library')

function main() {
  const command = process.argv[2]
  const arg = process.argv[3]

  const data = loadLibrary(LIBRARY_DIR)

  switch (command) {
    case 'stats':
      showStats(data)
      break
    case 'correspond':
      showCorrespondence(data)
      break
    case 'query':
      if (!arg) {
        console.error('Usage: library-manager.ts query <ref>')
        process.exit(1)
      }
      queryEntity(arg, data)
      break
    case 'registries':
      showRegistries(data, arg)
      break
    case 'dynasties':
      showDynasties(data)
      break
    default:
      console.log(`
Hanology Library Manager

Commands:
  stats              Show library statistics
  correspond         Check CHAM ↔ register correspondence
  query <ref>        Query an entity by ref (e.g. A018, A203)
  registries [ref]   Output ChamRegistries summary
  dynasties          Show dynasty register
`)
  }
}

// ─── Stats ─────────────────────────────────────────────────────

function showStats(data: LibraryData) {
  let withCtext = 0, withWikidata = 0, withBio = 0, withOffice = 0
  const dynastyCounts: Record<string, number> = {}

  for (const [, entity] of data.persons) {
    if (entity['@id']) withCtext++
    if (entity['cprop:authority-wikidata']) withWikidata++
    if (entity.bio_sources?.length) withBio++
    if (entity['cprop:held-office']) withOffice++
    const d = entity.dynasty || '?'
    dynastyCounts[d] = (dynastyCounts[d] || 0) + 1
  }

  const refCount = Object.keys(data.ctextTypeIndex).length

  console.log(`
+==========================================================+
|           HANOLOGY LIBRARY -- 漢學圖書館統計             |
+==========================================================+
|                                                          |
|  PERSON REGISTER (library/authors/)                      |
|    Unique directories:  ${String(data.personDirs).padStart(4)}                               |
|    Total refs (incl aliases): ${String(Object.keys(data.personIndex).length).padStart(4)}                          |
|    With ctext @id:     ${String(withCtext).padStart(4)}                               |
|    With Wikidata:      ${String(withWikidata).padStart(4)}                               |
|    With bio articles:  ${String(withBio).padStart(4)}                               |
|    With held-office:   ${String(withOffice).padStart(4)}                               |
|                                                          |
|  DYNASTY REGISTER (library/register/)                    |
|    Entries:            ${String(data.dynasties.length).padStart(4)}                               |
|                                                          |
|  CHAM CONTENT (library/content/)                         |
|    Text files:         ${String(data.chamTotalFiles).padStart(4)}                               |
|    Unique contributor refs: ${String(data.chamRefs.size).padStart(4)}                          |
|                                                          |
|  REFERENCE DATA (library/reference/)                     |
|    Total ctext entities: ${String(refCount).padStart(6)}                           |
|                                                          |
+==========================================================+
`)

  console.log('  Dynasty distribution:')
  for (const [d, count] of Object.entries(dynastyCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${d}: ${'█'.repeat(Math.min(count, 40))} ${count}`)
  }
}

// ─── Correspondence ────────────────────────────────────────────

function showCorrespondence(data: LibraryData) {
  console.log('Checking CHAM ↔ Register correspondence...\n')
  const result = checkCorrespondence(data)

  console.log(`Stats: ${JSON.stringify(result.stats, null, 2)}\n`)

  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`)
    for (const w of result.warnings) console.log(`  ⚠ ${w}`)
  }

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`)
    for (const e of result.errors) console.log(`  ✗ ${e}`)
  }

  if (result.errors.length === 0) {
    console.log('\n✓ All correspondence checks passed.')
  }
}

// ─── Query ─────────────────────────────────────────────────────

function queryEntity(ref: string, data: LibraryData) {
  const dirName = data.personIndex[ref]
  if (!dirName) {
    console.log(`Ref "${ref}" not found in register.`)
    return
  }

  const canonicalEntry = Object.entries(data.personIndex).find(
    ([r, d]) => d === dirName && data.persons.has(r),
  )
  const canonicalRef = canonicalEntry?.[0] || ref
  const entity = data.persons.get(canonicalRef)

  if (!entity) {
    console.log(`No entity data for ref "${ref}" (dir: ${dirName})`)
    return
  }

  const bio = data.personBios.get(canonicalRef)

  console.log(`\n+==================================================+`)
  console.log(`|  ${entity.label} (${ref})`)
  if (canonicalRef !== ref) console.log(`|  alias of: ${canonicalRef}`)
  console.log(`+==================================================+`)
  console.log(`  Type:     ${entity['@type']}`)
  console.log(`  ctext:    ${entity['@id']}`)
  if (entity.dynasty) console.log(`  Dynasty:  ${entity.dynasty}`)
  if (entity['cprop:name-style']) console.log(`  字:       ${entity['cprop:name-style']}`)
  if (entity['cprop:name-art']) console.log(`  號:       ${entity['cprop:name-art']}`)
  if (entity['cprop:born']) console.log(`  Born:     ${entity['cprop:born']['@value']}`)
  if (entity['cprop:died']) console.log(`  Died:     ${entity['cprop:died']['@value']}`)
  if (entity.alt_names?.length) console.log(`  Alt:      ${entity.alt_names.join(', ')}`)
  if (entity.alias_refs?.length) console.log(`  Aliases:  ${entity.alias_refs.join(', ')}`)
  if (entity['cprop:authority-wikidata']) console.log(`  Wikidata: ${entity['cprop:authority-wikidata']}`)
  if (entity['cprop:authority-cbdb']) console.log(`  CBDB:     ${entity['cprop:authority-cbdb']}`)
  if (entity['cprop:held-office']) console.log(`  Offices:  ${entity['cprop:held-office'].length} held`)
  if (entity.bio_sources?.length) {
    console.log(`  Bios:     ${entity.bio_sources.map(b => b.publication).join(', ')}`)
  }
  if (bio) console.log(`  Bio text: ${bio.slice(0, 80)}...`)
  console.log()
}

// ─── Registries ────────────────────────────────────────────────

function showRegistries(data: LibraryData, sampleRef?: string) {
  const registries = buildRegistries(data)
  const { authors, dynasties } = registries
  console.log(JSON.stringify({
    authors: Object.keys(authors).length,
    dynasties: dynasties.length,
    sample: {
      author: authors[sampleRef || 'A018'],
      dynasty: dynasties.find(d => d.label === '唐'),
    },
  }, null, 2))
}

// ─── Dynasties ─────────────────────────────────────────────────

function showDynasties(data: LibraryData) {
  console.log(`\nDynasty Register (${data.dynasties.length} entries):\n`)
  for (const d of data.dynasties) {
    const range = d.start && d.end
      ? `${d.start < 0 ? d.start : '+' + d.start} ~ ${d.end < 0 ? d.end : '+' + d.end}`
      : 'dates unknown'
    const parent = d.parent ? ` (< ${d.parent})` : ''
    const ctext = d.ctext_id ? ` ctext:${d.ctext_id}` : ''
    console.log(`  ${d.label.padEnd(6)} ${range.padEnd(20)}${parent}${ctext}`)
  }
  console.log()
}

main()
