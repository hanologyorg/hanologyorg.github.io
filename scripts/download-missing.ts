/**
 * 下載缺失的 secondary 和 culture 資源
 *
 * 用法：
 *   npx tsx scripts/download-missing.ts              # 下載所有缺失
 *   npx tsx scripts/download-missing.ts secondary     # 只下載 secondary
 *   npx tsx scripts/download-missing.ts culture       # 只下載 culture (secondary)
 */

import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as https from 'node:https'
import { PdfExtractor } from '../src/extractors/PdfExtractor.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const EDB = 'https://www.edb.gov.hk'
const DELAY = 500

const SECONDARY_DIR = join(ROOT, 'resources', 'secondary')
const CULTURE_SECONDARY_DIR = join(ROOT, 'resources', 'culture', 'secondary')

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function httpsGet(url: string): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const get = (target: string) => {
      https.get(target, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location
          if (loc) return get(loc.startsWith('http') ? loc : EDB + loc)
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }))
      }).on('error', reject)
    }
    get(url)
  })
}

async function download(url: string, dest: string): Promise<boolean> {
  mkdirSync(dirname(dest), { recursive: true })
  try {
    const { status, body } = await httpsGet(url)
    if (status !== 200) return false
    writeFileSync(dest, body)
    return true
  } catch { return false }
}

async function tryDownload(patterns: string[], dest: string): Promise<boolean> {
  for (const url of patterns) {
    const ok = await download(url, dest)
    if (ok) return true
    await sleep(200)
  }
  return false
}

// ─── Secondary Poem List ────────────────────────────

