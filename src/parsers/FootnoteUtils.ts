/**
 * 注腳工具
 *
 * 處理詩句中的注腳數字（上標數字）。
 * 注腳數字嵌入在詩句中，如「力拔山兮²氣蓋世³」。
 * 我們需要：
 *   1. 從詩句中提取注腳引用位置
 *   2. 生成不含注腳的純文本
 */

import type { FootnoteRef, VerseLine } from '../models/types.js';

/**
 * 注腳數字的正則：文本中跟在中文字後面的單獨數字（1-2位）。
 * 例如：「力拔山兮2 氣蓋世3」中的 2 和 3。
 * 注意：注腳數字可能是獨立的，也可能嵌入在文字中。
 */
const FOOTNOTE_RE = /(\d{1,2})(?=[^\d]|$)/g;

export class FootnoteUtils {
  /**
   * 從原始詩句文本中解析注腳引用，生成純文本 + 注腳列表。
   *
   * @param rawLine 原始文本（含注腳數字）
   * @returns VerseLine（純文本 + 注腳引用）
   */
  static parseVerseLine(rawLine: string): VerseLine {
    const footnotes: FootnoteRef[] = [];
    let cleanText = '';
    let offset = 0;

    // 逐字掃描，找注腳數字
    // 注腳的特徵：數字出現在中文字或標點之後
    const chars = [...rawLine];

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];

      // 如果是數字，且前後不是數字（即獨立數字），可能是注腳
      if (/\d/.test(ch)) {
        // 收集連續數字
        let numStr = ch;
        while (i + 1 < chars.length && /\d/.test(chars[i + 1])) {
          i++;
          numStr += chars[i];
        }
        const footnoteNum = parseInt(numStr, 10);

        // 判斷是否為注腳：
        // - 如果前面是中文字、標點或空格，且數字 <= 20，視為注腳
        // - 如果在行首或前面的字符是數字本身，不是注腳
        if (footnoteNum <= 20 && offset > 0) {
          const prevChar = cleanText[cleanText.length - 1];
          if (prevChar && /[一-鿿，。！？；：、]/.test(prevChar)) {
            footnotes.push({
              num: footnoteNum,
              position: cleanText.length - 1, // 指向前一個中文字
            });
            continue; // 不加入 cleanText
          }
        }
      }

      cleanText += ch;
      offset++;
    }

    return {
      text: cleanText.trim(),
      footnotes,
    };
  }

  /**
   * 批量解析多行詩句。
   */
  static parseVerses(rawLines: string[]): VerseLine[] {
    return rawLines
      .filter((l) => l.trim())
      .map((l) => this.parseVerseLine(l));
  }

  /**
   * 從 VerseLine 生成 Markdown 格式的詩句（帶上標注腳）。
   */
  static toMarkdown(verses: readonly VerseLine[]): string {
    return verses
      .map((v) => {
        let line = v.text;
        // 從後往前插入注腳，避免位移
        const sorted = [...v.footnotes].sort((a, b) => b.position - a.position);
        for (const fn of sorted) {
          line =
            line.slice(0, fn.position + 1) +
            `^[${fn.num}]` +
            line.slice(fn.position + 1);
        }
        return line;
      })
      .join('\n');
  }
}
