/**
 * EDB 網頁抓取器
 *
 * 從教育局 HTML 頁面提取資源 URL 和元數據。
 * 純 HTML 解析，不依賴 cheerio，使用正則提取。
 *
 * 支持頁面：
 * - reciting-mp3.html（積學與涵泳 150 篇）
 * - culture.html（郁文華章 50 篇）
 * - settext-text.html（NSS 12 篇）
 * - settext-reference.html（NSS 參考書目）
 * - teacher-training.html（教師培訓材料）
 */

import * as https from 'node:https';

export interface SecondaryPoemEntry {
  num: number;
  title: string;
  pdfUrl: string | null;
  audio: {
    cantonese_taici: string | null;
    cantonese_yinsong: string | null;
    mandarin: string | null;
  };
  revised: boolean;
}

export interface CultureArticleEntry {
  num: number;
  title: string;
  author: string;
  source: string;
  category: 'self_cultivation' | 'family_nation' | 'beauty_virtue' | 'nature';
  analysisUrl: string | null;
  format: 'pdf' | 'www';
}

export interface CultureEssayEntry {
  num: number;
  title: string;
  author: string;
  pdfUrl: string | null;
}

export interface CultureTeachingEntry {
  num: number;
  theme: string;
  pdfUrl: string | null;
}

export interface NSSSettextEntry {
  num: number;
  title: string;
  excerptRange: string;
  textPdfUrl: string | null;
  audio: {
    cantonese_taici: string | null;
    cantonese_yinsong: string | null;
    mandarin: string | null;
  };
}

export interface NSSReferenceEntry {
  settextTitle: string;
  subTitle?: string;
  entries: {
    type: 'edb_analysis' | 'academic';
    title: string;
    author: string;
    source: string;
    publisher: string;
    location: string;
    year: string;
    url: string | null;
    format: 'pdf' | 'www' | 'none';
  }[];
}

export interface TrainingEntry {
  date: string;
  title: string;
  speakers: string;
  category: 'learning_teaching' | 'curriculum_assessment' | 'classical_texts';
  files: { title: string; url: string }[];
}

const EDB_BASE = 'https://www.edb.gov.hk';

