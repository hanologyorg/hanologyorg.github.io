import type { ChamDate, DynastyRecord, EraRecord } from './types'

// ─── Sexagenary Cycle ─────────────────────────────────────────

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

const SEXAGENARY_MAP: Record<string, number> = {}
for (let i = 0; i < 60; i++) {
  SEXAGENARY_MAP[STEMS[i % 10] + BRANCHES[i % 12]] = i + 1
}

export function sexagenaryToNumber(cycle: string): number | null {
  return SEXAGENARY_MAP[cycle] ?? null
}

export function numberToSexagenary(n: number): string {
  const idx = ((n - 1) % 60 + 60) % 60
  return STEMS[idx % 10] + BRANCHES[idx % 12]
}

export function ceToSexagenary(ce: number): string {
  return numberToSexagenary(((ce - 4) % 60 + 60) % 60 + 1)
}

// ─── h-CN Encoding ────────────────────────────────────────────

export type DynastyCodeType = 1 | 2 | 3 | 4

export interface DynastyCodeSegments {
  type: DynastyCodeType
  dynasty?: string
  ruler?: string
  era?: string
  year?: number | string
  cycle?: string
}

export function encodeDynastyCode(segments: DynastyCodeSegments): string {
  switch (segments.type) {
    case 1: return `h-CN.1.${segments.dynasty}.${segments.ruler}.${segments.year}`
    case 2: return `h-CN.2.${segments.dynasty}.${segments.era}.${segments.year}`
    case 3: return `h-CN.3.${segments.year}`
    case 4: return `h-CN.4.${segments.cycle}`
  }
}

export function decodeDynastyCode(code: string): DynastyCodeSegments | null {
  const parts = code.split('.')
  if (parts[0] !== 'h-CN') return null

  const type = parseInt(parts[1], 10) as DynastyCodeType
  switch (type) {
    case 1: return { type: 1, dynasty: parts[2], ruler: parts[3], year: parseInt(parts[4], 10) || parts[4] }
    case 2: return { type: 2, dynasty: parts[2], era: parts[3], year: parseInt(parts[4], 10) || parts[4] }
    case 3: return { type: 3, year: parseInt(parts[2], 10) }
    case 4: return { type: 4, cycle: parts[2] }
    default: return null
  }
}

// ─── Dynasty Library (class-based, no global state) ───────────

export class DynastyLibrary {
  private dynasties: Map<string, DynastyRecord> = new Map()
  private eras: EraRecord[] = []

  load(dynasties: Map<string, DynastyRecord>, eras: EraRecord[]): void {
    this.dynasties = dynasties
    this.eras = eras
  }

  lookupDynasty(name: string): DynastyRecord | null {
    return this.dynasties.get(name) ?? null
  }

  lookupEra(dynasty: string, era: string | null): EraRecord[] {
    return this.eras.filter(e => e.dynasty === dynasty && e.era === era)
  }

  lookupByCE(ce: number): EraRecord[] {
    return this.eras.filter(e => e.iso === ce)
  }

  eraToCE(dynasty: string, era: string): number | null {
    return this.eras.find(e => e.dynasty === dynasty && e.era === era)?.iso ?? null
  }

  allDynasties(): Map<string, DynastyRecord> {
    return new Map(this.dynasties)
  }

  allEras(): EraRecord[] {
    return [...this.eras]
  }
}

// ─── ChamDate Helpers ─────────────────────────────────────────

export function resolveChamDate(date: ChamDate): { ce: number | null; sexagenary: string | null; display: string } {
  const parts: string[] = []
  if (date.era) parts.push(date.era)
  if (date.era_year) parts.push(`${date.era_year}年`)
  if (date.sexagenary) parts.push(date.sexagenary)

  return {
    ce: date.iso ?? null,
    sexagenary: date.sexagenary ?? null,
    display: (date.dynasty || '') + (parts.length ? ' ' + parts.join(' ') : ''),
  }
}
