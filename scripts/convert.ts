import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import * as yaml from 'yaml'
import { ChamConverter } from '../src/cham/convert'

const POEMS_JSON = 'site/public/data/poems.json'
const AUTHORS_YAML = 'data/authors.yaml'
const CONTENT_DIR = 'content'

interface SourcePoem {
  num: number
  title: string
  author: string
  verses: Array<{ text: string }>
  sections: Record<string, string>
  annotations: Array<Record<string, unknown>>
}

function main() {
  const poems: SourcePoem[] = JSON.parse(readFileSync(POEMS_JSON, 'utf-8'))
  const authorsData = yaml.parse(readFileSync(AUTHORS_YAML, 'utf-8'))

  const converter = new ChamConverter()
  converter.setAuthors(authorsData)

  let converted = 0
  let errors = 0

  for (const poem of poems) {
    const dirName = `${String(poem.num).padStart(3, '0')}_${poem.title.replace(/[\/\\:*?"<>|]/g, '_').trim()}`
    const dirPath = join(CONTENT_DIR, dirName)

    try {
      mkdirSync(dirPath, { recursive: true })

      const result = converter.convertPoem(poem as any)

      writeFileSync(join(dirPath, 'text.cham.md'), result.cham, 'utf-8')

      for (const [name, content] of result.prose) {
        writeFileSync(join(dirPath, `${name}.md`), content, 'utf-8')
      }

      converted++
    } catch (err) {
      console.error(`Error converting poem ${poem.num} "${poem.title}":`, err)
      errors++
    }
  }

  console.log(`\nConverted: ${converted}/${poems.length}`)
  if (errors > 0) console.error(`Errors: ${errors}`)
}

main()
