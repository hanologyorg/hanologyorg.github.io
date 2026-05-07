import { ref } from 'vue'
import type { Annotation } from '../types'

export interface AnnSpan {
  start: number
  end: number
  annotations: Annotation[]
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildVerseAnnotations(annotations: Annotation[], verseIndex: number): AnnSpan[] {
  const anns = annotations.filter(a =>
    a.range.scope === 'verse' && a.range.verseIndex === verseIndex
  )
  const spanMap = new Map<string, Annotation[]>()
  for (const a of anns) {
    const key = `${a.range.start ?? 0}:${a.range.end ?? 0}`
    if (!spanMap.has(key)) spanMap.set(key, [])
    spanMap.get(key)!.push(a)
  }
  return Array.from(spanMap.entries()).map(([k, matched]) => {
    const [start, end] = k.split(':').map(Number)
    return { start, end, annotations: matched }
  }).sort((a, b) => a.start - b.start)
}

export function renderAnnotatedText(text: string, spans: AnnSpan[]): string {
  if (!spans.length) return esc(text)

  let html = ''
  let cursor = 0
  for (const span of spans) {
    if (span.start > cursor) {
      html += esc(text.slice(cursor, span.start))
    }
    const ids = span.annotations.map(a => a.id).join(',')
    const kinds = [...new Set(span.annotations.map(a => a.kind))].join(' ')
    html += `<span class="ann-target ${kinds}" data-ann-ids="${ids}">${esc(text.slice(span.start, span.end))}</span>`
    cursor = span.end
  }
  if (cursor < text.length) {
    html += esc(text.slice(cursor))
  }
  return html
}

export function resolveHoveredAnnotations(
  event: MouseEvent,
  annotations: Annotation[],
): Annotation[] | null {
  const target = (event.target as HTMLElement).closest('.ann-target') as HTMLElement | null
  if (!target) return null
  const ids = target.getAttribute('data-ann-ids')?.split(',') || []
  const matched = annotations.filter(a => ids.includes(a.id))
  return matched.length ? matched : null
}

export function useAnnotationTooltip() {
  const visible = ref(false)
  const items = ref<Annotation[]>([])
  const style = ref<Record<string, string>>({})

  function show(event: MouseEvent, annotations: Annotation[]) {
    items.value = annotations
    const target = event.target as HTMLElement
    const rect = target.getBoundingClientRect()
    const w = 280
    style.value = {
      left: Math.max(8, Math.min(rect.left - w - 12, window.innerWidth - w - 8)) + 'px',
      top: Math.max(8, rect.top) + 'px',
    }
    visible.value = true
  }

  function hide() { visible.value = false }

  return { visible, items, style, show, hide }
}
