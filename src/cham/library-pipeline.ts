import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { parse } from './parser'
import type {
  BookConfig, BookMeta, BookData, LibraryIndex, LibraryScale, CrossRef,
  OutputPiece, OutputAnnotation, OutputRange, OutputAnnotationLayer, OutputProseSection,
  ChamDocument, PrimaryMeta, AnnotationEntry,
} from './types'

// ─── Helpers ──────────────────────────────────────────────────

function loadYaml(path: string): Record<string, unknown> {
  try {
    const yaml = require('yaml')
    return yaml.parse(readFileSync(path, 'utf-8')) || {}
  } catch {
    return {}
  }
}

function cleanHardWraps(text: string): string {
  return text
    .split('\n\n')
    .map(seg => seg.replace(/\n/g, ''))
    .join('\n\n')
}

// ─── BookScanner ──────────────────────────────────────────────

class BookScanner {
  constructor(private libraryDir: string) {}

  scan(): { config: BookConfig; dir: string }[] {
    const entries = readdirSync(this.libraryDir).sort()
    const books: { config: BookConfig; dir: string }[] = []

    for (const entry of entries) {
      const dir = join(this.libraryDir, entry)
      const bookYamlPath = join(dir, 'book.yaml')
      if (!existsSync(bookYamlPath)) continue

      const raw = loadYaml(bookYamlPath)
      const config: BookConfig = {
        id: raw.id as string,
        title: raw.title as string,
        subtitle: raw.subtitle as string | undefined,
        titleEn: raw.titleEn as string | undefined,
        publisher: raw.publisher as string | undefined,
        genre: raw.genre as BookConfig['genre'],
        contributors: raw.contributors as BookConfig['contributors'],
        date: raw.date as BookConfig['date'],
        hero: raw.hero as string[] | undefined,
        layers: raw.layers as BookConfig['layers'],
        annotation: raw.annotation as BookConfig['annotation'],
      }
      books.push({ config, dir })
    }

    return books
  }

  detectScale(books: { config: BookConfig }[]): LibraryScale {
    if (books.length === 0) return 'single-piece'
    if (books.length === 1) {
      const pieceCount = this.countPieces(books[0].dir)
      return pieceCount <= 1 ? 'single-piece' : 'single-book'
    }
    return 'library'
  }

  private countPieces(bookDir: string): number {
    let count = 0
    for (const entry of readdirSync(bookDir).sort()) {
      if (existsSync(join(bookDir, entry, 'text.cham.md'))) count++
    }
    return count
  }
}

// ─── PieceBuilder ─────────────────────────────────────────────

class PieceBuilder {
  constructor(
    private authors: Record<string, { name: string; dynasty: string; bio?: string }>,
    private bookConfig: BookConfig,
  ) {}

  build(chamPath: string, pieceDir: string, bookId: string): OutputPiece | null {
    const src = readFileSync(chamPath, 'utf-8')
    const doc = parse(src)
    if (doc.meta.type !== 'primary') return null

    const meta = doc.meta as PrimaryMeta
    const verses = doc.textBlocks.map(b => ({ text: b.text }))
    const annotations = this.buildAnnotations(doc)
    const { sections, structuredSections } = this.loadProseSections(pieceDir)
    const annText = this.buildAnnotationsText(doc, annotations)
    if (annText) sections['annotations'] = annText

    const rawContributors = meta.contributors?.length ? meta.contributors : this.bookConfig.contributors || []
    const contributors = rawContributors.map((c: { ref: string; role: string; title?: string }) => ({
      id: c.ref,
      name: this.authors[c.ref]?.name || c.ref,
      role: c.role,
      ...(c.title ? { title: c.title } : {}),
    }))
    const authorId = contributors[0]?.id || ''
    const authorName = contributors[0]?.name || ''
    const dynastyName = this.authors[authorId]?.dynasty
      || meta.date?.dynasty
      || this.bookConfig.date?.dynasty
      || ''

    const layers = this.loadCommentaryLayers(pieceDir, doc)
    const annotationLayers = this.buildAnnotationLayers(layers)

    return {
      bookId,
      num: meta.id as number,
      title: meta.title,
      author: authorName,
      authorId,
      ...(contributors.length > 1 ? { contributors } : {}),
      dynasty: dynastyName,
      genre: meta.genre || this.bookConfig.genre || 'poetry',
      verses,
      sections,
      annotations,
      ...(Object.keys(layers).length > 0 ? { layers } : {}),
      ...(annotationLayers.length > 0 ? { annotationLayers } : {}),
      ...(meta.source ? { source: meta.source } : {}),
      ...(structuredSections.length > 0 ? { structuredSections } : {}),
    }
  }

