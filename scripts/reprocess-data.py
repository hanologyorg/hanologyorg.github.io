#!/usr/bin/env python3
"""
資料後處理器 v2：從 reference-docs/raw-text/ 重新解析詩文資料

設計原則（取材自 ctext.org 但不採用 wiki 語法）：
- 注釋 = (文本範圍, 注釋物件)
- 文本範圍可以是：游標點、字元範圍、全文、標題、段落
- 注釋種類：pronunciation (ISO 639-5)、semantic、etymology、note
- 每個注釋獨立存在，多個注釋可指向同一範圍

用法：python3 scripts/reprocess-data.py
"""

import json
import re
from pathlib import Path
from typing import TypedDict
from typing_extensions import NotRequired


# ===== 資料模型 =====

class TextRange(TypedDict):
    """文本範圍：指向詩文中被注釋的文本位置"""
    type: str  # 'point' | 'range' | 'full'
    scope: str  # 'verse' | 'title' | 'section' | 'full_text'
    verseIndex: NotRequired[int]
    sectionKey: NotRequired[str]
    start: NotRequired[int]
    end: NotRequired[int]


class Annotation(TypedDict):
    """注釋：指向文本範圍的結構化標記"""
    id: str
    range: TextRange
    kind: str  # 'pronunciation' | 'semantic' | 'etymology' | 'note' | 'definition'
    lang: NotRequired[str]  # ISO 639-5: 'yue' | 'cmn' | etc.
    text: str
    source: str  # 來源：'edb'


class VerseLine(TypedDict):
    text: str


class Poem(TypedDict):
    num: int
    title: str
    author: str
    verses: list[VerseLine]
    sections: dict[str, str]
    annotations: list[Annotation]


# ===== 常量 =====

BASE = Path(__file__).resolve().parent.parent
RAW_DIR = BASE / 'reference-docs' / 'raw-text'
SITE_DATA = BASE / 'site' / 'public' / 'data'

POEM_META: dict[int, tuple[str, str]] = {
    1: ('垓下歌', '項羽'), 2: ('江南', '漢樂府'),
    3: ('長歌行', '漢樂府'), 4: ('十五從軍征', '漢樂府'),
    5: ('庭中有奇樹', '《古詩十九首》'), 6: ('短歌行', '曹操'),
    7: ('七步詩', '曹植'), 8: ('歸園田居（其三）', '陶淵明'),
    9: ('雜詩（其一）', '陶淵明'), 10: ('敕勒歌', '北朝民歌'),
    11: ('木蘭詩', '北朝民歌'), 12: ('詠螢', '虞世南'),
    13: ('詠鵝', '駱賓王'), 14: ('送杜少府之任蜀州', '王勃'),
    15: ('詠柳', '賀知章'), 16: ('回鄉偶書', '賀知章'),
    17: ('春江花月夜', '張若虛'), 18: ('涼州詞', '王翰'),
    19: ('涼州詞', '王之渙'), 20: ('登鸛鵲樓', '王之渙'),
    21: ('春曉', '孟浩然'), 22: ('九月九日憶山東兄弟', '王維'),
    23: ('相思', '王維'), 24: ('送元二使安西', '王維'),
    25: ('送別', '王維'), 26: ('山中送別', '王維'),
    27: ('鹿柴', '王維'), 28: ('竹里館', '王維'),
    29: ('閨怨', '王昌齡'), 30: ('出塞', '王昌齡'),
    31: ('靜夜思', '李白'), 32: ('送友人', '李白'),
    33: ('黃鶴樓送孟浩然之廣陵', '李白'), 34: ('望廬山瀑布', '李白'),
    35: ('秋浦歌', '李白'), 36: ('獨坐敬亭山', '李白'),
    37: ('贈汪倫', '李白'), 38: ('早發白帝城', '李白'),
    39: ('黃鶴樓', '崔顥'), 40: ('兵車行', '杜甫'),
    41: ('春望', '杜甫'), 42: ('客至', '杜甫'),
    43: ('絕句', '杜甫'), 44: ('月夜', '杜甫'),
    45: ('楓橋夜泊', '張繼'), 46: ('江村即事', '司空曙'),
    47: ('滁州西澗', '韋應物'), 48: ('遊子吟', '孟郊'),
    49: ('小松', '杜荀鶴'), 50: ('初春小雨', '韓愈'),
    51: ('竹枝詞（其一）', '劉禹錫'), 52: ('烏衣巷', '劉禹錫'),
    53: ('賦得古原草送別', '白居易'), 54: ('暮江吟', '白居易'),
    55: ('問劉十九', '白居易'), 56: ('憫農（其二）', '李紳'),
    57: ('江雪', '柳宗元'), 58: ('尋隱者不遇', '賈島'),
    59: ('近試上張籍水部', '朱慶餘'), 60: ('金縷衣', '杜秋娘'),
    61: ('贈別', '杜牧'), 62: ('泊秦淮', '杜牧'),
    63: ('山行', '杜牧'), 64: ('清明', '杜牧'),
    65: ('江南春', '杜牧'), 66: ('秋夕', '杜牧'),
    67: ('登樂遊原', '李商隱'), 68: ('夜雨寄北', '李商隱'),
    69: ('官倉鼠', '曹鄴'), 70: ('華山', '寇準'),
    71: ('畫眉鳥', '歐陽修'), 72: ('淮中晚泊犢頭', '蘇舜欽'),
    73: ('梅花', '王安石'), 74: ('元日', '王安石'),
    75: ('登飛來峰', '王安石'), 76: ('泊船瓜洲', '王安石'),
    77: ('書湖陰先生壁', '王安石'), 78: ('飲湖上初晴後雨', '蘇軾'),
    79: ('題西林壁', '蘇軾'), 80: ('惠崇春江晚景', '蘇軾'),
    81: ('花影', '蘇軾'), 82: ('贈劉景文', '蘇軾'),
    83: ('病牛', '李綱'), 84: ('曉出淨慈寺送林子方', '楊萬里'),
    85: ('小池', '楊萬里'), 86: ('宿新市徐公店', '楊萬里'),
    87: ('觀書有感', '朱熹'), 88: ('春日', '朱熹'),
    89: ('月兒彎彎照九州', '南宋民歌'), 90: ('題臨安邸', '林升'),
    91: ('約客', '趙師秀'), 92: ('遊園不值', '葉紹翁'),
    93: ('過零丁洋', '文天祥'), 94: ('墨梅（其三）', '王冕'),
    95: ('素梅（其五十六）', '王冕'), 96: ('石灰吟', '于謙'),
    97: ('畫雞', '唐寅'), 98: ('風鳶圖詩（其一）', '徐渭'),
    99: ('竹石', '鄭燮'), 100: ('村居', '高鼎'),
}

