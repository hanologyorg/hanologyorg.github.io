import { ChamParser } from '@hanology/cham';
import * as fs from 'node:fs';
import * as path from 'node:path';

const parser = new ChamParser();
const dir = 'content/secondary';
const folders = fs.readdirSync(dir).filter(d => 
  fs.statSync(path.join(dir, d)).isDirectory()
).sort();

let ok = 0, fail = 0;
const errors: string[] = [];
const warnings: string[] = [];

for (const folder of folders) {
  const chamPath = path.join(dir, folder, 'text.cham.md');
  if (!fs.existsSync(chamPath)) {
    errors.push(`${folder}: text.cham.md missing`);
    fail++;
    continue;
  }
  try {
    const src = fs.readFileSync(chamPath, 'utf-8');
    const doc = parser.parse(src);
    
    if (!doc.meta.title) errors.push(`${folder}: missing title`);
    if (!doc.textBlocks || doc.textBlocks.length === 0) errors.push(`${folder}: no text blocks`);
    
    const markerIds = new Set(doc.markers.keys());
    const annoMarkerIds = new Set<number>();
    for (const section of doc.sections) {
      for (const entry of section.entries) {
        if (entry.target.type === 'marker') annoMarkerIds.add(entry.target.markerId);
      }
    }
    
    let orphanMarkers = 0, orphanAnnos = 0;
    for (const id of markerIds) { if (!annoMarkerIds.has(id)) orphanMarkers++; }
    for (const id of annoMarkerIds) { if (!markerIds.has(id)) orphanAnnos++; }
    
    if (orphanMarkers > 0) warnings.push(`${folder}: ${orphanMarkers} markers without annotations`);
    if (orphanAnnos > 0) warnings.push(`${folder}: ${orphanAnnos} annotations without markers`);
    
    ok++;
  } catch (e: any) {
    errors.push(`${folder}: PARSE ERROR: ${e.message.substring(0, 200)}`);
    fail++;
  }
}

console.log(`Parsed: ${ok} OK, ${fail} FAIL out of ${folders.length} total`);
if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
if (errors.length > 0) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
}
