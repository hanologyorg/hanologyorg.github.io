<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  num: string
  label: string
  special: boolean
  text: string
  isAnnotations: boolean
}>()

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatParagraphs(text: string): string {
  const lines = text.split('\n').filter(l => l.trim())
  return lines.length ? lines.map(p => `<p>${esc(p.trim())}</p>`).join('') : ''
}

function formatAnnotations(text: string): string {
  const parts = text.split(/(\d{1,2})\.\s*/)
  const html: string[] = []
  for (let i = 1; i < parts.length; i += 2) {
    const num = parts[i]
    const body = parts[i + 1]?.trim() || ''
    const colonIdx = body.indexOf('：')
    const term = colonIdx >= 0 ? body.slice(0, colonIdx) : ''
    const def = colonIdx >= 0 ? body.slice(colonIdx + 1) : body
    html.push(`<div class="ann-entry"><span class="ann-num">${num}.</span><span class="ann-term">${esc(term)}：</span>${esc(def)}</div>`)
  }
  return html.join('') || `<p>${esc(text)}</p>`
}

const html = computed(() =>
  props.isAnnotations ? formatAnnotations(props.text) : formatParagraphs(props.text)
)
</script>

<template>
  <div v-if="text" class="content-block">
    <div class="cb-header">
      <span class="cb-num" :class="{ special }">{{ num }}</span>
      <h3>{{ special ? '【' + label + '】' : label }}</h3>
    </div>
    <div class="content-text" v-html="html" />
  </div>
</template>

<style scoped>
.content-block {
  margin-bottom: 40px;
  animation: fadeUp 0.5s ease forwards;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.cb-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 20px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.cb-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--vermillion); color: #fff;
  font-family: var(--sans); font-size: 13px; font-weight: 700;
  flex-shrink: 0;
}
.cb-num.special { background: var(--jade); }
.cb-header h3 { font-size: 18px; font-weight: 700; letter-spacing: 3px; color: var(--ink); }
.content-text {
  font-size: 16px; line-height: 2.2; color: var(--ink-mid);
  text-align: justify;
}
.content-text :deep(p) { margin-bottom: 16px; text-indent: 2em; }
.content-text :deep(p:last-child) { margin-bottom: 0; }
.content-text :deep(.ann-entry) { margin-bottom: 14px; padding-left: 2em; text-indent: -2em; }
.content-text :deep(.ann-num) { color: var(--vermillion); font-weight: 600; margin-right: 4px; }
.content-text :deep(.ann-term) { font-weight: 600; color: var(--ink); }
</style>
