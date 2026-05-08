# CHAM Source Folder Quality Rules

This document defines quality standards for CHAM source folders — what a well-formed collection looks like, common pitfalls, and rules that every `text.cham.md` must satisfy.

For the formal format specification, see `CHAM-spec.md`.

---

## 1. Directory Structure

### 1.1 Collection Layout

```
library/content/
  <collection-id>/
    book.yaml                          # required: collection metadata
    NNN_<title>/
      text.cham.md                     # required: primary CHAM file
      analysis.md                      # optional: literary analysis
      author-brief.md                  # optional: author biography
      background.md                    # optional: historical context
```

Every collection is a directory containing `book.yaml` and numbered subdirectories. Each subdirectory that contains a `text.cham.md` is a **piece**.

### 1.2 Rules

- `book.yaml` must exist at the collection root. The scanner skips directories without it.
- Piece subdirectories use `NNN_<title>/` naming. The numeric prefix sorts the pieces; it is independent of the `id` in frontmatter.
- Parentheses in directory names use full-width `（ ）`, not half-width `( )`. Example: `018_歸園田居（其三）/`.
- Only `.cham.md` and `.md` files belong inside piece directories. No PDFs, images, or generated artifacts.

---

## 2. Frontmatter (YAML)

### 2.1 Required Fields

```yaml
---
id: 14
title: 病牛
contributors:
  - ref: A189
    role: author
date:
  dynasty: 宋
genre: poetry
---
```

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Number or string. Unique within collection. |
| `title` | yes | Full title of the piece. |
| `contributors` | yes (unless inherited from `book.yaml`) | Array with `ref` + `role`. |
| `date.dynasty` | yes | Dynasty name. |
| `genre` | yes | One of: `poetry`, `prose`, `mixed`, `drama`. |

### 2.2 Author References

- `ref` values like `A189` must correspond to entries in `data/authors.yaml`.
- IDs are sequential: once assigned, never reused or changed.
- When creating new collections, allocate IDs in a range that doesn't collide with existing ones.

### 2.3 Common Mistakes

- Missing `role: author` on contributors.
- Using `dynasty:` at top level instead of nested under `date:`.
- Forgetting the closing `---` of the frontmatter.

---

## 3. Body Text

### 3.1 Poetry vs Prose Formatting

**Poetry**: one verse unit per line (couplet for regulated verse, natural line breaks for ci). Separate verse units with a blank line.

```
耕犁千畝{1}實{/1}千{2}箱{/2}，力盡筋疲誰復{3}傷{/3}？
{4}但得眾生{/4}{5}皆得飽{/5}，不辭{6}羸病{/6}臥{7}殘陽{/7}。
```

**Prose**: continuous text within a paragraph. No hard line breaks within a paragraph. Separate paragraphs with a single blank line.

```
余幼時即{1}嗜學{/1}。家貧，無從{2}致{/2}書以觀，每假借於藏書之家，手自筆錄，{3}計日以還{/3}。天大寒，{4}硯冰堅{/4}，手指不可屈伸，{5}弗之怠{/5}。

錄畢，{6}走送之{/6}，不敢稍{7}逾約{/7}。
```

### 3.2 Critical Rules

- **No hard line breaks in prose paragraphs.** The parser joins consecutive lines within a text block. If you wrap a prose paragraph at 80 characters, the parser will strip the newlines — but the source file is harder to read and diff. Keep prose paragraphs as single logical lines.
- **No extra blank lines between body and annotations.** Exactly one blank line separates the last body paragraph from `## 注釋`.
- **No page artifacts.** Remove page headers, page numbers, `--- PAGE BREAK ---` markers, and any OCR artifacts before creating the CHAM file.
- **No non-textual sections.** 「想一想」「活動」sections are editorial apparatus — they go in separate `.md` files (e.g., `follow-up.md`), never in `text.cham.md`.

### 3.3 Blank Line Semantics

The parser uses blank line counts to determine structure:

| Blank lines between content | Meaning |
|----------------------------|---------|
| 0 (consecutive lines) | Same text block (prose continuation) |
| 1 (one blank line) | New text block (new verse / new paragraph) |
| 2+ (multiple blank lines) | Structural break (stanza / chapter) |

For most poetry: use single blank lines between verse units, double blank lines between stanzas.

