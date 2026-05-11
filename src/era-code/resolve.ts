/**
 * Resolve GB/T calendar era codes to Gregorian years and labels,
 * and reverse-lookup codes from years.
 */
import type {
  EraData, DynastyEntry, RulerEntry, EraNameEntry,
  ParsedCode, ResolvedCode,
} from './types.js'

function pad2(n: number): string { return String(n).padStart(2, '0') }

export class EraResolver {
  private dynastyMap = new Map<number, DynastyEntry>()
  private rulerMap = new Map<string, RulerEntry>()
  private eraMap = new Map<string, EraNameEntry>()
  private dynastyLabelMap = new Map<string, number>()

  constructor(private data: EraData) {
    for (const d of data.dynasties) {
      this.dynastyMap.set(d.code, d)
      this.dynastyLabelMap.set(d.label, d.code)
    }
    for (const r of data.rulers) {
      this.rulerMap.set(`${r.dynastyCode}.${r.rulerCode}.${r.reignCount}`, r)
    }
    for (const e of data.eras) {
      this.eraMap.set(`${e.dynastyCode}.${e.rulerCode}.${e.reignCount}.${e.eraCode}.${e.eraInstance}`, e)
    }
  }

  getDynasty(code: number): DynastyEntry | undefined {
    return this.dynastyMap.get(code)
  }

  getDynastyByLabel(label: string): DynastyEntry | undefined {
    const code = this.dynastyLabelMap.get(label)
    return code !== undefined ? this.dynastyMap.get(code) : undefined
  }

  /** Look up a common dynasty label like "秦" or "唐" to its GB/T code */
  getDynastyCode(label: string): number | undefined {
    return this.dynastyLabelMap.get(label)
  }

  getRuler(dynastyCode: number, rulerCode: number, reignCount: number): RulerEntry | undefined {
    return this.rulerMap.get(`${dynastyCode}.${rulerCode}.${reignCount}`)
  }

  /** Get all rulers for a dynasty */
  getRulersForDynasty(dynastyCode: number): RulerEntry[] {
    return this.data.rulers.filter(r => r.dynastyCode === dynastyCode)
  }

  /** Get all era names for a ruler */
  getErasForRuler(dynastyCode: number, rulerCode: number, reignCount: number): EraNameEntry[] {
    return this.data.eras.filter(e =>
      e.dynastyCode === dynastyCode &&
      e.rulerCode === rulerCode &&
      e.reignCount === reignCount
    )
  }

  resolve(parsed: ParsedCode): ResolvedCode | null {
    switch (parsed.type) {
      case 1: return this.resolveKingly(parsed)
      case 2: return this.resolveImperial(parsed)
      case 3: return this.resolveROC(parsed)
      case 4: return this.resolveGanzhi(parsed)
    }
  }

  private resolveKingly(p: ParsedCode & { type: 1 }): ResolvedCode | null {
    const dynasty = this.dynastyMap.get(p.dynastyCode)
    const ruler = this.rulerMap.get(`${p.dynastyCode}.${p.rulerCode}.${p.reignCount}`)
    if (!dynasty || !ruler) return null

    const year = ruler.firstYear !== null ? ruler.firstYear + p.yearOrdinal - 1 : null
    return {
      code: this.formatCode(p),
      parsed: p,
      label: `${dynasty.label}${ruler.label}${this.ordinal(p.yearOrdinal)}年`,
      labelEn: `Year ${p.yearOrdinal} of ${ruler.label} of ${dynasty.label}`,
      gregorianYear: year,
    }
  }

  private resolveImperial(p: ParsedCode & { type: 2 }): ResolvedCode | null {
    const dynasty = this.dynastyMap.get(p.dynastyCode)
    const ruler = this.rulerMap.get(`${p.dynastyCode}.${p.rulerCode}.${p.reignCount}`)
    const era = this.eraMap.get(`${p.dynastyCode}.${p.rulerCode}.${p.reignCount}.${p.eraCode}.${p.eraInstance}`)
    if (!dynasty || !ruler || !era) return null

    const year = era.firstYear !== null ? era.firstYear + p.eraYear - 1 : null
    return {
      code: this.formatCode(p),
      parsed: p,
      label: `${dynasty.label}${ruler.label}${era.label}${this.ordinal(p.eraYear)}年`,
      labelEn: `${this.ordinal(p.eraYear)} year of ${era.label} era, ${ruler.label} of ${dynasty.label}`,
      gregorianYear: year,
    }
  }