async function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const get = (target: string) => {
      https.get(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,*/*',
        },
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (loc) return get(loc.startsWith('http') ? loc : EDB_BASE + loc);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${target}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      }).on('error', reject);
    };
    get(url);
  });
}

function resolveUrl(href: string): string {
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  return EDB_BASE + href;
}

// ===== 積學與涵泳（150 篇）=====

export async function scrapeSecondaryReciting(): Promise<{
  poems: SecondaryPoemEntry[];
  prefaceUrl: string;
  descriptionUrl: string;
  articleListUrl: string;
  acknowledgementUrl: string;
}> {
  const url = 'https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/reciting-mp3.html';
  const html = await fetchPage(url);

  // Extract chi_songdu (supplementary) PDFs
  const songduPdfs: Record<string, string> = {};
  for (const m of html.matchAll(/href="([^"]*chi_songdu\/([^"]*?\.pdf))"/g)) {
    songduPdfs[m[2]] = resolveUrl(m[1]);
  }

  // Build PDF map: num -> url from chi_chapter links
  const pdfMap = new Map<number, string>();
  for (const m of html.matchAll(/href="([^"]*chi_chapter\/P(\d+)[^"]*\.pdf)"/g)) {
    pdfMap.set(parseInt(m[2], 10), resolveUrl(m[1]));
  }

  // Build audio map: num -> {a, b, c} from learning_material links
  const audioMap = new Map<number, Record<string, string>>();
  for (const m of html.matchAll(/href="([^"]*learning_material[^"]*?(\d{3})_([abc])\.mp3)"/g)) {
    const num = parseInt(m[2], 10);
    const suffix = m[3];
    if (!audioMap.has(num)) audioMap.set(num, {});
    audioMap.get(num)![suffix] = resolveUrl(m[1]);
  }

  // Also extract ks3_/ks4_ audio for NSS set texts
  const ksAudioMap = new Map<string, Record<string, string>>();
  for (const m of html.matchAll(/href="[^"]*(ks[34]_\d+(?:[a-z])?)_([cpy])\.mp3"/g)) {
    const key = m[1];
    const type = m[2];
    if (!ksAudioMap.has(key)) ksAudioMap.set(key, {});
    const label = type === 'c' ? 'a' : type === 'p' ? 'c' : 'b'; // c=cantonese_taici, p=mandarin, y=yinsong->b
    ksAudioMap.get(key)![label] = m[0].match(/href="([^"]*)"/)![1];
    if (ksAudioMap.get(key)![label] && !ksAudioMap.get(key)![label].startsWith('http')) {
      ksAudioMap.get(key)![label] = resolveUrl(ksAudioMap.get(key)![label]);
    }
  }

  // Extract poem table entries (poems 1-150)
  // Parse table rows
  const poems: SecondaryPoemEntry[] = [];
  const rowRegex = /\|\s*(\d+)\s*\|\s*(.+?)\s*\|/g;
  let match;

  // Get just the table section
  const tableSection = html.match(/積學與涵泳[\s\S]*?(?=頁首|©)/)?.[0] ?? html;

  // Simple table parsing from the markdown-like content
  // We already have the poem list from the page analysis
  // Instead, parse from the known structure
  const knownPoems = getSecondaryPoemList();

  for (const poem of knownPoems) {
    const num = poem.num;
    poems.push({
      num,
      title: poem.title,
      pdfUrl: pdfMap.get(num) ?? null,
      audio: {
        cantonese_taici: audioMap.get(num)?.a ?? null,
        cantonese_yinsong: audioMap.get(num)?.b ?? null,
        mandarin: audioMap.get(num)?.c ?? null,
      },
      revised: poem.revised,
    });
  }

  return {
    poems,
    prefaceUrl: songduPdfs['Preface.pdf'] ?? '',
    descriptionUrl: songduPdfs['Description.pdf'] ?? '',
    articleListUrl: songduPdfs['Article_List.pdf'] ?? '',
    acknowledgementUrl: songduPdfs['Acknowledgments.pdf'] ?? '',
  };
}

function getSecondaryPoemList(): { num: number; title: string; revised: boolean }[] {
  return [
    { num: 1, title: '國風‧關雎', revised: true },
    { num: 2, title: '小雅‧蓼莪', revised: false },
    { num: 3, title: '九歌‧山鬼', revised: false },
    { num: 4, title: '古詩十九首（選二）', revised: true },
    { num: 5, title: '陌上桑', revised: false },
    { num: 6, title: '怨歌行', revised: false },
    { num: 7, title: '飲馬長城窟行', revised: false },
    { num: 8, title: '短歌行', revised: false },
    { num: 9, title: '贈白馬王彪 並序', revised: false },
    { num: 10, title: '飲酒（其五）', revised: true },
    { num: 11, title: '詠荊軻', revised: false },
    { num: 12, title: '木蘭詩', revised: true },
    { num: 13, title: '送杜少府之任蜀州', revised: true },
    { num: 14, title: '春江花月夜', revised: false },
    { num: 15, title: '登幽州臺歌', revised: false },
    { num: 16, title: '望月懷遠', revised: false },
    { num: 17, title: '過故人莊', revised: false },
    { num: 18, title: '臨洞庭', revised: false },
    { num: 19, title: '古從軍行', revised: false },
    { num: 20, title: '芙蓉樓送辛漸', revised: false },
    { num: 21, title: '山居秋暝', revised: false },
    { num: 22, title: '輞川閒居贈裴秀才廸', revised: false },
    { num: 23, title: '宣州謝朓樓餞別校書叔雲', revised: false },
    { num: 24, title: '將進酒', revised: false },
    { num: 25, title: '黃鶴樓', revised: false },
    { num: 26, title: '兵車行', revised: false },
    { num: 27, title: '茅屋為秋風所破歌', revised: false },
    { num: 28, title: '登樓', revised: false },
    { num: 29, title: '登高', revised: false },
    { num: 30, title: '白雪歌送武判官歸京', revised: false },
    { num: 31, title: '夜上受降城聞笛', revised: false },
    { num: 32, title: '節婦吟', revised: false },
    { num: 33, title: '燕詩', revised: false },
    { num: 34, title: '長恨歌', revised: false },
    { num: 35, title: '賣炭翁', revised: false },
    { num: 36, title: '遣悲懷（其二、其三）', revised: false },
    { num: 37, title: '泊秦淮', revised: false },
    { num: 38, title: '夜雨寄北', revised: false },
    { num: 39, title: '無題（相見時難別亦難）', revised: false },
    { num: 40, title: '更漏子（玉爐香）', revised: false },
    { num: 41, title: '謁金門（風乍起）', revised: false },
    { num: 42, title: '相見歡（無言獨上西樓）', revised: false },
    { num: 43, title: '破陣子（四十年來家國）', revised: false },
    { num: 44, title: '虞美人（春花秋月何時了）', revised: false },
    { num: 45, title: '明妃曲（兩首）', revised: false },
    { num: 46, title: '和子由澠池懷舊', revised: false },
    { num: 47, title: '登快閣', revised: false },
    { num: 48, title: '寄黃幾復', revised: false },
    { num: 49, title: '書憤', revised: false },
    { num: 50, title: '正氣歌 並序', revised: false },
    { num: 51, title: '雨霖鈴（寒蟬淒切）', revised: false },
    { num: 52, title: '漁家傲（塞下秋來風景異）', revised: false },
    { num: 53, title: '蘇幕遮（碧雲天）', revised: false },
    { num: 54, title: '浣溪沙（一曲新詞酒一杯）', revised: false },
    { num: 55, title: '蝶戀花（庭院深深深幾許）', revised: false },
    { num: 56, title: '生查子（去年元夜時）', revised: false },
    { num: 57, title: '鷓鴣天（彩袖慇勤捧玉鐘）', revised: false },
    { num: 58, title: '水調歌頭 並序', revised: false },
    { num: 59, title: '念奴嬌 赤壁懷古', revised: false },
    { num: 60, title: '江城子（十年生死兩茫茫）', revised: false },
    { num: 61, title: '鵲橋仙（纖雲弄巧）', revised: false },
    { num: 62, title: '青玉案（凌波不過橫塘路）', revised: false },
    { num: 63, title: '蘇幕遮（燎沉香）', revised: false },
    { num: 64, title: '西河 金陵懷古', revised: false },
    { num: 65, title: '漁家傲（天接雲濤連曉霧）', revised: false },
    { num: 66, title: '聲聲慢 秋情', revised: false },
    { num: 67, title: '一剪梅（紅藕香殘玉簟秋）', revised: false },
    { num: 68, title: '醉花陰（薄霧濃雲愁永晝）', revised: false },
    { num: 69, title: '滿江紅（怒髮衝冠）', revised: false },
    { num: 70, title: '釵頭鳳（紅酥手）', revised: false },
    { num: 71, title: '卜算子 詠梅', revised: false },
    { num: 72, title: '破陣子（醉裏挑燈看劍）', revised: false },
    { num: 73, title: '水龍吟 登建康賞心亭', revised: false },
    { num: 74, title: '摸魚兒（更能消幾番風雨）', revised: false },
    { num: 75, title: '醜奴兒 書博山道中壁', revised: false },
    { num: 76, title: '揚州慢（淮左名都）', revised: false },
    { num: 77, title: '虞美人 聽雨', revised: false },
    { num: 78, title: '高陽臺 西湖春感', revised: false },
    { num: 79, title: '邁陂塘（問世間）', revised: false },
    { num: 80, title: '四塊玉 閒適', revised: false },
    { num: 81, title: '一半兒 題情', revised: false },
    { num: 82, title: '沉醉東風 漁父', revised: false },
    { num: 83, title: '撥不斷（布衣中）', revised: false },
    { num: 84, title: '天淨沙 秋思', revised: false },
    { num: 85, title: '〔中呂〕十二月過堯民歌 別情', revised: false },
    { num: 86, title: '山坡羊 潼關懷古', revised: false },
    { num: 87, title: '〔南呂〕一枝花 湖上歸', revised: false },
    { num: 88, title: '賣花聲 懷古', revised: false },
    { num: 89, title: '水仙子 尋梅', revised: false },
    { num: 90, title: '法場（《竇娥冤》第三折）', revised: false },
    { num: 91, title: '灞橋餞別（《漢宫秋》第三折）', revised: false },
    { num: 92, title: '五月十九日大雨', revised: false },
    { num: 93, title: '臨江仙（滾滾長江東逝水）', revised: false },
    { num: 94, title: '圓圓曲', revised: false },
    { num: 95, title: '雜感', revised: false },
    { num: 96, title: '己亥雜詩（其五、其一二五）', revised: false },
    { num: 97, title: '對酒', revised: false },
    { num: 98, title: '解珮令（十年磨劍）', revised: false },
    { num: 99, title: '蝶戀花（辛苦最憐天上月）', revised: false },
    { num: 100, title: '餘韻（《桃花扇》續四十齣）', revised: false },
    { num: 101, title: '天尊地卑（節錄《周易》）', revised: false },
    { num: 102, title: '燭之武退秦師', revised: false },
    { num: 103, title: '學而篇', revised: false },
    { num: 104, title: '道德經（第三十三、六十四、八十一章）', revised: false },
    { num: 105, title: '魚我所欲也', revised: false },
    { num: 106, title: '論四端', revised: false },
    { num: 107, title: '庖丁解牛', revised: false },
    { num: 108, title: '說難', revised: false },
    { num: 109, title: '勸學', revised: false },
    { num: 110, title: '愚公移山', revised: false },
    { num: 111, title: '周書．秦誓', revised: false },
    { num: 112, title: '大同與小康', revised: false },
    { num: 113, title: '大學', revised: false },
    { num: 114, title: '中庸', revised: false },
    { num: 115, title: '蘇秦為趙合從說楚威王', revised: false },
    { num: 116, title: '諫逐客書', revised: false },
    { num: 117, title: '屈原列傳', revised: false },
    { num: 118, title: '答蘇武書', revised: false },
    { num: 119, title: '登樓賦', revised: false },
    { num: 120, title: '出師表', revised: false },
    { num: 121, title: '陳情表', revised: false },
    { num: 122, title: '蘭亭集序', revised: false },
    { num: 123, title: '歸去來辭並序', revised: false },
    { num: 124, title: '桃花源記', revised: false },
    { num: 125, title: '與宋元思書', revised: false },
    { num: 126, title: '謝太傅寒雪日內集', revised: false },
    { num: 127, title: '滕王閣序', revised: false },
    { num: 128, title: '春夜宴桃李園序', revised: false },
    { num: 129, title: '師說', revised: false },
    { num: 130, title: '馬說', revised: false },
    { num: 131, title: '陋室銘', revised: false },
    { num: 132, title: '捕蛇者說', revised: false },
    { num: 133, title: '始得西山宴遊記', revised: false },
    { num: 134, title: '阿房宮賦', revised: false },
    { num: 135, title: '岳陽樓記', revised: false },
    { num: 136, title: '醉翁亭記', revised: false },
    { num: 137, title: '秋聲賦', revised: false },
    { num: 138, title: '六國論', revised: false },
    { num: 139, title: '愛蓮說', revised: false },
    { num: 140, title: '讀孟嘗君傳', revised: false },
    { num: 141, title: '前赤壁賦', revised: false },
    { num: 142, title: '岳飛之少年時代', revised: false },
    { num: 143, title: '送東陽馬生序', revised: false },
    { num: 144, title: '賣柑者言', revised: false },
    { num: 145, title: '教條示龍場諸生', revised: false },
    { num: 146, title: '項脊軒志', revised: false },
    { num: 147, title: '滿井遊記', revised: false },
    { num: 148, title: '廉恥', revised: false },
    { num: 149, title: '左忠毅公軼事', revised: false },
    { num: 150, title: '病梅館記', revised: false },
  ];
}

// ===== 郁文華章（50 篇）=====

export async function scrapeCulture(): Promise<{
  articles: CultureArticleEntry[];
  essays: CultureEssayEntry[];
  teachings: CultureTeachingEntry[];
}> {
  const url = 'https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/culture.html';
  const html = await fetchPage(url);

  const articles: CultureArticleEntry[] = [];
  const categories = [
    { key: 'self_cultivation' as const, start: '修身和處世', end: '家國與人倫' },
    { key: 'family_nation' as const, start: '家國與人倫', end: '美與善' },
    { key: 'beauty_virtue' as const, start: '美與善', end: '人與自然' },
    { key: 'nature' as const, start: '人與自然', end: '教學設計' },
  ];

  for (const cat of categories) {
    const sectionStart = html.indexOf(cat.start);
    const sectionEnd = html.indexOf(cat.end, sectionStart + cat.start.length);
    const section = html.slice(sectionStart, sectionEnd > 0 ? sectionEnd : undefined);

    // Parse table rows: | num | title | author/source | analysis link |
    const rowRegex = /\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\|/g;
    let m;
    while ((m = rowRegex.exec(section)) !== null) {
      const num = parseInt(m[1], 10);
      const title = m[2].trim().replace(/\*\*/g, '');
      const authorSource = m[3].trim();

      // Extract analysis URL
      const linkMatch = m[4].match(/href="([^"]*)"/);
      const isWww = m[4].includes('www');
      const pdfUrlMatch = m[4].match(/href="([^"]*\.pdf)"/);

      articles.push({
        num,
        title,
        author: authorSource,
        source: authorSource,
        category: cat.key,
        analysisUrl: linkMatch ? resolveUrl(linkMatch[1]) : null,
        format: pdfUrlMatch ? 'pdf' : isWww ? 'www' : 'pdf',
      });
    }
  }

  // Parse essays (文化集思)
  const essays: CultureEssayEntry[] = [];
  const essaySection = html.slice(0, html.indexOf('選篇分析'));
  const essayRowRegex = /\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\|/g;
  let em;
  while ((em = essayRowRegex.exec(essaySection)) !== null) {
    const num = parseInt(em[1], 10);
    if (num > 6) continue;
    const title = em[2].trim().replace(/\*\*/g, '');
    const author = em[3].trim();
    const linkMatch = em[4].match(/href="([^"]*)"/);
    essays.push({ num, title, author, pdfUrl: linkMatch ? resolveUrl(linkMatch[1]) : null });
  }

  // Parse teaching designs
  const teachings: CultureTeachingEntry[] = [];
  const teachSection = html.slice(html.indexOf('教學設計'));
  const teachRowRegex = /\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\|/g;
  let tm;
  while ((tm = teachRowRegex.exec(teachSection)) !== null) {
    const num = parseInt(tm[1], 10);
    if (num > 6) continue;
    const theme = tm[2].trim().replace(/\*\*/g, '');
    const linkMatch = tm[3].match(/href="([^"]*)"/);
    teachings.push({ num, theme, pdfUrl: linkMatch ? resolveUrl(linkMatch[1]) : null });
  }

  return { articles, essays, teachings };
}