---

## 4. Annotation Markers

### 4.1 Marker Syntax

- `{N}` opens a range, `{/N}` closes it.
- `N` is a positive integer, unique within the file.
- Single-character annotation: `{1}騅{/1}` — marks "騅".
- Multi-character annotation: `{3}計日以還{/3}` — marks "計日以還".
- Adjacent markers are fine: `{50}假{/50}{51}諸{/51}`.

### 4.2 Marker Placement Rules

1. **Every `{N}` must have a matching `{/N}`.** Unbalanced markers cause parse failures or silent data loss.
2. **Every marker in the body must have at least one annotation entry.** Orphan markers (no corresponding entry in `## 注釋`) indicate incomplete work.
3. **Every annotation entry that targets `{N}` must reference a marker that exists in the body.** Orphan annotations (no matching marker) indicate a mismatch.
4. **Markers should wrap the minimum meaningful unit.** Prefer wrapping individual words/phrases rather than entire sentences. A marker like `{1}余幼時即嗜學家貧無從致書以觀{/1}` is too broad — split it into meaningful sub-annotations.
5. **Overlapping and nested markers are supported.** The parser handles `{1}力拔{2}山兮{/1}氣蓋{/2}世。` correctly. Use this when the same text has multiple annotations (e.g., a phrase annotation and a sub-word pronunciation).

### 4.3 Marker Numbering

- Number markers sequentially starting from 1, following the order they appear in the text.
- There is no requirement for consecutive numbering, but gaps (e.g., missing marker 7) usually indicate an error.
- The marker `id` is local to the file — different files can reuse the same numbers.

---

## 5. Annotation Definitions

### 5.1 Section Structure

The annotation section starts with `## 注釋` (or a custom section name for layered annotations):

```
## 注釋

{1} meaning [充實。]

{2} meaning [許許多多官府的糧倉。]

{6} pron type:hom lang:yue [雷；lœy4]
{6} pron type:pinyin lang:cmn [léi]
{6} meaning [瘦弱多病。]
```

### 5.2 Entry Format

```
{N} kind params [value]
{N} kind params [headword][value]
```

**kind** is one of: `meaning`, `pron`, `person`, `place`, `event`, `date`, `allusion`, `commentary`, `translation`.

**params** are `key:value` pairs separated by spaces, placed between kind and `[`.

### 5.3 Pronunciation Entries

When a source annotation includes pronunciation data (Cantonese homophone + Jyutping, or Mandarin pinyin), split it into separate `pron` entries:

Source: `羸：○粵[雷]，[lœy4]；○漢[léi]。`

CHAM output:
```
{6} pron type:hom lang:yue [雷；lœy4]
{6} pron type:pinyin lang:cmn [léi]
{6} meaning [瘦弱多病。]
```

Rules:
- `pron` entries always come **before** the `meaning` entry for the same marker.
- `type:hom` provides the Cantonese homophone character and Jyutping in `[同音字；Jyutping]` format.
- `type:pinyin` provides Mandarin pinyin with tone marks.
- `lang:yue` for Cantonese, `lang:cmn` for Mandarin.
- The pronunciation values go inside `[]`. Use `；` (full-width semicolon) to separate the homophone from Jyutping.

### 5.4 Pronunciation Normalization

- **Pinyin values must use standard Latin characters.** Replace IPA characters with their ASCII equivalents:
  - `ɑ` (U+0251) → `a` (U+0061)
  - `ɡ` (U+0261) → `g` (U+0067)
  - Bad: `[chɑ́nɡ]` — Good: `[cháng]`
  - Bad: `[ɡuɑ̀n]` — Good: `[guàn]`
- **Tone marks use combining diacritics** on standard vowels: `ā á ǎ à`, `ē é ě è`, `ī í ǐ ì`, `ō ó ǒ ò`, `ū ú ǔ ù`, `ǖ ǘ ǚ ǜ`.
- **Every `pron type:hom` should be paired with `pron type:pinyin`** (and vice versa) when the source provides both Cantonese and Mandarin readings. If only one is available, include only that one.
- **Every marker with `pron` entries should also have a `meaning` entry.** A pronunciation-only marker leaves the reader without a definition.

### 5.5 Empty Definitions

