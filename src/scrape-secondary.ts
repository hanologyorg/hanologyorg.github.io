/**
 * 資源抓取主程式
 *
 * 用法：
 *   npx tsx src/scrape-secondary.ts [--from N] [--to N] [--skip-download] [--culture] [--nss]
 */

import { SecondaryPipeline } from './scrapers/SecondaryPipeline.js';
import * as path from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  let from = 1;
  let to = 150;
  let skipDownload = false;
  let culture = false;
  let nss = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) from = parseInt(args[i + 1], 10);
    if (args[i] === '--to' && args[i + 1]) to = parseInt(args[i + 1], 10);
    if (args[i] === '--skip-download') skipDownload = true;
    if (args[i] === '--culture') culture = true;
    if (args[i] === '--nss') nss = true;
  }

  return { from, to, skipDownload, culture, nss };
}

const { from, to, skipDownload, culture, nss } = parseArgs();

const pipeline = new SecondaryPipeline({
  pdfDir: path.resolve('pdfs/secondary'),
  audioDir: path.resolve('audio/secondary'),
  outputDir: path.resolve('output'),
  skipDownload,
  range: { from, to },
});

async function main() {
  if (culture) {
    await pipeline.runCulture();
  } else if (nss) {
    await pipeline.runNSS();
  } else {
    await pipeline.run();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
