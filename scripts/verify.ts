import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { parse } from '../src/cham/parser'

let ok = 0
let fail = 0
const errors: string[] = []

const dirs = readdirSync('content')
for (const dir of dirs) {
  const chamPath = join('content', dir, 'text.cham.md')
  try {
    const src = readFileSync(chamPath, 'utf-8')
    const doc = parse(src)

    if (!doc.meta.id || !doc.meta.title) throw new Error('Missing meta')
    if (doc.meta.type !== 'primary') throw new Error('Not primary')

    ok++
  } catch (e: any) {
    fail++
    errors.push(`${dir}: ${e.message}`)
  }
}

console.log(`Parsed: ${ok}/${dirs.length} OK, ${fail} failed`)
if (errors.length > 0) {
  console.log('Errors:')
  errors.forEach(e => console.log(`  ${e}`))
}