- **Do not leave empty definitions.** The pattern `字：。` (character followed by colon and period with no explanation) is incomplete. If the source provides a character heading but no definition, either:
  - Find the definition from context and fill it in, or
  - Remove the annotation marker from the body text entirely.
- If a marker genuinely needs no definition (e.g., a pure pronunciation note), include a brief meaning like `{N} meaning [同音字標注。]`.

### 5.6 Bracket Rules

1. **Every `[` must have a matching `]`.** Unbalanced brackets cause the parser to enter multi-line mode or fail.
2. **No nested `[]` inside annotation values.** If the definition text contains brackets, use full-width `（ ）` instead. Example:
   ```
   {15} meaning [被：穿著也。綺繡：彩色絲織品（綾羅綢緞）。]
   ```
   NOT: `{15} meaning [被：穿著也。綺繡：彩色絲織品[綾羅綢緞]。]`
3. **Multi-line values** use `[` on the opening line and `]` alone on the closing line:
   ```
   {1} meaning [
   奇字可解單數和特出，本詩描敘的樹並不奇特，
   故宜解作挺立在庭院中的那一棵樹。
   ]
   ```
4. **Single-line values** keep `[]` on one line:
   ```
   {2} meaning [得到。]
   ```

### 5.7 Entry Spacing

- Place a blank line between annotation entries for readability.
- Do not place blank lines between `pron` and `meaning` entries for the same marker — keep them grouped:

```
{6} pron type:hom lang:yue [雷；lœy4]
{6} pron type:pinyin lang:cmn [léi]
{6} meaning [瘦弱多病。]

{7} meaning [快要下山的太陽。]
```

### 5.8 Empty Annotations

If a piece has no annotations (e.g., modern prose like 背影), include an empty annotation section:

```
## 注釋
```

This signals that the absence is intentional, not an oversight.

---

## 6. Text Integrity

### 6.1 Fidelity to Source

- **Do not alter the classical text.** The body text must be an exact transcription of the source material (PDF, book scan, etc.). Modernization, simplification, or "corrections" are not allowed without explicit source justification.
- **Do not add punctuation that isn't in the source.** If the source has no punctuation (e.g., oracle bone inscriptions), keep it unpunctuated.
- **Do not reorder lines.** Maintain the original verse or paragraph order.

### 6.2 Character Variants

- Use the exact characters from the source. If the source uses `羣` (with 君), don't normalize to `群` (with 羊).
- If a source has a known variant noted in annotations (e.g., `冰：一作「水」`), keep the main text as-is and note the variant in the annotation.

---

## 7. Prose Files (Non-CHAM Markdown)

Files like `author-brief.md`, `background.md`, and `analysis.md` are plain Markdown — no CHAM markup, no YAML frontmatter.

### 7.1 Content Extraction

When extracting from PDF source material:
- Remove page headers (e.g., `《積學與涵泳——中學古詩文誦讀材料選編》`).
- Remove page numbers.
- Remove `--- PAGE BREAK ---` markers.
- Remove editorial sections unrelated to the named file's purpose (e.g., don't include 「想一想」 in `analysis.md`).
- Clean up OCR artifacts (fragmented lines, stray numbers).

### 7.2 When to Create Prose Files

| File | Primary-culture | NSS | Secondary |
|------|-----------------|-----|-----------|
| `author-brief.md` | no (short pieces) | yes | yes |
| `background.md` | no | yes | yes |
| `analysis.md` | yes (簡析) | yes (賞析重點) | yes |

### 7.3 Paragraph Formatting

**Strict rule: do not alter text content — only fix formatting.**

- Each paragraph must be a single line of text. Remove hard line breaks (join continuation lines within the same paragraph).
- Separate paragraphs with exactly one blank line.
- Do not add, remove, or modify any characters, punctuation, or wording.

Example — before cleanup (hard-wrapped from PDF extraction):
```
這是一曲末路英雄的悲歌。項羽在八年的領兵生涯中，所向披靡，身經大小
七十餘戰，未嘗敗北，尤其是與劉邦的爭霸天下，劉邦每戰皆敗，自己卻屢戰屢
勝，但如今被圍在垓下，耳聞四面楚歌，面臨一敗塗地的局面，就連愛妾虞姬亦
且不保，憤慨之情難以抑制，深深覺得命運弄人。
「力拔山兮氣蓋世」，項羽不僅自誇力氣大，足可以拔山，也自負有叱吒風雲，
逐鹿中原的蓋世才幹，但這一切都已成為過去。
```

