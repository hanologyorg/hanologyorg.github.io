/**
 * PDF 下載器
 *
 * 負責從 EDB 網站下載 PDF 檔案。
 * 支援重試、快取（已存在的檔案會跳過）。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { PDF_BASE_URL } from '../config/poems.js';

export class Downloader {
  constructor(private readonly outputDir: string) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  pdfPath(num: number): string {
    return path.join(this.outputDir, `jilei_shi_${String(num).padStart(3, '0')}.pdf`);
  }

  private url(num: number): string {
    return PDF_BASE_URL.replace('{NUM:03d}', String(num).padStart(3, '0'));
  }

  async download(num: number, retries = 3): Promise<string> {
    const dest = this.pdfPath(num);

    // 快取：已存在且大於 1KB 則跳過
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
      return dest;
    }

    const url = this.url(num);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.fetch(url, dest);
        return dest;
      } catch (err) {
        if (attempt === retries) throw err;
        await this.sleep(2000 * attempt);
      }
    }

    throw new Error(`Failed to download poem #${num}`);
  }

  async downloadRange(from: number, to: number): Promise<Map<number, string>> {
    const results = new Map<number, string>();

    for (let num = from; num <= to; num++) {
      try {
        const p = await this.download(num);
        results.set(num, p);
        process.stdout.write(`  [${String(num).padStart(3, ' ')}] OK\n`);
      } catch (err) {
        process.stdout.write(`  [${String(num).padStart(3, ' ')}] FAILED: ${err}\n`);
      }

      // 禮貌延遲
      await this.sleep(300);
    }

    return results;
  }

  private fetch(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);

      const request = (targetUrl: string) => {
        https
          .get(
            targetUrl,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                Accept: 'application/pdf,*/*',
              },
            },
            (res) => {
              // 跟隨重導向
              if (res.statusCode === 301 || res.statusCode === 302) {
                const location = res.headers.location;
                if (location) {
                  request(location);
                  return;
                }
              }

              if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
              }

              res.pipe(file);
              file.on('finish', () => {
                file.close();
                resolve();
              });
            },
          )
          .on('error', (err) => {
            fs.unlinkSync(dest);
            reject(err);
          });
      };

      request(url);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
