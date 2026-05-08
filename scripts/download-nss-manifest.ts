/**
 * NSS 資源下載器 — 從 nss-manifest.json 下載 PDF 和音頻
 * 用法：npx tsx scripts/download-nss-manifest.ts
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'resources', 'nss')

const DELAY = 500

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function download(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) return false
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      redirect: 'follow',
    })
    if (!res.ok) {
      console.log(`  ✗ HTTP ${res.status}: ${url}`)
      return false
    }
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
    return true
  } catch (err: any) {
    console.log(`  ✗ ${err.message}: ${url}`)
    return false
  }
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'output', 'nss-manifest.json'), 'utf-8'))
  console.log(`NSS 指定篇章 — 下載 ${manifest.length} 篇資源\n`)

  // Also try known URL patterns for missing entries
  const ks4Base = 'https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/recommended-passages/'

  let pdfCount = 0, audioCount = 0

  for (const entry of manifest) {
    const num = String(entry.num).padStart(2, '0')

    // PDF
    let pdfUrl = entry.textPdfUrl
    if (!pdfUrl) {
      pdfUrl = `${ks4Base}ks4_${num}_text.pdf`
    }
    const pdfDest = join(OUT, 'pdf', `nss_${num}.pdf`)
    const pdfOk = await download(pdfUrl, pdfDest)
    if (pdfOk) {
      pdfCount++
      console.log(`  ✓ PDF ${num}: ${entry.title}`)
    } else if (existsSync(pdfDest)) {
      console.log(`  · PDF ${num}: 已存在`)
    }

    await sleep(DELAY)

    // Audio
    const audioTypes = [
      { key: 'cantonese_taici', suffix: '_taici.mp3', pattern: '_c.mp3' },
      { key: 'cantonese_yinsong', suffix: '_yinsong.mp3', pattern: '_y.mp3' },
      { key: 'mandarin', suffix: '_mandarin.mp3', pattern: '_p.mp3' },
    ]

    for (const { key, suffix, pattern } of audioTypes) {
      let url = entry.audio?.[key]
      if (!url) {
        url = `${ks4Base}ks4_${num}${pattern}`
      }
      const dest = join(OUT, 'audio', `nss_${num}${suffix}`)
      const ok = await download(url, dest)
      if (ok) {
        audioCount++
        console.log(`  ✓ 音頻 ${num}${suffix}`)
      }
      await sleep(DELAY)
    }
  }

  console.log(`\n完成：${pdfCount} PDF + ${audioCount} 音頻`)
}

main().catch(console.error)
