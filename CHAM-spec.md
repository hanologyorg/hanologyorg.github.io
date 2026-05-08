# CHAM — Classical Han with Annotations Markdown

## 1. 概述

CHAM 是古典漢文的結構化標記格式，設計為古漢文數位圖書館的 single source of truth。

### 1.1 設計原則

- **顯式宣告**：所有語義由語法明確表達，不依賴慣例推斷
- **通用性**：不限詩歌，支援所有古典漢文體裁（詩、詞、散文、經、史、賦、戲曲）
- **可擴展**：注釋類型 (kind) 開放，未來可增加
- **往返等價**：CHAM → 結構化資料 → CHAM，語義等價（不需位元組一致）
- **人機兼顧**：可手動編輯，也可程式解析

### 1.2 範圍

CHAM 檔案處理：
- 文本內容（帶行內注釋標記）
- 注釋條目（發音、語義、人名、地名、事件、典故、古注、今譯等）
- 多層注釋（不同貢獻者的獨立注釋層）

CHAM 檔案**不**處理：
- 作者簡介、背景、賞析等散文內容（普通 Markdown，見 §3.3）
- 全局發音詞表（見 §8）
- 註冊表資料（見 §9）

---

## 2. 檔案結構

### 2.1 目錄佈局

`content/` 下的每個子資料夾是一個 **CHAM 資料夾**，分兩種：

| 類型 | 識別方式 | 內容 |
|------|----------|------|
| **篇章資料夾** | 含 `text.cham.md` | 一篇獨立文本（一首詩、一章） |
| **書籍資料夾** | 含 `book.yaml` | 書籍元資料 + 子資料夾（各篇章） |

**獨立篇章**（詩歌、散文）：

```
content/
  001_垓下歌/
    text.cham.md
    author-brief.md
  002_大風歌/
    text.cham.md
```

**書籍**（多章節文本）：

```
content/
  老子/
    book.yaml
    01_第一章/
      text.cham.md
      wangbi.cham.md
      hesonggong.cham.md
    02_第二章/
      text.cham.md
      wangbi.cham.md
      hesonggong.cham.md
```

**多部書並存**：

```
content/
  001_垓下歌/
    text.cham.md
  老子/
    book.yaml
    01_第一章/
      text.cham.md
      wangbi.cham.md
  論語/
    book.yaml
    01_學而/
      text.cham.md
```

書籍資料夾可巢狀（多卷、分部）：

```
content/
  詩經/
    book.yaml
    國風/
      book.yaml
      01_關雎/
        text.cham.md
      02_葛覃/
        text.cham.md
    小雅/
      book.yaml
      01_鹿鳴/
        text.cham.md
```

### 2.2 book.yaml（書籍元資料）

書籍資料夾根目錄的 `book.yaml` 提供書籍層級的元資料：

```yaml
id: laozi-boomian-a              # 書籍 ID（全域唯一）
title: 帛書老子 甲本               # 書名
title-en: Book of Laozi on Silk, Version A  # 可選
contributors:                     # 可選
  - ref: Laozi                    # 引用 data/authors.yaml
    role: author
date:                             # 可選
  dynasty: 周
  circa: true
genre: prose                      # poetry | prose | mixed | drama
description: 馬王堆帛書老子甲本    # 可選
```

**繼承規則**：篇章 frontmatter 可省略 `book.yaml` 已提供的欄位（`contributors`、`date`、`genre`），解析器自動繼承最近的祖先 `book.yaml`。若篇章 frontmatter 明確宣告，以篇章為準。

範例——書籍資料夾 `老子/book.yaml` 宣告 `contributors: Laozi`、`genre: prose`，則各章的 `text.cham.md` 只需：

```yaml
id: 1
title: 第一章
```

無需重複 `contributors`、`date`、`genre`。

### 2.3 篇章資料夾檔案清單

