/**
 * Registry builder — constructs ChamRegistries from loaded data.
 *
 * Pure transformation: LibraryData → ChamRegistries.
 * Zero I/O. Zero filesystem access.
 */

import type { AuthorRecord, DynastyRecord, ChamRegistries } from '@hanology/cham'
import type { LibraryData } from './types.js'

export function buildRegistries(data: LibraryData): ChamRegistries {
  // Build dynasty label → gbCode lookup for era resolution
  const dynastyToGbCode = new Map<string, string>()
  const dynastyNames = new Map<string, string>() // alias → canonical label
  for (const d of data.dynasties) {
    if (d.gb_code) dynastyToGbCode.set(d.label, d.gb_code)
    if (d.gb_code && d.names) {
      for (const n of d.names) {
        dynastyToGbCode.set(n, d.gb_code)
        dynastyNames.set(n, d.label)
      }
    }
    dynastyNames.set(d.label, d.label)
  }

  return {
    authors: buildAuthorRecords(data, dynastyToGbCode),
    dynasties: buildDynastyRecords(data),
    eras: [],
    sexagenary: [],
    places: {},
    events: {},
    lexicon: [],
  }
}

function buildAuthorRecords(
  data: LibraryData,
  dynastyToGbCode: Map<string, string>,
): Record<string, AuthorRecord> {
  const records: Record<string, AuthorRecord> = {}

  for (const [ref, entity] of data.persons) {
    const ctextId = entity['@id']?.startsWith('ctext:') ? entity['@id'].replace('ctext:', '') : undefined
    const era = entity.dynasty || ''
    const eraCode = dynastyToGbCode.get(era) || ''
    records[ref] = {
      name: entity.label,
      dynasty: era,
      era,
      eraCode: eraCode || undefined,
      bio: data.personBios.get(ref) || undefined,
      born: entity['cprop:born']?.['@value'],
      died: entity['cprop:died']?.['@value'],
      courtesyName: entity['cprop:name-style'],
      artName: entity['cprop:name-art'],
      wikidata: entity['cprop:authority-wikidata'],
      ctextId,
      wikipediaZh: entity['cprop:link-wikipedia_zh'],
      wikipediaEn: entity['cprop:link-wikipedia_en'],
    }
  }

  // Map alias refs to the same record
  for (const [ref, dirName] of Object.entries(data.personIndex)) {
    if (!records[ref]) {
      const canonical = Object.entries(data.personIndex).find(
        ([r, d]) => d === dirName && records[r],
      )
      if (canonical) records[ref] = records[canonical[0]]
    }
  }

  return records
}

function buildDynastyRecords(data: LibraryData): DynastyRecord[] {
  return data.dynasties.map(d => ({
    id: d.id,
    label: d.label,
    start: d.start,
    end: d.end,
    gbCode: d.gb_code,
  }))
}
