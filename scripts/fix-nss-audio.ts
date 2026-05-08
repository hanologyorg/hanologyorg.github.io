/**
 * NSS 音頻修復 — 下載缺失的吟誦 + 移動 ks4_13-17 到正確位置
 * 用法：npx tsx scripts/fix-nss-audio.ts
 */

import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const NSS = join(ROOT, 'resources', 'nss')

async function download(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) return true
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      redirect: 'follow',
    })
    if (!res.ok) return false
    mkdirSync(dirname(dest), { recursive: true })
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1024) return false
    writeFileSync(dest, buf)
    return true
  } catch { return false }
}

function moveIfExists(src: string, dest: string) {
  if (existsSync(src) && !existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true })
    renameSync(src, dest)
  }
}

async function main() {
  console.log('NSS 音頻修復\n')

  // 1. Download missing yinsong for texts 8 and 9
  const missingYinsong = [
    { num: 8, url: 'https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/recommended-passages/ks4_08_y.mp3' },
    { num: 9, url: 'https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/recommended-passages/ks4_09_y.mp3' },
  ]

  for (const { num, url } of missingYinsong) {
    const dir = join(NSS, `${String(num).padStart(2, '0')}`)
    // Find the actual folder name
    const dirs = await import('node:fs').then(fs => 
      fs.readdirSync(NSS).filter(d => d.startsWith(`${String(num).padStart(2, '0')}-`))
    )
    if (dirs.length === 0) { console.log(`  ⚠ 找不到第 ${num} 篇資料夾`); continue }
    const itemDir = join(NSS, dirs[0])
    const dest = join(itemDir, 'audio_yinsong.mp3')
    if (existsSync(dest)) { console.log(`  · 第 ${num} 篇已有 yinsong`); continue }
    const ok = await download(url, dest)
    console.log(`  ${ok ? '✓' : '✗'} 第 ${num} 篇 yinsong`)
  }

  // 2. Move ks4_16a/b/c → text 11 sub-items (唐詩三首)
  const text11Dir = join(NSS, '11-唐詩三首')
  if (existsSync(text11Dir)) {
    const subItems = [
      { sub: 'a', title: '山居秋暝' },
      { sub: 'b', title: '月下獨酌' },
      { sub: 'c', title: '登樓' },
    ]
    for (const { sub, title } of subItems) {
      const subDir = join(text11Dir, title)
      mkdirSync(subDir, { recursive: true })
      moveIfExists(join(NSS, 'audio', `nss_16${sub}_taici.mp3`), join(subDir, 'audio_taici.mp3'))
      moveIfExists(join(NSS, 'audio', `nss_16${sub}_mandarin.mp3`), join(subDir, 'audio_mandarin.mp3'))
      moveIfExists(join(NSS, 'audio', `nss_16${sub}_yinsong.mp3`), join(subDir, 'audio_yinsong.mp3'))
      console.log(`  ✓ 唐詩三首/${title}`)
    }
  }

  // 3. Move ks4_17a/b/c → text 12 sub-items (詞三首)
  const text12Dir = join(NSS, '12-詞三首')
  if (existsSync(text12Dir)) {
    const subItems = [
      { sub: 'a', title: '念奴嬌_赤壁懷古' },
      { sub: 'b', title: '聲聲慢' },
      { sub: 'c', title: '青玉案_元夕' },
    ]
    for (const { sub, title } of subItems) {
      const subDir = join(text12Dir, title)
      mkdirSync(subDir, { recursive: true })
      moveIfExists(join(NSS, 'audio', `nss_17${sub}_taici.mp3`), join(subDir, 'audio_taici.mp3'))
      moveIfExists(join(NSS, 'audio', `nss_17${sub}_mandarin.mp3`), join(subDir, 'audio_mandarin.mp3'))
      moveIfExists(join(NSS, 'audio', `nss_17${sub}_yinsong.mp3`), join(subDir, 'audio_yinsong.mp3'))
      // Handle dual taici versions for 念奴嬌
      if (sub === 'a') {
        moveIfExists(join(NSS, 'audio', 'ks4_17a_c1.mp3'), join(subDir, 'audio_taici_1.mp3'))
        moveIfExists(join(NSS, 'audio', 'ks4_17a_c2.mp3'), join(subDir, 'audio_taici_2.mp3'))
      }
      console.log(`  ✓ 詞三首/${title}`)
    }
  }

  // 4. ks4_13/14/15 — keep as-is for now (uncertain mapping)
  // These might be from a different EDB page or reference materials
  const remainingFiles = await import('node:fs').then(fs =>
    fs.readdirSync(join(NSS, 'audio')).filter(f => f.endsWith('.mp3'))
  )
  if (remainingFiles.length > 0) {
    console.log(`\n  未處理的音頻 (${remainingFiles.length} 個):`)
    for (const f of remainingFiles) console.log(`    - ${f}`)
  } else {
    // Remove empty audio dir
    import('node:fs').then(fs => {
      try { fs.rmdirSync(join(NSS, 'audio')) } catch { /* not empty */ }
    })
    console.log('\n  ✓ 已清理空的 audio 目錄')
  }
}

main().catch(console.error)
