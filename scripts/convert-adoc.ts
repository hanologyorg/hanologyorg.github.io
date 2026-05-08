import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import YAML from 'yaml'

// ─── Config ──────────────────────────────────────────────────

const MN_DIR = process.env.MN_DIR || join(process.env.HOME!, 'src/mn/laozi')
const CONTENT_DIR = 'library/content'

interface ContributorRef {
  ref: string
  role?: string
  title?: string
}

interface BookConfig {
  id: string
  type: 'annotated' | 'prose'
  source: { dir?: string; file?: string }
  meta: Record<string, unknown>
  sections?: {
    unit: string
    contributors: {
      foreword?: (string | ContributorRef)[]
      preface?: (string | ContributorRef)[]
      native?: (string | ContributorRef)[]
      chapter?: (string | ContributorRef)[]
      postface?: (string | ContributorRef)[]
    }
  }
}

const configs: BookConfig[] = YAML.parse(
  readFileSync(join(__dirname, 'adoc-config.yaml'), 'utf-8'),
).books

// ─── Types ───────────────────────────────────────────────────

type SectionKind = 'foreword' | 'preface' | 'native' | 'chapter' | 'postface'

interface AdocLine { anchor: string; text: string }

interface AdocAnnotation {
  id: number; annotator: string; lines: string[]; ranges: number[][]; text: string
}

interface ExtractedPiece {
  title: string
  text: string
  notes: string
  kind: SectionKind
  contributors: Array<{ ref: string; role: string }>
}

// ─── Utility ─────────────────────────────────────────────────

function numToChinese(n: number): string {
  const d = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (n < 10) return d[n]
  if (n < 20) return (n === 10 ? '十' : '十' + d[n - 10])
  if (n < 100) return d[Math.floor(n / 10)] + '十' + d[n % 10]
  return String(n)
}

function circled(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1)
  return String(n)
}

const VOLUME_RE = /卷[一二三四上下]/
const ROLE = 'author'

function stripLine(line: string): string {
  return line.replace(/^[\t ]+/, '').replace(/[\t ]+$/, '')
}

function normalizeContributor(c: string | ContributorRef): ContributorRef {
  return typeof c === 'string' ? { ref: c } : c
}

function sectionContributors(config: BookConfig, kind: SectionKind): Array<{ ref: string; role: string }> {
  const map = config.sections?.contributors
  if (!map) {
    const ref = ((config.meta.contributors as Array<Record<string, string>>)?.[0]?.ref) || ''
    return [{ ref, role: ROLE }]
  }
  const raw = map[kind] || map.native || map.chapter || []
  return raw.map(c => {
    const n = normalizeContributor(c)
    return { ref: n.ref, role: n.role || ROLE, ...(n.title ? { title: n.title } : {}) }
  })
}

function makeChapterTitle(rawTitle: string, unit: string, index: number): string {
  // Format: 君體第一 → 篇第一·君體
  // Strip 卷上· etc.
  const stripped = rawTitle.replace(/^卷[上下]·/, '')

  // Case: ends with 第X (e.g., 君體第一)
  const m = stripped.match(/^(.+?)第([一二三四五六七八九十]+)$/)
  if (m) {
    return `${unit}第${m[2]}·${m[1]}`
  }

  // Case: ends with sectionUnit (e.g., 同體章)
  if (stripped.endsWith(unit)) {
    const desc = stripped.slice(0, -unit.length)
    return `${unit}第${numToChinese(index + 1)}·${desc}`
  }

  // Default: prefix with unit+sequential
  return `${unit}第${numToChinese(index + 1)}·${stripped}`
}

// ─── Annotated book (laozi) ──────────────────────────────────