| 檔案 | 類型 | 必要 | 說明 |
|------|------|:----:|------|
| `text.cham.md` | CHAM 主檔 | **是** | 文本 + 行內標記 + 注釋（見 §3） |
| `*.cham.md`（其他） | CHAM 從檔 | 否 | 古注、譯文等注釋層（見 §6） |
| `author-brief.md` | Markdown | 否 | 作者簡介 |
| `background.md` | Markdown | 否 | 創作背景 |
| `analysis.md` | Markdown | 否 | 文本賞析 |
| `follow-up.md` | Markdown | 否 | 延伸活動 |
| `think-questions.md` | Markdown | 否 | 思考問題 |
| `preparation.md` | Markdown | 否 | 教學準備 |

### 2.4 命名規則

- CHAM 檔案：`*.cham.md` 副檔名
- 主檔命名不限，約定為 `text.cham.md`
- 從檔命名不限，建議以貢獻者或性質命名（如 `wangbi.cham.md`、`modern-trans.cham.md`）
- 篇章資料夾命名：`NNN_標題/`，序號為排序用，與 frontmatter `id` 獨立
- 書籍資料夾命名不限（如 `老子/`、`論語/`），需要排序時可加前綴（如 `01_大學/`）
- 標題部分為人類可讀的短標識，非必要與 frontmatter `title` 一致

### 2.5 普通 Markdown 檔案

作者簡介、背景、賞析、教學活動等為普通 `.md` 檔案，非 CHAM。
這些是編輯性內容，不含注釋標記。標準檔案名稱見 §2.3 檔案清單。

---

## 3. CHAM 檔案格式

### 3.1 整體結構

```markdown
---
(YAML frontmatter)
---

(文字塊 + 行內標記)

## 注釋
(注釋條目)

## [其他注釋層]
@key: value
(注釋條目)
```

### 3.2 YAML Frontmatter

主檔必要欄位：

```yaml
id: 1                    # 文章 ID（數字或字串）
title: 第一章             # 標題
contributors:            # 貢獻者（可由 book.yaml 繼承）
  - ref: A001            # 引用 authors.yaml
    role: author          # 角色：author | editor | annotator | translator
date:                    # 日期（可由 book.yaml 繼承）
  dynasty: 周             # 朝代
  era: 正始              # 年號（可選）
  era_year: 1            # 年號紀年（可選）
  sexagenary: 甲子       # 天干地支（可選）
  iso: 240               # 公元紀年（可選）
  circa: true            # 約略年代（可選）
genre: prose             # poetry | prose | mixed | drama（可由 book.yaml 繼承）
```

若篇章屬於書籍資料夾（上層有 `book.yaml`），`contributors`、`date`、`genre` 可省略，由最近的祖先 `book.yaml` 繼承（見 §2.2）。

從檔必要欄位：

```yaml
base: text.cham.md       # 指向主檔
contributor: A010        # 貢獻者 ID
role: annotator          # 角色
dynasty: 三國（魏）       # 朝代
nature: commentary       # 注釋層性質
```

### 3.3 文字塊

文字塊是 CHAM 的主要內容單元。以空行數決定語義：

| 空行數 | 語義 | 說明 |
|--------|------|------|
| 0（連續行） | 接續 | 同一文字塊，編輯器換行不計入注釋偏移 |
| 1（一行空行） | 文字塊邊界 | 新詩行 / 新段落 |
| 2+（兩行以上空行） | 結構斷裂 | 詩段 / 章 / 節 |

**詩歌**——每行後空一行：

```
力拔山兮氣蓋世。

時不利兮{1}騅{/1}不逝。

{1}騅{/1}不逝兮可奈何！


虞兮虞兮{2}奈若何{/2}！
```

2 個 section，4 個文字塊。

**散文**——接續行不中斷，段落間空一行：

```
{1}道{/1}可道，非常{2}道{/2}。
{3}名{/3}可名，非常{4}名{/4}。

無名天地之始，有名萬物之母。
故常無欲，以觀其妙；
常有欲，以觀其徼。
```

1 個 section，2 個文字塊。接續行合併為一個字串，換行符不計入注釋偏移。

### 3.4 行內標記

#### 語法

- `{N}` — 範圍起點（零寬度）
- `{/N}` — 範圍終點（零寬度）
- 單字 = 長度 1 的範圍：`{1}騅{/1}`
- 位置 = 長度 0 的範圍：`{2}{/2}`