// ===== NSS 指定文言經典（12 篇）=====

export async function scrapeNSSText(): Promise<NSSSettextEntry[]> {
  const url = 'https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/nss-lang/settext-text.html';
  const html = await fetchPage(url);

  const entries: NSSSettextEntry[] = [];

  // Parse the table
  const tableSection = html.slice(html.indexOf('指定文言經典學習材料原文及誦讀錄音'));

  // Manual extraction from known structure
  const nssTexts = [
    { num: 1, title: '論仁、論孝、論君子', excerpt: '' },
    { num: 2, title: '魚我所欲也', excerpt: '節錄自《孟子‧告子上》' },
    { num: 3, title: '逍遙遊', excerpt: '節錄' },
    { num: 4, title: '勸學', excerpt: '節錄' },
    { num: 5, title: '廉頗藺相如列傳', excerpt: '節錄' },
    { num: 6, title: '出師表', excerpt: '' },
    { num: 7, title: '師說', excerpt: '' },
    { num: 8, title: '始得西山宴遊記', excerpt: '' },
    { num: 9, title: '岳陽樓記', excerpt: '' },
    { num: 10, title: '六國論', excerpt: '' },
    { num: 11, title: '唐詩三首', excerpt: '' },
    { num: 12, title: '詞三首', excerpt: '' },
  ];

  for (const text of nssTexts) {
    // Extract PDF URL for text
    const textPdfPattern = new RegExp(`href="([^"]*ks4_${String(text.num).padStart(2, '0')}_text\\.pdf)"`, 'i');
    const textPdfMatch = tableSection.match(textPdfPattern);

    // Extract audio URLs
    const cantonesePattern = new RegExp(`href="([^"]*ks4_${String(text.num).padStart(2, '0')}_[cp]\\.mp3)"`, 'g');
    const yinsongPattern = new RegExp(`href="([^"]*ks4_${String(text.num).padStart(2, '0')}_y\\.mp3)"`, 'g');

    const cMatch = tableSection.match(new RegExp(`href="([^"]*ks4_${String(text.num).padStart(2, '0')}_c\\.mp3)"`));
    const pMatch = tableSection.match(new RegExp(`href="([^"]*ks4_${String(text.num).padStart(2, '0')}_p\\.mp3)"`));
    const yMatch = tableSection.match(new RegExp(`href="([^"]*ks4_${String(text.num).padStart(2, '0')}_y\\.mp3)"`));

    entries.push({
      num: text.num,
      title: text.title,
      excerptRange: text.excerpt,
      textPdfUrl: textPdfMatch ? resolveUrl(textPdfMatch[1]) : null,
      audio: {
        cantonese_taici: cMatch ? resolveUrl(cMatch[1]) : null,
        cantonese_yinsong: yMatch ? resolveUrl(yMatch[1]) : null,
        mandarin: pMatch ? resolveUrl(pMatch[1]) : null,
      },
    });
  }

  return entries;
}