After cleanup:
```
這是一曲末路英雄的悲歌。項羽在八年的領兵生涯中，所向披靡，身經大小七十餘戰，未嘗敗北，尤其是與劉邦的爭霸天下，劉邦每戰皆敗，自己卻屢戰屢勝，但如今被圍在垓下，耳聞四面楚歌，面臨一敗塗地的局面，就連愛妾虞姬亦且不保，憤慨之情難以抑制，深深覺得命運弄人。

「力拔山兮氣蓋世」，項羽不僅自誇力氣大，足可以拔山，也自負有叱吒風雲，逐鹿中原的蓋世才幹，但這一切都已成為過去。
```

### 7.4 Footnote Number Removal

Remove stray footnote numbers that appear after punctuation:

- Remove: `。1` → `。`, `？2` → `？`, `﹖3` → `﹖` (isolated Arabic digits after sentence-ending punctuation)
- Remove: digits at the end of text that are clearly footnote references, not content

**Keep** the following:
- Years: `(1278)`, `公元前 770 年`
- Quantities: `三章`, `八個`, `四首`
- Section references: `第三章第二節`
- Any semantically meaningful number

Pattern: only remove isolated Arabic digits immediately following sentence-ending punctuation (`。！？﹖；`).

---

## 8. Validation Checklist

Before submitting a CHAM folder, verify:

### Parse Check
- [ ] `parse()` succeeds without errors
- [ ] `doc.meta.title` is present
- [ ] `doc.meta.id` is present

### Marker Balance
- [ ] Every `{N}` in the body has a matching `{/N}`
- [ ] Every marker ID in the body has at least one annotation entry
- [ ] Every annotation entry targeting `{N}` references a marker that exists in the body
- [ ] Marker numbering is sequential (no gaps without justification)

### Bracket Balance
- [ ] Every `[` in the annotations section has a matching `]`
- [ ] No nested `[]` in annotation values (use `（ ）` instead)
- [ ] No raw pronunciation notation inside `meaning` values (`○粵[...]`)

### Pronunciation
- [ ] Pinyin values use standard Latin characters (no IPA `ɑ`, `ɡ`)
- [ ] `pron type:hom` entries are paired with `pron type:pinyin` where source provides both
- [ ] Markers with `pron` also have `meaning` entries

### Content Integrity
- [ ] Body text matches the source exactly (no character changes)
- [ ] No page artifacts remain (headers, page numbers, PAGE BREAK markers)
- [ ] No stray footnote digits after punctuation (`。1`, `？2`)
- [ ] No editorial sections in the body (想一想, 活動)
- [ ] No empty definitions (`字：。`)
- [ ] No dual annotation systems (old-style + CHAM coexisting)

### Formatting
- [ ] Prose: no hard line breaks within paragraphs
- [ ] Poetry: one verse unit per line, blank line between units
- [ ] Annotation entries separated by blank lines
- [ ] `pron` entries grouped with their `meaning` entry

### Frontmatter
- [ ] YAML frontmatter is complete (id, title, contributors, date, genre)
- [ ] `date.dynasty` is present and correct (not empty)
- [ ] `genre` field is present (or inherited from `book.yaml`)
- [ ] All `ref` values in `contributors` exist in `data/authors.yaml`

### File Structure
- [ ] `text.cham.md` exists
- [ ] `book.yaml` exists at collection root
- [ ] Directory name uses full-width `（ ）` for parentheses
- [ ] Prose files have proper paragraph separation (no single-line dumps)

### Cross-Reference
- [ ] Author refs (A-IDs) have entries in `authors.yaml`
- [ ] Author names are correct (not sentence fragments)
- [ ] Dynasty values in authors are historically accurate

---

## 9. Common Antipatterns

### 9.1 Hard-Wrapped Prose

Bad:
```
余幼時即{1}嗜學{/1}。家貧，無從{2}致{/2}書以觀，每假借於
藏書之家，手自筆錄，{3}計日以還{/3}。
```

