/**
 * Patch auxiliary .md files in content/primary/ with YAML frontmatter.
 * Reads authorId from text.cham.md and adds `subject: { type: author, ref }` to author-brief.md.
 * Adds `title` frontmatter to other builtin auxiliary files.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const BUILTIN_TITLES: Record<string, string> = {
  'author-brief.md': '作者簡介',
  'background.md': '背景資料',
  'analysis.md': '賞析',
  'follow-up.md': '延伸活動',
  'think-questions.md': '思考問題',
  'preparation.md': '教學準備',
}

function loadYaml(path: string): Record<string, unknown> {
  try {
    const yaml = require('yaml')
    return yaml.parse(readFileSync(path, 'utf-8')) || {}
  } catch { return {} }
}

function hasFrontmatter(content: string): boolean {
  const trimmed = content.replace(/^﻿/, '')
  if (!trimmed.startsWith('---')) return false
  const end = trimmed.indexOf('\n---', 3)
  return end !== -1
}

function getAuthorId(chamPath: string): string | null {
  const raw = readFileSync(chamPath, 'utf-8')
  const yaml = require('yaml')
  const trimmed = raw.replace(/^﻿/, '')
  if (!trimmed.startsWith('---')) return null
  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) return null
  try {
    const fm = yaml.parse(trimmed.slice(3, end))
    return fm?.contributors?.[0]?.ref || null
  } catch { return null }
}

function patchFile(filePath: string, title: string, authorId?: string): boolean {
  if (!existsSync(filePath)) return false
  let content = readFileSync(filePath, 'utf-8')
  if (hasFrontmatter(content)) return false

  const lines: string[] = ['---']
  lines.push(`title: ${title}`)
  if (authorId) {
    lines.push('subject:')
    lines.push(`  type: author`)
    lines.push(`  ref: ${authorId}`)
  }
  lines.push('---')
  lines.push('')

  writeFileSync(filePath, lines.join('\n') + content, 'utf-8')
  return true
}

const contentDir = process.argv[2] || 'content/primary'
let patched = 0

for (const entry of readdirSync(contentDir).sort()) {
  const pieceDir = join(contentDir, entry)
  const chamPath = join(pieceDir, 'text.cham.md')
  if (!existsSync(chamPath)) continue

  const authorId = getAuthorId(chamPath)

  for (const [filename, title] of Object.entries(BUILTIN_TITLES)) {
    const filePath = join(pieceDir, filename)
    const aid = filename === 'author-brief.md' ? authorId : undefined
    if (patchFile(filePath, title, aid ?? undefined)) patched++
  }
}

console.log(`Patched ${patched} files`)
