import { ChamSerializer } from './serializer'
import type {
  PrimaryMeta, ChamDate, TextBlock, Marker, MarkerTable,
  AnnotationSection, AnnotationEntry, AnnotationTarget,
  ChamDocument,
} from './types'

// ─── Source Types (from poems.json) ───────────────────────────

interface SourceAnnotation {
  id: string
  range: { type: string; scope: string; start: number; end: number; verseIndex?: number }
  kind: 'pronunciation' | 'semantic'
  lang?: string
  text: string
  source: string
}

interface SourcePoem {
  num: number
  title: string
  author: string
  verses: Array<{ text: string }>
  sections: Record<string, string>
  annotations: SourceAnnotation[]
}

// ─── Marker ID Allocator ──────────────────────────────────────

class MarkerAllocator {
  private nextId = 1
  private ranges = new Map<string, number>() // "scope:verseIdx:start:end" → markerId

  getOrCreate(scope: string, verseIndex: number | undefined, start: number, end: number): number {
    const key = `${scope}:${verseIndex ?? ''}:${start}:${end}`
    let id = this.ranges.get(key)
    if (id === undefined) {
      id = this.nextId++
      this.ranges.set(key, id)
    }
    return id
  }
}

// ─── Converters ───────────────────────────────────────────────

function buildVerseText(verses: Array<{ text: string }>, allocator: MarkerAllocator, annotations: SourceAnnotation[]): {
  body: string
  markers: MarkerTable
  textBlocks: TextBlock[]
} {
  const markers: MarkerTable = new Map()
  const textBlocks: TextBlock[] = []
  const lines: string[] = []

  // Collect annotations by scope for marker insertion
  const titleAnns = annotations.filter(a => a.range.scope === 'title')
  const verseAnns = annotations.filter(a => a.range.scope === 'verse')

  // Process title as first block
  // (title is handled by @title target, not inline markers)

  // Process each verse
  let blockIndex = 0
  for (let vi = 0; vi < verses.length; vi++) {
    const verseText = verses[vi].text

    // Get annotations for this verse
    const vAnns = verseAnns.filter(a => a.range.verseIndex === vi)

    // Build sorted marker positions (unique ranges only)
    const markerPositions: Array<{ start: number; end: number; id: number }> = []
    const seenRanges = new Set<string>()

    for (const ann of vAnns) {
      const rangeKey = `${ann.range.start}:${ann.range.end}`
      if (seenRanges.has(rangeKey)) continue
      seenRanges.add(rangeKey)

      const id = allocator.getOrCreate('verse', vi, ann.range.start, ann.range.end)
      markerPositions.push({ start: ann.range.start, end: ann.range.end, id })
    }

    // Sort by start position (descending for insertion, but we build the marked string)
    markerPositions.sort((a, b) => a.start - b.start)

    // Insert markers into verse text
    let marked = verseText
    let offset = 0
    const markerEntries: Array<{ id: number; offset: number; length: number; text: string }> = []

    for (const mp of markerPositions) {
      const s = mp.start + offset
      const e = mp.end + offset
      const markerText = marked.slice(s, e)
      marked = marked.slice(0, s) + `{${mp.id}}` + markerText + `{/${mp.id}}` + marked.slice(e)
      markerEntries.push({ id: mp.id, offset: mp.start, length: mp.end - mp.start, text: markerText })
      offset += `{${mp.id}}`.length + `{/${mp.id}}`.length
    }

    lines.push(marked)

    // Build marker records
    for (const me of markerEntries) {
      markers.set(me.id, {
        id: me.id,
        sectionIndex: 0,
        blockIndex,
        offset: me.offset,
        length: me.length,
        text: me.text,
      })
    }

    textBlocks.push({
      sectionIndex: 0,
      blockIndexInSection: vi,
      text: verseText,
      display: verseText,
      source: marked,
    })

    blockIndex++
  }

  return {
    body: lines.join('\n\n'),
    markers,
    textBlocks,
  }
}

