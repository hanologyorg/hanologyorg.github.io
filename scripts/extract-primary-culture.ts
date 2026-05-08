/**
 * 從 resources/primary-culture/ 提取 31 個 PDF 到 /tmp/primary-culture-raw/
 *
 * 使用方法: npx tsx scripts/extract-primary-culture.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PdfExtractor } from '../src/extractors/PdfExtractor.js';

const RESOURCE_DIR = 'resources/primary-culture';
const OUTPUT_DIR = '/tmp/primary-culture-raw';

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const extractor = new PdfExtractor();

  const dirs = fs.readdirSync(RESOURCE_DIR)
    .filter(d => {
      const full = path.join(RESOURCE_DIR, d);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'original.pdf'));
    })
    .sort();

  console.log(`Found ${dirs.length} PDF directories\n`);

  for (const dir of dirs) {
    const pdfPath = path.join(RESOURCE_DIR, dir, 'original.pdf');
    const outFile = path.join(OUTPUT_DIR, `${dir}.txt`);

    if (fs.existsSync(outFile)) {
      console.log(`SKIP ${dir} (already extracted)`);
      continue;
    }

    console.log(`Extracting ${dir}...`);
    try {
      const pages = await extractor.extract(pdfPath);
      fs.writeFileSync(outFile, pages.join('\n--- PAGE BREAK ---\n'));
      console.log(`  → ${pages.length} pages → ${outFile}`);
    } catch (e) {
      console.error(`  ERROR: ${e}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
