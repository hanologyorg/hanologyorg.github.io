/**
 * 文本清洗工具
 *
 * 負責識別並移除 PDF 中的頁首/頁尾/頁碼等干擾文本。
 */

const HEADER_RE =
  /積累與感興\s*[—\-–]+\s*小學古詩文誦讀材料選編（修訂）/;
const PAGE_NUM_RE = /^\d{1,3}$/;

export class TextCleaner {
  /**
   * 判斷一行是否為干擾文本（頁首、頁尾、頁碼）。
   */
  static isJunk(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (HEADER_RE.test(trimmed)) return true;
    if (PAGE_NUM_RE.test(trimmed)) return true;
    return false;
  }

  /**
   * 清洗一頁文本，回傳有效行。
   */
  static cleanPage(rawText: string): string[] {
    return rawText
      .split('\n')
      .filter((line) => !this.isJunk(line));
  }

  /**
   * 合併多頁已清洗的行。
   */
  static cleanPages(pages: string[]): string[] {
    const all: string[] = [];
    for (const page of pages) {
      all.push(...this.cleanPage(page));
    }
    return all;
  }
}
