import { describe, it, expect } from 'vitest'
import { ChamParser } from '../parser'
import { ChamSerializer } from '../serializer'
import { isSecondaryMeta } from '../types'

const SAMPLE_CHAM = `---
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

騅不逝兮可奈何！


虞兮虞兮{2}奈若何{/2}！

## 注釋

{1} meaning [騅][項羽的馬名]

{2} meaning [奈何][
「奈何」意為「怎麼辦」。
全句即「把你怎麼辦呢」。
]`

const parser = new ChamParser()
const serializer = new ChamSerializer()

describe('ChamParser', () => {
  it('parses primary meta with discriminated type', () => {
    const doc = parser.parse(SAMPLE_CHAM)
    expect(doc.meta.type).toBe('primary')
    expect(isSecondaryMeta(doc.meta)).toBe(false)
    if (doc.meta.type === 'primary') {
      expect(doc.meta.id).toBe(1)
      expect(doc.meta.title).toBe('垓下歌')
      expect(doc.meta.genre).toBe('poetry')
      expect(doc.meta.date?.dynasty).toBe('秦末')
      expect(doc.meta.date?.circa).toBe(true)
      expect(doc.meta.contributors).toEqual([{ ref: 'A001', role: 'author' }])
    }
  })

  it('parses secondary meta', () => {
    const src = `---
base: text.cham.md
contributor: A010
role: annotator
dynasty: 三國（魏）
nature: commentary
---

## 王弼註

{1} commentary [可道之道。]`

    const doc = parser.parse(src)
    expect(doc.meta.type).toBe('secondary')
    expect(isSecondaryMeta(doc.meta)).toBe(true)
    if (doc.meta.type === 'secondary') {
      expect(doc.meta.base).toBe('text.cham.md')
      expect(doc.meta.contributor).toBe('A010')
    }
  })

  it('parses text blocks with section breaks', () => {
    const doc = parser.parse(SAMPLE_CHAM)
    expect(doc.textBlocks.length).toBe(4)
    expect(doc.textBlocks[0].text).toBe('力拔山兮氣蓋世。')
    expect(doc.textBlocks[1].text).toBe('時不利兮騅不逝。')
    expect(doc.textBlocks[2].text).toBe('騅不逝兮可奈何！')
    expect(doc.textBlocks[3].text).toBe('虞兮虞兮奈若何！')

    expect(doc.textBlocks[0].sectionIndex).toBe(0)
    expect(doc.textBlocks[3].sectionIndex).toBe(1)
  })

  it('parses inline markers', () => {
    const doc = parser.parse(SAMPLE_CHAM)
    const m1 = doc.markers.get(1)!
    const m2 = doc.markers.get(2)!

    expect(m1.offset).toBe(4)
    expect(m1.length).toBe(1)
    expect(m1.text).toBe('騅')

    expect(m2.text).toBe('奈若何')
    expect(m2.length).toBe(3)
  })

  it('parses annotation sections', () => {
    const doc = parser.parse(SAMPLE_CHAM)
    expect(doc.sections.length).toBe(1)
    expect(doc.sections[0].name).toBe('注釋')
    expect(doc.sections[0].entries.length).toBe(2)
  })

  it('parses annotation entries with headword', () => {
    const doc = parser.parse(SAMPLE_CHAM)
    const [e1, e2] = doc.sections[0].entries

    expect(e1.target).toEqual({ type: 'marker', markerId: 1 })
    expect(e1.kind).toBe('meaning')
    expect(e1.headword).toBe('騅')
    expect(e1.value).toBe('項羽的馬名')

    expect(e2.headword).toBe('奈何')
    expect(e2.value).toContain('怎麼辦')
  })
})

describe('ChamSerializer', () => {
  it('produces valid CHAM', () => {
    const doc = parser.parse(SAMPLE_CHAM)
    const output = serializer.serialize(doc)
    expect(output).toContain('title: 垓下歌')
    expect(output).toContain('{1}騅{/1}')
    expect(output).toContain('## 注釋')
  })
})

