// ─── Meta: Discriminated Union ────────────────────────────────

export type Genre = 'poetry' | 'prose' | 'mixed' | 'drama'
export type Role = 'author' | 'editor' | 'annotator' | 'translator'

export interface ChamContributor {
  ref: string
  role: Role
  title?: string
}

export interface ChamDate {
  dynasty?: string
  era?: string
  era_year?: number
  sexagenary?: string
  iso?: number
  circa?: boolean
  iso_range?: [number, number]
}

export interface PrimaryMeta {
  type: 'primary'
  id: number | string
  title: string
  contributors?: ChamContributor[]
  date?: ChamDate
  genre?: Genre
  source?: PieceSource
}

export interface SecondaryMeta {
  type: 'secondary'
  base: string
  contributor?: string
  role?: string
  dynasty?: string
  era?: string
  era_year?: number
  iso?: number
  nature?: string
}

export type ChamMeta = PrimaryMeta | SecondaryMeta

export function isSecondaryMeta(meta: ChamMeta): meta is SecondaryMeta {
  return meta.type === 'secondary'
}

// ─── Text Model ───────────────────────────────────────────────

export interface TextBlock {
  sectionIndex: number
  blockIndexInSection: number
  text: string    // clean text (no markers, no internal newlines)
  display: string // with original newlines for display
  source: string  // original text with markers
}

// ─── Marker Model ─────────────────────────────────────────────

export interface Marker {
  id: number
  sectionIndex: number
  blockIndex: number
  offset: number
  length: number
  text?: string
}

export type MarkerTable = Map<number, Marker>

// ─── Annotation Model ─────────────────────────────────────────

export interface SectionMeta {
  contributor?: string
  role?: string
  dynasty?: string
  era?: string
  era_year?: number
  iso?: number
  nature?: string
}

export interface AnnotationSection {
  name: string
  meta: SectionMeta
  entries: AnnotationEntry[]
}

export type AnnotationKind =
  | 'pron' | 'meaning' | 'person' | 'place' | 'event'
  | 'date' | 'allusion' | 'commentary' | 'translation'
  | (string & {})

export type AnnotationTarget =
  | { type: 'marker'; markerId: number }
  | { type: 'title' }
  | { type: 'full' }
  | { type: 'verse'; line: number; char: number }

export interface AnnotationEntry {
  target: AnnotationTarget
  kind: AnnotationKind
  params: Record<string, string>
  headword?: string
  value: string
}

// ─── Document Model ───────────────────────────────────────────

export interface ChamDocument {
  meta: ChamMeta
  textBlocks: TextBlock[]
  markers: MarkerTable
  sections: AnnotationSection[]
}

export interface ChamProject {
  primary: ChamDocument
  secondary: ChamDocument[]
  prose: Map<string, string>
}

// ─── Library Types ──────────────────────────────────────────────

export type LibraryScale = 'single-piece' | 'single-book' | 'library'
export type BookGenre = 'poetry' | 'prose' | 'mixed' | 'drama'

export interface BookLayer {
  id: string
  label: string
  shortLabel?: string
  contributor: string
  role?: string
  nature?: string
  displayOrder?: number
  enabled?: boolean
}

export interface BookAnnotationDefaults {
  defaultLabel?: string
  defaultShortLabel?: string
}

export interface BookConfig {
  id: string
  title: string
  subtitle?: string
  titleEn?: string
  publisher?: string
  genre?: BookGenre
  contributors?: ChamContributor[]
  date?: ChamDate
  hero?: string[]
  layers?: BookLayer[]
  annotation?: BookAnnotationDefaults
}

export interface BookMeta {
  id: string
  title: string
  subtitle?: string
  titleEn?: string
  publisher?: string
  genre: BookGenre
  count: number
  hero?: string[]
  layers?: BookLayer[]
  annotation?: BookAnnotationDefaults
}

export interface CrossRef {
  focusedBookId: string
  focusedNum: number
  fullBookId: string
  fullNum?: number
  relation: 'section' | 'excerpt'
}

export interface LibraryIndex {
  scale: LibraryScale
  books: BookMeta[]
  crossRefs?: CrossRef[]
}

// ─── Piece Output (pipeline → frontend) ────────────────────────

export interface OutputRange {
  type: 'range'
  scope: 'title' | 'verse'
  verseIndex?: number
  start: number
  end: number
}

export interface OutputAnnotation {
  id: string
  range: OutputRange
  kind: string
  lang?: string
  text: string
  source: string
}

export interface OutputAnnotationLayer {
  id: string
  label: string
  shortLabel: string
  contributor: string
  role: string
  nature: string
  displayOrder: number
  enabled: boolean
  annotations: OutputAnnotation[]
}

export interface PieceSource {
  text?: string
  textRef?: string
  pieceRef?: number
  relation: 'section' | 'excerpt' | 'standalone'
  range?: { start: string; end: string }
}

export interface OutputProseSection {
  key: string
  title: string
  filename: string
  body: string
  order: number
}

export interface OutputPiece {
  bookId: string
  num: number
  title: string
  author: string
  authorId: string
  dynasty: string
  genre: BookGenre
  verses: { text: string }[]
  sections: Record<string, string>
  structuredSections?: OutputProseSection[]
  annotations: OutputAnnotation[]
  layers?: Record<string, OutputAnnotation[]>
  annotationLayers?: OutputAnnotationLayer[]
  source?: PieceSource
}

export interface BookData {
  meta: BookMeta
  pieces: OutputPiece[]
}

// ─── Registry Types ───────────────────────────────────────────

export interface DynastyRecord {
  name: string
  code: string
  start: number | null
  end: number | null
}

export interface EraRecord {
  dynasty: string
  dynastyCode: string
  ruler: string | null
  rulerCode: string | null
  accession: number | null
  era: string | null
  eraCode: string | null
  eraCount: number | null
  sexagenary: string | null
  iso: number | null
}

export interface LexiconPron {
  type: string
  lang: string
  value: string
}

export interface LexiconEntry {
  pron: LexiconPron[]
}

export type Lexicon = Record<string, LexiconEntry>
