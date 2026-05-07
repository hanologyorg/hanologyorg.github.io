/**
 * 領域模型 — 古典詩文圖書館統一資料結構
 *
 * 設計原則：
 * - 所有模型皆為不可變（readonly）
 * - 注腳與詩句分離，詩句保留純文本
 * - 章節以枚舉區分，MECE
 * - 開放封閉：新增資源類型不需修改現有模型
 */

// ===== 資源集 =====

export const Collection = {
  Primary: 'primary',           // 積累與感興（小學 100 篇）
  Secondary: 'secondary',       // 積學與涵泳（中學 150 篇）
  Culture: 'culture',           // 郁文華章（50 篇文化選篇）
  NSS: 'nss',                   // 指定文言經典（12 篇 DSE）
  Training: 'training',         // 教師培訓材料
} as const;

export type Collection = (typeof Collection)[keyof typeof Collection];

// ===== 章節類型 =====

export const SectionType = {
  AuthorBio: 'author_bio',
  Background: 'background',
  Annotations: 'annotations',
  Analysis: 'analysis',
  Preparation: 'preparation',
  FollowUp: 'follow_up',
  ThinkQuestions: 'think_questions',
  Supplementary: 'supplementary',
  OriginalText: 'original_text',
  Reflection: 'reflection',
  Activities: 'activities',
} as const;

export type SectionType = (typeof SectionType)[keyof typeof SectionType];

export const SECTION_LABELS: Record<SectionType, string> = {
  author_bio: '作者簡介',
  background: '背景資料',
  annotations: '注釋',
  analysis: '賞析重點',
  preparation: '預習活動',
  follow_up: '跟進活動',
  think_questions: '想一想',
  supplementary: '補充資料',
  original_text: '原文',
  reflection: '反思問題',
  activities: '學習活動',
};

// ===== 注腳引用 =====

export interface FootnoteRef {
  num: number;
  position: number;
}

// ===== 詩句行 =====

export interface VerseLine {
  text: string;
  footnotes: readonly FootnoteRef[];
}

// ===== 讀音 =====

export type Dialect = 'cantonese' | 'mandarin';

export interface Pronunciation {
  dialect: Dialect;
  homophone: string;
  phonetic: string;
}

// ===== 注釋條目 =====

export interface AnnotationEntry {
  num: number;
  term: string;
  pronunciations: readonly Pronunciation[];
  definition: string;
  children: readonly AnnotationEntry[];
}

// ===== 體裁 =====

export const Genre = {
  Shi: 'shi',
  Ci: 'ci',
  Qu: 'qu',
  Fu: 'fu',
  Prose: 'prose',
  Letter: 'letter',
  Essay: 'essay',
  Chronicle: 'chronicle',
  Philosophical: 'philosophical',
  Other: 'other',
} as const;

export type Genre = (typeof Genre)[keyof typeof Genre];

// ===== 音頻資源 =====

export interface AudioTrack {
  url: string;
  type: 'cantonese_taici' | 'cantonese_yinsong' | 'mandarin';
  label: string;
}

// ===== 統一作品模型 =====

export interface Work {
  id: string;                          // 唯一標識，如 'secondary:042'
  num: number;                         // 在所在集中的編號
  collection: Collection;
  title: string;
  author: string;
  dynasty?: string;
  genre?: Genre;
  source?: string;                     // 出處（禮記、論語、莊子等）
  category?: string;                   // 文化分類（修身處世、家國人倫等）
  excerpt_range?: string;              // 節錄範圍（如有）
  verses: readonly VerseLine[];
  sections: Readonly<Partial<Record<SectionType, string>>>;
  annotations: readonly AnnotationEntry[];
  audio: readonly AudioTrack[];
  related_works: readonly string[];    // 關聯作品 ID
  pdf_url?: string;
}

// ===== 作者 =====

export interface Author {
  name: string;
  dynasty?: string;
  bio?: string;
  workCount: number;
  collections: Collection[];
}

// ===== 朝代 =====

export interface Dynasty {
  name: string;
  startDate?: string;
  endDate?: string;
  authors: string[];
  workCount: number;
}

// ===== 文化選篇 =====

export const CultureCategory = {
  SelfCultivation: 'self_cultivation',
  FamilyNation: 'family_nation',
  BeautyVirtue: 'beauty_virtue',
  Nature: 'nature',
} as const;

export type CultureCategory = (typeof CultureCategory)[keyof typeof CultureCategory];

// ===== NSS 指定篇章 =====

export interface NSSReference {
  settext_title: string;
  entries: readonly {
    type: 'edb_analysis' | 'academic';
    title: string;
    author: string;
    source: string;
    publisher: string;
    year: string;
    url?: string;
  }[];
}

// ===== 教師培訓材料 =====

export const TrainingCategory = {
  LearningTeaching: 'learning_teaching',
  CurriculumAssessment: 'curriculum_assessment',
  ClassicalTexts: 'classical_texts',
} as const;

export type TrainingCategory = (typeof TrainingCategory)[keyof typeof TrainingCategory];

export interface TrainingMaterial {
  id: string;
  date: string;
  title: string;
  speakers: readonly { name: string; affiliation: string }[];
  category: TrainingCategory;
  files: readonly { title: string; url: string }[];
  tags: string[];
}

// ===== Pipeline 介面 =====

export interface Extractor {
  extract(pdfPath: string): Promise<string[]>;
}

export interface Parser {
  parse(pages: string[], num: number, knownTitle: string): Work;
}

export interface Renderer {
  readonly format: string;
  render(work: Work): string;
  renderAll(works: readonly Work[]): string;
}

// ===== 向後兼容 =====

export type Poem = Work;
export type PoemIndex = { num: number; title: string; author: string; versePreview: string };

export const SECTION_LABEL_MAP = SECTION_LABELS;
