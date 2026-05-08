import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { parse } from './parser'
import type { ChamDocument, PrimaryMeta, AnnotationEntry, Marker } from './types'

// ─── Output Types (compatible with existing frontend) ─────────

interface OutputVerse {
  text: string
}

interface OutputRange {
  type: 'range'
  scope: 'title' | 'verse'
  verseIndex?: number
  start: number
  end: number
}

interface OutputAnnotation {
  id: string
  range: OutputRange
  kind: string
  lang?: string
  text: string
  source: string
}

interface OutputPoem {
  num: number
  title: string
  author: string
  authorId: string
  dynasty: string
  verses: OutputVerse[]
  annotations: OutputAnnotation[]
  sections: Record<string, string>
}

// ─── Pipeline ─────────────────────────────────────────────────

export class ChamPipeline {
  private contentDir: string
  private dataDir: string
  private outputDir: string

  constructor(contentDir: string, dataDir: string, outputDir: string) {
    this.contentDir = contentDir
    this.dataDir = dataDir
    this.outputDir = outputDir
  }

  run(): void {
    mkdirSync(this.outputDir, { recursive: true })

    // Load registries
    const authors = this.loadAuthors()
    const dynasties = this.loadDynasties()

    // Scan content directory
    const poems: OutputPoem[] = []
    const dirs = readdirSync(this.contentDir).sort()

    for (const dir of dirs) {
      const dirPath = join(this.contentDir, dir)
      const chamPath = join(dirPath, 'text.cham.md')
      if (!existsSync(chamPath)) continue

      const src = readFileSync(chamPath, 'utf-8')
      const doc = parse(src)

      if (doc.meta.type !== 'primary') continue
      const meta = doc.meta as PrimaryMeta

      // Build verses from text blocks
      const verses: OutputVerse[] = doc.textBlocks.map(b => ({ text: b.text }))

      // Build annotations from sections
      const annotations = this.buildAnnotations(doc)

      // Load prose sections (keys must match frontend SECTION_META)
      const sections: Record<string, string> = {}
      const proseFiles = [
        ['author_bio', 'author-brief.md'],
        ['background', 'background.md'],
        ['analysis', 'analysis.md'],
        ['follow_up', 'follow-up.md'],
        ['think_questions', 'think-questions.md'],
        ['preparation', 'preparation.md'],
      ]
      for (const [key, filename] of proseFiles) {
        const prosePath = join(dirPath, filename)
        if (existsSync(prosePath)) {
          sections[key] = readFileSync(prosePath, 'utf-8')
        }
      }

      // Generate annotations section text from structured annotations
      const annText = this.buildAnnotationsText(doc, annotations)
      if (annText) sections['annotations'] = annText

      // Look up author/dynasty from contributors
      const authorId = meta.contributors?.[0]?.ref || ''
      const authorName = authors[authorId]?.name || ''
      const dynastyName = authors[authorId]?.dynasty || meta.date?.dynasty || ''

      poems.push({
        num: meta.id as number,
        title: meta.title,
        author: authorName,
        authorId,
        dynasty: dynastyName,
        verses,
        annotations,
        sections,
      })
    }

    // Write output files
    writeFileSync(join(this.outputDir, 'poems.json'), JSON.stringify(poems, null, 2), 'utf-8')
    writeFileSync(join(this.outputDir, 'authors.json'), JSON.stringify(this.buildAuthorsJson(authors), null, 2), 'utf-8')
    writeFileSync(join(this.outputDir, 'dynasties.json'), JSON.stringify(this.buildDynastiesJson(poems), null, 2), 'utf-8')

    console.log(`Generated ${poems.length} poems to ${this.outputDir}`)
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
        if (!marker) return null
        const verseIndex = marker.blockIndex
        return {
          type: 'range',
          scope: 'verse',
          verseIndex,
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

  private loadAuthors(): Record<string, { name: string; dynasty: string; bio?: string }> {
    try {
      const yaml = require('yaml')
      const content = readFileSync(join(this.dataDir, 'authors.yaml'), 'utf-8')
      return yaml.parse(content)
    } catch {
      return {}
    }
  }

  private loadDynasties(): Record<string, any> {
    // Build dynasty list from poems
    const dynastyMap: Record<string, { name: string; authors: string[]; poemCount: number }> = {}
    return dynastyMap
  }

  private buildAuthorsJson(authors: Record<string, any>): any[] {
    return Object.entries(authors).map(([id, data]: [string, any]) => ({
      '@id': `author:${encodeURIComponent(data.name)}`,
      '@type': 'Person',
      name: data.name,
      dynasty: data.dynasty || '',
      bio: data.bio || '',
    }))
  }

  private buildAnnotationsText(doc: ChamDocument, annotations: OutputAnnotation[]): string {
    if (!annotations.length) return ''

    // Group annotations by target range
    const groups = new Map<string, { headword: string; pron: OutputAnnotation[]; meaning: OutputAnnotation[] }>()

    for (const ann of annotations) {
      const key = `${ann.range.scope}:${ann.range.verseIndex ?? ''}:${ann.range.start}:${ann.range.end}`
      if (!groups.has(key)) {
        const headword = this.getHeadword(doc, ann)
        groups.set(key, { headword, pron: [], meaning: [] })
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
          const lang = a.lang === 'yue' ? '粵' : '漢'
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

  private buildDynastiesJson(poems: OutputPoem[]): Record<string, any> {
    const dynastyMap: Record<string, { name: string; authors: Set<string>; poemCount: number }> = {}

    for (const poem of poems) {
      const d = poem.dynasty
      if (!d) continue
      if (!dynastyMap[d]) dynastyMap[d] = { name: d, authors: new Set(), poemCount: 0 }
      dynastyMap[d].authors.add(poem.author)
      dynastyMap[d].poemCount++
    }

    const result: Record<string, any> = {}
    for (const [name, data] of Object.entries(dynastyMap)) {
      result[name] = {
        '@id': `dynasty:${encodeURIComponent(name)}`,
        '@type': 'HistoricalPeriod',
        name,
        authors: [...data.authors],
        poemCount: data.poemCount,
      }
    }
    return result
  }
}
