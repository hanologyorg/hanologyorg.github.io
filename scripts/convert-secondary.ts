import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import YAML from 'yaml'

// ─── Types ────────────────────────────────────────────────────

interface ParsedAnnotation {
  num: number
  headword: string
  pronYue?: { char: string; jyutping: string }
  pronHan?: string
  meaning: string
}

interface ParsedPiece {
  num: number
  title: string
  author: string
  rawText: string
  annotations: ParsedAnnotation[]
  authorBio: string
  background: string
  analysis: string
}

// ─── Section Extraction ───────────────────────────────────────

function getAllSections(text: string): Map<string, string> {
  const sections = new Map<string, string>()
  const headingRegex = /^## (.+)$/gm
  const matches: { name: string; start: number }[] = []
  let m: RegExpExecArray | null
  while ((m = headingRegex.exec(text)) !== null) {
    matches.push({ name: m[1].trim(), start: m.index })
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].start
    const end = i + 1 < matches.length ? matches[i + 1].start : text.length
    const headerEnd = text.indexOf('\n', start)
    sections.set(matches[i].name, text.slice(headerEnd + 1, end).trim())
  }
  return sections
}

// ─── Original Text Extraction ─────────────────────────────────

/**
 * Extract clean original text from the 原文 section.
 * Returns an array of verse/prose lines with all PDF artifacts removed.
 *
 * Key transformations:
 * - Remove collection headers (《積學與涵泳...》), 編號 lines
 * - Remove the title+author line (first content line)
 * - Remove standalone number lines ("1 0 1 1")
 * - Strip trailing inline annotation numbers from each line
 * - Join hard-wrapped lines (within same paragraph)
 */
/**
 * Detect if a piece is prose (has sentence-ending punctuation mid-paragraph).
 * Poetry typically has one phrase per line, prose has sentences spanning lines.
 */
function isProse(genre: string): boolean {
  return genre === 'prose' || genre === 'mixed'
}

function extractCleanLines(rawSection: string, genre: string = 'poetry'): string[] {
  const lines = rawSection.split('\n')
  const contentLines: string[] = []
  let pastHeader = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('《積學與涵泳')) continue
    if (/^編號[：:︰]/.test(trimmed)) { pastHeader = true; continue }
    if (!pastHeader) continue
    if (/^\d*《積學與涵泳/.test(trimmed)) continue
    // Pure space-separated digits (multi-digit markers from PDF)
    if (/^(\d\s*)+$/.test(trimmed)) continue
    contentLines.push(trimmed)
  }

  // Remove title+author line (always first)
  if (contentLines.length > 0) contentLines.shift()

  // Strip trailing inline annotation numbers from each line
  // Pattern: CJK/punctuation followed by digits at line end
  const stripped = contentLines.map(l =>
    l.replace(/([一-鿿㐀-䶿，。！？、；：""''（）《》〈〉─—…·])\d+$/g, '$1')
  )

  // Remove trailing standalone page numbers
  while (stripped.length > 0 && /^(\d+)$/.test(stripped[stripped.length - 1])) {
    stripped.pop()
  }

  // For prose: join hard-wrapped lines into paragraphs
  // A line that doesn't end with sentence-ending punctuation continues to the next
  if (genre !== 'poetry') {
    const joined: string[] = []
    let current = ''
    for (const line of stripped) {
      if (!line) continue
      current += (current ? '' : '') + line
      // Check if line ends a sentence
      if (/[。！？]$/.test(current)) {
        joined.push(current)
        current = ''
      }
    }
    if (current) joined.push(current)
    return joined
  }

  return stripped.filter(l => l.length > 0)
}

// ─── Annotation Parser ────────────────────────────────────────