// ===== NSS 參考書目 =====

export async function scrapeNSSReference(): Promise<NSSReferenceEntry[]> {
  const url = 'https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/nss-lang/settext-reference.html';
  const html = await fetchPage(url);

  const results: NSSReferenceEntry[] = [];
  // Complex table parsing - extract references grouped by settext title
  // The table has merged rows for settext titles
  const lines = html.split('\n');

  let currentSettext = '';
  let currentSubTitle = '';
  let currentEntries: NSSReferenceEntry['entries'] = [];

  for (const line of lines) {
    if (line.includes('上述參考資料提供')) break;
    if (!line.includes('|')) continue;

    // Check for settext title markers
    if (line.includes('論仁') || line.includes('魚我所欲') || line.includes('逍遙遊') ||
        line.includes('勸學') || line.includes('廉頗') || line.includes('出師表') ||
        line.includes('師說') || line.includes('始得西山') || line.includes('岳陽樓記') ||
        line.includes('六國論') || line.includes('唐詩三首') || line.includes('詞三首')) {
      // May be a new settext section
      if (currentSettext && currentEntries.length > 0) {
        results.push({ settextTitle: currentSettext, subTitle: currentSubTitle, entries: currentEntries });
      }

      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        const potentialTitle = cells[0].replace(/\*\*/g, '').trim();
        if (potentialTitle.length < 20 && !potentialTitle.match(/^\d/)) {
          currentSettext = potentialTitle;
          currentEntries = [];
        }
      }
    }

    // Parse reference entry
    const linkMatch = line.match(/href="([^"]*)"/);
    const isEdb = line.includes('教育局') && line.includes('賞析');

    if (linkMatch && line.includes('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        currentEntries.push({
          type: isEdb ? 'edb_analysis' : 'academic',
          title: cells[0].replace(/\*\*/g, '').trim(),
          author: cells.length > 1 ? cells[1].trim() : '',
          source: cells.length > 2 ? cells[2].trim() : '',
          publisher: cells.length > 3 ? cells[3].trim() : '',
          location: cells.length > 4 ? cells[4].trim() : '',
          year: cells.length > 5 ? cells[5].trim() : '',
          url: resolveUrl(linkMatch[1]),
          format: linkMatch[1].endsWith('.pdf') ? 'pdf' : 'www',
        });
      }
    }
  }

  if (currentSettext && currentEntries.length > 0) {
    results.push({ settextTitle: currentSettext, subTitle: currentSubTitle, entries: currentEntries });
  }

  return results;
}