#### 特性

- 標記為零寬度，不包裹文字
- 清除標記即得純文字：`時不利兮{1}騅{/1}不逝。` → `時不利兮騅不逝。`
- 支援重疊範圍：

```
{1}力拔{2}山兮{/1}氣蓋{/2}世。
```
範圍 1：力拔山兮，範圍 2：山兮氣蓋（重疊區：山兮）

- 支援封入範圍：

```
{1}奈{2}若何{/2}{/1}！
```
範圍 1：奈若何，範圍 2：若何（範圍 2 被範圍 1 封入）

- 標記不可巢狀重疊時造成語法歧義（`{1}{2}{/1}{/2}` 允許，`{1}{2}{/1}` 不允許——未閉合）
- N 為正整數，每個 CHAM 檔案內唯一
- 多位數 ID 支援：`{12}`, `{/12}`

#### 偏移量計算

- 在文字塊合併後的字串上計算（接續行的換行符不計入）
- 標點字元計入偏移
- 標記本身（`{N}`, `{/N}`）不計入

---

## 4. 注釋條目

### 4.1 語法

```
target kind params [headword][value]
target kind params [value]
```

### 4.2 target（定位方式）

| target | 語義 | 適用 |
|--------|------|------|
| `{N}` | 行內標記引用 | 主檔：引用 `{N}`/`{/N}` 定義的範圍 |
| `文字` | 模式匹配 | 全局詞表用（見 §8） |
| `@title` | 標題文字 | 注釋目標為標題 |
| `@full` | 全部詩文 | 注釋目標為整篇文本 |
| `@verse:L:C` | 指定位置 | 第 L 文字塊第 C 字元起（罕用） |

### 4.3 kind（注釋類型）

kind 為開放式枚舉。每種 kind 有自己的參數規則：

| kind | 必要參數 | 值格式 | 說明 |
|------|----------|--------|------|
| `pron` | `type`, `lang` | `[val]` 或 `[char][val]` | 發音（含多音字覆蓋） |
| `meaning` | — | `[explanation]` 或 `[headword][explanation]` | 語義注釋 |
| `person` | `ref` | `[name][brief]` 或 `[brief]` | 人名 |
| `place` | — | `[name][desc]` 或 `[desc]` | 地名（可選 `ref`） |
| `event` | — | `[name][desc]` 或 `[desc]` | 歷史事件（可選 `ref`） |
| `date` | — | `[text][desc]` | 時間參照（可選 `dynasty`, `era`, `year`, `iso`） |
| `allusion` | — | `[quote][explanation]` | 典故（可選 `source`） |
| `commentary` | — | `[text]` | 古注 |
| `translation` | — | `[text]` | 今譯 |
| 擴展 | 自定義 | 自定義 | 未來種類 |

### 4.4 params（參數）

參數為 `key:value` 空格分隔，位於 kind 之後、方括號之前：

```
{3} pron type:hom lang:yue [錐]
{5} person ref:A020 [皋陶][舜帝理官]
{7} date dynasty:唐 era:開元 year:15 iso:727 [開元十五年]
{4} allusion source:詩經·采薇 [昔我往矣][出自《詩經·小雅·采薇》]
```

發音參數：

| 參數 | 值 | 說明 |
|------|-----|------|
| `type` | `hom` / `jyut` / `pinyin` / `bopomofo` | 發音系統 |
| `lang` | `yue` / `cmn` | 語言變體 |

### 4.5 方括號值

- **一組** `[value]`：headword 預設為行內標記匹配的文字
- **兩組** `[headword][value]`：headword 為被解釋的詞（可能 ≠ 範圍全文）

單行值：
```
{1} meaning [騅][項羽的馬名]
```

多行值——`[` 開頭，`]` 獨佔一行結尾：
```
{2} meaning [奈何][
「奈何」意為「怎麼辦」。
全句即「把你怎麼辦呢」。

表達了項羽對虞姬的深情與無奈。
]
```