function parseAnnotations(raw: string): ParsedAnnotation[] {
  if (!raw) return []

  const lines = raw.split('\n')
    .filter(l => !l.trim().startsWith('《積學與涵泳'))

  const annotations: ParsedAnnotation[] = []
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (!trimmed) { i++; continue }

    // Match: N.headword[：:]definition
    const match = trimmed.match(/^(\d+)[.．]\s*(.+)$/)
    if (!match) { i++; continue }

    const num = parseInt(match[1], 10)
    const rest = match[2]

    // Find colon separator (Chinese or ASCII)
    const colonMatch = rest.match(/^(.+?)\s*[：:︰]\s*(.*)$/s)
    let headword: string
    let body: string

    if (colonMatch) {
      headword = colonMatch[1].trim()
      body = colonMatch[2]
    } else {
      headword = rest.trim()
      body = ''
    }

    // Collect continuation lines until next annotation
    i++
    while (i < lines.length) {
      const next = lines[i].trim()
      if (!next) { i++; continue }
      if (/^\d+[.．]/.test(next)) break
      body += '\n' + next
      i++
    }

    // Extract pronunciation
    let pronYue: ParsedAnnotation['pronYue']
    let pronHan: string | undefined

    const yueMatch = body.match(/○粵\[([^\]]+)\]，\[([^\]]+)\]/)
    if (yueMatch) pronYue = { char: yueMatch[1], jyutping: yueMatch[2] }

    const hanMatch = body.match(/○漢\[([^\]]+)\]/)
    if (hanMatch) pronHan = hanMatch[1]

    // Clean meaning: remove pronunciation, trailing page numbers
    let meaning = body
      .replace(/○粵\[[^\]]+\]，\[[^\]]+\]/g, '')
      .replace(/○漢\[[^\]]+\]/g, '')
      .replace(/\n\d+$/g, '')
      .replace(/^[。；：:\s]+/, '')
      .replace(/[。；:]\s*$/, '')
      .trim()

    // Also clean headword
    headword = headword
      .replace(/○粵\[[^\]]+\]，\[[^\]]+\]/g, '')
      .replace(/○漢\[[^\]]+\]/g, '')
      .replace(/[：:]\s*$/, '')
      .trim()

    // Clean trailing standalone number from meaning (page reference)
    meaning = meaning.replace(/\d+$/, '').replace(/[。]\s*$/, '').replace(/；\s*$/, '').trim()

    annotations.push({ num, headword, pronYue, pronHan, meaning })
  }

  return annotations
}

// ─── CHAM Text Builder ────────────────────────────────────────

/**
 * Build text.cham.md content.
 *
 * Marker placement strategy:
 * 1. Clean the text (remove all PDF artifacts and inline numbers)
 * 2. For each annotation, find its headword in the clean text (first occurrence)
 * 3. Insert {N}...{/N} markers, processing right-to-left to preserve offsets
 * 4. For headwords that appear in the title (not in verse text), use @title annotations
 */
function buildChamText(
  piece: ParsedPiece,
  authorId: string,
  dynasty: string,
  genre: string,
): string {
  const cleanLines = extractCleanLines(piece.rawText, genre)

  // Join lines into a single text for marker insertion
  // Each line is a "verse" (or paragraph for prose)
  // We process each line independently to avoid cross-line issues
  const annByNum = new Map<number, ParsedAnnotation>()
  for (const ann of piece.annotations) {
    annByNum.set(ann.num, ann)
  }

  // For each annotation, find which line contains its headword
  // and at what offset
  const markerPlacements: {
    num: number
    lineIdx: number
    start: number
    end: number
  }[] = []

  const usedPositions = new Set<string>()

  for (const ann of piece.annotations) {
    if (!ann.headword) continue
    const hw = ann.headword

    // Search through lines for the headword
    let found = false
    for (let li = 0; li < cleanLines.length && !found; li++) {
      const line = cleanLines[li]
      let searchStart = 0
      while (searchStart <= line.length - hw.length) {
        const idx = line.indexOf(hw, searchStart)
        if (idx === -1) break

        const posKey = `${li}:${idx}`
        if (!usedPositions.has(posKey)) {
          markerPlacements.push({ num: ann.num, lineIdx: li, start: idx, end: idx + hw.length })
          usedPositions.add(posKey)
          found = true
          break
        }
        searchStart = idx + 1
      }
    }

    // If not found in verse text, check the title
    if (!found) {
      const titleIdx = piece.title.indexOf(hw)
      if (titleIdx !== -1) {
        // Mark as title-scope — handled separately below
        markerPlacements.push({ num: ann.num, lineIdx: -1, start: titleIdx, end: titleIdx + hw.length })
      }
    }
  }

  // Insert markers into each line (right-to-left within line)
  const markedLines = [...cleanLines]
  const lineMarkers = new Map<number, typeof markerPlacements>()

  for (const mp of markerPlacements) {
    if (mp.lineIdx < 0) continue
    if (!lineMarkers.has(mp.lineIdx)) lineMarkers.set(mp.lineIdx, [])
    lineMarkers.get(mp.lineIdx)!.push(mp)
  }

  for (const [li, markers] of lineMarkers) {
    markers.sort((a, b) => b.start - a.start)
    let line = markedLines[li]
    for (const m of markers) {
      line = line.slice(0, m.start) +
        `{${m.num}}` +
        line.slice(m.start, m.end) +
        `{/${m.num}}` +
        line.slice(m.end)
    }
    markedLines[li] = line
  }

  // Identify title-scope annotations
  const titleAnnotations = markerPlacements.filter(m => m.lineIdx < 0)

  // Build frontmatter
  const fm: string[] = [
    '---',
    `id: ${piece.num}`,
    `title: ${piece.title}`,
    `contributors:`,
    `  - ref: ${authorId}`,
    `    role: author`,
    `date:`,
    `  dynasty: ${dynasty}`,
  ]
  if (genre !== 'poetry') fm.push(`genre: ${genre}`)
  fm.push('---', '')

  // Body
  const body = markedLines.join('\n\n')

  // Annotations
  const annLines: string[] = ['', '', '## 注釋', '']

  // Title-scope annotations first
  for (const ta of titleAnnotations) {
    const ann = annByNum.get(ta.num)
    if (!ann) continue
    appendAnnotationEntries(ann, annLines, true)
  }

  // Verse-scope annotations in order
  const verseAnns = markerPlacements
    .filter(m => m.lineIdx >= 0)
    .sort((a, b) => a.num - b.num)

  for (const va of verseAnns) {
    const ann = annByNum.get(va.num)
    if (!ann) continue
    appendAnnotationEntries(ann, annLines)
  }

  return fm.join('\n') + body + annLines.join('\n')
}