const SECONDARY_POEMS = [
  { num: 1, title: '國風_關雎' },
  { num: 2, title: '小雅_蓼莪' },
  { num: 3, title: '九歌_山鬼' },
  { num: 4, title: '古詩十九首_選二' },
  { num: 5, title: '陌上桑' },
  { num: 6, title: '怨歌行' },
  { num: 7, title: '飲馬長城窟行' },
  { num: 8, title: '短歌行' },
  { num: 9, title: '贈白馬王彪_並序' },
  { num: 10, title: '飲酒_其五' },
  { num: 11, title: '詠荊軻' },
  { num: 12, title: '木蘭詩' },
  { num: 13, title: '送杜少府之任蜀州' },
  { num: 14, title: '春江花月夜' },
  { num: 15, title: '登幽州臺歌' },
  { num: 16, title: '望月懷遠' },
  { num: 17, title: '過故人莊' },
  { num: 18, title: '臨洞庭' },
  { num: 19, title: '古從軍行' },
  { num: 20, title: '芙蓉樓送辛漸' },
  { num: 21, title: '山居秋暝' },
  { num: 22, title: '輞川閒居贈裴秀才廸' },
  { num: 23, title: '宣州謝朓樓餞別校書叔雲' },
  { num: 24, title: '將進酒' },
  { num: 25, title: '黃鶴樓' },
  { num: 26, title: '兵車行' },
  { num: 27, title: '茅屋為秋風所破歌' },
  { num: 28, title: '登樓' },
  { num: 29, title: '登高' },
  { num: 30, title: '白雪歌送武判官歸京' },
  { num: 31, title: '夜上受降城聞笛' },
  { num: 32, title: '節婦吟' },
  { num: 33, title: '燕詩' },
  { num: 34, title: '長恨歌' },
  { num: 35, title: '賣炭翁' },
  { num: 36, title: '遣悲懷_其二_其三' },
  { num: 37, title: '泊秦淮' },
  { num: 38, title: '夜雨寄北' },
  { num: 39, title: '無題_相見時難別亦難' },
  { num: 40, title: '更漏子_玉爐香' },
  { num: 41, title: '謁金門_風乍起' },
  { num: 42, title: '相見歡_無言獨上西樓' },
  { num: 43, title: '破陣子_四十年來家國' },
  { num: 44, title: '虞美人_春花秋月何時了' },
  { num: 45, title: '明妃曲_兩首' },
  { num: 46, title: '和子由澠池懷舊' },
  { num: 47, title: '登快閣' },
  { num: 48, title: '寄黃幾復' },
  { num: 49, title: '書憤' },
  { num: 50, title: '正氣歌_並序' },
  { num: 51, title: '雨霖鈴_寒蟬淒切' },
  { num: 52, title: '漁家傲_塞下秋來風景異' },
  { num: 53, title: '蘇幕遮_碧雲天' },
  { num: 54, title: '浣溪沙_一曲新詞酒一杯' },
  { num: 55, title: '蝶戀花_庭院深深深幾許' },
  { num: 56, title: '生查子_去年元夜時' },
  { num: 57, title: '鷓鴣天_彩袖慇勤捧玉鐘' },
  { num: 58, title: '水調歌頭_並序' },
  { num: 59, title: '念奴嬌_赤壁懷古' },
  { num: 60, title: '江城子_十年生死兩茫茫' },
  { num: 61, title: '鵲橋仙_纖雲弄巧' },
  { num: 62, title: '青玉案_凌波不過橫塘路' },
  { num: 63, title: '蘇幕遮_燎沉香' },
  { num: 64, title: '西河_金陵懷古' },
  { num: 65, title: '漁家傲_天接雲濤連曉霧' },
  { num: 66, title: '聲聲慢_秋情' },
  { num: 67, title: '一剪梅_紅藕香殘玉簟秋' },
  { num: 68, title: '醉花陰_薄霧濃雲愁永晝' },
  { num: 69, title: '滿江紅_怒髮衝冠' },
  { num: 70, title: '釵頭鳳_紅酥手' },
  { num: 71, title: '卜算子_詠梅' },
  { num: 72, title: '破陣子_醉裏挑燈看劍' },
  { num: 73, title: '水龍吟_登建康賞心亭' },
  { num: 74, title: '摸魚兒_更能消幾番風雨' },
  { num: 75, title: '醜奴兒_書博山道中壁' },
  { num: 76, title: '揚州慢_淮左名都' },
  { num: 77, title: '虞美人_聽雨' },
  { num: 78, title: '高陽臺_西湖春感' },
  { num: 79, title: '邁陂塘_問世間' },
  { num: 80, title: '四塊玉_閒適' },
  { num: 81, title: '一半兒_題情' },
  { num: 82, title: '沉醉東風_漁父' },
  { num: 83, title: '撥不斷_布衣中' },
  { num: 84, title: '天淨沙_秋思' },
  { num: 85, title: '〔中呂〕十二月過堯民歌_別情' },
  { num: 86, title: '山坡羊_潼關懷古' },
  { num: 87, title: '〔南呂〕一枝花_湖上歸' },
  { num: 88, title: '賣花聲_懷古' },
  { num: 89, title: '水仙子_尋梅' },
  { num: 90, title: '法場_《竇娥冤》第三折' },
  { num: 91, title: '灞橋餞別_《漢宫秋》第三折' },
  { num: 92, title: '五月十九日大雨' },
  { num: 93, title: '臨江仙_滾滾長江東逝水' },
  { num: 94, title: '圓圓曲' },
  { num: 95, title: '雜感' },
  { num: 96, title: '己亥雜詩_其五_其一二五' },
  { num: 97, title: '對酒' },
  { num: 98, title: '解珮令_十年磨劍' },
  { num: 99, title: '蝶戀花_辛苦最憐天上月' },
  { num: 100, title: '餘韻_《桃花扇》續四十齣' },
  { num: 101, title: '天尊地卑_節錄《周易》' },
  { num: 102, title: '燭之武退秦師' },
  { num: 103, title: '學而篇' },
  { num: 104, title: '道德經_第三十三_六十四_八十一章' },
  { num: 105, title: '魚我所欲也' },
  { num: 106, title: '論四端' },
  { num: 107, title: '庖丁解牛' },
  { num: 108, title: '說難' },
  { num: 109, title: '勸學' },
  { num: 110, title: '愚公移山' },
  { num: 111, title: '周書．秦誓' },
  { num: 112, title: '大同與小康' },
  { num: 113, title: '大學' },
  { num: 114, title: '中庸' },
  { num: 115, title: '蘇秦為趙合從說楚威王' },
  { num: 116, title: '諫逐客書' },
  { num: 117, title: '屈原列傳' },
  { num: 118, title: '答蘇武書' },
  { num: 119, title: '登樓賦' },
  { num: 120, title: '出師表' },
  { num: 121, title: '陳情表' },
  { num: 122, title: '蘭亭集序' },
  { num: 123, title: '歸去來辭並序' },
  { num: 124, title: '桃花源記' },
  { num: 125, title: '與宋元思書' },
  { num: 126, title: '謝太傅寒雪日內集' },
  { num: 127, title: '滕王閣序' },
  { num: 128, title: '春夜宴桃李園序' },
  { num: 129, title: '師說' },
  { num: 130, title: '馬說' },
  { num: 131, title: '陋室銘' },
  { num: 132, title: '捕蛇者說' },
  { num: 133, title: '始得西山宴遊記' },
  { num: 134, title: '阿房宮賦' },
  { num: 135, title: '岳陽樓記' },
  { num: 136, title: '醉翁亭記' },
  { num: 137, title: '秋聲賦' },
  { num: 138, title: '六國論' },
  { num: 139, title: '愛蓮說' },
  { num: 140, title: '讀孟嘗君傳' },
  { num: 141, title: '前赤壁賦' },
  { num: 142, title: '岳飛之少年時代' },
  { num: 143, title: '送東陽馬生序' },
  { num: 144, title: '賣柑者言' },
  { num: 145, title: '教條示龍場諸生' },
  { num: 146, title: '項脊軒志' },
  { num: 147, title: '滿井遊記' },
  { num: 148, title: '廉恥' },
  { num: 149, title: '左忠毅公軼事' },
  { num: 150, title: '病梅館記' },
]

