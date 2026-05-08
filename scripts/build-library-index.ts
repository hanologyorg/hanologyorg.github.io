/**
 * 圖書館索引生成器 — 建立所有集合的統一索引
 * 用法：npx tsx scripts/build-library-index.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const DATA = join(ROOT, 'site', 'public', 'data')
const RESOURCES = join(ROOT, 'resources')

function safeReadJson(path: string): any {
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return null }
}

function countInDirs(collectionDir: string, ext: string): { total: number; withFile: number; folders: number } {
  if (!existsSync(collectionDir)) return { total: 0, withFile: 0, folders: 0 }
  const entries = readdirSync(collectionDir).filter(e => {
    const p = join(collectionDir, e)
    return statSync(p).isDirectory() && !e.startsWith('.')
  })
  let withFile = 0
  for (const entry of entries) {
    const files = readdirSync(join(collectionDir, entry))
    if (files.some(f => f.endsWith(ext))) withFile++
  }
  return { total: entries.length, withFile, folders: entries.length }
}

function main() {
  console.log('古典詩文圖書館 — 建立索引\n')

  const poems = safeReadJson(join(DATA, 'poems.json'))
  const authors = safeReadJson(join(DATA, 'authors.json'))
  const cultureArticles = safeReadJson(join(DATA, 'culture-articles.json'))
  const nssSettexts = safeReadJson(join(DATA, 'nss-settexts.json'))
  const trainingMaterials = safeReadJson(join(DATA, 'training-materials.json'))
  const crossRefs = safeReadJson(join(DATA, 'cross-references.json'))

  // Count from per-item folders
  const primaryPdf = countInDirs(join(RESOURCES, 'primary'), '.pdf')
  const primaryMd = countInDirs(join(RESOURCES, 'primary'), '.md')

  const secondaryPdf = countInDirs(join(RESOURCES, 'secondary'), '.pdf')
  const secondaryMp3 = countInDirs(join(RESOURCES, 'secondary'), '.mp3')
  const secondaryMd = countInDirs(join(RESOURCES, 'secondary'), '.md')

  const culturePdf = countInDirs(join(RESOURCES, 'culture'), '.pdf')
  const cultureMd = countInDirs(join(RESOURCES, 'culture'), '.md')

  const nssPdf = countInDirs(join(RESOURCES, 'nss'), '.pdf')
  const nssMp3 = countInDirs(join(RESOURCES, 'nss'), '.mp3')
  const nssMd = countInDirs(join(RESOURCES, 'nss'), '.md')

  const trainingPdf = countInDirs(join(RESOURCES, 'training'), '.pdf')
  const trainingMd = countInDirs(join(RESOURCES, 'training'), '.md')

  const cultureTotal = (cultureArticles?.articles?.length ?? 0) +
    (cultureArticles?.essays?.length ?? 0) +
    (cultureArticles?.teachingDesigns?.length ?? 0)

  const index = {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    collections: {
      primary: {
        label: '積累與感興（小學）',
        total: poems?.length ?? 0,
        withPdf: primaryPdf.withFile,
        withFullText: poems?.filter((p: any) => p.verses?.length > 0).length ?? 0,
        withAnnotations: poems?.filter((p: any) => p.annotations?.length > 0).length ?? 0,
        authors: authors?.length ?? 0,
        folders: primaryPdf.folders,
      },
      secondary: {
        label: '積學與涵泳（中學）',
        total: secondaryPdf.total,
        withPdf: secondaryPdf.withFile,
        withAudio: secondaryMp3.withFile,
        withTextMd: secondaryMd.withFile,
        folders: secondaryPdf.folders,
      },
      culture: {
        label: '郁文華章（文化）',
        articles: cultureArticles?.articles?.length ?? 0,
        essays: cultureArticles?.essays?.length ?? 0,
        teachingDesigns: cultureArticles?.teachingDesigns?.length ?? 0,
        total: cultureTotal,
        withPdf: culturePdf.withFile,
        withTextMd: cultureMd.withFile,
        folders: culturePdf.folders,
      },
      nss: {
        label: 'NSS 指定篇章',
        total: nssSettexts?.texts?.length ?? 0,
        subItems: nssSettexts?.texts?.reduce((n: number, t: any) => n + (t.subItems?.length ?? 0), 0) ?? 0,
        withPdf: nssPdf.withFile,
        withAudio: nssMp3.withFile,
        withTextMd: nssMd.withFile,
        folders: nssPdf.folders,
      },
      training: {
        label: '教師培訓',
        total: trainingMaterials?.total ?? 0,
        withPdf: trainingPdf.withFile,
        withTextMd: trainingMd.withFile,
        folders: trainingPdf.folders,
        byCategory: trainingMaterials?.byCategory ?? {},
        series: trainingMaterials?.series?.length ?? 0,
      },
    },
    crossReferences: {
      total: crossRefs?.total ?? crossRefs?.refs?.length ?? 0,
    },
    totalResources: 0,
    totalFolders: 0,
  }

  index.totalResources = index.collections.primary.total + index.collections.secondary.total +
    index.collections.culture.total + index.collections.nss.total + index.collections.training.total

  index.totalFolders = index.collections.primary.folders + index.collections.secondary.folders +
    index.collections.culture.folders + index.collections.nss.folders + index.collections.training.folders

  const outPath = join(DATA, 'library-index.json')
  writeFileSync(outPath, JSON.stringify(index, null, 2), 'utf-8')

  console.log('圖書館索引:')
  const p = index.collections.primary
  console.log(`  積累與感興: ${p.total} 篇 (${p.withPdf} PDF, ${p.withFullText} 全文, ${p.folders} 資料夾)`)
  const s = index.collections.secondary
  console.log(`  積學與涵泳: ${s.total} 資料夾 (${s.withPdf} PDF, ${s.withAudio} 音頻, ${s.withTextMd} text.md)`)
  const c = index.collections.culture
  console.log(`  郁文華章: ${c.total} 篇 (${c.articles} 文章 + ${c.essays} 散文 + ${c.teachingDesigns} 教學, ${c.withPdf} PDF, ${c.folders} 資料夾)`)
  const n = index.collections.nss
  console.log(`  NSS: ${n.total} 篇 + ${n.subItems} 子項 (${n.withPdf} PDF, ${n.withAudio} 音頻, ${n.folders} 資料夾)`)
  const t = index.collections.training
  console.log(`  教師培訓: ${t.total} 條 (${t.withPdf} PDF, ${t.folders} 資料夾)`)
  console.log(`  交叉引用: ${index.crossReferences.total} 條`)
  console.log(`  總計: ${index.totalResources} 篇/條, ${index.totalFolders} 資料夾`)
  console.log(`\n輸出: ${outPath}`)
}

main()