function appendAnnotationEntries(ann: ParsedAnnotation, out: string[], titleScope: boolean = false): void {
  const prefix = titleScope ? '@title' : `{${ann.num}}`
  if (ann.pronYue) {
    out.push(`${prefix} pron type:hom lang:yue [${ann.pronYue.char}；${ann.pronYue.jyutping}]`, '')
  }
  if (ann.pronHan) {
    out.push(`${prefix} pron type:pinyin lang:cmn [${ann.pronHan}]`, '')
  }
  if (ann.meaning) {
    const lines = ann.meaning.split('\n')
    if (lines.length === 1 && ann.meaning.length <= 80) {
      out.push(`${prefix} meaning [${ann.meaning}]`)
    } else {
      out.push(`${prefix} meaning [`)
      out.push(...lines)
      out.push(']')
    }
    out.push('')
  }
}

// ─── Author Resolver ──────────────────────────────────────────

interface AuthorRecord {
  name: string
  dynasty: string
  bio?: string
}

class AuthorResolver {
  private byName = new Map<string, { id: string; record: AuthorRecord }>()
  private nextId = 100
  private newAuthors = new Map<string, AuthorRecord>()

  constructor(existing: Record<string, AuthorRecord>) {
    for (const [id, record] of Object.entries(existing)) {
      this.byName.set(record.name, { id, record })
    }
  }

  resolve(name: string, bio: string): { id: string; dynasty: string } {
    const existing = this.byName.get(name)
    if (existing) {
      return { id: existing.id, dynasty: existing.record.dynasty }
    }

    // Try to extract dynasty from bio
    const dynasty = this.guessDynasty(bio, name)
    const id = `A${String(this.nextId++).padStart(3, '0')}`
    const record: AuthorRecord = { name, dynasty }
    this.newAuthors.set(id, record)
    this.byName.set(name, { id, record })
    return { id, dynasty }
  }