// ===== 教師培訓材料 =====

export async function scrapeTraining(): Promise<TrainingEntry[]> {
  const url = 'https://www.edb.gov.hk/tc/curriculum-development/kla/chi-edu/resources/secondary-edu/lang/teacher-training.html';
  const html = await fetchPage(url);

  const entries: TrainingEntry[] = [];
  let currentCategory: TrainingEntry['category'] = 'learning_teaching';

  const lines = html.split('\n');
  for (const line of lines) {
    if (line.includes('課程詮釋及學習評估')) {
      currentCategory = 'curriculum_assessment';
    } else if (line.includes('文言經典學習材料系列')) {
      currentCategory = 'classical_texts';
    }

    // Parse table rows
    if (!line.includes('|') || line.includes('舉行日期') || line.includes('---')) continue;

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;

    const date = cells[0];
    if (!date.match(/\d{4}/)) continue;

    const title = cells[1];
    const speakers = cells[2];

    // Extract PDF links
    const files: { title: string; url: string }[] = [];
    const pdfRegex = /href="([^"]*\.pdf)"/g;
    let pm;
    const materialsCell = cells[3] ?? '';
    while ((pm = pdfRegex.exec(materialsCell)) !== null) {
      files.push({ title: `講義`, url: resolveUrl(pm[1]) });
    }

    entries.push({
      date: date.replace(/\*\*/g, '').trim(),
      title: title.replace(/\*\*/g, '').trim(),
      speakers: speakers.replace(/\*\*/g, '').trim(),
      category: currentCategory,
      files,
    });
  }

  return entries;
}