describe('Round-trip equivalence', () => {
  it('parse → serialize → parse preserves semantics', () => {
    const doc1 = parser.parse(SAMPLE_CHAM)
    const serialized = serializer.serialize(doc1)
    const doc2 = parser.parse(serialized)

    expect(doc2.meta.type).toBe(doc1.meta.type)

    // Text blocks
    expect(doc2.textBlocks.length).toBe(doc1.textBlocks.length)
    for (let i = 0; i < doc1.textBlocks.length; i++) {
      expect(doc2.textBlocks[i].text).toBe(doc1.textBlocks[i].text)
      expect(doc2.textBlocks[i].sectionIndex).toBe(doc1.textBlocks[i].sectionIndex)
    }

    // Markers
    expect(doc2.markers.size).toBe(doc1.markers.size)
    for (const [id, m1] of doc1.markers) {
      const m2 = doc2.markers.get(id)!
      expect(m2.offset).toBe(m1.offset)
      expect(m2.length).toBe(m1.length)
      expect(m2.text).toBe(m1.text)
    }

    // Sections
    expect(doc2.sections.length).toBe(doc1.sections.length)
    for (let i = 0; i < doc1.sections.length; i++) {
      expect(doc2.sections[i].entries.length).toBe(doc1.sections[i].entries.length)
      for (let j = 0; j < doc1.sections[i].entries.length; j++) {
        const e1 = doc1.sections[i].entries[j]
        const e2 = doc2.sections[i].entries[j]
        expect(e2.target).toEqual(e1.target)
        expect(e2.kind).toBe(e1.kind)
        expect(e2.headword).toBe(e1.headword)
        expect(e2.value).toBe(e1.value)
      }
    }
  })
})

describe('Overlapping markers', () => {
  it('parses overlapping ranges', () => {
    const doc = parser.parse(`---
id: test
title: test
---

{1}力拔{2}山兮{/1}氣蓋{/2}世。

## 注釋

{1} meaning [力拔山兮][test1]

{2} meaning [山兮氣蓋][test2]`)

    expect(doc.markers.get(1)!.text).toBe('力拔山兮')
    expect(doc.markers.get(2)!.text).toBe('山兮氣蓋')
  })

  it('parses encapsulating ranges', () => {
    const doc = parser.parse(`---
id: test
title: test
---

{1}奈{2}若何{/2}{/1}！

## 注釋

{1} meaning [奈若何][outer]

{2} meaning [若何][inner]`)

    expect(doc.markers.get(1)!.text).toBe('奈若何')
    expect(doc.markers.get(2)!.text).toBe('若何')
  })
})

describe('Prose continuation lines', () => {
  it('joins continuation lines', () => {
    const doc = parser.parse(`---
id: test
title: test
---

{1}道{/1}可道，非常{2}道{/2}。
{3}名{/3}可名，非常{4}名{/4}。

無名天地之始。

## 注釋

{1} meaning [道][the way]`)

    expect(doc.textBlocks.length).toBe(2)
    expect(doc.textBlocks[0].text).toBe('道可道，非常道。名可名，非常名。')
    expect(doc.textBlocks[1].text).toBe('無名天地之始。')
    expect(doc.markers.get(4)!.offset).toBe(14)
  })
})

describe('Annotation targets and params', () => {
  it('parses all target types', () => {
    const doc = parser.parse(`---
id: test
title: test
---

test text

## 注釋

@title pron type:hom lang:yue [垓][該]

@full meaning [全詩反覆詠嘆。]

{1} pron type:hom lang:yue [錐]

{2} person ref:A020 [皋陶][舜帝理官]`)

    const entries = doc.sections[0].entries
    expect(entries[0].target).toEqual({ type: 'title' })
    expect(entries[1].target).toEqual({ type: 'full' })
    expect(entries[2].params).toEqual({ type: 'hom', lang: 'yue' })
    expect(entries[3].params).toEqual({ ref: 'A020' })
    expect(entries[3].headword).toBe('皋陶')
  })
})

describe('Section metadata', () => {
  it('parses @key:value metadata', () => {
    const doc = parser.parse(`---
id: test
title: test
---

test

## 王弼註
@contributor: A010
@role: annotator
@dynasty: 三國（魏）
@nature: commentary

{1} commentary [可道之道。]

## 白話譯文
@contributor: A050
@role: translator
@nature: translation

{1} translation [可以說出來的道。]`)

    expect(doc.sections.length).toBe(2)
    expect(doc.sections[0].meta.contributor).toBe('A010')
    expect(doc.sections[0].meta.nature).toBe('commentary')
    expect(doc.sections[1].meta.contributor).toBe('A050')
  })
})