function parseAnnotatedChapter(src: string) {
  const titleMatch = src.match(/^== (.+)$/m)
  const title = titleMatch?.[1] || ''
  const lines: AdocLine[] = []
  const lineRegex = /^\[#(L[^\]]+)\]\n(.+)$/gm
  let m: RegExpExecArray | null
  while ((m = lineRegex.exec(src)) !== null) {
    lines.push({ anchor: m[1], text: m[2].trim() })
  }
  const annotations: AdocAnnotation[] = []
  const annMatch = src.match(/\[annotations\]\n----\n([\s\S]*?)----/)
  if (annMatch) {
    const parsed = YAML.parse(annMatch[1])
    if (Array.isArray(parsed)) {
      for (const ann of parsed) {
        annotations.push({
          id: ann.id,
          annotator: ann.annotator,
          lines: ann.lines || [],
          ranges: ann.ranges || [],
          text: ann.text?.trim() || '',
        })
      }
    }
  }
  return { title, lines, annotations }
}

function convertAnnotatedBook(config: BookConfig) {
  const sourceDir = join(MN_DIR, config.source.dir!)
  if (!existsSync(sourceDir)) { console.log(`No ${config.id} source dir, skipping`); return }

  const files = readdirSync(sourceDir).filter(f => f.endsWith('.adoc')).sort()
  const bookDir = join(CONTENT_DIR, config.id)
  mkdirSync(bookDir, { recursive: true })
  writeFileSync(join(bookDir, 'book.yaml'), YAML.stringify({ id: config.id, ...config.meta }), 'utf-8')

  const layers = (config.meta.layers as Array<Record<string, unknown>>) || []
  const layerMap = new Map<string, { layerId: string; contributorId: string }>()
  for (const layer of layers) {
    layerMap.set(layer.annotator as string, { layerId: layer.id as string, contributorId: layer.contributor as string })
  }
  const contributorRef = ((config.meta.contributors as Array<Record<string, string>>)?.[0]?.ref) || ''
  const date = config.meta.date as Record<string, unknown>
  const genre = config.meta.genre as string

  for (const file of files) {
    const chapterNum = parseInt(file, 10)
    const src = readFileSync(join(sourceDir, file), 'utf-8')
    const chapter = parseAnnotatedChapter(src)
    const dirName = String(chapterNum).padStart(2, '0') + '_第' + numToChinese(chapterNum) + '章'
    const dirPath = join(bookDir, dirName)
    mkdirSync(dirPath, { recursive: true })

    const markerMap = new Map<string, number>()
    chapter.lines.forEach((line, i) => markerMap.set(line.anchor, i + 1))
    const markedLines = chapter.lines.map((line, i) => `{${i + 1}}${line.text}{/${i + 1}}`)

    const fm = [
      '---',
      `id: ${chapterNum}`,
      `title: 第${numToChinese(chapterNum)}章`,
      'contributors:',
      `  - ref: ${contributorRef}`,
      '    role: author',
      'date:',
      ...Object.entries(date || {}).map(([k, v]) => `  ${k}: ${v}`),
      `genre: ${genre}`,
      'source:',
      `  textRef: ${config.id}`,
      '  relation: section',
      '---', '',
    ].join('\n')
    writeFileSync(join(dirPath, 'text.cham.md'), fm + markedLines.join('\n\n') + '\n', 'utf-8')

    const byAnnotator = new Map<string, AdocAnnotation[]>()
    for (const ann of chapter.annotations) {
      if (!byAnnotator.has(ann.annotator)) byAnnotator.set(ann.annotator, [])
      byAnnotator.get(ann.annotator)!.push(ann)
    }
    for (const [annotator, anns] of byAnnotator) {
      const mapping = layerMap.get(annotator)
      if (!mapping) continue
      const layerFm = [
        '---', 'type: secondary', 'base: text.cham.md',
        `contributor: ${mapping.contributorId}`,
        'role: commentator', 'nature: commentary',
        '---', '', '## 注釋', '',
      ].join('\n')
      const annLines: string[] = []
      for (const ann of anns) {
        const markerId = markerMap.get(ann.lines[0])
        if (markerId) { annLines.push(`{${markerId}} meaning [${ann.text}]`, '') }
      }
      writeFileSync(join(dirPath, `${mapping.layerId}.cham.md`), layerFm + annLines.join('\n'), 'utf-8')
    }
  }
  console.log(`${config.id}: ${files.length} chapters converted`)
}

// ─── Prose book ──────────────────────────────────────────────

function convertProseBook(config: BookConfig) {
  const srcPath = join(MN_DIR, config.source.file!)
  if (!existsSync(srcPath)) { console.log(`No ${config.source.file}, skipping ${config.id}`); return }

  const src = readFileSync(srcPath, 'utf-8')
  const bookDir = join(CONTENT_DIR, config.id)
  mkdirSync(bookDir, { recursive: true })
  writeFileSync(join(bookDir, 'book.yaml'), YAML.stringify({ id: config.id, ...config.meta }), 'utf-8')

  const unit = config.sections?.unit || '篇'
  const pieces = extractPieces(src, config)

  let extCount = 0
  let chCount = 0
  for (let num = 0; num < pieces.length; num++) {
    const piece = pieces[num]

    // Set title based on kind
    let title = piece.title
    if (piece.kind === 'foreword' || piece.kind === 'preface') {
      extCount++
      title = `外序${circled(extCount)}`
    } else if (piece.kind === 'chapter') {
      chCount++
      title = makeChapterTitle(piece.title, unit, chCount - 1)
    }
    // native & postface keep original title

    const dirName = String(num).padStart(3, '0') + '_' + title.replace(/[\/\\:*?"<>|]/g, '_')
    const dirPath = join(bookDir, dirName)
    mkdirSync(dirPath, { recursive: true })

    const dynasty = (config.meta.date as Record<string, string>)?.dynasty || ''
    const fm = [
      '---',
      `id: ${num}`,
      `title: ${title}`,
      'contributors:',
      ...piece.contributors.map(c => {
        let line = `  - ref: ${c.ref}\n    role: ${c.role}`
        if ((c as any).title) line += `\n    title: ${(c as any).title}`
        return line
      }),
      'date:',
      `  dynasty: ${dynasty}`,
      'genre: prose',
      'source:',
      `  textRef: ${config.id}`,
      '  relation: section',
      '---', '',
    ].join('\n')
    writeFileSync(join(dirPath, 'text.cham.md'), fm + piece.text + '\n', 'utf-8')
    if (piece.notes) writeFileSync(join(dirPath, 'commentary.md'), piece.notes, 'utf-8')
  }
  console.log(`${config.id}: ${pieces.length} pieces converted`)
}

/**
 * Single-pass extraction with AsciiDoc attribute classification.
 * Attribute on the line BEFORE the heading determines section kind.
 */
function extractPieces(src: string, config: BookConfig): ExtractedPiece[] {
  const pieces: ExtractedPiece[] = []
  const lines = src.split('\n')

  let mode: 'idle' | 'collecting' = 'idle'
  let currentKind: SectionKind = 'native'
  let currentTitle = ''
  let currentText: string[] = []
  let currentNotes: string[] = []

  function flush(): void {
    const text = currentText.join('\n\n').trim()
    if (text) {
      const contributors = sectionContributors(config, currentKind)
      pieces.push({ title: currentTitle, text, notes: currentNotes.join('\n\n').trim(), kind: currentKind, contributors })
    }
    currentText = []
    currentNotes = []
  }

  // Look backward from current line index to find the attribute line
  // that precedes the heading (skipping blank lines).
  function getPrevAttr(startIdx: number): string {
    for (let i = startIdx - 1; i >= 0; i--) {
      const s = stripLine(lines[i])
      if (!s) continue
      return s
    }
    return ''
  }

  function classifySection(attr: string): SectionKind {
    if (attr.startsWith('[heading=foreword]')) return 'foreword'
    if (attr.startsWith('[.preface]')) return 'preface'
    return 'native'
  }

  for (let i = 0; i < lines.length; i++) {
    const stripped = stripLine(lines[i])

    const h2 = stripped.match(/^== (.+)$/)
    if (h2) {
      const rawTitle = h2[1].replace(/^\[.*?\]\s*/, '')
      if (VOLUME_RE.test(rawTitle)) { flush(); mode = 'idle'; continue }

      const attr = getPrevAttr(i)
      flush()  // flush previous section with its saved kind
      currentTitle = rawTitle
      currentKind = classifySection(attr)
      mode = 'collecting'
      continue
    }

    const h3 = stripped.match(/^=== (.+)$/)
    if (h3) {
      const rawTitle = h3[1].replace(/^卷[上下]·/, '').replace(/^(NOTE:\s*)?/, '')
      flush()  // flush previous section with its saved kind
      currentTitle = rawTitle
      currentKind = 'chapter'
      mode = 'collecting'
      continue
    }

    if (mode !== 'collecting') continue
    if (stripped.startsWith('NOTE:')) { currentNotes.push(stripped.slice(5).trim()); continue }
    if (!stripped || stripped.startsWith('**') || stripped.startsWith(':') || stripped.startsWith('[')) continue
    if (stripped.startsWith('　') || /^[一-鿿]/.test(stripped)) currentText.push(stripped)
  }

  // Flush the last section
  if (mode === 'collecting' && currentText.length > 0) flush()

  return pieces
}

// ─── Main ────────────────────────────────────────────────────

for (const config of configs) {
  if (config.type === 'annotated') convertAnnotatedBook(config)
  else convertProseBook(config)
}
console.log('AsciiDoc conversion complete')
