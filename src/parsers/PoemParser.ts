/**
 * 詩文解析器
 *
 * 核心解析器：將清洗後的文本行解析為結構化的 Poem 物件。
 *
 * 解析策略：
 * 1. 定位詩題行（含注腳數字的詩題 + 作者名）
 * 2. 提取詩句（從詩題到第一個章節標記之間的文本）
 * 3. 按章節標記切割文本段落
 * 4. 提取跟進活動與想一想
 */

import type {
  Poem,
  SectionType,
  AnnotationEntry,
  Pronunciation,
  VerseLine,
} from '../models/types.js';
import { SectionType as ST } from '../models/types.js';
import { TextCleaner } from './TextCleaner.js';
import { FootnoteUtils } from './FootnoteUtils.js';
import type { PoemMeta } from '../config/poems.js';
import { getMeta } from '../config/poems.js';

// ===== 章節偵測模式 =====

interface SectionPattern {
  type: SectionType;
  pattern: RegExp;
}

const SECTION_PATTERNS: readonly SectionPattern[] = [
  { type: ST.AuthorBio, pattern: /一\s*、\s*作\s*者\s*簡\s*介/ },
  { type: ST.Background, pattern: /二\s*、\s*背\s*景\s*資\s*料/ },
  { type: ST.Annotations, pattern: /三\s*、\s*注\s*釋/ },
  { type: ST.Analysis, pattern: /[四五六七八九十]+\s*、\s*賞\s*析\s*重\s*點/ },
];

const FOLLOWUP_RE = /【\s*跟進活動\s*】/;
const THINK_RE = /【\s*想一想\s*】/;

// ===== 區段定位結果 =====

interface RegionMap {
  numLine: number;
  titleLine: number;
  verseStart: number;
  verseEnd: number;
  sectionRegions: { type: SectionType; start: number; end: number }[];
  followupLine: number;
  thinkLine: number;
}

// ===== 解析器 =====

export class PoemParser {
  parse(pages: string[], num: number, _knownTitle: string): Poem {
    const meta = getMeta(num);
    const lines = TextCleaner.cleanPages(pages);
    const regions = this.locateRegions(lines, num, meta);

    const rawVerses = this.extractVerses(lines, regions);
    const verses = FootnoteUtils.parseVerses(rawVerses);
    const sections = this.extractSections(lines, regions);
    const annotations = this.parseAnnotations(
      sections.get(ST.Annotations) ?? '',
    );

    return {
      num,
      title: meta?.title ?? _knownTitle,
      author: meta?.author ?? '',
      verses,
      sections,
      annotations,
    };
  }

  // ===== 區段定位 =====

  private locateRegions(lines: string[], poemNum: number, meta: PoemMeta | undefined): RegionMap {
    const titleHint = (meta?.title ?? '').slice(0, 2);

    let numLine = -1;
    let titleLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (numLine < 0 && new RegExp(`^${poemNum}$`).test(line)) {
        numLine = i;
        continue;
      }

      if (numLine >= 0 && titleLine < 0 && line.length > 1) {
        titleLine = i;
        continue;
      }
    }

    // 如果沒有找到獨立編號行，嘗試直接找詩題
    if (titleLine < 0) {
      for (let i = 0; i < Math.min(8, lines.length); i++) {
        if (lines[i].includes(titleHint)) {
          titleLine = i;
          break;
        }
      }
    }

    // 定位章節標記
    const sectionRegions: { type: SectionType; start: number; end: number }[] = [];