const CULTURE_ARTICLES = [
  { num: 1, title: '大學_節錄' },
  { num: 2, title: '論仁_論君子' },
  { num: 3, title: '論學' },
  { num: 4, title: '魚我所欲也' },
  { num: 5, title: '論四端' },
  { num: 6, title: '晏子僕御_節錄' },
  { num: 7, title: '臧與穀牧羊_節錄' },
  { num: 8, title: '庖丁解牛_節錄' },
  { num: 9, title: '歸園田居_三首' },
  { num: 10, title: '管寧華歆共園中鋤菜_節錄' },
  { num: 11, title: '把酒問月' },
  { num: 12, title: '茅屋為秋風所破歌' },
  { num: 13, title: '始得西山宴遊記' },
  { num: 14, title: '岳陽樓記' },
  { num: 15, title: '醉翁亭記' },
  { num: 16, title: '正氣歌_並序' },
  { num: 17, title: '廉恥' },
  { num: 18, title: '左忠毅公軼事' },
  { num: 19, title: '為學' },
  { num: 20, title: '習慣說' },
  { num: 21, title: '敬業與樂業' },
  { num: 22, title: '中山先生的習醫時代' },
  { num: 23, title: '不恥下問' },
  { num: 24, title: '小國寡民' },
  { num: 25, title: '兼愛' },
  { num: 26, title: '寡人願安承教' },
  { num: 27, title: '隆禮重法_節錄' },
  { num: 28, title: '君不仁_臣不忠_節錄' },
  { num: 29, title: '大同與小康_節錄' },
  { num: 30, title: '出師表' },
  { num: 31, title: '雪落在中國的土地上' },
  { num: 32, title: '論孝' },
  { num: 33, title: '燕詩' },
  { num: 34, title: '我的母親' },
  { num: 35, title: '父親節論慈孝_節錄' },
  { num: 36, title: '承教小記' },
  { num: 37, title: '不遷' },
  { num: 38, title: '少小離家老大回' },
  { num: 39, title: '鄉愁四韻' },
  { num: 40, title: '愛蓮說' },
  { num: 41, title: '白玉苦瓜' },
  { num: 42, title: '中國的牛' },
  { num: 43, title: '竹影' },
  { num: 44, title: '宋徽宗選畫_節錄' },
  { num: 45, title: '知魚之樂' },
  { num: 46, title: '逍遙遊_節錄' },
  { num: 47, title: '女媧補天_節錄' },
  { num: 48, title: '飲酒_其五' },
  { num: 49, title: '鳥鳴澗' },
  { num: 50, title: '明天不封陽台' },
]