多行值內可包含任何中文標點、空行、段落。`]` 獨佔一行（前後無其他字元）時結束。

### 4.6 完整條目範例

```markdown
## 注釋

{1} pron type:hom lang:yue [錐]
{1} pron type:jyut lang:yue [zeoi1]
{1} pron type:pinyin lang:cmn [zhuī]
{1} meaning [騅][項羽的馬名]

{2} meaning [奈何][
「奈何」意為「怎麼辦」。
全句即「把你怎麼辦呢」。
]

{3}皋陶{/3} pron type:pinyin lang:cmn [gāo yáo]
{3} person ref:A020 [皋陶][舜帝時代理官，中國司法鼻祖]

{4} place ref:P001 [垓下][今安徽省靈璧縣東南]

{5} date dynasty:唐 era:開元 year:15 iso:727 [開元十五年]

{6} allusion source:詩經·采薇 [昔我往矣][
出自《詩經·小雅·采薇》。
原句為「昔我往矣，楊柳依依」。
]

{7} @title pron type:hom lang:yue [垓][該]
{8} @full meaning [全詩以「兮」字貫穿四句，反覆詠嘆。]
```

---

## 5. 注釋區段與元資料

### 5.1 區段結構

CHAM 檔案可含多個 `##` 注釋區段，每個區段是一個注釋層：

```markdown
## 注釋
(現代注釋條目)

## 王弼註
@contributor: A010
@role: annotator
@dynasty: 三國（魏）
@era: 正始
@era_year: 1
@iso: 240
@nature: commentary
(王弼注條目)

## 白話譯文
@contributor: A050
@role: translator
@nature: translation
(譯文條目)
```

所有區段共享同一組行內標記 `{N}`。

### 5.2 區段元資料

`@key: value` 行緊接在 `## 標題` 之後，至第一個非 `@` 行結束：

| key | 說明 |
|-----|------|
| `@contributor` | 貢獻者 ID（引用 authors.yaml） |
| `@role` | 角色：annotator / translator / editor |
| `@dynasty` | 朝代 |
| `@era` | 年號 |
| `@era_year` | 年號紀年 |
| `@iso` | 公元紀年 |
| `@nature` | 注釋層性質：annotation / commentary / translation / exegesis / notes |

`## 注釋` 預設區段可省略元資料（預設 nature=annotation）。

---

## 6. 多檔關聯

### 6.1 主檔

- 包含文本 + `{N}`/`{/N}` 行內標記
- 可含注釋條目
- frontmatter 中 `base` 省略

### 6.2 從檔

- frontmatter 中 `base: text.cham.md` 指向主檔
- 不含文本和行內標記
- 只含注釋條目，`{N}` 引用主檔的標記
- 擁有自己的貢獻者、日期、性質元資料

### 6.3 合併規則

1. 解析器載入主檔，建立標記表（marker ID → 文字塊 + 偏移 + 長度）
2. 載入同目錄所有 `*.cham.md` 從檔
3. 從檔的注釋條目引用主檔標記
4. 所有注釋合併，區段名稱不重複

### 6.4 使用選擇

- 簡單文本（詩歌）：單檔模式，所有注釋在 `text.cham.md`
- 複雜文本（經典）：多檔模式，不同注釋層分離

兩種模式語法完全相容，差異僅在檔案組織。

---

## 7. 三層注釋架構

### 7.1 層級

| 層級 | 來源 | 作用域 | 覆蓋規則 |
|------|------|--------|----------|
| 1. 全局詞表 | `data/lexicon.yaml` | 所有文本 | 最弱 |
| 2. 主檔行內 | `text.cham.md` 注釋條目 | 單篇文本 | 覆蓋全局 |
| 3. 從檔 | `*.cham.md` 從檔 | 單篇文本 | 覆蓋全局 |

在同一位置：行內 > 全局。不同 kind 之間不覆蓋（`pron` 和 `meaning` 並存）。

### 7.2 全局詞表處理

1. 載入 `data/lexicon.yaml`
2. 掃描文本中所有匹配字元/詞組
3. 為每個匹配自動建立注釋實例
4. 若同一位置有行內 `pron` 條目，以行內為準
5. 全局詞表只有 `pron` 類型（語義注釋永遠位置特定）

