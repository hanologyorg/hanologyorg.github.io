/**
 * Parse GB/T calendar era codes.
 *
 * Formats:
 *   Type 1: h-CN.1.{DD}.{RRR}.{YYY}     王公即位年次紀年
 *   Type 2: h-CN.2.{DD}.{RRR}.{EER}.{YY} 年號紀年
 *   Type 3: h-CN.3.{YY}                   中華民國紀年
 *   Type 4: h-CN.4.{CC}.{OO}              天干地支紀年
 */
import type {
  ParsedCode, KinglyParsedCode, ImperialParsedCode,
  ROCParsedCode, GanzhiParsedCode,
} from './types.js'

export function parseCode(code: string): ParsedCode | null {
  const parts = code.split(/[-.]/)
  // Minimum: [state, country, type]
  if (parts.length < 3) return null

  const [state, country, typeStr, ...aux] = parts
  if (!/^[hc]$/.test(state)) return null
  if (!/^[A-Z]{2}$/.test(country)) return null
  const type = Number(typeStr)
  if (![1, 2, 3, 4].includes(type)) return null

  switch (type as 1 | 2 | 3 | 4) {
    case 1: {
      // h-CN.1.{DD}.{RRR}.{YYY} — aux = [DD, RRR, YYY]
      if (aux.length < 3) return null
      return {
        calendarState: state as 'h' | 'c',
        countryCode: country,
        type: 1,
        dynastyCode: parseInt(aux[0], 10),
        rulerCode: parseInt(aux[1].slice(0, 2), 10),
        reignCount: parseInt(aux[1][2], 10),
        yearOrdinal: parseInt(aux[2], 10),
      } satisfies KinglyParsedCode
    }
    case 2: {
      // h-CN.2.{DD}.{RRR}.{EER}.{YY} — aux = [DD, RRR, EER, YY]
      if (aux.length < 4) return null
      return {
        calendarState: state as 'h' | 'c',
        countryCode: country,
        type: 2,
        dynastyCode: parseInt(aux[0], 10),
        rulerCode: parseInt(aux[1].slice(0, 2), 10),
        reignCount: parseInt(aux[1][2], 10),
        eraCode: parseInt(aux[2].slice(0, 2), 10),
        eraInstance: parseInt(aux[2][2], 10),
        eraYear: parseInt(aux[3], 10),
      } satisfies ImperialParsedCode
    }
    case 3: {
      // h-CN.3.{YY} — aux = [YY]
      if (aux.length < 1) return null
      return {
        calendarState: state as 'h' | 'c',
        countryCode: country,
        type: 3,
        rocYear: parseInt(aux[0], 10),
      } satisfies ROCParsedCode
    }
    case 4: {
      // h-CN.4.{CC}.{OO} — aux = [CC, OO]
      if (aux.length < 2) return null
      return {
        calendarState: state as 'h' | 'c',
        countryCode: country,
        type: 4,
        ganzhiCode: parseInt(aux[0], 10),
        occurrenceOrdinal: parseInt(aux[1], 10),
      } satisfies GanzhiParsedCode
    }
  }
}

export function isValidCode(code: string): boolean {
  return parseCode(code) !== null
}
