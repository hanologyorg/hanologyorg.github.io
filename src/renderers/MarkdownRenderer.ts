/**
 * Markdown 渲染器
 *
 * 將 Poem 物件渲染為結構化 Markdown 文本。
 */

import type { Poem, Renderer, SectionType } from '../models/types.js';
import { SECTION_LABELS, SectionType as ST } from '../models/types.js';
import { FootnoteUtils } from '../parsers/FootnoteUtils.js';

const SECTION_ORDER: SectionType[] = [
  ST.AuthorBio,
  ST.Background,
  ST.Annotations,
  ST.Analysis,
  ST.FollowUp,
  ST.ThinkQuestions,
];

export class MarkdownRenderer implements Renderer {
  readonly format = 'markdown';

  render(poem: Poem): string {
    const lines: string[] = [];

    // 標題
    lines.push(`# ${poem.num}. ${poem.title}`);
    if (poem.author) lines.push(`**${poem.author}**`);
    lines.push('');

    // 詩句
    if (poem.verses.length > 0) {
      lines.push('---');
      lines.push('');
      for (const verse of poem.verses) {
        lines.push(`> ${verse.text}`);
      }
      lines.push('');
      lines.push('---');
    }
    lines.push('');

    // 章節
    for (const type of SECTION_ORDER) {
      const content = poem.sections.get(type);
      if (!content) continue;

      const label = SECTION_LABELS[type];
      const isSpecial = type === ST.FollowUp || type === ST.ThinkQuestions;

      lines.push(isSpecial ? `### 【${label}】` : `### ${label}`);
      lines.push('');
      lines.push(content);
      lines.push('');
    }

    return lines.join('\n');
  }

  renderAll(poems: readonly Poem[]): string {
    return poems.map((p) => this.render(p)).join('\n---\n\n');
  }
}
