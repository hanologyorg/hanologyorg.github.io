/**
 * JSON 渲染器
 *
 * 將 Poem 物件序列化為 JSON，供網站前端使用。
 * Map 轉換為 plain object 以便 JSON.stringify。
 */

import type { Poem, Renderer } from '../models/types.js';

interface PoemJson {
  num: number;
  title: string;
  author: string;
  verses: { text: string; footnotes: { num: number; position: number }[] }[];
  sections: Record<string, string>;
  annotations: {
    num: number;
    term: string;
    pronunciations: { dialect: string; homophone: string; phonetic: string }[];
    definition: string;
    children: any[];
  }[];
}

export class JsonRenderer implements Renderer {
  readonly format = 'json';

  render(poem: Poem): string {
    return JSON.stringify(this.toPlain(poem), null, 2);
  }

  renderAll(poems: readonly Poem[]): string {
    return JSON.stringify(poems.map((p) => this.toPlain(p)), null, 2);
  }

  toPlain(poem: Poem): PoemJson {
    const sections: Record<string, string> = {};
    poem.sections.forEach((value, key) => {
      sections[key] = value;
    });

    return {
      num: poem.num,
      title: poem.title,
      author: poem.author,
      verses: poem.verses.map((v) => ({
        text: v.text,
        footnotes: v.footnotes.map((fn) => ({ num: fn.num, position: fn.position })),
      })),
      sections,
      annotations: poem.annotations.map((a) => ({
        num: a.num,
        term: a.term,
        pronunciations: a.pronunciations.map((p) => ({
          dialect: p.dialect,
          homophone: p.homophone,
          phonetic: p.phonetic,
        })),
        definition: a.definition,
        children: a.children.map((c) => ({
          num: c.num,
          term: c.term,
          pronunciations: [],
          definition: c.definition,
          children: [],
        })),
      })),
    };
  }
}
