import { PdfExtractor } from '../src/extractors/PdfExtractor.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MISSING = [
  1, 4, 10, 12, 13, 21, 26, 28, 33,
  58, 59, 66, 69, 80, 82, 84,
  105, 106, 109, 110, 112, 113,
  120, 121, 124, 129, 131, 133, 135, 138, 139,
  142, 144, 147, 149,
];

const RES_DIR = 'library/resources/secondary';
const OUT_DIR = '/tmp/secondary-raw';

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ext = new PdfExtractor();

  for (const num of MISSING) {
    const prefix = String(num).padStart(3, '0');
    const entries = fs.readdirSync(RES_DIR).filter(d => d.startsWith(`${prefix}-`));
    if (entries.length === 0) {
      console.log(`[${prefix}] SKIP: no resource folder`);
      continue;
    }
    const folder = entries[0];
    const folderPath = path.join(RES_DIR, folder);

    // Extract from analysis.pdf
    const analysisPdf = path.join(folderPath, 'analysis.pdf');
    if (fs.existsSync(analysisPdf)) {
      try {
        const pages = await ext.extract(analysisPdf);
        const fullText = pages.join('\n--- PAGE BREAK ---\n');
        const outPath = path.join(OUT_DIR, `${prefix}-analysis.txt`);
        fs.writeFileSync(outPath, fullText, 'utf-8');
        console.log(`[${prefix}] ${folder} → analysis (${pages.length} pages, ${fullText.length} chars)`);
      } catch (e: any) {
        console.log(`[${prefix}] ERROR: ${e.message}`);
      }
    }

    // Extract from original.pdf if exists
    const originalPdf = path.join(folderPath, 'original.pdf');
    if (fs.existsSync(originalPdf)) {
      try {
        const pages = await ext.extract(originalPdf);
        const fullText = pages.join('\n--- PAGE BREAK ---\n');
        const outPath = path.join(OUT_DIR, `${prefix}-original.txt`);
        fs.writeFileSync(outPath, fullText, 'utf-8');
        console.log(`[${prefix}] ${folder} → original (${pages.length} pages)`);
      } catch (e: any) {
        console.log(`[${prefix}] original ERROR: ${e.message}`);
      }
    }

    // Save folder name for reference
    fs.writeFileSync(path.join(OUT_DIR, `${prefix}-folder.txt`), folder, 'utf-8');
  }
  console.log('\nDone!');
}

main();