---

## 8. 全局詞表

### 8.1 格式

`data/lexicon.yaml`：

```yaml
騅:
  pron:
    - type:hom lang:yue [錐]
    - type:jyut lang:yue [zeoi1]
    - type:pinyin lang:cmn [zhuī]

行:
  pron:
    - type:pinyin lang:cmn [xíng]
    - type:pinyin lang:cmn [háng]

樂:
  pron:
    - type:hom lang:yue [落]
    - type:jyut lang:yue [lok6]
    - type:pinyin lang:cmn [lè]
    - type:pinyin lang:cmn [yuè]
```

### 8.2 多音字處理

全局詞表列出所有可能讀法。每個字第一條為**預設讀法**。
CHAM 行內 `pron` 條目覆蓋預設，指定實際讀法。

---

## 9. 註冊表

### 9.1 檔案清單

```
data/
  lexicon.yaml        # 發音詞表
  authors.yaml        # 人物（A0xx）— 不限作者
  dynasties.yaml      # 朝代註冊表
  eras.yaml           # 紀元表（652 行）
  sexagenary.yaml     # 天干地支對照
  places.yaml         # 地名（P0xx）
  events.yaml         # 事件（Exx）
```

### 9.2 authors.yaml

```yaml
A001:
  name: 項羽
  dynasty: 秦末
  bio: 項羽（前232—前202），名籍，字羽……

A010:
  name: 王弼
  dynasty: 三國（魏）
  bio: ……
```

ID 格式：`A` + 三位數字。ID 一旦分配不再變更。
`person` kind 的 `ref` 引用此檔（所有歷史人物共用 ID 空間）。

### 9.3 places.yaml

```yaml
P001:
  name: 垓下
  modern: 今安徽省靈璧縣東南
  geo: [33.28, 117.55]      # 可選：經緯度
```

### 9.4 events.yaml

```yaml
E001:
  name: 垓下之戰
  date: 前202
  description: 楚漢戰爭最後決戰
```

### 9.5 dynasties.yaml / eras.yaml / sexagenary.yaml

見 TODO.cham/02-dynasty-registry.md 詳細規格。

---

## 10. 處理管線

```
data/lexicon.yaml ─────────┐
                           │
content/                   │
  NNN_標題/ (篇章) ────────┤
    text.cham.md ──────────┤
    *.cham.md (從檔) ──────┤
    *.md (散文) ───────────┤──→ CHAM 解析器 ──→ 合併 ──→ JSON
  書籍/                    │                        │
    book.yaml ─────────────┤                        ↓
    NNN_篇章/ ─────────────┤                  cham.json
      text.cham.md ────────┤                  text.json
      *.cham.md ───────────┤                  authors.json
      *.md ────────────────┤                  metadata.json
      *.md ────────────────┤
                           │
data/authors.yaml ─────────┤
data/places.yaml ──────────┤
data/events.yaml ──────────┘
```

### 10.1 解析步驟

1. 載入全局詞表 `lexicon.yaml`
2. 遞迴掃描 `content/` 目錄：
   - 含 `text.cham.md` → 篇章資料夾
   - 含 `book.yaml` → 書籍資料夾，繼續遞迴其子目錄
3. 載入書籍元資料 `book.yaml`（若有），建立繼承上下文
4. 載入主檔（無 `base` 的 `.cham.md`）：
   a. 解析 YAML frontmatter，合併 `book.yaml` 繼承欄位
   b. 提取文字塊（空行切割）
   c. 解析行內標記 `{N}`/`{/N}` → 標記表
   d. 清除標記 → 純文字
5. 載入從檔（有 `base` 的 `.cham.md`）：
   a. 解析 YAML frontmatter（含 `base` 引用）
   b. 解析注釋條目（引用主檔標記）
6. 載入普通 `.md` 散文檔案
7. 套用全局詞表：
   a. 掃描純文字，匹配詞表中的字元/詞組
   b. 為每個匹配建立注釋實例
   c. 若同一位置有行內 `pron`，以行內為準
