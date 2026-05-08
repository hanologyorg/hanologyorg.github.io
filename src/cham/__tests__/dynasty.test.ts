import { describe, it, expect } from 'vitest'
import {
  sexagenaryToNumber, numberToSexagenary, ceToSexagenary,
  encodeDynastyCode, decodeDynastyCode,
  DynastyLibrary,
  resolveChamDate,
} from '../dynasty'

describe('Sexagenary cycle', () => {
  it('converts sexagenary to number', () => {
    expect(sexagenaryToNumber('甲子')).toBe(1)
    expect(sexagenaryToNumber('乙丑')).toBe(2)
    expect(sexagenaryToNumber('癸亥')).toBe(60)
  })

  it('converts number to sexagenary', () => {
    expect(numberToSexagenary(1)).toBe('甲子')
    expect(numberToSexagenary(60)).toBe('癸亥')
  })

  it('round-trips 1–60', () => {
    for (let i = 1; i <= 60; i++)
      expect(sexagenaryToNumber(numberToSexagenary(i))).toBe(i)
  })

  it('converts CE to sexagenary', () => {
    expect(ceToSexagenary(4)).toBe('甲子')
    expect(ceToSexagenary(1984)).toBe('甲子')
  })
})

describe('h-CN encoding', () => {
  it('encodes all 4 types', () => {
    expect(encodeDynastyCode({ type: 1, dynasty: 'QIN', ruler: 'ZS', year: 1 })).toBe('h-CN.1.QIN.ZS.1')
    expect(encodeDynastyCode({ type: 2, dynasty: 'TANG', era: 'KF', year: 15 })).toBe('h-CN.2.TANG.KF.15')
    expect(encodeDynastyCode({ type: 3, year: 1 })).toBe('h-CN.3.1')
    expect(encodeDynastyCode({ type: 4, cycle: '甲子' })).toBe('h-CN.4.甲子')
  })

  it('decode reverses encode', () => {
    expect(decodeDynastyCode('h-CN.1.QIN.ZS.1')).toEqual({ type: 1, dynasty: 'QIN', ruler: 'ZS', year: 1 })
    expect(decodeDynastyCode('h-CN.3.1')).toEqual({ type: 3, year: 1 })
    expect(decodeDynastyCode('invalid')).toBeNull()
  })
})

describe('DynastyLibrary', () => {
  it('looks up dynasties and eras', () => {
    const lib = new DynastyLibrary()
    lib.load(
      new Map([['唐', { name: '唐', code: '24', start: 618, end: 904 }]]),
      [{ dynasty: '唐', dynastyCode: '24', ruler: '玄宗', rulerCode: null, accession: 1, era: '開元', eraCode: '02', eraCount: 1, sexagenary: '癸丑', iso: 713 }],
    )

    expect(lib.lookupDynasty('唐')?.start).toBe(618)
    expect(lib.lookupEra('唐', '開元')[0]?.iso).toBe(713)
    expect(lib.lookupDynasty('宋')).toBeNull()
  })
})

describe('ChamDate resolution', () => {
  it('resolves dates', () => {
    expect(resolveChamDate({ dynasty: '唐', iso: 727 }).ce).toBe(727)
    expect(resolveChamDate({ dynasty: '唐', era: '開元', era_year: 15 }).display).toContain('開元')
    expect(resolveChamDate({ dynasty: '秦末', circa: true }).ce).toBeNull()
  })
})