  private buildAnnotations(doc: ChamDocument): OutputAnnotation[] {
    const annotations: OutputAnnotation[] = []
    let annId = 1

    for (const section of doc.sections) {
      for (const entry of section.entries) {
        const range = this.entryToRange(entry, doc)
        if (!range) continue

        annotations.push({
          id: `${doc.meta.id}-${annId++}`,
          range,
          kind: this.mapKind(entry.kind),
          lang: entry.params.lang,
          text: entry.value.trim(),
          source: 'cham',
        })
      }
    }

    return annotations
  }

  buildAnnotationsWithDoc(layerDoc: ChamDocument, primaryDoc: ChamDocument, layerId: string): OutputAnnotation[] {
    const annotations: OutputAnnotation[] = []
    let annId = 1

    for (const section of layerDoc.sections) {
      for (const entry of section.entries) {
        const range = this.entryToRange(entry, primaryDoc)
        if (!range) continue

        annotations.push({
          id: `${layerId}-${annId++}`,
          range,
          kind: this.mapKind(entry.kind),
          lang: entry.params.lang,
          text: entry.value,
          source: 'cham',
        })
      }
    }

    return annotations
  }

  private entryToRange(entry: AnnotationEntry, doc: ChamDocument): OutputRange | null {
    switch (entry.target.type) {
      case 'title':
        return { type: 'range', scope: 'title', start: 0, end: 1 }
      case 'full':
        return { type: 'range', scope: 'title', start: 0, end: 0 }
      case 'marker': {
        const marker = doc.markers.get(entry.target.markerId)
        if (!marker) {
          return { type: 'range', scope: 'title', start: 0, end: 1 }
        }
        return {
          type: 'range',
          scope: 'verse',
          verseIndex: marker.blockIndex,
          start: marker.offset,
          end: marker.offset + marker.length,
        }
      }
      case 'verse':
        return {
          type: 'range',
          scope: 'verse',
          verseIndex: entry.target.line,
          start: entry.target.char,
          end: entry.target.char,
        }
    }
  }

  private mapKind(kind: string): string {
    if (kind === 'pron') return 'pronunciation'
    if (kind === 'meaning') return 'semantic'
    return kind
  }

  private loadProseSections(pieceDir: string): {
    sections: Record<string, string>
    structuredSections: OutputProseSection[]
  } {
    const sections: Record<string, string> = {}
    const structured: OutputProseSection[] = []

    const BUILTIN_FILES: Record<string, { key: string; title: string; order: number }> = {
      'author-brief.md': { key: 'author_bio', title: '作者簡介', order: 1 },
      'background.md': { key: 'background', title: '背景資料', order: 2 },
      'analysis.md': { key: 'analysis', title: '賞析', order: 3 },
      'follow-up.md': { key: 'follow_up', title: '延伸活動', order: 4 },
      'think-questions.md': { key: 'think_questions', title: '思考問題', order: 5 },
      'preparation.md': { key: 'preparation', title: '教學準備', order: 6 },
    }

    const entries = readdirSync(pieceDir)
    for (const filename of entries) {
      if (!filename.endsWith('.md') || filename.endsWith('.cham.md')) continue
      if (filename.startsWith('_')) continue

      const path = join(pieceDir, filename)
      const content = readFileSync(path, 'utf-8')
      const { frontmatter, body } = this.splitMdFrontmatter(content)

      const builtin = BUILTIN_FILES[filename]
      let key: string, title: string, order: number

      if (builtin) {
        key = builtin.key
        title = (frontmatter?.title as string) || builtin.title
        order = (frontmatter?.order as number) ?? builtin.order
      } else if (filename.startsWith('custom-')) {
        const stem = filename.slice(7, -3)
        key = `custom_${stem}`
        title = (frontmatter?.title as string) || stem
        order = (frontmatter?.order as number) ?? 99
      } else {
        continue
      }

      const cleanedBody = cleanHardWraps(body.trim())
      sections[key] = cleanedBody
      structured.push({ key, title, filename, body: cleanedBody, order })
    }

    structured.sort((a, b) => a.order - b.order)
    return { sections, structuredSections: structured }
  }

