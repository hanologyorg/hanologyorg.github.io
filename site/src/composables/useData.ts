import { ref, shallowRef, computed } from 'vue'
import type { Poem, Author, Dynasty } from '../types'

function cleanHardWraps(text: string): string {
  return text
    .split('\n\n')
    .map(seg => seg.replace(/\n/g, ''))
    .join('\n\n')
}

function cleanPoem(poem: Poem): Poem {
  const sections: Record<string, string> = {}
  for (const [key, val] of Object.entries(poem.sections)) {
    sections[key] = cleanHardWraps(val)
  }
  return { ...poem, sections }
}

const poems = shallowRef<Poem[]>([])
const authors = shallowRef<Author[]>([])
const dynasties = ref<Record<string, Dynasty>>({})
const loaded = ref(false)

const poemByNum = computed(() => {
  const map = new Map<number, Poem>()
  for (const p of poems.value) map.set(p.num, p)
  return map
})

const poemsByAuthor = computed(() => {
  const map = new Map<string, Poem[]>()
  for (const p of poems.value) {
    const list = map.get(p.author)
    if (list) list.push(p)
    else map.set(p.author, [p])
  }
  return map
})

const authorByName = computed(() => {
  const map = new Map<string, Author>()
  for (const a of authors.value) map.set(a.name, a)
  return map
})

async function loadData() {
  if (loaded.value) return

  if (import.meta.env.SSR) {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const base = resolve('public/data')
    poems.value = JSON.parse(readFileSync(`${base}/poems.json`, 'utf-8')).map(cleanPoem)
    authors.value = JSON.parse(readFileSync(`${base}/authors.json`, 'utf-8'))
    dynasties.value = JSON.parse(readFileSync(`${base}/dynasties.json`, 'utf-8'))
  } else {
    const [poemsRes, authorsRes, dynastiesRes] = await Promise.all([
      fetch('/data/poems.json'),
      fetch('/data/authors.json'),
      fetch('/data/dynasties.json'),
    ])
    poems.value = (await poemsRes.json()).map(cleanPoem)
    authors.value = await authorsRes.json()
    dynasties.value = await dynastiesRes.json()
  }

  loaded.value = true
}

export function useData() {
  function getPoem(num: number): Poem | undefined {
    return poemByNum.value.get(num)
  }

  function getPoemsByAuthor(authorName: string): Poem[] {
    return poemsByAuthor.value.get(authorName) || []
  }

  function getAuthor(name: string): Author | undefined {
    return authorByName.value.get(name)
  }

  return { poems, authors, dynasties, loaded, loadData, getPoem, getPoemsByAuthor, getAuthor }
}