The parser will join these lines, but diffs and reviews become harder. Keep prose as single lines.

### 9.2 Brackets Inside Brackets

Bad:
```
{15} meaning [被：穿著也。綺繡：彩色絲織品[綾羅綢緞]。]
```

Good:
```
{15} meaning [被：穿著也。綺繡：彩色絲織品（綾羅綢緞）。]
```

### 9.3 Pronunciation Left in Meaning Text

Bad:
```
{6} meaning [羸：○粵[雷]，[lœy4]；○漢[léi]。瘦弱多病。]
```

The `[]` inside the value confuses the parser. Instead:

```
{6} pron type:hom lang:yue [雷；lœy4]
{6} pron type:pinyin lang:cmn [léi]
{6} meaning [瘦弱多病。]
```

### 9.4 Missing Annotation Section

Bad:
```
---
id: 1
title: 背影
---
我與父親不相見已二年餘了...
```

Good (even with zero annotations):
```
---
id: 1
title: 背影
---
我與父親不相見已二年餘了...

## 注釋
```

### 9.5 IPA Characters in Pinyin

Bad:
```
{19} pron type:pinyin lang:cmn [chɑ́nɡ]
{39} pron type:pinyin lang:cmn [ɡuɑ̀n]
```

Good:
```
{19} pron type:pinyin lang:cmn [cháng]
{39} pron type:pinyin lang:cmn [guàn]
```

### 9.6 Empty Definitions

Bad:
```
{5} meaning [甸：。古時稱郊外的地方。]
```

The `甸：。` is an empty character heading. Either provide the definition or remove the marker.

Good:
```
{5} meaning [甸：郊外。古時稱郊外的地方。]
```

### 9.7 Stray Footnote Digits

Bad:
```
辨我是雄雌﹖1
```

Good:
```
辨我是雄雌﹖
```

### 9.8 Dual Annotation Systems

Bad — file contains both old-style numbered list AND CHAM `## 注釋`:
```
一、注釋
1. 騅：項羽的馬名。
2. 奈何：怎麼辦。

## 注釋

{1} meaning [項羽的馬名。]
{2} meaning [怎麼辦。]
```

Good — only CHAM annotations:
```
## 注釋

{1} meaning [騅：項羽的馬名。]
{2} meaning [奈何：怎麼辦。]
```

### 9.9 Inconsistent Marker Phrasing

When the source has annotation number 6 next to "羸病", make sure the marker wraps the correct text. Don't guess — cross-reference the annotation definition with the body text.

---

## 10. Conversion Workflow (PDF → CHAM)

1. **Extract** text from PDF using `PdfExtractor`.
2. **Identify regions**: body text, annotation definitions, analysis sections.
3. **Map annotation numbers to phrases**: for each superscript number in the body, find the corresponding word/phrase it annotates.
4. **Build the body**: insert `{N}...{/N}` markers around each annotated phrase.
5. **Build annotations**: convert each numbered definition to CHAM format. Split pronunciation into `pron` entries.
6. **Build prose files**: extract author-brief, background, analysis sections to separate `.md` files.
7. **Validate**: run the parser and marker-balance checks.

### Key Challenges in PDF Extraction

- **Superscript numbers** often appear on separate lines or are interleaved with text. Match them to the correct preceding word/phrase.
- **Multi-line annotations** in PDFs may be split across pages. Reassemble them before converting.
- **Page-level noise**: headers, footers, and page numbers must be stripped completely.
- **OCR quality**: verify character accuracy against the PDF visually, especially for rare characters.

---

## 11. Examples

### Minimal Poetry (primary-culture style)

```
---
id: 14
title: 病牛
contributors:
  - ref: A189
    role: author
date:
  dynasty: 宋
genre: poetry
---
耕犁千畝{1}實{/1}千{2}箱{/2}，力盡筋疲誰復{3}傷{/3}？
{4}但得眾生{/4}{5}皆得飽{/5}，不辭{6}羸病{/6}臥{7}殘陽{/7}。

## 注釋

{1} meaning [充實。]
{2} meaning [許許多多官府的糧倉。]
{3} meaning [可憐，同情。]
{4} meaning [老百姓。]
{5} meaning [不推辭。]
{6} pron type:hom lang:yue [雷；lœy4]
{6} pron type:pinyin lang:cmn [léi]
{6} meaning [瘦弱多病。]
{7} meaning [快要下山的太陽。]
```