SECTION_PATTERNS = [
    ('author_bio', re.compile(r'[一二三四五六七八九十]+\s*[、]?\s*作\s*者\s*(?:簡\s*介|介\s*紹)')),
    ('background', re.compile(r'[一二三四五六七八九十]+\s*[、]?\s*背\s*景\s*資\s*料')),
    ('annotations', re.compile(r'[一二三四五六七八九十]+\s*[、]?\s*注\s*釋')),
    ('analysis', re.compile(r'[一二三四五六七八九十]+\s*[、]?\s*賞\s*析\s*重\s*點')),
]
ACTIVITY_PATTERNS = [
    ('preparation', re.compile(r'【\s*預習\s*[/／]\s*跟進活動\s*】')),
    ('follow_up', re.compile(r'【\s*跟進活動\s*】')),
    ('think_questions', re.compile(r'【\s*想一想\s*】')),
]

HAN_RE = re.compile(r'[一-鿿]')


# ===== 解析工具 =====

def parse_raw_lines(raw_text: str) -> list[str]:
    """從 raw-text 檔案提取 CLEANED 段落的行"""
    in_cleaned = False
    lines = []
    for line in raw_text.split('\n'):
        if line.strip() == '=== CLEANED ===':
            in_cleaned = True
            continue
        if in_cleaned:
            m = re.match(r'\s*\d+\s*\|\s*(.*)', line)
            if m:
                lines.append(m.group(1))
    return lines


def extract_trailing_fn(text: str) -> tuple[str, list[int]]:
    """從文字末尾提取注腳數字，返回 (乾淨文本, 注腳編號列表)"""
    m = re.search(r'([一-鿿，。！？；：、」「『』（）—…《》）》\)])(\d+)$', text)
    if not m:
        return text, []

    clean = text[:m.start(2)]
    nums = _parse_digit_seq(m.group(2))
    return clean, nums


