/**
 * GB/T XXXXX — 日曆體系代碼 (Calendar System Code)
 * Type definitions for Chinese historical calendar era codes.
 *
 * Four era types per Part 2:
 *   1 = 王公即位年次紀年 (Kingly succession)
 *   2 = 年號紀年 (Imperial era name)
 *   3 = 中華民國紀年 (ROC)
 *   4 = 天干地支紀年 (Ganzhi cycle)
 */

export type CalendarState = 'h' | 'c'
export type EraType = 1 | 2 | 3 | 4

export interface DynastyEntry {
  code: number
  label: string
  firstYear: number | null
  lastYear: number | null
  rulerCount: number
}

export interface RulerEntry {
  dynastyCode: number
  rulerCode: number
  reignCount: number
  label: string
  firstYear: number | null
  lastYear: number | null
}

export interface EraNameEntry {
  dynastyCode: number
  rulerCode: number
  reignCount: number
  eraCode: number
  eraInstance: number
  label: string
  firstYear: number | null
  lastYear: number | null
}

export interface GanzhiEntry {
  year: number | null
  ganzhi: string
  ganzhiCode: number
  calendarCode: string
}

/** Master data tables extracted from GB/T XXXXX.2 Appendix A */
export interface EraData {
  dynasties: DynastyEntry[]
  rulers: RulerEntry[]
  eras: EraNameEntry[]
  ganzhi: GanzhiEntry[]
}

// ─── Parsed code structures ─────────────────────────────────

export interface BaseParsedCode {
  calendarState: CalendarState
  countryCode: string
  type: EraType
}

/** Type 1: 王公即位年次紀年 — h-CN.1.{DD}.{RRR}.{YYY} */
export interface KinglyParsedCode extends BaseParsedCode {
  type: 1
  dynastyCode: number
  rulerCode: number
  reignCount: number
  yearOrdinal: number
}

/** Type 2: 年號紀年 — h-CN.2.{DD}.{RRR}.{EER}.{YY} */
export interface ImperialParsedCode extends BaseParsedCode {
  type: 2
  dynastyCode: number
  rulerCode: number
  reignCount: number
  eraCode: number
  eraInstance: number
  eraYear: number
}

/** Type 3: 中華民國紀年 — h-CN.3.{YY} */
export interface ROCParsedCode extends BaseParsedCode {
  type: 3
  rocYear: number
}

/** Type 4: 天干地支紀年 — h-CN.4.{CC}.{YY} */
export interface GanzhiParsedCode extends BaseParsedCode {
  type: 4
  ganzhiCode: number
  occurrenceOrdinal: number
}

export type ParsedCode =
  | KinglyParsedCode
  | ImperialParsedCode
  | ROCParsedCode
  | GanzhiParsedCode

/** Resolved code with human-readable labels and Gregorian year */
export interface ResolvedCode {
  code: string
  parsed: ParsedCode
  label: string
  labelEn: string
  gregorianYear: number | null
}
