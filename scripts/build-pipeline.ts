import { writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { ChamJsonConverter } from '@hanology/cham'
import type { OutputPiece, AuthorRecord } from '@hanology/cham'
import { loadLibrary, buildRegistries } from '../src/library/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const contentDir = join(__dirname, '..', 'library', 'content')
const outputDir = join(__dirname, '..', 'site', 'public', 'data')
const libraryDir = join(__dirname, '..', 'library')

// ─── Load author registry via library module ──────────────────

const libraryData = loadLibrary(libraryDir)
const registries = buildRegistries(libraryData)

// ─── Build supplementary outputs ──────────────────────────────

function buildAuthorsJson(
  authors: Record<string, AuthorRecord>,
  allPieces: OutputPiece[],
): void {
  const pieceCounts = new Map<string, number>()
  for (const p of allPieces) {
    pieceCounts.set(p.authorId, (pieceCounts.get(p.authorId) || 0) + 1)
  }

  const seen = new Set<string>()
  const entries: object[] = []
  for (const [id, data] of Object.entries(authors)) {
    const key = data.name
    if (seen.has(key)) continue
    seen.add(key)
    const entry: Record<string, unknown> = {
      '@id': `author:${encodeURIComponent(data.name)}`,
      '@type': 'Person',
      name: data.name,
      dynasty: data.dynasty || '',
      bio: data.bio || '',
      poemCount: pieceCounts.get(id) || 0,
    }
    if (data.born) entry.born = data.born
    if (data.died) entry.died = data.died
    if (data.courtesyName) entry.courtesyName = data.courtesyName
    if (data.artName) entry.artName = data.artName
    if (data.wikidata) entry.wikidata = data.wikidata
    if (data.ctextId) entry.ctextId = data.ctextId
    if (data.wikipediaZh) entry.wikipediaZh = data.wikipediaZh
    if (data.wikipediaEn) entry.wikipediaEn = data.wikipediaEn
    entries.push(entry)
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

const authors = registries.authors
const converter = new ChamJsonConverter()

const { library, allPieces } = converter.convertLibrary({
  libraryDir: contentDir,
  outputDir,
  authors,
})

buildAuthorsJson(authors, allPieces)
buildDynastiesJson(allPieces)

console.log(`\nSupplementary: ${Object.keys(authors).length} authors, dynasties written`)
