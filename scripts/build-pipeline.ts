import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { ChamJsonConverter } from '@hanology/cham'
import type { OutputPiece, AuthorRecord } from '@hanology/cham'

const contentDir = 'library/content'
const dataDir = 'library/data'
const outputDir = 'site/public/data'

// ─── Load author registry ─────────────────────────────────────

function loadAuthors(): Record<string, AuthorRecord> {
  const yamlPath = join(dataDir, 'authors.yaml')
  if (!existsSync(yamlPath)) return {}

  const yaml = require('yaml')
  return yaml.parse(readFileSync(yamlPath, 'utf-8')) || {}
}

// ─── Build supplementary outputs ──────────────────────────────

function buildAuthorsJson(
  authors: Record<string, AuthorRecord>,
  allPieces: OutputPiece[],
): void {
  // Count pieces per author
  const pieceCounts = new Map<string, number>()
  for (const p of allPieces) {
    pieceCounts.set(p.authorId, (pieceCounts.get(p.authorId) || 0) + 1)
  }

  const entries = Object.entries(authors).map(([id, data]) => ({
    '@id': `author:${encodeURIComponent(data.name)}`,
    '@type': 'Person',
    name: data.name,
    dynasty: data.dynasty || '',
    bio: data.bio || '',
    poemCount: pieceCounts.get(id) || 0,
  }))

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
