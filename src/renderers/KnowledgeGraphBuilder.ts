/**
 * 知識圖譜建構器
 *
 * 從原始詩文資料提取：
 *   1. 作者實體（去重，含朝代資訊）
 *   2. 朝代索引
 *   3. JSON-LD 知識圖譜
 *   4. 改進的內容 Schema（正確分離預習/跟進/想一想）
 */

import * as fs from 'fs';
import * as path from 'path';

interface AuthorEntry {
  '@id': string;
  '@type': string;
  name: string;
  dynasty: string;
  poemCount: number;
  bio?: string;
}

interface DynastyEntry {
  '@id': string;
  '@type': string;
  name: string;
  authors: string[];
  poemCount: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPoems(): any[] {
  const raw = fs.readFileSync('output/poems.json', 'utf-8');
  return JSON.parse(raw);
}

// 朝代對照（作者 → 朝代）
const AUTHOR_DYNASTY: Record<string, string> = {
  '項羽': '秦末', '漢樂府': '漢', '《古詩十九首》': '漢',
  '曹操': '漢末', '曹植': '漢末', '陶淵明': '東晉',
  '北朝民歌': '南北朝', '虞世南': '唐', '駱賓王': '唐',
  '王勃': '唐', '賀知章': '唐', '張若虛': '唐',
  '王翰': '唐', '王之渙': '唐', '孟浩然': '唐',
  '王維': '唐', '王昌齡': '唐', '李白': '唐',
  '崔顥': '唐', '杜甫': '唐', '張繼': '唐',
  '司空曙': '唐', '韋應物': '唐', '孟郊': '唐',
  '杜荀鶴': '唐', '韓愈': '唐', '劉禹錫': '唐',
  '白居易': '唐', '李紳': '唐', '柳宗元': '唐',
  '賈島': '唐', '朱慶餘': '唐', '杜秋娘': '唐',
  '杜牧': '唐', '李商隱': '唐', '曹鄴': '唐',
  '寇準': '宋', '歐陽修': '宋', '蘇舜欽': '宋',
  '王安石': '宋', '蘇軾': '宋', '李綱': '宋',
  '楊萬里': '宋', '朱熹': '宋', '南宋民歌': '宋',
  '林升': '宋', '趙師秀': '宋', '葉紹翁': '宋',
  '文天祥': '宋', '王冕': '元', '于謙': '明',
  '唐寅': '明', '徐渭': '明', '鄭燮': '清',
  '高鼎': '清',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAuthors(poems: any[]): Map<string, AuthorEntry> {
  const authors = new Map<string, AuthorEntry>();

  for (const poem of poems) {
    const name = poem.author;
    if (!name || authors.has(name)) continue;

    authors.set(name, {
      '@id': `author:${encodeURIComponent(name)}`,
      '@type': 'Person',
      name,
      dynasty: AUTHOR_DYNASTY[name] ?? '未知',
      poemCount: poems.filter(p => p.author === name).length,
      bio: poem.sections?.author_bio?.slice(0, 200),
    });
  }

  return authors;
}

function extractDynasties(authors: Map<string, AuthorEntry>): Map<string, DynastyEntry> {
  const dynasties = new Map<string, DynastyEntry>();

  for (const [, author] of authors) {
    const d = author.dynasty;
    if (!dynasties.has(d)) {
      dynasties.set(d, {
        '@id': `dynasty:${encodeURIComponent(d)}`,
        '@type': 'HistoricalPeriod',
        name: d,
        authors: [],
        poemCount: 0,
      });
    }
    const entry = dynasties.get(d)!;
    entry.authors.push(author.name);
    entry.poemCount += author.poemCount;
  }

  return dynasties;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildKnowledgeGraph(poems: any[], authors: Map<string, AuthorEntry>, dynasties: Map<string, DynastyEntry>): object {
  return {
    '@context': {
      '@vocab': 'https://schema.org/',
      author: { '@type': '@id' },
      dynasty: { '@type': '@id' },
      hasPart: { '@container': '@list' },
    },
    '@type': 'Dataset',
    '@id': 'https://classic-han-library.example/積累與感興',
    name: '積累與感興——小學古詩文誦讀材料選編（修訂）',
    description: '香港教育局課程發展處編製之古詩文誦讀材料',
    author: { '@type': 'Organization', name: '教育局課程發展處' },
    hasPart: poems.map(p => ({
      '@id': `poem:${p.num}`,
      '@type': 'CreativeWork',
      name: p.title,
      author: authors.get(p.author)?.['@id'] ?? `author:${encodeURIComponent(p.author)}`,
      position: p.num,
      text: p.verses?.map((v: { text: string }) => v.text).join('\n') ?? '',
      about: {
        '@type': 'EducationalResource',
        annotations: p.sections?.annotations,
        analysis: p.sections?.analysis,
      },
    })),
    // Authors as separate graph nodes
    authorIndex: Object.fromEntries(
      [...authors.entries()].map(([name, a]) => [name, a]),
    ),
    dynastyIndex: Object.fromEntries(
      [...dynasties.entries()].map(([name, d]) => [name, d]),
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function improveContentSchema(poems: any[]): any[] {
  // Scan for 【預習活動】, 【跟進活動】, 【想一想】 markers
  // in any section and extract them properly
  const markers = [
    { pattern: /【\s*預習活動\s*】/g, key: 'preparation' },
    { pattern: /【\s*跟進活動\s*】/g, key: 'follow_up' },
    { pattern: /【\s*預習\/跟進活動\s*】/g, key: 'preparation' }, // also follow_up
    { pattern: /【\s*想一想\s*】/g, key: 'think_questions' },
    { pattern: /【\s*補充資料\s*】/g, key: 'supplementary' },
  ];

  return poems.map(poem => {
    const improved = { ...poem, sections: { ...poem.sections } };

    // Scan analysis section for embedded activity markers
    for (const [sectionKey, sectionText] of Object.entries(improved.sections)) {
      if (typeof sectionText !== 'string') continue;

      for (const marker of markers) {
        const match = sectionText.match(marker.pattern);
        if (match) {
          // Extract content after the marker
          const idx = sectionText.indexOf(match[0]);
          const markerEnd = idx + match[0].length;
          const content = sectionText.slice(markerEnd).trim();

          // Remove from original section
          improved.sections[sectionKey] = sectionText.slice(0, idx).trim();

          // Also handle content after this marker until next marker or end
          if (content) {
            improved.sections[marker.key] = content;
          }

          // For 預習/跟進, also add to follow_up
          if (marker.key === 'preparation' && match[0].includes('跟進')) {
            improved.sections['follow_up'] = content;
          }
        }
      }
    }

    return improved;
  });
}

// ===== MAIN =====
function main() {
  const poems = loadPoems();
  const authors = extractAuthors(poems);
  const dynasties = extractDynasties(authors);

  console.log(`📖 ${poems.length} 首詩文`);
  console.log(`👤 ${authors.size} 位作者`);
  console.log(`🏛️  ${dynasties.size} 個朝代/時期`);

  // Build knowledge graph
  const kg = buildKnowledgeGraph(poems, authors, dynasties);
  fs.writeFileSync(
    'output/knowledge-graph.jsonld',
    JSON.stringify(kg, null, 2),
    'utf-8',
  );
  console.log('✅ knowledge-graph.jsonld');

  // Authors index
  const authorsData = [...authors.values()];
  fs.writeFileSync(
    'output/authors.json',
    JSON.stringify(authorsData, null, 2),
    'utf-8',
  );
  console.log('✅ authors.json');

  // Dynasties index
  const dynastiesData = Object.fromEntries(dynasties);
  fs.writeFileSync(
    'output/dynasties.json',
    JSON.stringify(dynastiesData, null, 2),
    'utf-8',
  );
  console.log('✅ dynasties.json');

  // Improved poems with better content schema
  const improved = improveContentSchema(poems);
  fs.writeFileSync(
    'output/poems.json',
    JSON.stringify(improved, null, 2),
    'utf-8',
  );
  console.log('✅ poems.json (improved schema)');
}

main();