### Prose with Multiple Paragraphs (secondary style)

```
---
id: 143
title: 送東陽馬生序
contributors:
  - ref: A162
    role: author
date:
  dynasty: 元
genre: prose
---
余幼時即{1}嗜學{/1}。家貧，無從{2}致{/2}書以觀...

當余從師也，{24}負篋曳屣{/24}，行深山巨谷...

## 注釋

{1} meaning [嗜：《說文》曰：「喜之也。」嗜學：愛好讀書學習。]
...
```

### Prose with No Annotations

```
---
id: 40
title: 背影
contributors:
  - ref: A208
    role: author
date:
  dynasty: 民國
genre: prose
---
我與父親不相見已二年餘了...

## 注釋
```

---

## 12. Author Reference Integrity

### 12.1 Reference Validation

- Every `ref` value in `contributors` (e.g., `A189`) must have a corresponding entry in `data/authors.yaml`.
- Every author entry in `authors.yaml` must have `name` (Chinese) and `dynasty` fields.
- The `name` field must be a proper author name, not a sentence fragment (e.g., not `本文節錄自劉義慶`).

### 12.2 ID Allocation

- Author IDs (`A001`–`A999`, `C001`–`C999`) are sequential and permanent. Once assigned, never reuse or change.
- When adding new collections, check the highest existing ID before allocating new ones.
- Avoid creating duplicate entries: before adding a new author, check if that person already exists under a different ID.

### 12.3 Dynasty Accuracy

- The `dynasty` field in author entries must be historically correct. Common errors:
  - Confucius → 周 (not 唐)
  - Guan Hanqing → 元 (not 宋)
  - Zhu Yizun → 清 (not 宋)
  - Book of Changes → 周 (not 宋)

---

## 13. Subordinate File Consistency

### 13.1 Required Fields

Every subordinate `.cham.md` file (files with a `base` field) must include:

| Field | Required | Example |
|-------|----------|---------|
| `base` | yes | `text.cham.md` |
| `contributor` | yes | `A010` or `C001` |
| `role` | yes | `annotator`, `commentator`, `translator` |
| `nature` | yes | `commentary`, `translation`, `annotation`, `exegesis`, `notes` |

### 13.2 Marker Coverage

- Subordinate files reference the same marker table as the main file.
- Every `{N}` in a subordinate file's annotations must exist in the main file's body.
- It is acceptable for a subordinate file to annotate only a subset of the main file's markers.

---

## 14. Collection-Level Consistency

### 14.1 book.yaml Requirements

- Every collection directory must contain a `book.yaml` with at minimum: `id`, `title`, `genre`.
- The `id` must be unique across all collections.
- `contributors`, `date`, and `genre` in `book.yaml` are inherited by pieces that omit them.

### 14.2 Cross-Collection Standards

- All collections within the same library should use consistent frontmatter field names and structures.
- Subordinate files should use the same `type: secondary` convention (or omit it consistently).
- `date` and `source` fields, if used in one collection, should be used in all collections of similar type.

---

## 15. Common Audit Findings

The following issues have been found across the library and should be checked during quality review:

### 15.1 Stray Footnote Digits in Body Text

Footnote reference numbers from PDF extraction sometimes remain in the body text or annotation values. Check for isolated digits after punctuation: `。1`, `？2`, `，3`.

### 15.2 Dual Annotation Systems

Some files retain both old-style numbered annotations (e.g., `一、注釋` with numbered list) and CHAM `## 注釋`. The old-style annotations must be removed entirely — they should not coexist with CHAM annotations.

### 15.3 Missing `genre` Field

Every `text.cham.md` must have a `genre` field (either in its own frontmatter or inherited from `book.yaml`). Common omission: poetry files in collections where only prose files have explicit `genre`.

### 15.4 Empty `dynasty` Field

The `date.dynasty` field must have a value. An empty `dynasty:` is incomplete — research the correct dynasty for the author.

### 15.5 Non-Sequential Marker Numbering

While not a correctness error, gaps in marker numbering (e.g., using {1}, {3} without {2}) usually indicate a mistake during conversion. Verify that gaps are intentional.
