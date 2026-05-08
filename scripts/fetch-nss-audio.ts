/**
 * NSS 音頻 URL 提取器 — 從 HTML 提取所有嵌入的音頻 URL
 * 用法：npx tsx scripts/fetch-nss-audio.ts
 */

import * as https from 'node:https'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const EDB_BASE = 'https://www.edb.gov.hk'

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'text/html,*/*' },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location
        if (loc) return fetchPage(loc.startsWith('http') ? loc : EDB_BASE + loc).then(resolve, reject)
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    }).on('error', reject)
  })
}

function resolveUrl(href: string): string {
  if (href.startsWith('http')) return href
  if (href.startsWith('//')) return 'https:' + href
  return EDB_BASE + href
}

async function download(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) return false
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      redirect: 'follow',
    })
    if (!res.ok) return false
    mkdirSync(dirname(dest), { recursive: true })
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1024) return false // skip tiny files
    writeFileSync(dest, buf)
    return true
  } catch { return false }
}

async function main() {
  console.log('NSS 音頻 URL 提取\n')

  const html = await fetchPage('https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/nss-lang/settext-text.html')
  console.log(`頁面大小: ${html.length} bytes\n`)

  // Extract ALL .mp3 URLs from the page
  const mp3Urls = new Map<string, string>()
  for (const m of html.matchAll(/(?:href|src|value)="([^"]*\.mp3[^"]*)"/gi)) {
    const url = resolveUrl(m[1])
    const filename = url.split('/').pop()?.split('?')[0] ?? ''
    mp3Urls.set(filename, url)
  }

  // Also check <object> and <embed> tags (Windows Media Player)
  for (const m of html.matchAll(/<(?:object|embed|param)[^>]*(?:data|src|value)="([^"]+)"/gi)) {
    const url = m[1]
    if (url.includes('.mp3') || url.includes('ks4_') || url.includes('learning_material') || url.includes('recommended')) {
      const fullUrl = resolveUrl(url)
      const filename = fullUrl.split('/').pop()?.split('?')[0] ?? ''
      if (filename.includes('.mp3') || filename.includes('ks4_')) {
        mp3Urls.set(filename, fullUrl)
      }
    }
  }

  // Also check for URL= patterns in object params
  for (const m of html.matchAll(/value="([^"]*(?:ks4|mp3)[^"]*)"/gi)) {
    const url = resolveUrl(m[1])
    const filename = url.split('/').pop()?.split('?')[0] ?? ''
    mp3Urls.set(filename, url)
  }

  console.log(`找到 ${mp3Urls.size} 個音頻 URL:\n`)
  const audioDir = join(ROOT, 'resources', 'nss', 'audio')
  let downloaded = 0

  for (const [filename, url] of mp3Urls) {
    // Determine the standard filename
    let stdName = filename
    const ks4Match = filename.match(/ks4_(\d+)([a-z]?)_([cpy])\.mp3/)
    if (ks4Match) {
      const num = ks4Match[1]
      const sub = ks4Match[2]
      const type = ks4Match[3]
      const typeMap: Record<string, string> = { c: 'taici', p: 'mandarin', y: 'yinsong' }
      const prefix = sub ? `nss_${num}${sub}` : `nss_${num}`
      stdName = `${prefix}_${typeMap[type]}.mp3`
    }

    const dest = join(audioDir, stdName)
    const ok = await download(url, dest)
    if (ok) {
      downloaded++
      console.log(`  ✓ ${stdName}`)
    } else if (existsSync(dest)) {
      console.log(`  · ${stdName} (已存在)`)
    } else {
      console.log(`  ✗ ${stdName} — ${url}`)
    }
  }

  console.log(`\n下載 ${downloaded} 個新音頻`)
}

main().catch(console.error)
