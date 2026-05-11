/**
 * @hanology/era-code — GB/T XXXXX 日曆體系代碼
 *
 * Parse, generate, resolve, and validate Chinese historical calendar era codes
 * per the national standard GB/T XXXXX (日期和時間 日曆體系代碼).
 *
 * Four era types (Part 2):
 *   1 = 王公即位年次紀年  h-CN.1.{DD}.{RRR}.{YYY}
 *   2 = 年號紀年          h-CN.2.{DD}.{RRR}.{EER}.{YY}
 *   3 = 中華民國紀年      h-CN.3.{YY}
 *   4 = 天干地支紀年      h-CN.4.{CC}.{OO}
 */
export { parseCode, isValidCode } from './parse.js'
export {
  generateCode, kinglyCode, imperialCode, rocCode, ganzhiCode,
} from './generate.js'
export { EraResolver } from './resolve.js'
export { loadEraData } from './data.js'
export type {
  CalendarState, EraType,
  DynastyEntry, RulerEntry, EraNameEntry, GanzhiEntry, EraData,
  ParsedCode, KinglyParsedCode, ImperialParsedCode, ROCParsedCode, GanzhiParsedCode,
  ResolvedCode,
} from './types.js'
