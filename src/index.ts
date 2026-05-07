/**
 * 積累與感興 — 詩文資料處理主程式
 *
 * 用法：npx tsx src/index.ts [--from N] [--to N]
 */

import { Pipeline } from './pipeline/Pipeline.js';
import * as path from 'node:path';

function parseArgs(): { from: number; to: number } {
  const args = process.argv.slice(2);
  let from = 1;
  let to = 100;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) from = parseInt(args[i + 1], 10);
    if (args[i] === '--to' && args[i + 1]) to = parseInt(args[i + 1], 10);
  }

  return { from, to };
}

const { from, to } = parseArgs();

const pipeline = new Pipeline({
  pdfDir: path.resolve('pdfs'),
  outputDir: path.resolve('output'),
  range: { from, to },
});

pipeline.run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
