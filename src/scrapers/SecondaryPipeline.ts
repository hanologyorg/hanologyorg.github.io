/**
 * 中學資源處理流水線
 *
 * 編排積學與涵泳 150 篇古詩文的完整流程：
 *   Scrape HTML → Download PDF/Audio → Extract Text → Parse → Output JSON
 *
 * 設計原則：復用現有 PdfExtractor 和 Downloader，擴展而非修改。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { PdfExtractor } from '../extractors/PdfExtractor.js';
import {
  scrapeSecondaryReciting,
  scrapeCulture,
  scrapeNSSText,
  type SecondaryPoemEntry,
} from './HtmlPageScraper.js';

const SECONDARY_PDF_BASE = 'https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/chi_chapter/';

interface SecondaryPipelineOptions {
  pdfDir: string;
  audioDir: string;
  outputDir: string;
  skipDownload?: boolean;
  range?: { from: number; to: number };
}

interface ProcessedWork {
  id: string;
  num: number;
  title: string;
  collection: string;
  pdfUrl: string | null;
  audio: {
    cantonese_taici: string | null;
    cantonese_yinsong: string | null;
    mandarin: string | null;
  };
  extracted_text?: string;
  sections?: Record<string, string>;
  verses?: { text: string; footnotes: { num: number; position: number }[] }[];
}

export class SecondaryPipeline {
  private readonly extractor: PdfExtractor;

  constructor(private readonly options: SecondaryPipelineOptions) {
    this.extractor = new PdfExtractor();
    fs.mkdirSync(options.pdfDir, { recursive: true });
    fs.mkdirSync(options.audioDir, { recursive: true });
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  async run(): Promise<void> {
    console.log('=== 積學與涵泳 — 中學古詩文處理流水線 ===\n');

    // Phase 1: Scrape HTML
    console.log('📡 Phase 1: 抓取頁面元數據...');
    const scraped = await scrapeSecondaryReciting();
    const { from = 1, to = 150 } = this.options.range ?? {};
    const poems = scraped.poems.filter(p => p.num >= from && p.num <= to);
    console.log(`  找到 ${poems.length} 篇詩文`);
    console.log(`  有 PDF: ${poems.filter(p => p.pdfUrl).length}`);
    console.log(`  有音頻: ${poems.filter(p => p.audio.cantonese_taici || p.audio.mandarin).length}`);

    // Phase 2: Download PDFs
    console.log('\n📥 Phase 2: 下載篇章賞析 PDF...');
    const pdfPaths = new Map<number, string>();
    for (const poem of poems) {
      if (!poem.pdfUrl) continue;
      const dest = path.join(this.options.pdfDir, `P${String(poem.num).padStart(3, '0')}.pdf`);
      pdfPaths.set(poem.num, dest);

      if (!this.options.skipDownload) {
        if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
          continue;
        }
        try {
          await this.downloadFile(poem.pdfUrl, dest);
          process.stdout.write(`  [${String(poem.num).padStart(3, ' ')}] ✓ ${poem.title}\n`);
        } catch (err) {
          process.stdout.write(`  [${String(poem.num).padStart(3, ' ')}] ✗ ${poem.title}: ${err}\n`);
        }
        await this.sleep(300);
      }
    }

    // Phase 3: Download Audio
    console.log('\n🎵 Phase 3: 下載誦讀音頻...');
    let audioCount = 0;
    for (const poem of poems) {
      for (const [type, url] of Object.entries(poem.audio)) {
        if (!url) continue;
        const suffix = type === 'cantonese_taici' ? '_a' : type === 'cantonese_yinsong' ? '_b' : '_c';
        const dest = path.join(this.options.audioDir, `${String(poem.num).padStart(3, '0')}${suffix}.mp3`);

        if (!this.options.skipDownload) {
          if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) continue;
          try {
            await this.downloadFile(url, dest);
            audioCount++;
          } catch {
            // Audio download failure is non-fatal
          }
          await this.sleep(200);
        }
      }
    }
    console.log(`  下載 ${audioCount} 個音頻文件`);

    // Phase 4: Extract text from PDFs
    console.log('\n📄 Phase 4: 提取 PDF 文本...');
    const works: ProcessedWork[] = [];

    for (const poem of poems) {
      const pdfPath = pdfPaths.get(poem.num);
      const work: ProcessedWork = {
        id: `secondary:${String(poem.num).padStart(3, '0')}`,
        num: poem.num,
        title: poem.title,
        collection: 'secondary',
        pdfUrl: poem.pdfUrl,
        audio: poem.audio,
      };

      if (pdfPath && fs.existsSync(pdfPath)) {
        try {
          const pages = await this.extractor.extract(pdfPath);
          const fullText = pages.join('\n');
          work.extracted_text = fullText;
          work.sections = this.parseSections(fullText);
          work.verses = this.extractVerses(fullText);
        } catch (err) {
          process.stdout.write(`  [${String(poem.num).padStart(3, ' ')}] 提取失敗: ${err}\n`);
        }
      }

      works.push(work);
      process.stdout.write(`  [${String(poem.num).padStart(3, ' ')}] ${poem.title} ${work.extracted_text ? `(${work.extracted_text.length} chars)` : '(no text)'}\n`);
    }

    // Phase 5: Output
    console.log('\n💾 Phase 5: 輸出結構化數據...');
    const outputPath = path.join(this.options.outputDir, 'secondary-poems.json');
    fs.writeFileSync(outputPath, JSON.stringify(works, null, 2), 'utf-8');
    console.log(`  JSON: ${outputPath} (${works.length} 篇)`);

    // Output manifest (URL index)
    const manifest = {
      source: '積學與涵泳—中學古詩文誦讀材料選編',
      total: scraped.poems.length,
      with_pdf: scraped.poems.filter(p => p.pdfUrl).length,
      with_audio: scraped.poems.filter(p => p.audio.cantonese_taici || p.audio.mandarin).length,
      poems: scraped.poems,
      supplementary_pdfs: {
        preface: scraped.prefaceUrl,
        description: scraped.descriptionUrl,
        articleList: scraped.articleListUrl,
        acknowledgement: scraped.acknowledgementUrl,
      },
    };
    const manifestPath = path.join(this.options.outputDir, 'secondary-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`  Manifest: ${manifestPath}`);

    console.log(`\n✅ 完成！共處理 ${works.length} 篇，${works.filter(w => w.extracted_text).length} 篇有文本。`);
  }

  // ===== Culture Pipeline =====

  async runCulture(): Promise<void> {
    console.log('\n=== 郁文華章 — 文化選篇處理 ===\n');

    const scraped = await scrapeCulture();
    console.log(`  找到 ${scraped.articles.length} 篇選篇分析`);
    console.log(`  找到 ${scraped.essays.length} 篇文化集思`);
    console.log(`  找到 ${scraped.teachings.length} 份教學設計`);

    // Download PDFs
    for (const article of scraped.articles) {
      if (!article.analysisUrl || article.format !== 'pdf') continue;
      const dest = path.join(this.options.pdfDir, `culture_${String(article.num).padStart(2, '0')}.pdf`);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) continue;
      try {
        await this.downloadFile(article.analysisUrl, dest);
        await this.sleep(300);
      } catch {
        // Non-fatal
      }
    }

    // Extract text from culture PDFs
    const cultureWorks: any[] = [];
    for (const article of scraped.articles) {
      const pdfPath = path.join(this.options.pdfDir, `culture_${String(article.num).padStart(2, '0')}.pdf`);
      let extracted_text: string | undefined;
      if (fs.existsSync(pdfPath)) {
        try {
          const pages = await this.extractor.extract(pdfPath);
          extracted_text = pages.join('\n');
        } catch { /* non-fatal */ }
      }
      cultureWorks.push({
        id: `culture:${String(article.num).padStart(2, '0')}`,
        num: article.num,
        title: article.title,
        author: article.author,
        source: article.source,
        category: article.category,
        collection: 'culture',
        analysisUrl: article.analysisUrl,
        format: article.format,
        extracted_text,
      });
    }

    const outputPath = path.join(this.options.outputDir, 'culture-articles.json');
    fs.writeFileSync(outputPath, JSON.stringify(cultureWorks, null, 2), 'utf-8');
    console.log(`  輸出: ${outputPath} (${cultureWorks.length} 篇)`);
  }

  // ===== NSS Pipeline =====

  async runNSS(): Promise<void> {
    console.log('\n=== NSS 指定文言經典 ===\n');

    const entries = await scrapeNSSText();
    console.log(`  找到 ${entries.length} 篇指定篇章`);

    // Save manifest
    const manifestPath = path.join(this.options.outputDir, 'nss-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2), 'utf-8');
    console.log(`  Manifest: ${manifestPath}`);
  }

  // ===== Helpers =====

  private parseSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const patterns: [string, RegExp][] = [
      ['author_bio', /一、作者簡介\s*\n([\s\S]*?)(?=二、|$)/],
      ['background', /二、背景資料\s*\n([\s\S]*?)(?=三、|$)/],
      ['annotations', /三、注釋\s*\n([\s\S]*?)(?=四、|$)/],
      ['analysis', /四、賞析重點\s*\n([\s\S]*?)(?=$)/],
    ];

    for (const [key, regex] of patterns) {
      const match = text.match(regex);
      if (match) sections[key] = match[1].trim();
    }

    // Extract special sections from analysis
    if (sections.analysis) {
      const prepMatch = sections.analysis.match(/【預習活動】\s*\n([\s\S]*?)(?=【|$)/);
      if (prepMatch) {
        sections.preparation = prepMatch[1].trim();
        sections.analysis = sections.analysis.replace(prepMatch[0], '');
      }

      const followMatch = sections.analysis.match(/【(?:跟進活動|預習\/跟進活動)】\s*\n([\s\S]*?)(?=【|$)/);
      if (followMatch) {
        sections.follow_up = followMatch[1].trim();
        sections.analysis = sections.analysis.replace(followMatch[0], '');
      }

      const thinkMatch = sections.analysis.match(/【想一想】\s*\n([\s\S]*?)(?=【|$)/);
      if (thinkMatch) {
        sections.think_questions = thinkMatch[1].trim();
        sections.analysis = sections.analysis.replace(thinkMatch[0], '');
      }
    }

    return sections;
  }

  private extractVerses(text: string): { text: string; footnotes: { num: number; position: number }[] }[] {
    // Try to find poem text between author info and annotations
    const verses: { text: string; footnotes: { num: number; position: number }[] }[] = [];

    // Look for the poem text section (usually between the title and 一、作者簡介)
    const poemMatch = text.match(/(?:一、作者簡介|作者簡介)[\s\S]*?(?:一、作者簡介|$)/);
    if (!poemMatch) return verses;

    // Extract lines from the beginning to the first section header
    const headerIdx = text.indexOf('一、');
    if (headerIdx < 0) return verses;

    const preamble = text.slice(0, headerIdx).trim();
    const lines = preamble.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const cleaned = line.trim();
      if (!cleaned || cleaned.length < 2) continue;
      if (cleaned.match(/^[一二三四五六七八九十]、/)) break;
      if (cleaned.match(/^\d+\./)) break;

      // Check if this looks like a verse line
      if (cleaned.match(/[一-鿿]/) && cleaned.length >= 4) {
        verses.push({ text: cleaned, footnotes: [] });
      }
    }

    return verses;
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);

      const request = (target: string) => {
        https.get(target, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const loc = res.headers.location;
            if (loc) {
              request(loc.startsWith('http') ? loc : new URL(loc, target).href);
              return;
            }
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(err);
        });
      };
      request(url);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