  private splitMdFrontmatter(content: string): {
    frontmatter: Record<string, unknown> | null
    body: string
  } {
    const trimmed = content.replace(/^﻿/, '')
    if (!trimmed.startsWith('---')) return { frontmatter: null, body: trimmed }
    const end = trimmed.indexOf('\n---', 3)
    if (end === -1) return { frontmatter: null, body: trimmed }
    const yaml = require('yaml')
    try {
      const fm = yaml.parse(trimmed.slice(3, end)) || {}
      const body = trimmed.slice(end + 4)
      return { frontmatter: fm, body: body.startsWith('\n') ? body.slice(1) : body }
    } catch {
      return { frontmatter: null, body: trimmed.slice(end + 4) }
    }
  }

  private loadCommentaryLayers(
    pieceDir: string, doc: ChamDocument,
  ): Record<string, OutputAnnotation[]> {
    const layers: Record<string, OutputAnnotation[]> = {}
    const files = readdirSync(pieceDir)

    for (const f of files) {
      if (!f.endsWith('.cham.md') || f === 'text.cham.md') continue
      const filePath = join(pieceDir, f)
      const src = readFileSync(filePath, 'utf-8')
      const layerDoc = parse(src)
      if (layerDoc.meta.type !== 'secondary') continue

      const layerId = f.replace('.cham.md', '')
      layers[layerId] = this.buildAnnotationsWithDoc(layerDoc, doc, layerId)
    }

    return layers
  }

  private buildAnnotationLayers(
    layerAnnotations: Record<string, OutputAnnotation[]>,
  ): OutputAnnotationLayer[] {
    const bookLayers = this.bookConfig.layers || []
    if (bookLayers.length === 0 && Object.keys(layerAnnotations).length === 0) return []

    const result: OutputAnnotationLayer[] = []

    // Default layer (main text annotations)
    result.push({
      id: 'default',
      label: this.bookConfig.annotation?.defaultLabel || '原文',
      shortLabel: this.bookConfig.annotation?.defaultShortLabel || '文',
      contributor: this.bookConfig.contributors?.[0]?.ref || '',
      role: 'author',
      nature: 'annotation',
      displayOrder: 0,
      enabled: true,
      annotations: [],
    })

    for (const bookLayer of bookLayers) {
      const annotations = layerAnnotations[bookLayer.id] || []
      result.push({
        id: bookLayer.id,
        label: bookLayer.label,
        shortLabel: bookLayer.shortLabel || bookLayer.label.charAt(0),
        contributor: bookLayer.contributor,
        role: bookLayer.role || 'commentator',
        nature: bookLayer.nature || 'commentary',
        displayOrder: bookLayer.displayOrder ?? result.length,
        enabled: bookLayer.enabled !== false,
        annotations,
      })
    }

    return result
  }

  private buildAnnotationsText(doc: ChamDocument, annotations: OutputAnnotation[]): string {
    if (!annotations.length) return ''

    const groups = new Map<string, { headword: string; pron: OutputAnnotation[]; meaning: OutputAnnotation[] }>()

    for (const ann of annotations) {
      const key = `${ann.range.scope}:${ann.range.verseIndex ?? ''}:${ann.range.start}:${ann.range.end}`
      if (!groups.has(key)) {
        groups.set(key, { headword: this.getHeadword(doc, ann), pron: [], meaning: [] })
      }
      const g = groups.get(key)!
      if (ann.kind === 'pronunciation') g.pron.push(ann)
      else g.meaning.push(ann)
    }

    const lines: string[] = []
    let num = 1
    for (const [, g] of groups) {
      const parts: string[] = []
      if (g.pron.length) {
        const pronParts = g.pron.map(a => {
          const lang = a.lang === 'yue' ? '粵' : '普'
          return `○${lang}${a.text}`
        })
        parts.push(pronParts.join('；'))
      }
      for (const m of g.meaning) {
        parts.push(m.text)
      }
      lines.push(`${num}.${g.headword}：${parts.join('。')}`)
      num++
    }

    return lines.join('\n')
  }

  private getHeadword(doc: ChamDocument, ann: OutputAnnotation): string {
    if (ann.range.scope === 'title') {
      return doc.meta.title.slice(ann.range.start, ann.range.end)
    }
    if (ann.range.scope === 'verse' && ann.range.verseIndex !== undefined) {
      const block = doc.textBlocks[ann.range.verseIndex]
      if (block) return block.text.slice(ann.range.start, ann.range.end)
    }
    return ''
  }
}

