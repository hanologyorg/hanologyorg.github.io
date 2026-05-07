/**
 * 一次性提取所有 PDF 原始文本到 reference-docs/raw-text/
 * 用法：npx tsx scripts/extract-raw-text.ts
 */

import { PdfExtractor } from '../src/extractors/PdfExtractor.js';
import { TextCleaner } from '../src/parsers/TextCleaner.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PDF_DIR = path.resolve('pdfs');
const OUT_DIR = path.resolve('reference-docs/raw-text');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ext = new PdfExtractor();

  for (let num = 1; num <= 100; num++) {
    const pdfFile = path.join(PDF_DIR, `jilei_shi_${String(num).padStart(3, '0')}.pdf`);
    if (!fs.existsSync(pdfFile)) {
      console.log(`  [${num}] SKIP (no PDF)`);
      continue;
    }

    const pages = await ext.extract(pdfFile);
    const rawContent = pages.join('\n--- PAGE BREAK ---\n');
    const cleanLines = TextCleaner.cleanPages(pages);
    const cleanContent = cleanLines.map((l, i) => `${String(i).padStart(3)} | ${l}`).join('\n');

    const outPath = path.join(OUT_DIR, `${String(num).padStart(3, '0')}.txt`);
    fs.writeFileSync(outPath, `=== RAW ===\n${rawContent}\n\n=== CLEANED ===\n${cleanContent}\n`);
    console.log(`  [${num}] OK (${pages.length} pages, ${cleanLines.length} lines)`);
  }

  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
