/**
 * Unified Library Types — Classical Chinese Text Digital Library
 *
 * Covers all collections: primary (積累與感興), secondary (積學與涵泳),
 * culture (郁文華章), NSS settexts, NSS references, and teacher training.
 */

// ─── Collection Identity ────────────────────────────

export type CollectionId =
  | 'primary'          // 積累與感興（小學 100 篇）
  | 'secondary'        // 積學與涵泳（中學 150 篇）
  | 'culture'          // 郁文華章（文化選篇 50 + 文化集思 6 + 教學設計 6）
  | 'nss'              // NSS 指定文言經典學習材料（12 篇）
  | 'nss_reference'    // NSS 教師參考資料選編
  | 'training'         // 教師培訓課程材料

// ─── Audio ──────────────────────────────────────────

export interface AudioTracks {
  cantonese_taici?: string
  cantonese_yinsong?: string
  mandarin?: string
}

// ─── Secondary Collection (積學與涵泳) ─────────────

export interface SecondaryPoem {
  id: string
  num: number
  title: string
  collection: 'secondary'
  pdfUrl?: string
  audio: AudioTracks
  revised: boolean
}

// ─── Culture Collection (郁文華章) ─────────────────

export type CultureCategory = 'self_cultivation' | 'family_nation' | 'beauty_goodness' | 'nature'
export type CultureSection = 'essays' | 'articles' | 'teaching_designs'

export const CULTURE_CATEGORY_LABELS: Record<CultureCategory, string> = {
  self_cultivation: '修身和處世',
  family_nation: '家國與人倫',
  beauty_goodness: '美與善',
  nature: '人與自然',
}

export interface CultureEssay {
  id: string
  num: number
  title: string
  author: string
  pdfUrl?: string
  section: 'essays'
  collection: 'culture'
}

export interface CultureArticle {
  id: string
  num: number
  title: string
  author: string
  source?: string
  category: CultureCategory
  pdfUrl?: string
  externalUrl?: string
  format: 'pdf' | 'www'
  section: 'articles'
  collection: 'culture'
}

export interface CultureTeachingDesign {
  id: string
  num: number
  title: string
  pdfUrl?: string
  section: 'teaching_designs'
  collection: 'culture'
}

export interface CultureCollection {
  source: string
  essays: CultureEssay[]
  articles: CultureArticle[]
  teachingDesigns: CultureTeachingDesign[]
}

// ─── NSS Collection ────────────────────────────────

export interface NSSSettext {
  id: string
  num: number
  title: string
  author: string
  dynasty: string
  source?: string
  excerptRange?: string
  pdfUrl?: string
  audio: AudioTracks
  subItems?: NSSSettext[]
  collection: 'nss'
}

export interface NSSReferenceGroup {
  settextId: string
  settextTitle: string
  entries: NSSReferenceEntry[]
}

export interface NSSReferenceEntry {
  type: 'edb_analysis' | 'academic'
  title: string
  author: string
  source?: string
  publisher?: string
  year?: string
  url?: string
  format: 'pdf' | 'www'
  isDuplicateOfSecondary?: number
}

export interface NSSCultureMapping {
  nssTitle: string
  nssId: string
  category: 'self_cultivation' | 'family_nation'
  cultureArticles: string[]
}

export interface NSSTeachingExample {
  textTitle: string
  pdfUrl?: string
}

export interface NSSCurriculumDoc {
  title: string
  date?: string
  url?: string
}

export interface NSSIndex {
  cultureMappings: NSSCultureMapping[]
  teachingExamples: NSSTeachingExample[]
  curriculumDocs: NSSCurriculumDoc[]
}

// ─── Training Collection ───────────────────────────

export type TrainingCategory =
  | 'learning_teaching'      // 學與教資源
  | 'curriculum_assessment'  // 課程詮釋及學習評估
  | 'classical_texts'        // 文言經典學習材料系列

export const TRAINING_CATEGORY_LABELS: Record<TrainingCategory, string> = {
  learning_teaching: '學與教資源',
  curriculum_assessment: '課程詮釋及學習評估',
  classical_texts: '文言經典學習材料系列',
}

export interface TrainingMaterial {
  id: string
  date: string
  title: string
  speakers: Speaker[]
  materials: MaterialFile[]
  category: TrainingCategory
  series?: string
  tags: string[]
  collection: 'training'
}

export interface Speaker {
  name: string
  affiliation?: string
}

export interface MaterialFile {
  title: string
  url?: string
  relatedTexts?: string[]
}

// ─── Cross References ──────────────────────────────

export type CrossRefRelation =
  | 'same_text'
  | 'excerpt'
  | 'analysis'
  | 'reference'
  | 'teaching_example'
  | 'culture_mapping'
  | 'training_series'

export interface CrossReference {
  from: { collection: CollectionId; id: string }
  to: { collection: CollectionId; id: string }
  relation: CrossRefRelation
}

// ─── Library Index ──────────────────────────────────

export interface LibraryIndex {
  collections: {
    primary: { total: number; label: string }
    secondary: { total: number; label: string }
    culture: { total: number; articles: number; essays: number; teachingDesigns: number; label: string }
    nss: { total: number; label: string }
    training: { total: number; label: string }
  }
  crossRefCount: number
}