// ─── Find missing ───────────────────────────────────

function findMissingSecondary(): { num: number; title: string }[] {
  const fs = require('fs') as typeof import('fs')
  const dirs = fs.readdirSync(SECONDARY_DIR)
  // Only consider a poem "present" if it has a PDF
  const existingNums = new Set<number>()
  for (const d of dirs) {
    const m = d.match(/^(\d+)-/)
    if (m && fs.existsSync(join(SECONDARY_DIR, d, 'original.pdf'))) {
      existingNums.add(parseInt(m[1], 10))
    }
  }
  return SECONDARY_POEMS.filter(p => !existingNums.has(p.num))
}

function findMissingCulture(): { num: number; title: string }[] {
  const fs = require('fs') as typeof import('fs')
  const dirs = fs.readdirSync(CULTURE_SECONDARY_DIR)
  // Only consider an article "present" if it has a PDF
  const existingNums = new Set<number>()
  for (const d of dirs) {
    const m = d.match(/^(\d+)-/)
    if (m) {
      const hasPdf = fs.existsSync(join(CULTURE_SECONDARY_DIR, d, 'analysis.pdf'))
        || fs.existsSync(join(CULTURE_SECONDARY_DIR, d, 'original.pdf'))
      if (hasPdf) existingNums.add(parseInt(m[1], 10))
    }
  }
  return CULTURE_ARTICLES.filter(a => !existingNums.has(a.num))
}

// ─── Download Secondary ─────────────────────────────

const KS_MAP: Record<number, string[]> = {
  1: ['ks4_01'],
  4: ['ks3_05a', 'ks3_05b'],
  10: ['ks4_11'],
  12: ['ks3_08'],
  13: ['ks3_09'],
  21: ['ks4_16a'],
  26: ['ks3_10'],
  28: ['ks4_16c'],
  33: ['ks3_11a'],
  58: ['ks3_17'],
  59: ['ks4_17a'],
  66: ['ks4_17b'],
}

const REC_PASSAGES_BASE = `${EDB}/attachment/tc/curriculum-development/kla/chi-edu/recommended-passages/`