  private guessDynasty(bio: string, name: string): string {
    // Special cases for known collective authors
    if (name === '《詩經》' || name === '詩經') return '周'
    if (/漢樂府/.test(name)) return '漢'
    if (/北朝民歌/.test(name)) return '南北朝'
    if (/南宋民歌/.test(name)) return '宋'
    if (name === '佚名') return '漢'

    const specific: [RegExp, string][] = [
      [/秦末/, '秦末'],
      [/漢末|東漢末/, '漢末'],
      [/西漢/, '漢'],
      [/東漢/, '漢'],
      [/三國/, '三國'],
      [/西晉/, '晉'],
      [/東晉/, '東晉'],
      [/南北朝/, '南北朝'],
      [/北宋/, '宋'],
      [/南宋/, '宋'],
      [/五代/, '五代'],
      [/戰國/, '周'],
    ]
    for (const [re, d] of specific) {
      if (re.test(bio)) return d
    }

    if (/唐代|唐朝/.test(bio) || /唐[睿祖代宗德憲穆敬文武宣懿僖昭哀]/.test(bio)) return '唐'
    if (/宋代|宋朝/.test(bio) || /宋[太宗真仁英神哲徽欽高孝光寧理度恭]/.test(bio)) return '宋'
    if (/漢[武帝宣元成哀平]/.test(bio)) return '漢'
    if (/晉[武帝惠懷愍元明成康穆哀廢簡文孝武安恭]/.test(bio)) return '晉'
    if (/秦王|秦國|秦始皇/.test(bio)) return '秦'
    if (/魏[文武惠哀]/.test(bio)) return '周'

    const dateMatch = bio.match(/[（(]公元?(\d+)/)
    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10)
      if (year < 220) return '漢'
      if (year < 420) return '晉'
      if (year < 589) return '南北朝'
      if (year < 907) return '唐'
      if (year < 960) return '五代'
      if (year < 1279) return '宋'
      if (year < 1368) return '元'
      if (year < 1644) return '明'
      return '清'
    }

    return ''
  }

  getNewAuthors(): Record<string, AuthorRecord> {
    return Object.fromEntries(this.newAuthors)
  }
}

// ─── Genre Detector ───────────────────────────────────────────

function detectGenre(title: string): string {
  if (/記$/.test(title)) return 'prose'
  if (/序$/.test(title)) return 'prose'
  if (/賦$/.test(title)) return 'prose'
  if (/說$/.test(title)) return 'prose'
  if (/論$/.test(title)) return 'prose'
  if (/傳$/.test(title)) return 'prose'
  if (/書$/.test(title)) return 'prose'
  if (/文$/.test(title)) return 'prose'
  if (/表$/.test(title)) return 'prose'
  if (/銘$/.test(title)) return 'prose'
  if (/志$/.test(title)) return 'prose'
  return 'poetry'
}

// ─── Piece Parser ─────────────────────────────────────────────

class PieceParser {
  parse(dirPath: string, num: number): ParsedPiece | null {
    const mdPath = join(dirPath, 'text.md')
    if (!existsSync(mdPath)) return null

    const raw = readFileSync(mdPath, 'utf-8')
    const sections = getAllSections(raw)

    const titleMatch = raw.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : basename(dirPath)

    const authorBioRaw = sections.get('作者簡介') || ''
    const author = this.extractAuthor(authorBioRaw, title, sections.get('原文') || '')

    return {
      num,
      title,
      author,
      rawText: sections.get('原文') || '',
      annotations: parseAnnotations(sections.get('注釋') || ''),
      authorBio: this.cleanProse(authorBioRaw),
      background: this.cleanProse(sections.get('背景資料') || ''),
      analysis: this.cleanProse(sections.get('賞析') || ''),
    }
  }

