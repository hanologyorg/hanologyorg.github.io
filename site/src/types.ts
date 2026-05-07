export interface TextRange {
  type: 'point' | 'range' | 'full'
  scope: 'verse' | 'title' | 'section' | 'full_text'
  verseIndex?: number
  sectionKey?: string
  start?: number
  end?: number
}

export interface Annotation {
  id: string
  range: TextRange
  kind: 'pronunciation' | 'semantic' | 'etymology' | 'note' | 'definition'
  lang?: string
  text: string
  source: string
}

export interface VerseLine {
  text: string
}

export interface Poem {
  num: number
  title: string
  author: string
  verses: VerseLine[]
  sections: Record<string, string>
  annotations: Annotation[]
}

export interface Author {
  '@id': string
  '@type': string
  name: string
  dynasty: string
  poemCount: number
  bio?: string
}

export interface Dynasty {
  '@id': string
  '@type': string
  name: string
  authors: string[]
  poemCount: number
}
