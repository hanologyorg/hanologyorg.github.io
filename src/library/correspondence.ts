/**
 * Correspondence checker — validates CHAM ↔ register bidirectionally.
 *
 * Pure validation logic over LibraryData.
 * Zero I/O. Zero filesystem access.
 */

import type { LibraryData, CorrespondenceResult } from './types.js'

export function checkCorrespondence(data: LibraryData): CorrespondenceResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Every CHAM ref exists in register
  for (const ref of data.chamRefs) {
    if (!data.personIndex[ref]) {
      errors.push(`CHAM ref "${ref}" not in register`)
    }
  }

  // 2. Every canonical register entry is used by at least one CHAM file
  const usedRefs = data.chamRefs
  const unused: string[] = []
  for (const [ref, dirName] of Object.entries(data.personIndex)) {
    const allAliasesForDir = Object.entries(data.personIndex)
      .filter(([, d]) => d === dirName)
      .map(([r]) => r)
    if (!allAliasesForDir.some(r => usedRefs.has(r))) {
      if (ref === allAliasesForDir[0]) unused.push(ref)
    }
  }
  if (unused.length > 0) {
    warnings.push(`${unused.length} register entries not used by any CHAM file: ${unused.join(', ')}`)
  }

  // 3. Entity integrity
  let missingCtext = 0
  for (const [ref, entity] of data.persons) {
    if (!entity.label) errors.push(`${ref}: missing label`)
    if (!entity['@id']) {
      missingCtext++
      if (entity.ref && !isCollectiveRef(ref)) {
        warnings.push(`${entity.label} (${ref}): no ctext @id`)
      }
    }
  }

  // 4. Dynasty consistency (check against labels and all alias names)
  const dynastyLabels = new Set<string>()
  for (const d of data.dynasties) {
    dynastyLabels.add(d.label)
    if (d.names) for (const n of d.names) dynastyLabels.add(n)
  }
  const unknownDynasties: string[] = []
  for (const [, entity] of data.persons) {
    if (entity.dynasty && entity.dynasty !== '未知' && !dynastyLabels.has(entity.dynasty) && !unknownDynasties.includes(entity.dynasty)) {
      unknownDynasties.push(entity.dynasty)
    }
  }
  if (unknownDynasties.length > 0) {
    warnings.push(`Dynasties not in register: ${unknownDynasties.join(', ')}`)
  }

  return {
    errors,
    warnings,
    stats: {
      chamRefs: data.chamRefs.size,
      registerRefs: Object.keys(data.personIndex).length,
      registerDirs: data.personDirs,
      chamFiles: data.chamTotalFiles,
      unusedEntries: unused.length,
      missingCtext,
      unknownDynasties,
    },
  }
}

function isCollectiveRef(ref: string): boolean {
  // Collectives, anonymous, and works-as-authors that legitimately have no ctext ID
  return ['A002', 'A003', 'A007', 'A045', 'A100', 'A102', 'A146', 'A152', 'A153', 'C010'].includes(ref)
}