// ─── RegistryBuilder ──────────────────────────────────────────

class RegistryBuilder {
  buildAuthors(
    allPieces: OutputPiece[],
    authorRegistry: Record<string, { name: string; dynasty: string; bio?: string }>,
  ): Record<string, unknown>[] {
    return Object.entries(authorRegistry).map(([, data]) => ({
      '@id': `author:${encodeURIComponent(data.name)}`,
      '@type': 'Person',
      name: data.name,
      dynasty: data.dynasty || '',
      bio: data.bio || '',
    }))
  }

  buildDynasties(allPieces: OutputPiece[]): Record<string, unknown> {
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
    return result
  }
}

// ─── LibraryPipeline (orchestrator) ───────────────────────────

export class LibraryPipeline {
  private scanner: BookScanner
  private registryBuilder = new RegistryBuilder()
  private authors: Record<string, { name: string; dynasty: string; bio?: string }> = {}

  constructor(
    private libraryDir: string,
    private dataDir: string,
    private outputDir: string,
  ) {
    this.scanner = new BookScanner(libraryDir)
  }

  run(): void {
    mkdirSync(this.outputDir, { recursive: true })
    mkdirSync(join(this.outputDir, 'books'), { recursive: true })

    this.authors = this.loadAuthors()

    const books = this.scanner.scan()
    const scale = this.scanner.detectScale(books)

    const allPieces: OutputPiece[] = []
    const bookMetas: BookMeta[] = []

    for (const { config, dir } of books) {
      const builder = new PieceBuilder(this.authors, config)
      const pieces: OutputPiece[] = []

      for (const entry of readdirSync(dir).sort()) {
        const pieceDir = join(dir, entry)
        const chamPath = join(pieceDir, 'text.cham.md')
        if (!existsSync(chamPath)) continue

        const piece = builder.build(chamPath, pieceDir, config.id)
        if (piece) pieces.push(piece)
      }

      const meta: BookMeta = {
        id: config.id,
        title: config.title,
        subtitle: config.subtitle,
        titleEn: config.titleEn,
        publisher: config.publisher,
        genre: config.genre || 'poetry',
        count: pieces.length,
        hero: config.hero,
        layers: config.layers,
        annotation: config.annotation,
      }

      const bookData: BookData = { meta, pieces }
      writeFileSync(
        join(this.outputDir, 'books', `${config.id}.json`),
        JSON.stringify(bookData, null, 2),
        'utf-8',
      )

      bookMetas.push(meta)
      allPieces.push(...pieces)
    }

    const crossRefs = this.buildCrossRefs(allPieces)

    const library: LibraryIndex = { scale, books: bookMetas, crossRefs }
    writeFileSync(
      join(this.outputDir, 'library.json'),
      JSON.stringify(library, null, 2),
      'utf-8',
    )

    // Build legacy poems.json for backward compatibility during transition
    writeFileSync(
      join(this.outputDir, 'poems.json'),
      JSON.stringify(allPieces, null, 2),
      'utf-8',
    )

    writeFileSync(
      join(this.outputDir, 'authors.json'),
      JSON.stringify(this.registryBuilder.buildAuthors(allPieces, this.authors), null, 2),
      'utf-8',
    )

    writeFileSync(
      join(this.outputDir, 'dynasties.json'),
      JSON.stringify(this.registryBuilder.buildDynasties(allPieces), null, 2),
      'utf-8',
    )

    console.log(`Library: ${scale}, ${bookMetas.length} book(s), ${allPieces.length} piece(s) total`)
  }

  private loadAuthors(): Record<string, { name: string; dynasty: string; bio?: string }> {
    try {
      return loadYaml(join(this.dataDir, 'authors.yaml')) as any
    } catch {
      return {}
    }
  }

  private buildCrossRefs(allPieces: OutputPiece[]): CrossRef[] {
    const refs: CrossRef[] = []
    for (const piece of allPieces) {
      const src = piece.source
      if (!src || src.relation === 'standalone') continue
      if (!src.textRef) continue
      refs.push({
        focusedBookId: piece.bookId,
        focusedNum: piece.num,
        fullBookId: src.textRef,
        fullNum: src.pieceRef,
        relation: src.relation,
      })
    }
    return refs
  }
}