def _parse_digit_seq(s: str, first: int | None = None) -> list[int]:
    """將連續數字序列解析為遞增注腳編號

    "567" → [5,6,7]  "123456" → [1,2,3,4,5,6]
    first: 種子值，用於正確解析 "10111213" → [10,11,12,13]
    """
    if not s:
        return []
    nums = []
    i = 0
    while i < len(s):
        if len(nums) == 0:
            if first is not None:
                fstr = str(first)
                if s[i:i+len(fstr)] == fstr:
                    nums.append(first)
                    i += len(fstr)
                    continue
            nums.append(int(s[i]))
            i += 1
            continue

        expected = nums[-1] + 1
        e_str = str(expected)
        if s[i:i+len(e_str)] == e_str:
            nums.append(expected)
            i += len(e_str)
            continue
        nums.append(int(s[i]))
        i += 1
    return nums


def parse_fn_line(text: str, next_expected: int | None = None) -> list[int]:
    """從純數字行解析注腳編號，如 "7 8 9 1 0" → [7,8,9,10]"""
    tokens = re.findall(r'\d+', text)
    if not tokens:
        return []
    digits = ''.join(tokens)
    return _parse_digit_seq(digits, first=next_expected)


def is_fn_only(line: str) -> bool:
    """判斷是否為純注腳數字行"""
    return bool(re.match(r'^[\d\s]+$', line.strip()))


def detect_section(line: str) -> str | None:
    """偵測章節標題行"""
    for key, pat in SECTION_PATTERNS + ACTIVITY_PATTERNS:
        if pat.search(line):
            return key
    return None


# ===== 注釋解析 =====

def parse_annotation_section(raw_text: str, poem_num: int) -> list[dict]:
    """從注釋段落提取結構化注釋條目（原始格式，尚未映射位置）"""
    if not raw_text:
        return []

    entries = []
    # 按編號分割：匹配 "數字." 開頭
    parts = re.split(r'(?m)^(\d{1,2})\.\s*', raw_text)

    for i in range(1, len(parts), 2):
        num = int(parts[i])
        body = parts[i + 1].strip() if i + 1 < len(parts) else ''
        if not body:
            continue
        entry = _parse_entry(num, body)
        entries.append(entry)

    return entries


def _parse_entry(num: int, body: str) -> dict:
    colon_idx = body.find('：')
    if colon_idx < 0:
        return {'num': num, 'term': '', 'pronunciations': [], 'definition': body, 'children': []}

    term = body[:colon_idx].strip()
    rest = body[colon_idx + 1:].strip()
    prons, cleaned = _extract_pronunciations(rest)
    children = _parse_children(cleaned)
    return {'num': num, 'term': term, 'pronunciations': prons, 'definition': cleaned, 'children': children}


def _extract_pronunciations(text: str) -> tuple[list[dict], str]:
    prons = []
    cleaned = text

    # ○粵[同音字]，[粵拼]；○漢[漢語拼音]
    for m in re.finditer(
        r'○\s*粵\s*\[([^\]]+)\]\s*[，,]\s*\[([^\]]+)\]\s*[；;]?\s*○\s*漢\s*\[([^\]]+)\]',
        text
    ):
        prons.append({'dialect': 'yue', 'homophone': m.group(1).strip(), 'phonetic': m.group(2).strip()})
        prons.append({'dialect': 'cmn', 'homophone': '', 'phonetic': m.group(3).strip()})
        cleaned = cleaned.replace(m.group(0), '')

    # 單獨粵音
    for m in re.finditer(r'○\s*粵\s*\[([^\]]+)\]\s*[，,]\s*\[([^\]]+)\]', cleaned):
        if not any(p.get('dialect') == 'yue' and p.get('phonetic') == m.group(2).strip() for p in prons):
            prons.append({'dialect': 'yue', 'homophone': m.group(1).strip(), 'phonetic': m.group(2).strip()})
        cleaned = cleaned.replace(m.group(0), '')

    # 單獨漢音
    for m in re.finditer(r'○\s*漢\s*\[([^\]]+)\]', cleaned):
        prons.append({'dialect': 'cmn', 'homophone': '', 'phonetic': m.group(1).strip()})
        cleaned = cleaned.replace(m.group(0), '')

    return prons, re.sub(r'\n{3,}', '\n', cleaned).strip()


def _parse_children(text: str) -> list[dict]:
    children = []
    for m in re.finditer(r'^([^\d\n：]{1,6})：(.+)$', text, re.MULTILINE):
        children.append({
            'num': 0, 'term': m.group(1).strip(),
            'pronunciations': [], 'definition': m.group(2).strip(), 'children': []
        })
    return children


