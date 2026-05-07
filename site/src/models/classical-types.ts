/**
 * Classical Chinese Text Data Model
 *
 * Supports hierarchical text structure, layered commentaries,
 * recursive annotations, historical date encoding, and knowledge graph entities.
 *
 * See TODO.classic-han-library/06-classical-text-model.md for full design rationale.
 */

// ─── Work Hierarchy ────────────────────────────────────────────────

export type WorkType = 'jing' | 'shi' | 'zi' | 'ji' | 'anthology' | 'other'

export interface Work {
  id: string
  title: string
  type: WorkType
  creator?: EntityRef
  era?: EntityRef
  metadata: Record<string, string>
  structure: WorkStructure
}

export interface WorkStructure {
  levels: StructureLevel[]
  tree: StructureNode
}

export interface StructureLevel {
  name: string
  labelZh: string
}

export interface StructureNode {
  id: string
  level: number
  label: string
  children: StructureNode[]
  textRef?: TextRef
}

export interface TextRef {
  workId: string
  path: string[]
}

// ─── Text Content ──────────────────────────────────────────────────

export interface TextSegment {
  id: string
  text: string
  normalizedText?: string
  path: string[]
  parallelTexts?: ParallelText[]
}

export interface ParallelText {
  lang: string
  type: 'translation' | 'transliteration' | 'paraphrase'
  text: string
  source?: string
}

export type TextScope =
  | 'segment' | 'passage' | 'chapter' | 'juan' | 'work'
  | 'verse' | 'title' | 'section' | 'full_text'

export interface ClassicalTextRange {
  type: 'point' | 'range' | 'full'
  scope: TextScope
  path?: string[]
  start?: number
  end?: number
}

// ─── Annotation Model ──────────────────────────────────────────────

export type AnnotationTarget =
  | { type: 'text'; range: ClassicalTextRange }
  | { type: 'annotation'; annotationId: string }

export type AnnotationKind =
  // Semantic (義訓)
  | 'semantic' | 'definition' | 'exegesis'
  // Phonetic (聲訓)
  | 'pronunciation' | 'fanqie' | 'duruo' | 'duwei'
  // Form (形訓)
  | 'etymology' | 'palaeography'
  // Textual criticism (校勘)
  | 'collation' | 'emendation'
  // Commentary
  | 'note' | 'commentary' | 'appreciation'
  // Reference
  | 'citation' | 'cross_reference'

export interface ClassicalAnnotation {
  id: string
  target: AnnotationTarget
  kind: AnnotationKind
  lang?: string
  text: string
  source: string
  commentaryId?: string
  metadata?: AnnotationMetadata
}

export interface AnnotationMetadata {
  confidence?: number
  generatedBy?: 'human' | 'ai' | 'pipeline'
  createdAt?: string
}

// ─── Commentary Layers ────────────────────────────────────────────

export type CommentaryType =
  | 'zhuan'       // 傳
  | 'gu'          // 故/詁
  | 'xun'         // 訓
  | 'ji'          // 記
  | 'zhu'         // 注
  | 'jie'         // 解
  | 'zhangju'     // 章句
  | 'jian'        // 箋
  | 'jijie'       // 集解
  | 'jizhu'       // 集注
  | 'shu'         // 疏
  | 'zhengyi'     // 正義
  | 'yinyi'       // 音義
  | 'kaozheng'    // 考證
  | 'pingdian'    // 評點
  | 'biji'        // 筆記

export const COMMENTARY_TYPE_LABELS: Record<CommentaryType, string> = {
  zhuan: '傳', gu: '故', xun: '訓', ji: '記',
  zhu: '注', jie: '解', zhangju: '章句', jian: '箋',
  jijie: '集解', jizhu: '集注', shu: '疏', zhengyi: '正義',
  yinyi: '音義', kaozheng: '考證', pingdian: '評點', biji: '筆記',
}

export interface Commentary {
  id: string
  title: string
  commentator: EntityRef
  era?: EntityRef
  targetWork: EntityRef
  baseCommentary?: EntityRef
  type: CommentaryType
  annotationCount: number
}

// ─── Date Encoding ─────────────────────────────────────────────────

export type CalendarSystem = 'gregorian' | 'chinese' | 'julian'

export interface HistoricalDate {
  type: 'point' | 'range' | 'fuzzy'
  calendar: CalendarSystem
  era?: EraReference
  year?: number
  month?: number
  day?: number
  ganzhi?: GanzhiDate
  endEra?: EraReference
  endYear?: number
  endMonth?: number
  endDay?: number
  approximate?: boolean
  description?: string
}

export interface EraReference {
  eraId: string
  eraName: string
  yearInEra: number
}

export interface GanzhiDate {
  heavenlyStem: number   // 0–9 (甲乙丙丁戊己庚辛壬癸)
  earthlyBranch: number  // 0–11 (子丑寅卯辰巳午未申酉戌亥)
}

// ─── Entity Model ──────────────────────────────────────────────────

export type EntityType =
  | 'person' | 'era' | 'dynasty' | 'work' | 'place'
  | 'office' | 'concept' | 'event' | 'school'

export interface Entity {
  '@id': string
  '@type': EntityType
  name: string
  aliases?: string[]
  description?: string
  claims: Claim[]
}

export type EntityRef = string

export interface Claim {
  predicate: string
  object: string | EntityRef
  qualifiers?: Qualifier[]
  source?: Citation
}

export interface Qualifier {
  predicate: string
  object: string | EntityRef
}

export interface Citation {
  urn: string
  literalText?: string
  commentary?: EntityRef
}

// ─── Kind-to-style mapping (Open/Closed) ───────────────────────────

export const ANNOTATION_KIND_META: Record<AnnotationKind, { label: string; color: string }> = {
  semantic:        { label: '義', color: 'vermillion' },
  definition:      { label: '釋', color: 'vermillion' },
  exegesis:        { label: '解', color: 'vermillion' },
  pronunciation:   { label: '音', color: 'jade' },
  fanqie:          { label: '反', color: 'jade' },
  duruo:           { label: '讀', color: 'jade' },
  duwei:           { label: '音義', color: 'gold' },
  etymology:       { label: '源', color: 'ink-light' },
  palaeography:    { label: '古', color: 'ink-light' },
  collation:       { label: '校', color: 'gold' },
  emendation:      { label: '改', color: 'gold' },
  note:            { label: '註', color: 'ink-mid' },
  commentary:      { label: '評', color: 'ink-mid' },
  appreciation:    { label: '賞', color: 'vermillion-light' },
  citation:        { label: '引', color: 'ink-faint' },
  cross_reference: { label: '參', color: 'ink-faint' },
}