function buildAnnotationEntries(
  annotations: SourceAnnotation[],
  allocator: MarkerAllocator,
): AnnotationEntry[] {
  const entries: AnnotationEntry[] = []

  for (const ann of annotations) {
    const target = buildTarget(ann, allocator)
    if (!target) continue

    if (ann.kind === 'pronunciation') {
      const { type, value } = parsePronunciation(ann)
      if (!type || !value) continue

      entries.push({
        target,
        kind: 'pron',
        params: { type, lang: ann.lang || 'yue' },
        value,
      })
    } else if (ann.kind === 'semantic') {
      const headword = extractHeadword(ann)
      entries.push({
        target,
        kind: 'meaning',
        params: {},
        headword: headword !== ann.text ? headword : undefined,
        value: ann.text,
      })
    }
  }

  return entries
}

function buildTarget(ann: SourceAnnotation, allocator: MarkerAllocator): AnnotationTarget | null {
  const { scope, start, end, verseIndex } = ann.range

  if (scope === 'title') return { type: 'title' }
  if (scope === 'verse' && verseIndex !== undefined) {
    const id = allocator.getOrCreate('verse', verseIndex, start, end)
    return { type: 'marker', markerId: id }
  }
  return null
}

function parsePronunciation(ann: SourceAnnotation): { type: string; value: string } {
  const text = ann.text
  let homMatch = text.match(/同音字[：:]\s*([^；;\[]+)/)
  let bracketMatch = text.match(/\[([^\]]+)\]/g)

  if (homMatch) {
    const homChar = homMatch[1].trim()
    const jyutVal = bracketMatch?.[bracketMatch.length - 1]?.replace(/[\[\]]/g, '')
    return { type: 'hom', value: homChar + (jyutVal ? `；${jyutVal}` : '') }
  }

  if (bracketMatch?.length) {
    const val = bracketMatch[bracketMatch.length - 1].replace(/[\[\]]/g, '')
    const type = ann.lang === 'cmn' ? 'pinyin' : 'jyut'
    return { type, value: val }
  }

  return { type: ann.lang === 'cmn' ? 'pinyin' : 'jyut', value: text }
}

function extractHeadword(ann: SourceAnnotation): string {
  // For semantic annotations, the headword is the annotated text range
  // We don't have the verse text here, so we return empty
  return ''
}

// ─── Main Converter ───────────────────────────────────────────

export class ChamConverter {
  private serializer = new ChamSerializer()
  private authorsByName = new Map<string, { id: string; dynasty: string }>()

  setAuthors(authors: Record<string, { name: string; dynasty: string }>): void {
    this.authorsByName.clear()
    for (const [id, data] of Object.entries(authors)) {
      this.authorsByName.set(data.name, { id, dynasty: data.dynasty })
    }
  }

  convertPoem(poem: SourcePoem): { cham: string; prose: Map<string, string> } {
    const allocator = new MarkerAllocator()

    // Build text + markers
    const { body, markers, textBlocks } = buildVerseText(poem.verses, allocator, poem.annotations)

    // Build annotation entries
    const entries = buildAnnotationEntries(poem.annotations, allocator)

    // Build meta
    const authorInfo = this.authorsByName.get(poem.author)
    const meta: PrimaryMeta = {
      type: 'primary',
      id: poem.num,
      title: poem.title,
      contributors: authorInfo ? [{ ref: authorInfo.id, role: 'author' }] : undefined,
      date: authorInfo?.dynasty ? { dynasty: authorInfo.dynasty, circa: true } : undefined,
      genre: 'poetry',
    }

    // Sections
    const sections: AnnotationSection[] = []
    if (entries.length > 0) {
      sections.push({ name: '注釋', meta: {}, entries })
    }

    const doc: ChamDocument = { meta, textBlocks, markers, sections }

    // Extract prose sections
    const prose = new Map<string, string>()
    const proseKeys = ['author_bio', 'background', 'analysis', 'follow_up', 'think_questions', 'preparation']
    const proseNames: Record<string, string> = {
      author_bio: 'author-brief',
      background: 'background',
      analysis: 'analysis',
      follow_up: 'follow-up',
      think_questions: 'think-questions',
      preparation: 'preparation',
    }

    for (const key of proseKeys) {
      const content = poem.sections?.[key]
      if (content) {
        prose.set(proseNames[key] || key, content)
      }
    }

    return { cham: this.serializer.serialize(doc), prose }
  }
}