# ===== 注釋 → 注解模型轉換 =====

def build_annotations(
    raw_entries: list[dict],
    verse_fn_map: list[tuple[str, list[int]]],
    poem_title: str,
    poem_num: int
) -> list[Annotation]:
    """將原始注釋條目轉換為結構化注解模型，映射到文本範圍"""
    annotations: list[Annotation] = []
    ann_id_counter = 0

    # 建立 fn_num → verse_index
    fn_to_verse: dict[int, int] = {}
    for vi, (_, fn_nums) in enumerate(verse_fn_map):
        for fn in fn_nums:
            fn_to_verse[fn] = vi

    for entry in raw_entries:
        num = entry['num']
        term = entry.get('term', '')
        prons = entry.get('pronunciations', [])
        definition = entry.get('definition', '')
        children = entry.get('children', [])

        # 確定文本範圍
        text_range = _locate_range(num, term, fn_to_verse, verse_fn_map, poem_title)

        # 生成讀音注解
        for p in prons:
            ann_id_counter += 1
            phonetic_text = ''
            if p.get('homophone'):
                phonetic_text = f"同音字：{p['homophone']}；"
            phonetic_text += f"讀音：[{p['phonetic']}]"
            annotations.append(Annotation(
                id=f'{poem_num}-{ann_id_counter}',
                range=dict(text_range) if text_range else {'type': 'full', 'scope': 'full_text'},
                kind='pronunciation',
                lang=p['dialect'],
                text=phonetic_text,
                source='edb',
            ))

        # 生成語義注解（定義）
        # 清理 definition：移除開頭的標點和空格
        clean_def = definition.lstrip('。，、：；！？\s')
        # 移除末尾無意義的數字（可能是頁碼殘留）
        clean_def = re.sub(r'\d+$', '', clean_def).strip()
        if clean_def and len(clean_def) > 1:
            ann_id_counter += 1
            annotations.append(Annotation(
                id=f'{poem_num}-{ann_id_counter}',
                range=dict(text_range) if text_range else {'type': 'full', 'scope': 'full_text'},
                kind='semantic',
                text=clean_def,
                source='edb',
            ))

        # 處理子注釋
        for child in children:
            child_term = child.get('term', '')
            if child_term:
                child_range = _locate_child_range(child_term, text_range, verse_fn_map)
            else:
                child_range = text_range

            child_def = child.get('definition', '').strip()
            child_def = re.sub(r'\d+$', '', child_def).strip()
            if child_def and len(child_def) > 1:
                ann_id_counter += 1
                annotations.append(Annotation(
                    id=f'{poem_num}-{ann_id_counter}',
                    range=dict(child_range) if child_range else {'type': 'full', 'scope': 'full_text'},
                    kind='semantic',
                    text=child_def,
                    source='edb',
                ))

    return annotations


def _locate_range(
    fn_num: int,
    term: str,
    fn_to_verse: dict[int, int],
    verse_fn_map: list[tuple[str, list[int]]],
    poem_title: str
) -> TextRange | None:
    """定位注釋條目在文本中的範圍"""
    if not term:
        return None

    vi = fn_to_verse.get(fn_num)

    if vi is not None and vi < len(verse_fn_map):
        verse_text = verse_fn_map[vi][0]
        pos = _find_term(verse_text, term)
        if pos:
            return TextRange(
                type='range', scope='verse',
                verseIndex=vi, start=pos[0], end=pos[1]
            )

    # 嘗試在所有詩句中搜尋
    for alt_vi, (alt_text, _) in enumerate(verse_fn_map):
        pos = _find_term(alt_text, term)
        if pos:
            return TextRange(
                type='range', scope='verse',
                verseIndex=alt_vi, start=pos[0], end=pos[1]
            )

    # 嘗試在標題中搜尋
    pos = _find_term(poem_title, term)
    if pos:
        return TextRange(
            type='range', scope='title',
            start=pos[0], end=pos[1]
        )

    return None


