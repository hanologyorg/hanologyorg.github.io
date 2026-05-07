/**
 * PDF 文本提取器
 *
 * 使用 pdfjs-dist 從 PDF 提取文本。
 *
 * 策略：針對中文古籍 PDF（逐字定位、注腳上標），
 * 採取「先緊密合併，後清理空格」的方式：
 *   1. 同行文字項目先緊密連接（不加空格）
 *   2. 大間距（標題↔作者）用 tab 分隔
 *   3. 後處理清除 CJK 之間多餘空格
 */

import * as fs from 'node:fs';
import type { Extractor } from '../models/types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
  }
  return pdfjsLib;
}

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Unicode CJK 屬性 */
const HAN = /\p{Script=Han}/u;

/** 判斷字串是否只含空白或數字 */
const ONLY_DIGITS = /^\s*\d+\s*$/;

export class PdfExtractor implements Extractor {
  async extract(pdfPath: string): Promise<string[]> {
    const pdfjs = await getPdfjs();
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(this.extractPage(content.items));
    }

    return pages;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractPage(raw: any[]): string {
    const items = this.collectItems(raw);
    if (items.length === 0) return '';

    const { medianH, avgCW } = this.computeMetrics(items);
    const groups = this.groupByY(items, medianH * 0.3);
    const sortedY = [...groups.keys()].sort((a, b) => b - a);

    const lines: string[] = [];

    for (const y of sortedY) {
      const group = groups.get(y)!;
      group.sort((a, b) => a.x - b.x);

      // 偵測純數字上標行（注腳）
      if (group.every((it) => ONLY_DIGITS.test(it.str))) {
        // 注腳行：數字附加到上一行
        if (lines.length > 0) {
          const nums = group.map((it) => it.str.trim()).join('');
          lines[lines.length - 1] += nums;
        }
        continue;
      }

      // 正常行：合併文字項目
      let line = '';
      for (let i = 0; i < group.length; i++) {
        const curr = group[i];
        if (i > 0) {
          const prev = group[i - 1];
          const gap = curr.x - (prev.x + prev.w);
          // 只有大間距（>2倍字寬）才插入分隔符
          if (gap > avgCW * 2) {
            line += '\t';
          }
        }
        line += curr.str;
      }

      lines.push(this.sanitize(line));
    }

    return lines.join('\n');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private collectItems(raw: any[]): Item[] {
    const items: Item[] = [];
    for (const r of raw) {
      if (!r.str || typeof r.str !== 'string' || !r.str.trim()) continue;
      const tx = r.transform;
      items.push({
        str: r.str,
        x: tx[4],
        y: tx[5],
        w: r.width ?? 0,
        h: Math.abs(tx[0]) || Math.abs(tx[3]) || 10,
      });
    }
    return items;
  }

  private computeMetrics(items: Item[]): { medianH: number; avgCW: number } {
    const hs = items.map((i) => i.h).sort((a, b) => a - b);
    const medianH = hs[Math.floor(hs.length / 2)] || 10;

    const ws: number[] = [];
    for (const it of items) {
      const chars = [...it.str].filter((c) => c.trim());
      if (chars.length > 0) {
        const cw = it.w / chars.length;
        if (cw > 0 && cw < 50) ws.push(cw);
      }
    }
    const avgCW = ws.length > 0 ? ws.reduce((s, w) => s + w, 0) / ws.length : 10;
    return { medianH, avgCW };
  }

  private groupByY(items: Item[], tol: number): Map<number, Item[]> {
    const groups = new Map<number, Item[]>();
    for (const item of items) {
      let key: number | null = null;
      for (const k of groups.keys()) {
        if (Math.abs(k - item.y) <= tol) { key = k; break; }
      }
      const target = key ?? item.y;
      if (!groups.has(target)) groups.set(target, []);
      groups.get(target)!.push(item);
    }
    return groups;
  }

  /**
   * 文本後處理：
   * 1. tab → 三空格（標題與作者的分隔）
   * 2. 移除所有 CJK 字元之間的空格
   * 3. 移除 CJK 與標點之間的空格
   * 4. 移除 CJK 與數字之間的空格（注腳緊跟中文字）
   */
  private sanitize(line: string): string {
    // tab → 保留標記
    let s = line.replace(/\t/g, '   ');

    // 多次迭代清除 CJK 間空格（一次可能不夠）
    for (let i = 0; i < 3; i++) {
      s = s.replace(/(\p{Script=Han})\s+(\p{Script=Han})/gu, '$1$2');
    }

    // CJK 與標點
    s = s.replace(/([\p{Script=Han}\p{P}])\s+([\p{P}，。！？；：、」「『』（）—…《》○])/gu, '$1$2');
    s = s.replace(/([\p{P}，。！？；：、」「『』（）—…《》○])\s+([\p{Script=Han}\p{P}])/gu, '$1$2');

    // 數字與 CJK
    s = s.replace(/(\p{Script=Han})\s*(\d)/gu, '$1$2');
    s = s.replace(/(\d)\s*(\p{Script=Han})/gu, '$1$2');

    // [ ] 內容不動，但括號外空格清理
    // 清理連續空格（但保留三空格分隔符）
    s = s.replace(/(?<!   )  +(?!   )/g, ' ');

    return s.trim();
  }
}