8. 合併輸出 JSON

### 10.2 輸出 JSON 格式

- `cham.json`：完整 CHAM 結構化資料（篇章 + 注釋 + 標記表，保留完整語義）
- `text.json`：前端消費用扁平格式（取代原有 `poems.json`，不限詩歌體裁）
- `authors.json`：人物註冊表
- `metadata.json`：書籍元資料（從各 `book.yaml` 合併）

---

## 11. 往返等價

### 11.1 保證

解析 → 序列化 → 再解析：兩次解析結果語義相同。

### 11.2 不保證

- 空白量完全一致
- 欄位順序完全一致
- YAML 引號風格一致
- 註解保留

### 11.3 等價規則

- 所有注釋條目的 kind、params、headword、value 相同
- 行內標記位置相同（文字塊、偏移、長度）
- frontmatter 所有欄位值相同
- 區段元資料相同

---

## 12. 附錄：完整範例

### A. 詩歌（單檔模式）

```markdown
---
id: 1
title: 垓下歌
contributors:
  - ref: A001
    role: author
date:
  dynasty: 秦末
  circa: true
genre: poetry
---

力拔山兮氣蓋世。

時不利兮{1}騅{/1}不逝。

{1}騅{/1}不逝兮可奈何！

虞兮虞兮{2}奈若何{/2}！

## 注釋

{1} meaning [騅][項羽的馬名]

{2} meaning [奈何][
「奈何」意為「怎麼辦」。
全句即「把你怎麼辦呢」。

表達了項羽對虞姬的深情與無奈。
]

{3} @title pron type:hom lang:yue [垓][該]

{4} @full meaning [
全詩以「兮」字貫穿四句，反覆詠嘆。
首句寫英雄氣概，末句寫兒女深情。
]
```

（`騅` 的發音由全局 lexicon.yaml 自動提供）

### B. 老子（書籍 + 多檔模式）

書籍資料夾 `老子/book.yaml`：

```yaml
id: laozi-boomian-a
title: 帛書老子 甲本
title-en: Book of Laozi on Silk, Version A
contributors:
  - ref: Laozi
    role: author
date:
  dynasty: 周
  circa: true
genre: prose
```

第一章主檔 `老子/01_第一章/text.cham.md`：

```markdown
---
id: 1
title: 第一章
---

{1}道{/1}可道，非常{2}道{/2}。
{3}名{/3}可名，非常{4}名{/4}。

{5}無名{/5}，天地之始；
{6}有名{/6}，萬物之母。

故常{7}無欲{/7}，以觀其{8}妙{/8}；
常{9}有欲{/9}，以觀其{10}徼{/10}。

此兩者同出而異名，同謂之{11}玄{/11}。
玄之又玄，眾妙之門。

## 注釋

{1} meaning [道][
道，宇宙的本源和根本規律。
第一個「道」指可以用語言描述的道。
]

{5} meaning [無名][
沒有具體名稱的狀態，指天地形成之前的混沌。
]

{11} meaning [玄][深奧、微妙。指道的深不可測。]
```

從檔 `老子/01_第一章/wangbi.cham.md`：

```markdown
---
base: text.cham.md
contributor: A010
role: annotator
dynasty: 三國（魏）
nature: commentary
---

{1} commentary [可道之道，可名之名，指事造形。非其常也。故不可道，不可名也。]

{5} commentary [凡物皆有始。始，本也。謂道為無，故能生萬物。]

{11} commentary [玄者，冥也。默然無有也。始，母之所出也。]
```

從檔 `老子/01_第一章/modern-trans.cham.md`：

```markdown
---
base: text.cham.md
contributor: A050
role: translator
nature: translation
---

{1} translation [可以說出來的道，就不是永恆不變的道。]

{3} translation [可以叫出來的名字，就不是永恆不變的名字。]

{5} translation [
「無名」是天地的開端；
「有名」是萬物的根本。
]

{11} translation [
此兩者同出一源而名稱不同，都可稱之為「玄」。
玄之又玄，是一切奧妙的門徑。
]
```
