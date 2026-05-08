/**
 * 從 resources/nss/ 提取 16 個 analysis.pdf 到 /tmp/nss-raw/
 *
 * 注意：NSS analysis.pdf 存在循環錯位，需要按正確對應讀取：
 *   dir 03 → 讀 dir 05 的 analysis.pdf
 *   dir 04 → 讀 dir 06 的 analysis.pdf
 *   dir 05 → 讀 dir 04 的 analysis.pdf
 *   dir 06 → 讀 dir 07 的 analysis.pdf
 *   dir 07 → 讀 dir 10 的 analysis.pdf
 *   dir 10 → 讀 dir 03 的 analysis.pdf
 *   其餘 dirs (01, 02, 08, 09) 及子篇正確無錯位
 *
 * 使用方法: npx tsx scripts/extract-nss.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PdfExtractor } from '../src/extractors/PdfExtractor.js';

const RESOURCE_DIR = 'resources/nss';
const OUTPUT_DIR = '/tmp/nss-raw';

// 實際目錄名
const DIR_NAMES: Record<string, string> = {
  '01': '01-論仁_論孝_論君子',
  '02': '02-魚我所欲也',
  '03': '03-逍遙遊',
  '04': '04-勸學',
  '05': '05-廉頗藺相如列傳',
  '06': '06-出師表',
  '07': '07-師說',
  '08': '08-始得西山宴遊記',
  '09': '09-岳陽樓記',
  '10': '10-六國論',
};

// 錯位對照：key 是目標 dir 編號，value是實際讀取的 dir 編號
const SHIFT_MAP: Record<string, string> = {
  '03': '05',
  '04': '06',
  '05': '04',
  '06': '07',
  '07': '10',
  '10': '03',
};

const NSS_PIECES = [
  { id: '01', title: '論仁、論孝、論君子', num: '01' },
  { id: '02', title: '魚我所欲也', num: '02' },
  { id: '03', title: '逍遙遊（節錄）', num: '03' },
  { id: '04', title: '勸學（節錄）', num: '04' },
  { id: '05', title: '廉頗藺相如列傳（節錄）', num: '05' },
  { id: '06', title: '出師表', num: '06' },
  { id: '07', title: '師說', num: '07' },
  { id: '08', title: '始得西山宴遊記', num: '08' },
  { id: '09', title: '岳陽樓記', num: '09' },
  { id: '10', title: '六國論', num: '10' },
];

const NSS_SUB_PIECES = [
  { parentDir: '11-唐詩三首', subDir: '登樓', id: '11', title: '登樓' },
  { parentDir: '11-唐詩三首', subDir: '山居秋暝', id: '12', title: '山居秋暝' },
  { parentDir: '11-唐詩三首', subDir: '月下獨酌', id: '13', title: '月下獨酌（其一）' },
  { parentDir: '12-詞三首', subDir: '聲聲慢', id: '14', title: '聲聲慢' },
  { parentDir: '12-詞三首', subDir: '青玉案_元夕', id: '15', title: '青玉案（元夕）' },
  { parentDir: '12-詞三首', subDir: '念奴嬌_赤壁懷古', id: '16', title: '念奴嬌（赤壁懷古）' },
];

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const extractor = new PdfExtractor();

  // 處理 10 個主篇
  for (const piece of NSS_PIECES) {
    const actualNum = SHIFT_MAP[piece.num] || piece.num;
    const actualDirName = DIR_NAMES[actualNum];
    const pdfPath = path.join(RESOURCE_DIR, actualDirName, 'analysis.pdf');
    const outFile = path.join(OUTPUT_DIR, `${piece.id}-${piece.title}.txt`);

    if (fs.existsSync(outFile)) {
      console.log(`SKIP ${piece.id} ${piece.title} (already extracted)`);
      continue;
    }

    console.log(`Extracting ${piece.id} ${piece.title} (from ${actualDirName})...`);
    try {
      const pages = await extractor.extract(pdfPath);
      fs.writeFileSync(outFile, pages.join('\n--- PAGE BREAK ---\n'));
      console.log(`  → ${pages.length} pages`);
    } catch (e) {
      console.error(`  ERROR: ${e}`);
    }
  }

  // 處理 6 個子篇
  for (const piece of NSS_SUB_PIECES) {
    const pdfPath = path.join(RESOURCE_DIR, piece.parentDir, piece.subDir, 'analysis.pdf');
    const outFile = path.join(OUTPUT_DIR, `${piece.id}-${piece.title}.txt`);

    if (fs.existsSync(outFile)) {
      console.log(`SKIP ${piece.id} ${piece.title} (already extracted)`);
      continue;
    }

    console.log(`Extracting ${piece.id} ${piece.title}...`);
    try {
      const pages = await extractor.extract(pdfPath);
      fs.writeFileSync(outFile, pages.join('\n--- PAGE BREAK ---\n'));
      console.log(`  → ${pages.length} pages`);
    } catch (e) {
      console.error(`  ERROR: ${e}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