async function downloadSecondary() {
  const missing = findMissingSecondary()
  console.log(`\n📚 積學與涵泳 — ${missing.length} 篇缺失\n`)

  const extractor = new PdfExtractor()
  const pdfBase = `${EDB}/attachment/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/chi_chapter/`
  const audioBase = `${EDB}/attachment/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/learning_material_2013-03/`

  let pdfOk = 0, audioOk = 0, textOk = 0

  for (const poem of missing) {
    const n = String(poem.num).padStart(3, '0')
    const dir = join(SECONDARY_DIR, `${n}-${poem.title}`)
    mkdirSync(dir, { recursive: true })

    // PDF — try chi_chapter, dated variants, then recommended-passages
    const pdfDest = join(dir, 'original.pdf')
    if (!existsSync(pdfDest)) {
      const pdfPatterns = [
        `${pdfBase}P${n}.pdf`,
        `${pdfBase}P${n}_201704.pdf`,
        `${pdfBase}P${n}_201808.pdf`,
        `${pdfBase}P${n}_202306.pdf`,
        `${pdfBase}P${n}_r.pdf`,
      ]
      // Also try recommended-passages mapping
      const ksIds = KS_MAP[poem.num]
      if (ksIds) {
        pdfPatterns.push(`${REC_PASSAGES_BASE}${ksIds[0]}_text.pdf`)
      }

      const ok = await tryDownload(pdfPatterns, pdfDest)
      if (ok) {
        pdfOk++
        console.log(`  ✓ PDF ${n}: ${poem.title}`)
      } else {
        console.log(`  ✗ PDF ${n}: ${poem.title} (no source)`)
      }
      await sleep(DELAY)

      // Download additional ks parts (e.g. ks3_05b for P004)
      if (ksIds && ksIds.length > 1) {
        for (let i = 1; i < ksIds.length; i++) {
          const extraDest = join(dir, `original_${String.fromCharCode(97 + i)}.pdf`)
          if (!existsSync(extraDest)) {
            const ok2 = await download(`${REC_PASSAGES_BASE}${ksIds[i]}_text.pdf`, extraDest)
            if (ok2) pdfOk++
            await sleep(DELAY)
          }
        }
      }
    }

    // Audio
    for (const [suffix, name] of [['_a', 'taici'], ['_b', 'yinsong'], ['_c', 'mandarin']] as const) {
      const dest = join(dir, `audio_${name}.mp3`)
      if (existsSync(dest)) continue
      const url = `${audioBase}${n}${suffix}.mp3`
      const ok = await download(url, dest)
      if (ok) audioOk++
      await sleep(200)
    }

    // Extract text
    if (existsSync(pdfDest)) {
      const textDest = join(dir, 'text.md')
      if (!existsSync(textDest)) {
        try {
          const pages = await extractor.extract(pdfDest)
          const fullText = pages.join('\n')
          writeFileSync(textDest, `# ${poem.title}\n\n${fullText}`, 'utf-8')
          textOk++
        } catch (err: any) {
          console.log(`  ⚠ 提取失敗 ${n}: ${err.message}`)
        }
      }
    }
  }

  console.log(`\n  完成：${pdfOk} PDF + ${audioOk} 音頻 + ${textOk} 文本`)
}

// ─── Download Culture ────────────────────────────────

async function downloadCulture() {
  const missing = findMissingCulture()
  console.log(`\n📜 郁文華章 — ${missing.length} 篇缺失\n`)

  if (missing.length === 0) {
    console.log('  無缺失')
    return
  }

  // Try direct B-series URLs for culture articles
  const culturePdfBase = `${EDB}/attachment/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/culture/`

  const extractor = new PdfExtractor()
  let pdfOk = 0, textOk = 0

  for (const art of missing) {
    const n = String(art.num).padStart(2, '0')
    const dir = join(CULTURE_SECONDARY_DIR, `${n}-${art.title}`)
    mkdirSync(dir, { recursive: true })

    // PDF — try direct B-series URL (not all are linked on page)
    const pdfDest = join(dir, 'analysis.pdf')
    if (!existsSync(pdfDest)) {
      const padded = String(art.num).padStart(3, '0')
      const pdfPatterns = [
        `${culturePdfBase}B${padded}.pdf`,
        `${culturePdfBase}B${padded}_a.pdf`,
        `${culturePdfBase}C${padded}.pdf`,
      ]
      const ok = await tryDownload(pdfPatterns, pdfDest)
      if (ok) {
        pdfOk++
        console.log(`  ✓ PDF ${n}: ${art.title}`)
      } else {
        console.log(`  ⚠ 無 PDF ${n}: ${art.title} (www-only)`)
      }
      await sleep(DELAY)
    }

    // Extract text
    if (existsSync(pdfDest)) {
      const textDest = join(dir, 'text.md')
      if (!existsSync(textDest)) {
        try {
          const pages = await extractor.extract(pdfDest)
          const fullText = pages.join('\n')
          writeFileSync(textDest, `# ${art.title}\n\n${fullText}`, 'utf-8')
          textOk++
        } catch (err: any) {
          console.log(`  ⚠ 提取失敗 ${n}: ${err.message}`)
        }
      }
    }
  }

  console.log(`\n  完成：${pdfOk} PDF + ${textOk} 文本`)
}

// ─── Main ────────────────────────────────────────────

async function main() {
  const target = process.argv[2] || 'all'
  console.log('下載缺失資源')
  console.log(`目標：${target}`)

  if (target === 'secondary' || target === 'all') await downloadSecondary()
  if (target === 'culture' || target === 'all') await downloadCulture()

  console.log('\n✓ 完成')
}

main().catch(console.error)