    for (const { type, pattern } of SECTION_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          sectionRegions.push({ type, start: i, end: i });
          break;
        }
      }
    }

    const followupLine = this.findLine(lines, FOLLOWUP_RE);
    const thinkLine = this.findLine(lines, THINK_RE);

    // 計算章節結束位置
    for (let i = 0; i < sectionRegions.length; i++) {
      sectionRegions[i].end =
        sectionRegions[i + 1]?.start ??
        (followupLine >= 0 ? followupLine : thinkLine >= 0 ? thinkLine : lines.length);
    }

    const verseStart = titleLine >= 0 ? titleLine + 1 : 0;
    const verseEnd = sectionRegions.length > 0
      ? sectionRegions[0].start
      : followupLine >= 0
        ? followupLine
        : thinkLine >= 0
          ? thinkLine
          : lines.length;

    return { numLine, titleLine, verseStart, verseEnd, sectionRegions, followupLine, thinkLine };
  }

  private findLine(lines: string[], pattern: RegExp): number {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) return i;
    }
    return -1;
  }

  // ===== 詩句提取 =====

  private extractVerses(lines: string[], regions: RegionMap): string[] {
    const titleText = regions.titleLine >= 0 ? lines[regions.titleLine]?.trim() : '';
    const result: string[] = [];

    for (let i = regions.verseStart; i < regions.verseEnd; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // 跳過詩題行重複
      if (titleText && line === titleText) continue;
      // 跳過已知作者名（獨立一行）
      if (this.isAuthorLine(line, regions)) continue;
      result.push(line);
    }

    return result;
  }

  private isAuthorLine(line: string, _regions: RegionMap): boolean {
    // 作者名通常很短（2-3字），且不包含標點或注腳
    // 暫時用簡單啟發式：純中文字且長度 <= 4
    return /^[一-鿿]{1,4}$/.test(line);
  }

  // ===== 章節提取 =====

  private extractSections(lines: string[], regions: RegionMap): Map<SectionType, string> {
    const sections = new Map<SectionType, string>();

    for (const { type, start, end } of regions.sectionRegions) {
      const content = lines
        .slice(start + 1, end)
        .join('\n')
        .trim()
        .replace(/\n{3,}/g, '\n\n');
      sections.set(type, content);
    }

    if (regions.followupLine >= 0) {
      const end = regions.thinkLine >= 0 ? regions.thinkLine : lines.length;
      sections.set(ST.FollowUp, lines.slice(regions.followupLine + 1, end).join('\n').trim());
    }

    if (regions.thinkLine >= 0) {
      sections.set(ST.ThinkQuestions, lines.slice(regions.thinkLine + 1).join('\n').trim());
    }

    return sections;
  }

  // ===== 注釋解析 =====

  private parseAnnotations(rawText: string): AnnotationEntry[] {
    if (!rawText) return [];

    const entries: AnnotationEntry[] = [];
    const entryPattern = /(\d{1,2})\.\s*/g;
    const splits = rawText.split(entryPattern);

    for (let i = 1; i < splits.length; i += 2) {
      const num = parseInt(splits[i], 10);
      const body = splits[i + 1]?.trim();
      if (!body) continue;
      entries.push(this.parseAnnotationEntry(num, body));
    }

    return entries;
  }

  private parseAnnotationEntry(num: number, body: string): AnnotationEntry {
    const colonIdx = body.indexOf('：');
    if (colonIdx < 0) {
      return { num, term: '', pronunciations: [], definition: body, children: [] };
    }

    const term = body.slice(0, colonIdx).trim();
    const rest = body.slice(colonIdx + 1).trim();
    const { pronunciations, cleanedText } = this.extractPronunciations(rest);
    const children = this.parseSubAnnotations(cleanedText);

    return { num, term, pronunciations, definition: cleanedText, children };
  }

  private extractPronunciations(text: string): { pronunciations: Pronunciation[]; cleanedText: string } {
    const pronunciations: Pronunciation[] = [];
    let cleaned = text;

    // 完整格式：○粵[同音字]，[粵拼]；○漢[漢語拼音]
    const fullPattern = /○\s*粵\s*\[([^\]]+)\]\s*[，,]\s*\[([^\]]+)\]\s*[；;]?\s*○\s*漢\s*\[([^\]]+)\]/g;
    let match: RegExpExecArray | null;

    while ((match = fullPattern.exec(text)) !== null) {
      pronunciations.push(
        { dialect: 'cantonese', homophone: match[1].trim(), phonetic: match[2].trim() },
        { dialect: 'mandarin', homophone: '', phonetic: match[3].trim() },
      );
      cleaned = cleaned.replace(match[0], '');
    }

    // 單獨粵音
    const cantonesePattern = /○\s*粵\s*\[([^\]]+)\]\s*[，,]\s*\[([^\]]+)\]/g;
    while ((match = cantonesePattern.exec(text)) !== null) {
      if (!pronunciations.some((p) => p.dialect === 'cantonese' && p.phonetic === match[2].trim())) {
        pronunciations.push(
          { dialect: 'cantonese', homophone: match[1].trim(), phonetic: match[2].trim() },
        );
        cleaned = cleaned.replace(match[0], '');
      }
    }

    return { pronunciations, cleanedText: cleaned.replace(/\n{3,}/g, '\n').trim() };
  }

  private parseSubAnnotations(text: string): AnnotationEntry[] {
    const children: AnnotationEntry[] = [];
    const subPattern = /^([^\d\n：]{1,4})：(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = subPattern.exec(text)) !== null) {
      children.push({
        num: 0,
        term: match[1].trim(),
        pronunciations: [],
        definition: match[2].trim(),
        children: [],
      });
    }

    return children;
  }
}