  private resolveROC(p: ParsedCode & { type: 3 }): ResolvedCode | null {
    return {
      code: this.formatCode(p),
      parsed: p,
      label: `中華民國${this.ordinal(p.rocYear)}年`,
      labelEn: `Year ${p.rocYear} of the Republic of China`,
      gregorianYear: p.rocYear + 1911,
    }
  }

  private resolveGanzhi(p: ParsedCode & { type: 4 }): ResolvedCode | null {
    const entry = this.data.ganzhi.find(g => g.ganzhiCode === p.ganzhiCode && g.year !== null)
    return {
      code: this.formatCode(p),
      parsed: p,
      label: `${this.ganzhiLabel(p.ganzhiCode)}年`,
      labelEn: `Year of ${this.ganzhiLabel(p.ganzhiCode)} (cycle ${p.occurrenceOrdinal})`,
      gregorianYear: entry?.year ?? null,
    }
  }

  private ordinal(n: number): string {
    const chars = ['元', '二', '三', '四', '五', '六', '七', '八', '九', '十']
    if (n === 1) return '元'
    if (n <= 10) return chars[n]
    return String(n)
  }

  private ganzhiLabel(code: number): string {
    const tiangan = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
    const dizhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
    const idx = code - 1
    return tiangan[idx % 10] + dizhi[idx % 12]
  }

  private formatCode(p: ParsedCode): string {
    const prefix = `${p.calendarState}-${p.countryCode}.${p.type}`
    switch (p.type) {
      case 1: return `${prefix}.${pad2(p.dynastyCode)}.${pad2(p.rulerCode)}${p.reignCount}.${String(p.yearOrdinal).padStart(3, '0')}`
      case 2: return `${prefix}.${pad2(p.dynastyCode)}.${pad2(p.rulerCode)}${p.reignCount}.${pad2(p.eraCode)}${p.eraInstance}.${pad2(p.eraYear)}`
      case 3: return `${prefix}.${pad2(p.rocYear)}`
      case 4: return `${prefix}.${pad2(p.ganzhiCode)}.${pad2(p.occurrenceOrdinal)}`
    }
  }

  // ─── Reverse lookups ─────────────────────────────────────

  /** Find which dynasty a Gregorian year belongs to */
  findDynastiesForYear(year: number): DynastyEntry[] {
    return this.data.dynasties.filter(d =>
      d.firstYear !== null && d.lastYear !== null &&
      year >= d.firstYear && year <= d.lastYear
    )
  }

  /** Find rulers active in a given year */
  findRulersForYear(year: number, dynastyCode?: number): RulerEntry[] {
    return this.data.rulers.filter(r => {
      if (dynastyCode !== undefined && r.dynastyCode !== dynastyCode) return false
      return r.firstYear !== null && r.lastYear !== null &&
        year >= r.firstYear && year <= r.lastYear
    })
  }

  /** Resolve a common dynasty label to GB/T code.
   *  Handles common aliases: 魏→曹魏(09), 漢→西漢(07) or 東漢(08), etc.
   */
  resolveDynastyAlias(label: string): number | undefined {
    const direct = this.getDynastyCode(label)
    if (direct !== undefined) return direct

    // Common aliases
    const aliases: Record<string, number> = {
      '魏': 9, '曹魏': 9,
      '漢': 7, '前漢': 7, '西漢': 7,
      '東漢': 8, '後漢': 8,
      '吳': 11, '孫吳': 11,
      '蜀': 10, '蜀漢': 10,
      '晉': 12, '西晉': 12,
      '東晉': 13,
      '宋': 30, '北宋': 30, '南宋': 31,
      '周': 4, '西周': 4, '東周': 5,
    }
    return aliases[label]
  }
}
