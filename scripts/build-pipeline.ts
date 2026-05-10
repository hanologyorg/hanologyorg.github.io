import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { ChamJsonConverter } from '@hanology/cham'
import type { OutputPiece, AuthorRecord } from '@hanology/cham'
import { parse as yamlParse } from 'yaml'

const contentDir = 'library/content'
const authorsDir = 'library/authors'
const outputDir = 'site/public/data'

// ─── Load author registry from author library ─────────────────

function loadAuthors(): Record<string, AuthorRecord> {
  const yaml = { parse: yamlParse }
  const indexPath = join(authorsDir, '_index.yaml')
  if (!existsSync(indexPath)) return {}

  const index = yaml.parse(readFileSync(indexPath, 'utf-8'))
  const seen = new Set<string>()
  const result: Record<string, AuthorRecord> = {}

  for (const [ref, dirName] of Object.entries(index.authors as Record<string, string>)) {
    if (seen.has(dirName)) continue
    seen.add(dirName)

    const yamlPath = join(authorsDir, dirName, 'author.yaml')
    if (!existsSync(yamlPath)) continue

    const data = yaml.parse(readFileSync(yamlPath, 'utf-8'))

    let bio = ''
    if (data.bio_sources?.length > 0) {
      const bioFile = join(authorsDir, dirName, data.bio_sources[0].file)
      if (existsSync(bioFile)) {
        bio = readFileSync(bioFile, 'utf-8').replace(/^---\n.*?\n---\n/s, '').trim()
      }
    }

    result[ref] = {
      name: data.label,
      dynasty: data.dynasty || '',
      bio: bio || '',
    }
  }

  // Map alias refs to canonical record
  for (const [ref, dirName] of Object.entries(index.authors as Record<string, string>)) {
    if (!result[ref]) {
      const canonical = Object.entries(index.authors as Record<string, string>).find(
        ([r, d]) => d === dirName && result[r]
      )
      if (canonical) result[ref] = result[canonical[0]]
    }
  }

  return result
}

// ─── Build supplementary outputs ──────────────────────────────

function buildAuthorsJson(
  authors: Record<string, AuthorRecord>,
  allPieces: OutputPiece[],
): void {
  // Count pieces per author ref
  const pieceCounts = new Map<string, number>()
  for (const p of allPieces) {
    pieceCounts.set(p.authorId, (pieceCounts.get(p.authorId) || 0) + 1)
  }

  // Deduplicate: alias refs share the same AuthorRecord, emit one entry per unique record
  const seen = new Set<string>()
  const entries: object[] = []
  for (const [id, data] of Object.entries(authors)) {
    const key = data.name
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      '@id': `author:${encodeURIComponent(data.name)}`,
      '@type': 'Person',
      name: data.name,
      dynasty: data.dynasty || '',
      bio: data.bio || '',
      poemCount: pieceCounts.get(id) || 0,
    })
  }

  writeFileSync(
    join(outputDir, 'authors.json'),
    JSON.stringify(entries, null, 2),
    'utf-8',
  )
}

function buildDynastiesJson(allPieces: OutputPiece[]): void {
  const map = new Map<string, { authors: Set<string>; count: number }>()

  for (const piece of allPieces) {
    const d = piece.dynasty
    if (!d) continue
    if (!map.has(d)) map.set(d, { authors: new Set(), count: 0 })
    const entry = map.get(d)!
    entry.authors.add(piece.author)
    entry.count++
  }

  const result: Record<string, unknown> = {}
  for (const [name, data] of map) {
    result[name] = {
      '@id': `dynasty:${encodeURIComponent(name)}`,
      '@type': 'HistoricalPeriod',
      name,
      authors: [...data.authors],
      poemCount: data.count,
    }
  }

  writeFileSync(
    join(outputDir, 'dynasties.json'),
    JSON.stringify(result, null, 2),
    'utf-8',
  )
}

// ─── Main ─────────────────────────────────────────────────────

const authors = loadAuthors()
const converter = new ChamJsonConverter()

const { library, allPieces } = converter.convertLibrary({
  libraryDir: contentDir,
  outputDir,
  authors,
})

buildAuthorsJson(authors, allPieces)
buildDynastiesJson(allPieces)

console.log(`\nSupplementary: ${Object.keys(authors).length} authors, dynasties written`)
