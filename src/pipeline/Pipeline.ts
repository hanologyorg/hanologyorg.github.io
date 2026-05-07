/**
 * 處理流水線
 *
 * 編排完整的 詩文資料處理流程：
 *   Download → Extract → Parse → Render
 *
 * 設計原則：開放封閉。新增渲染器不需要修改此類別。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Poem, Extractor, Parser, Renderer } from '../models/types.js';
import { Downloader } from '../extractors/Downloader.js';
import { PdfExtractor } from '../extractors/PdfExtractor.js';
import { PoemParser } from '../parsers/PoemParser.js';
import { MarkdownRenderer } from '../renderers/MarkdownRenderer.js';
import { JsonRenderer } from '../renderers/JsonRenderer.js';
import { getMeta } from '../config/poems.js';

export interface PipelineOptions {
  pdfDir: string;
  outputDir: string;
  range?: { from: number; to: number };
}

export class Pipeline {
  private readonly downloader: Downloader;
  private readonly extractor: Extractor;
  private readonly parser: Parser;
  private readonly renderers: Renderer[] = [];

  constructor(private readonly options: PipelineOptions) {
    this.downloader = new Downloader(options.pdfDir);
    this.extractor = new PdfExtractor();
    this.parser = new PoemParser();

    // 預設渲染器
    this.renderers.push(new MarkdownRenderer(), new JsonRenderer());
  }

  addRenderer(renderer: Renderer): void {
    this.renderers.push(renderer);
  }

  async run(): Promise<Poem[]> {
    const { from = 1, to = 100 } = this.options.range ?? {};

    console.log(`📥 下載 PDF（${from}-${to}）...`);
    const paths = await this.downloader.downloadRange(from, to);

    console.log('\n📄 解析詩文...');
    const poems: Poem[] = [];

    for (let num = from; num <= to; num++) {
      const pdfPath = paths.get(num);
      if (!pdfPath) continue;

      const meta = getMeta(num);
      const title = meta?.title ?? `Poem ${num}`;

      try {
        const pages = await this.extractor.extract(pdfPath);
        const poem = this.parser.parse(pages, num, title);
        poems.push(poem);
        process.stdout.write(`  [${String(num).padStart(3, ' ')}] ${title} — ${poem.verses.length} 句, ${poem.sections.size} 章節\n`);
      } catch (err) {
        process.stdout.write(`  [${String(num).padStart(3, ' ')}] ${title} — ERROR: ${err}\n`);
      }
    }

    console.log('\n🎨 渲染輸出...');
    await this.renderAll(poems);

    console.log(`\n✅ 完成！共處理 ${poems.length} 首詩文。`);
    return poems;
  }

  private async renderAll(poems: Poem[]): Promise<void> {
    fs.mkdirSync(this.options.outputDir, { recursive: true });

    for (const renderer of this.renderers) {
      switch (renderer.format) {
        case 'markdown': {
          const mdDir = path.join(this.options.outputDir, 'markdown');
          fs.mkdirSync(mdDir, { recursive: true });
          for (const poem of poems) {
            const filePath = path.join(
              mdDir,
              `${String(poem.num).padStart(3, '0')}_${poem.title}.md`,
            );
            fs.writeFileSync(filePath, renderer.render(poem), 'utf-8');
          }
          console.log(`  Markdown: ${mdDir}/ (${poems.length} 檔案)`);
          break;
        }
        case 'json': {
          const jsonPath = path.join(this.options.outputDir, 'poems.json');
          fs.writeFileSync(jsonPath, renderer.renderAll(poems), 'utf-8');
          console.log(`  JSON: ${jsonPath}`);
          break;
        }
      }
    }
  }
}
