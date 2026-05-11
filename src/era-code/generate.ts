/**
 * Generate GB/T calendar era codes from structured data.
 */
import type { ParsedCode } from './types.js'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

export function generateCode(parsed: ParsedCode): string {
  const prefix = `${parsed.calendarState}-${parsed.countryCode}.${parsed.type}`

  switch (parsed.type) {
    case 1:
      return `${prefix}.${pad2(parsed.dynastyCode)}.${pad2(parsed.rulerCode)}${parsed.reignCount}.${pad3(parsed.yearOrdinal)}`
    case 2:
      return `${prefix}.${pad2(parsed.dynastyCode)}.${pad2(parsed.rulerCode)}${parsed.reignCount}.${pad2(parsed.eraCode)}${parsed.eraInstance}.${pad2(parsed.eraYear)}`
    case 3:
      return `${prefix}.${pad2(parsed.rocYear)}`
    case 4:
      return `${prefix}.${pad2(parsed.ganzhiCode)}.${pad2(parsed.occurrenceOrdinal)}`
  }
}

/** Convenience: generate a Type 1 (王公即位年次紀年) code */
export function kinglyCode(dynasty: number, ruler: number, reign: number, year: number): string {
  return generateCode({
    calendarState: 'h', countryCode: 'CN', type: 1,
    dynastyCode: dynasty, rulerCode: ruler, reignCount: reign, yearOrdinal: year,
  })
}

/** Convenience: generate a Type 2 (年號紀年) code */
export function imperialCode(dynasty: number, ruler: number, reign: number, era: number, instance: number, year: number): string {
  return generateCode({
    calendarState: 'h', countryCode: 'CN', type: 2,
    dynastyCode: dynasty, rulerCode: ruler, reignCount: reign,
    eraCode: era, eraInstance: instance, eraYear: year,
  })
}

/** Convenience: generate a Type 3 (中華民國紀年) code */
export function rocCode(year: number): string {
  return generateCode({
    calendarState: 'h', countryCode: 'CN', type: 3, rocYear: year,
  })
}

/** Convenience: generate a Type 4 (天干地支紀年) code */
export function ganzhiCode(ganzhi: number, ordinal: number): string {
  return generateCode({
    calendarState: 'h', countryCode: 'CN', type: 4,
    ganzhiCode: ganzhi, occurrenceOrdinal: ordinal,
  })
}
