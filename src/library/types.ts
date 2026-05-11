/**
 * Entity type definitions for the Hanology Library.
 *
 * These types model the YAML-LD entity data in library/register/
 * and library/reference/. They are pure TypeScript interfaces —
 * no I/O, no dependencies.
 *
 * The types align with ChamRegistries in @hanology/cham but are
 * richer: they include full YAML-LD properties (ctext IDs, authority
 * records, cross-references) that the pipeline doesn't need but
 * the ontology site will.
 */

// ─── Person ───────────────────────────────────────────────────────
// Source: library/authors/*/author.yaml (YAML-LD)

export interface PersonEntity {
  '@id': string | null           // ctext URI or null
  '@type': string                // schema:Person or schema:CreativeWork
  ref: string                    // our identifier (A018, C003, etc.)
  alias_refs?: string[]          // alternate refs pointing to this directory
  label: string                  // primary display name
  alt_names?: string[]           // alternative names
  dynasty?: string               // dynasty label (唐, 宋, ...)

  // Dates
  'cprop:born'?: { '@value': string; '@type': string }
  'cprop:died'?: { '@value': string; '@type': string }
  'cprop:born-date'?: string
  'cprop:died-date'?: string
  'cprop:died-age'?: string

  // Names
  'cprop:name-style'?: string       // 字 (courtesy name)
  'cprop:name-art'?: string         // 號 (art name)
  'cprop:name-posthumous'?: string  // 諡號
  'cprop:name-temple'?: string      // 廟號

  // Relationships
  'cprop:associated-dynasty'?: { '@id': string }
  'cprop:father'?: string
  'cprop:mother'?: string
  'cprop:held-office'?: string[]
  'cprop:exam-status'?: string[]
  'cprop:place'?: string

  // Authority IDs
  'cprop:authority-wikidata'?: string
  'cprop:authority-viaf'?: string
  'cprop:authority-cbdb'?: string
  'cprop:authority-ddbc'?: string
  'cprop:authority-sinica'?: string

  // Links
  'cprop:link-wikipedia_zh'?: string
  'cprop:link-wikipedia_en'?: string

  // Library-specific
  bio_sources?: BioSource[]
  'lib:has_raw_bio'?: boolean
}

export interface BioSource {
  publication: string
  file: string
}

// ─── Dynasty ──────────────────────────────────────────────────────
// Source: library/register/dynasties.yaml

export interface DynastyEntity {
  id: string                     // slug (tang, song, ...)
  label: string                  // display name (唐, 宋, ...)
  names?: string[]               // alternative names
  start?: number                 // start year (BCE negative)
  end?: number                   // end year
  ctext_id?: string              // ctext entity ID
  wikidata?: string              // Wikidata Q-number
  parent?: string                // parent dynasty id
  gb_code?: string              // GB/T dynasty code (01-38)
}

// ─── Reference entity (generic) ───────────────────────────────────
// Source: library/reference/*.yaml

export interface ReferenceEntity {
  '@id': string
  '@type': string
  label?: string
  names?: string[]
  [key: string]: unknown
}

// ─── Loaded library data ──────────────────────────────────────────
// The shape returned by the loader

export interface LibraryData {
  persons: Map<string, PersonEntity>            // ref → entity (canonical)
  personBios: Map<string, string>               // ref → bio text (loaded from .md)
  personIndex: Record<string, string>           // ref → directory
  personDirs: number

  dynasties: DynastyEntity[]

  ctextTypeIndex: Record<string, string>        // ctext_id → type
  ctagNameIndex: Record<string, string[]>       // name → [ctext_ids]

  chamRefs: Set<string>                         // all refs used in CHAM content
  chamPieceRefs: Array<{
    book: string
    piece: string
    refs: string[]
  }>
  chamTotalFiles: number
}

// ─── Correspondence result ────────────────────────────────────────

export interface CorrespondenceResult {
  errors: string[]
  warnings: string[]
  stats: {
    chamRefs: number
    registerRefs: number
    registerDirs: number
    chamFiles: number
    unusedEntries: number
    missingCtext: number
    unknownDynasties: string[]
  }
}