  private extractAuthor(bioRaw: string, title: string, rawText: string): string {
    const firstLine = bioRaw.split('\n').find(l => l.trim())
    if (firstLine) {
      // "《詩經》我國第一部..."
      if (firstLine.startsWith('《')) {
        const m = firstLine.match(/^《(.+?)》/)
        if (m) return `《${m[1]}》`
      }
      // "甲、作者生平\nName（公元..."
      const parenIdx = firstLine.search(/[（(]/)
      if (parenIdx > 0) {
        const name = firstLine.slice(0, parenIdx).trim()
        if (name.length >= 2 && name.length <= 8) return name
      }
      // "Name（公元..." without section header
      const nameMatch = firstLine.match(/^([^\s，。：:、（(《]{2,8})/)
      if (nameMatch && !/^[甲乙丙丁]/.test(nameMatch[1])) {
        return nameMatch[1]
      }
    }

    // Fallback: from title+author line
    for (const line of rawText.split('\n')) {
      if (line.trim().startsWith('編號')) {
        const nextLines = rawText.split('\n')
        const idx = nextLines.indexOf(line)
        if (idx >= 0 && idx + 1 < nextLines.length) {
          const authorLine = nextLines[idx + 1].trim().replace(/\d+$/, '')
          const cleanTitle = title.replace(/[（(].+?[）)]/g, '').trim()
          if (authorLine.startsWith(cleanTitle)) {
            const remaining = authorLine.slice(cleanTitle.length).trim()
            if (remaining.length >= 2) return remaining
          }
        }
        break
      }
    }

    return '未知'
  }

  private cleanProse(raw: string): string {
    if (!raw) return ''
    return raw
      .split('\n')
      .filter(l => !l.trim().startsWith('《積學與涵泳') && !/^(\d+)$/.test(l.trim()))
      .join('\n')
      .split(/\n\n+/)
      .map(p => p.replace(/\n/g, ''))
      .join('\n\n')
      .trim()
  }
}

// ─── Converter (orchestrator) ─────────────────────────────────

class SecondaryConverter {
  private parser = new PieceParser()
  private authors: Record<string, AuthorRecord>
  private resolver: AuthorResolver

  constructor(
    private resourcesDir: string,
    private contentDir: string,
    private dataDir: string,
  ) {
    this.authors = this.loadAuthors()
    this.resolver = new AuthorResolver(this.authors)
  }

  run(): void {
    const pieces = this.scanResources()
    mkdirSync(this.contentDir, { recursive: true })

    writeFileSync(
      join(this.contentDir, 'book.yaml'),
      YAML.stringify({
        id: 'secondary',
        title: '積學與涵泳',
        subtitle: '中學古詩文誦讀材料選編',
        publisher: '教育局課程發展處 · 中國語文教育',
        genre: 'mixed',
        hero: ['{count} 篇詩文', '{authorCount} 位作者', '跨越千年·詩經至清'],
      }),
      'utf-8',
    )

    for (const piece of pieces) {
      this.convertPiece(piece)
    }

    const newAuthors = this.resolver.getNewAuthors()
    if (Object.keys(newAuthors).length > 0) {
      const merged = { ...this.authors, ...newAuthors }
      writeFileSync(join(this.dataDir, 'authors.yaml'), YAML.stringify(merged), 'utf-8')
      console.log(`Added ${Object.keys(newAuthors).length} new authors`)
    }

    console.log(`Converted ${pieces.length} pieces`)
  }

  private scanResources(): ParsedPiece[] {
    return readdirSync(this.resourcesDir).sort()
      .map(entry => {
        const numMatch = entry.match(/^(\d+)/)
        if (!numMatch) return null
        return this.parser.parse(join(this.resourcesDir, entry), parseInt(numMatch[1], 10))
      })
      .filter((p): p is ParsedPiece => p !== null)
  }

  private convertPiece(piece: ParsedPiece): void {
    const { id: authorId, dynasty } = this.resolver.resolve(piece.author, piece.authorBio)
    const genre = detectGenre(piece.title)

    const dirName = `${String(piece.num).padStart(3, '0')}_${piece.title.replace(/[\/\\:*?"<>|]/g, '_')}`
    const pieceDir = join(this.contentDir, dirName)
    mkdirSync(pieceDir, { recursive: true })

    writeFileSync(join(pieceDir, 'text.cham.md'), buildChamText(piece, authorId, dynasty, genre), 'utf-8')
    if (piece.authorBio) {
      const fm = `---\ntitle: 作者簡介\nsubject:\n  type: author\n  ref: ${authorId}\n---\n\n`
      writeFileSync(join(pieceDir, 'author-brief.md'), fm + piece.authorBio, 'utf-8')
    }
    if (piece.background) {
      const fm = `---\ntitle: 背景資料\n---\n\n`
      writeFileSync(join(pieceDir, 'background.md'), fm + piece.background, 'utf-8')
    }
    if (piece.analysis) {
      const fm = `---\ntitle: 賞析\n---\n\n`
      writeFileSync(join(pieceDir, 'analysis.md'), fm + piece.analysis, 'utf-8')
    }
  }

  private loadAuthors(): Record<string, AuthorRecord> {
    const path = join(this.dataDir, 'authors.yaml')
    if (!existsSync(path)) return {}
    try { return YAML.parse(readFileSync(path, 'utf-8')) || {} }
    catch { return {} }
  }
}

// ─── Main ─────────────────────────────────────────────────────

const converter = new SecondaryConverter('library/resources/secondary', 'library/content/secondary', 'library/data')
converter.run()
