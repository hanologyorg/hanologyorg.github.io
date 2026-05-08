/**
 * 清理全部 content/ 的 CHAM 注釋品質問題
 *
 * 用 ChamParser 解析 → 操作結構化資料 → ChamSerializer 寫回
 *
 * 處理：
 *   1a. ：。空子定義 → 去掉空讀音欄位
 *   1b. 孤立注釋片段（value 以 。開頭）→ 刪除或修復
 *   1c. ，。 → 。
 *   1d. 殘留腳註數字 → 移除
 *   1e. 子定義拆分為獨立 [headword][value] 條目
 *
 * 用法：npx tsx scripts/clean-annotations.ts [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ChamParser } from '@hanology/cham'
import { ChamSerializer } from '@hanology/cham'
import type {
  ChamDocument, AnnotationEntry, AnnotationSection, Marker,
} from '@hanology/cham'

const ROOT = import.meta.dirname ? join(import.meta.dirname, '..') : process.cwd()
const CONTENT_DIR = join(ROOT, 'library/content')
const DRY_RUN = process.argv.includes('--dry-run')

const parser = new ChamParser()
const serializer = new ChamSerializer()

interface Stats {
  emptySubDef: number
  orphanFragment: number
  commaPeriod: number
  strayDigit: number
  subDefSplit: number
  filesModified: number
  filesTotal: number
}

const stats: Stats = { emptySubDef: 0, orphanFragment: 0, commaPeriod: 0, strayDigit: 0, subDefSplit: 0, filesModified: 0, filesTotal: 0 }

// ─── Sub-definition pattern ────────────────────────────────
// Matches: 騅：毛色青白相雜的馬 (CJK chars + fullwidth colon + definition text)
// But NOT: 騅： (empty definition after colon)

const CJK_RANGES = '\\u4e00-\\u9fff\\u3400-\\u4dbf\\uf900-\\ufaff'
const SUB_DEF_RE = new RegExp(`([${CJK_RANGES}][${CJK_RANGES}]*?)：(.+)`, 'g')

function hasSubDefinitions(value: string): boolean {
  const lines = value.split('\n')
  let defCount = 0
  for (const line of lines) {
    if (line.match(new RegExp(`^[${CJK_RANGES}]+：`))) {
      defCount++
    }
  }
  return defCount > 0
}

function splitSubDefinitions(value: string): { mainDef: string; subs: Array<{ headword: string; definition: string }> } {
  const lines = value.split('\n')
  const mainLines: string[] = []
  const subs: Array<{ headword: string; definition: string }> = []

  let inMain = true
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { mainLines.push(''); continue }

    const subMatch = trimmed.match(new RegExp(`^([${CJK_RANGES}]+)：(.+)$`))
    if (subMatch) {
      inMain = false
      const headword = subMatch[1]
      const definition = subMatch[2]
      subs.push({ headword, definition })
    } else if (inMain) {
      mainLines.push(line)
    } else {
      // Continuation of the last sub-definition
      if (subs.length > 0) {
        subs[subs.length - 1].definition += '\n' + line
      }
    }
  }

  return { mainDef: mainLines.join('\n').trim(), subs }
}

// ─── Fixes ─────────────────────────────────────────────────

function fixEmptySubDef(value: string): string {
  // CHAR：。DEFINITION → CHAR：DEFINITION
  // CHAR：；DEFINITION → CHAR：DEFINITION
  let result = value
  const emptyPronPattern = new RegExp(`([${CJK_RANGES}]+)：。`, 'g')
  const emptyPronSemiPattern = new RegExp(`([${CJK_RANGES}]+)：；`, 'g')
  result = result.replace(emptyPronSemiPattern, '$1：')
  result = result.replace(emptyPronPattern, '$1：')
  return result
}

function fixCommaPeriod(value: string): string {
  return value.replace(/，。/g, '。')
}

function fixStrayDigit(value: string): string {
  // Remove trailing footnote digits after CJK punctuation
  return value.replace(/[。！？﹖]([0-9])/g, (match, digit) => {
    // Only remove if it looks like a footnote (single digit after sentence-ending punctuation)
    return match[0]
  })
}

function isOrphanFragment(entry: AnnotationEntry, allEntries: AnnotationEntry[]): boolean {
  if (entry.kind !== 'meaning') return false
  if (!entry.value.startsWith('。')) return false

  // Check if this fragment is a duplicate of another entry's value
  const fragmentText = entry.value.slice(1) // Remove leading 。
  for (const other of allEntries) {
    if (other === entry) continue
    if (other.kind !== 'meaning') continue
    if (other.value.includes(fragmentText) && other.value.length > fragmentText.length) {
      return true
    }
  }
  return false
}

// ─── Main processing ───────────────────────────────────────

function findChamFiles(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      // Check if this is a book directory or a piece directory
      if (existsSync(join(fullPath, 'text.cham.md'))) {
        results.push(join(fullPath, 'text.cham.md'))
      }
      // Recurse into subdirectories (for books)
      const subCham = existsSync(join(fullPath, 'book.yaml'))
      for (const sub of readdirSync(fullPath, { withFileTypes: true })) {
        if (sub.isDirectory()) {
          const subPath = join(fullPath, sub.name)
          if (existsSync(join(subPath, 'text.cham.md'))) {
            results.push(join(subPath, 'text.cham.md'))
          }
        }
      }
    }
  }
  return results
}

function processFile(chamPath: string): boolean {
  const src = readFileSync(chamPath, 'utf-8')
  let doc: ChamDocument
  try {
    doc = parser.parse(src)
  } catch (err: any) {
    console.log(`  SKIP ${chamPath}: ${err.message}`)
    return false
  }

  let modified = false
  const markerUsedBy = new Map<number, number>() // markerId → count of entries referencing it

  // Count all marker references
  for (const section of doc.sections) {
    for (const entry of section.entries) {
      if (entry.target.type === 'marker') {
        const id = entry.target.markerId
        markerUsedBy.set(id, (markerUsedBy.get(id) || 0) + 1)
      }
    }
  }

  for (const section of doc.sections) {
    const newEntries: AnnotationEntry[] = []

    for (const entry of section.entries) {
      if (entry.kind !== 'meaning' && entry.kind !== 'commentary' && entry.kind !== 'translation') {
        // For non-text annotations, still fix stray digits
        if (entry.kind === 'pron') {
          const fixed = fixStrayDigit(entry.value)
          if (fixed !== entry.value) {
            entry.value = fixed
            stats.strayDigit++
            modified = true
          }
        }
        newEntries.push(entry)
        continue
      }

      let value = entry.value

      // 1a. Fix ：。 empty sub-definitions
      const beforeA = value
      value = fixEmptySubDef(value)
      if (value !== beforeA) {
        stats.emptySubDef++
        modified = true
      }

      // 1c. Fix ，。
      const beforeC = value
      value = fixCommaPeriod(value)
      if (value !== beforeC) {
        stats.commaPeriod++
        modified = true
      }

      // 1d. Fix stray digits
      const beforeD = value
      value = fixStrayDigit(value)
      if (value !== beforeD) {
        stats.strayDigit++
        modified = true
      }

      entry.value = value

      // 1b. Check for orphaned fragments
      if (isOrphanFragment(entry, section.entries)) {
        stats.orphanFragment++
        modified = true
        // Decrement marker reference count
        if (entry.target.type === 'marker') {
          const id = entry.target.markerId
          markerUsedBy.set(id, (markerUsedBy.get(id) || 1) - 1)
        }
        continue // Skip this entry (remove it)
      }
      // If value starts with 。but is not an orphan, strip the leading period
      if (entry.value.startsWith('。')) {
        entry.value = entry.value.slice(1)
        modified = true
      }

      // 1e. Split sub-definitions into separate entries
      if (entry.kind === 'meaning' && hasSubDefinitions(entry.value)) {
        const { mainDef, subs } = splitSubDefinitions(entry.value)

        if (subs.length > 0) {
          stats.subDefSplit++
          modified = true

          // Keep parent entry with just the main definition
          entry.value = mainDef || entry.value

          // Create new entries for each sub-definition
          for (const sub of subs) {
            // Find a marker that corresponds to this sub-definition's headword
            // We need to find a marker whose text matches the headword
            let targetMarkerId = findMarkerForHeadword(doc, sub.headword, entry)

            if (targetMarkerId !== null) {
              newEntries.push({
                target: { type: 'marker', markerId: targetMarkerId },
                kind: 'meaning',
                params: {},
                headword: undefined, // headword derived from marker text
                value: sub.definition,
              })
            } else {
              // No matching marker found; keep as a reference in the parent value
              // Append back to parent with proper formatting
              entry.value += `\n${sub.headword}：${sub.definition}`
            }
          }
          continue
        }
      }

      newEntries.push(entry)
    }

    section.entries = newEntries
  }

  // Remove unreferenced markers from text blocks (if their count dropped to 0)
  // This is complex since markers are embedded in the source text.
  // For now, we leave zero-reference markers in place — the serializer handles them.

  if (!modified) return false

  stats.filesModified++

  if (DRY_RUN) {
    console.log(`  [DRY] Would modify: ${chamPath}`)
    return false
  }

  const output = serializer.serialize(doc)
  writeFileSync(chamPath, output, 'utf-8')
  return true
}

function findMarkerForHeadword(doc: ChamDocument, headword: string, parentEntry: AnnotationEntry): number | null {
  // Look for a marker whose text matches the headword
  for (const [id, marker] of doc.markers) {
    if (marker.text === headword) {
      return id
    }
  }
  // Also try matching a single character from multi-char headwords
  if (headword.length === 1) {
    for (const [id, marker] of doc.markers) {
      if (marker.text === headword || (marker.length === 1 && marker.text === headword)) {
        return id
      }
    }
  }
  return null
}

// ─── Entry point ───────────────────────────────────────────

console.log('清理 CHAM 注釋品質')
console.log(`模式：${DRY_RUN ? 'DRY RUN' : '實際修改'}`)
console.log()

for (const collection of readdirSync(CONTENT_DIR, { withFileTypes: true })) {
  if (!collection.isDirectory()) continue
  const collectionPath = join(CONTENT_DIR, collection.name)
  const chamFiles = findChamFiles(collectionPath)

  if (chamFiles.length === 0) continue

  console.log(`${collection.name}/ (${chamFiles.length} text.cham.md)`)

  for (const chamPath of chamFiles) {
    stats.filesTotal++
    processFile(chamPath)
  }
}

console.log()
console.log('統計：')
console.log(`  處理：${stats.filesTotal} 個 text.cham.md`)
console.log(`  修改：${stats.filesModified} 個檔案`)
console.log(`  ：。空子定義修復：${stats.emptySubDef}`)
console.log(`  孤立片段刪除：${stats.orphanFragment}`)
console.log(`  ，。修復：${stats.commaPeriod}`)
console.log(`  腳註數字移除：${stats.strayDigit}`)
console.log(`  子定義拆分：${stats.subDefSplit}`)