def _locate_child_range(
    child_term: str,
    parent_range: TextRange | None,
    verse_fn_map: list[tuple[str, list[int]]]
) -> TextRange | None:
    """定位子注釋的範圍（通常和父注釋在同一範圍內）"""
    if not parent_range or parent_range.get('scope') != 'verse':
        return parent_range

    vi = parent_range.get('verseIndex', -1)
    if vi < 0 or vi >= len(verse_fn_map):
        return parent_range

    verse_text = verse_fn_map[vi][0]
    pos = _find_term(verse_text, child_term)
    if pos:
        return TextRange(
            type='range', scope='verse',
            verseIndex=vi, start=pos[0], end=pos[1]
        )
    return parent_range


def _find_term(text: str, term: str) -> tuple[int, int] | None:
    """在文本中找到詞條的位置"""
    idx = text.find(term)
    if idx >= 0:
        return (idx, idx + len(term))
    return None


# ===== 主處理流程 =====

def reprocess_poem(num: int) -> Poem | None:
    raw_path = RAW_DIR / f'{num:03d}.txt'
    if not raw_path.exists():
        print(f'  [{num:3d}] SKIP')
        return None

    raw = raw_path.read_text(encoding='utf-8')
    lines = parse_raw_lines(raw)
    if not lines:
        print(f'  [{num:3d}] EMPTY')
        return None

    title, author = POEM_META[num]

    # 1. 定位章節邊界
    section_starts: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        key = detect_section(line)
        if key:
            section_starts.append((i, key))

    verse_end = section_starts[0][0] if section_starts else len(lines)
    raw_verse_area = lines[:verse_end]

    # 2. 解析詩句
    title_line = raw_verse_area[0] if raw_verse_area else ''
    _, title_fn = extract_trailing_fn(title_line)
    max_fn = max(title_fn) if title_fn else 0

    verse_fn_map: list[tuple[str, list[int]]] = []
    verse_output: list[VerseLine] = []
    pending_fn: list[int] = []

    for i in range(1, len(raw_verse_area)):
        line = raw_verse_area[i].strip()
        if not line:
            continue

        if is_fn_only(line):
            fn_nums = parse_fn_line(line, max_fn + 1 if max_fn else None)
            pending_fn.extend(fn_nums)
            if fn_nums:
                max_fn = max(max_fn, max(fn_nums))
            continue

        clean, trailing = extract_trailing_fn(line)
        all_fn = pending_fn + trailing
        pending_fn = []
        if trailing:
            max_fn = max(max_fn, max(trailing))

        if not clean.strip() or not HAN_RE.search(clean):
            continue

        verse_fn_map.append((clean, all_fn))
        verse_output.append(VerseLine(text=clean))

    # 標題行注腳 → 第一行詩句
    if title_fn and verse_fn_map:
        text, existing = verse_fn_map[0]
        verse_fn_map[0] = (text, title_fn + existing)

    # 3. 解析章節
    sections: dict[str, str] = {}
    for si, (start_idx, key) in enumerate(section_starts):
        end_idx = section_starts[si + 1][0] if si + 1 < len(section_starts) else len(lines)
        content = '\n'.join(lines[start_idx + 1:end_idx]).strip()
        sections[key] = content

    # 4. 解析注釋條目 → 轉換為注解模型
    raw_ann = parse_annotation_section(sections.get('annotations', ''), num)
    annotations = build_annotations(raw_ann, verse_fn_map, title, num)

    # 統計
    mapped = sum(1 for a in annotations if a['range'].get('scope') in ('verse', 'title'))
    print(f'  [{num:3d}] {title} — {len(verse_output)} 句, {len(sections)} 段, '
          f'{len(annotations)} 注解 ({mapped} 已定位)')

    return Poem(
        num=num, title=title, author=author,
        verses=verse_output, sections=sections,
        annotations=annotations,
    )


def main():
    poems: list[Poem] = []
    print('📝 重新處理詩文資料 v2...\n')

    for num in range(1, 101):
        poem = reprocess_poem(num)
        if poem:
            poems.append(poem)

    SITE_DATA.mkdir(parents=True, exist_ok=True)
    out_path = SITE_DATA / 'poems.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(poems, f, ensure_ascii=False, indent=2)

    print(f'\n✅ 完成！{len(poems)} 首詩文 → {out_path}')

    # 驗證
    total_ann = sum(len(p['annotations']) for p in poems)
    located = sum(1 for p in poems for a in p['annotations']
                  if a['range'].get('scope') in ('verse', 'title'))
    print(f'   注解總數：{total_ann}，已定位：{located} ({located*100//max(total_ann,1)}%)')


if __name__ == '__main__':
    main()
