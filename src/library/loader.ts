/**
 * Data loader — the I/O boundary.
 *
 * Reads YAML-LD files from the library submodule into typed objects.
 * This is the ONLY module that touches the filesystem.
 * All other modules consume the LibraryData structure.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { parse as yamlParse } from 'yaml'
import type { LibraryData, PersonEntity, DynastyEntity } from './types.js'

/**
 * Load all library data from disk.
 * The single function that reads from the filesystem.
 */
export function loadLibrary(libraryDir: string): LibraryData {
  const authorsDir = join(libraryDir, 'authors')
  const registerDir = join(libraryDir, 'register')
  const referenceDir = join(libraryDir, 'reference')
  const contentDir = join(libraryDir, 'content')

  const personData = loadPersonRegister(authorsDir)
  const dynastyData = loadDynastyRegister(registerDir)
  const refData = loadReferenceIndexes(referenceDir)
  const chamData = loadChamRefs(contentDir)

  return {
    ...personData,
    ...dynastyData,
    ...refData,
    ...chamData,
  }
}

// ─── Person register ──────────────────────────────────────────────

function loadPersonRegister(authorsDir: string): {
  persons: Map<string, PersonEntity>
  personBios: Map<string, string>
  personIndex: Record<string, string>
  personDirs: number
} {
  const indexPath = join(authorsDir, '_index.yaml')
  if (!existsSync(indexPath)) {
    return { persons: new Map(), personBios: new Map(), personIndex: {}, personDirs: 0 }
  }

  const indexData = yamlParse(readFileSync(indexPath, 'utf-8'))
  const personIndex: Record<string, string> = indexData.authors
  const seenDirs = new Set<string>()
  const persons = new Map<string, PersonEntity>()
  const personBios = new Map<string, string>()

  for (const [ref, dirName] of Object.entries(personIndex) as [string, string][]) {
    if (seenDirs.has(dirName)) continue
    seenDirs.add(dirName)

    const yamlPath = join(authorsDir, dirName, 'author.yaml')
    if (!existsSync(yamlPath)) continue

    const data: PersonEntity = yamlParse(readFileSync(yamlPath, 'utf-8'))
    if (!data) continue

    persons.set(ref, data)

    // Read first bio source
    if (data.bio_sources?.length) {
      const bioFile = join(authorsDir, dirName, data.bio_sources[0].file)
      if (existsSync(bioFile)) {
        const text = readFileSync(bioFile, 'utf-8')
          .replace(/^---\n[\s\S]*?\n---\n/, '')
          .trim()
        if (text) personBios.set(ref, text)
      }
    }
  }

  return { persons, personBios, personIndex, personDirs: seenDirs.size }
}

// ─── Dynasty register ─────────────────────────────────────────────

function loadDynastyRegister(registerDir: string): { dynasties: DynastyEntity[] } {
  const path = join(registerDir, 'dynasties.yaml')
  if (!existsSync(path)) return { dynasties: [] }
  return { dynasties: yamlParse(readFileSync(path, 'utf-8')) || [] }
}

// ─── Reference indexes ────────────────────────────────────────────

function loadReferenceIndexes(referenceDir: string): {
  ctextTypeIndex: Record<string, string>
  ctagNameIndex: Record<string, string[]>
} {
  const typePath = join(referenceDir, '_type-index.json')
  const namePath = join(referenceDir, '_name-index.json')

  return {
    ctextTypeIndex: existsSync(typePath)
      ? JSON.parse(readFileSync(typePath, 'utf-8'))
      : {},
    ctagNameIndex: existsSync(namePath)
      ? JSON.parse(readFileSync(namePath, 'utf-8'))
      : {},
  }
}

// ─── CHAM content refs ────────────────────────────────────────────

function loadChamRefs(contentDir: string): {
  chamRefs: Set<string>
  chamPieceRefs: Array<{ book: string; piece: string; refs: string[] }>
  chamTotalFiles: number
} {
  const chamRefs = new Set<string>()
  const chamPieceRefs: Array<{ book: string; piece: string; refs: string[] }> = []
  let chamTotalFiles = 0

  if (!existsSync(contentDir)) return { chamRefs, chamPieceRefs, chamTotalFiles }

  const books = readdirSync(contentDir).filter(d =>
    statSync(join(contentDir, d)).isDirectory()
  )

  for (const book of books) {
    const bookDir = join(contentDir, book)
    if (!existsSync(join(bookDir, 'book.yaml'))) continue

    const pieces = readdirSync(bookDir).filter(d => {
      const p = join(bookDir, d)
      return statSync(p).isDirectory() && existsSync(join(p, 'text.cham.md'))
    })

    for (const piece of pieces) {
      chamTotalFiles++
      const src = readFileSync(join(bookDir, piece, 'text.cham.md'), 'utf-8')
      const fm = src.match(/^---\n([\s\S]*?)\n---/)
      if (!fm) continue

      try {
        const meta = yamlParse(fm[1])
        if (meta?.contributors) {
          const refs: string[] = []
          for (const c of meta.contributors) {
            if (c.ref) {
              chamRefs.add(c.ref)
              refs.push(c.ref)
            }
          }
          if (refs.length > 0) chamPieceRefs.push({ book, piece, refs })
        }
      } catch { /* skip */ }
    }
  }

  return { chamRefs, chamPieceRefs, chamTotalFiles }
}
