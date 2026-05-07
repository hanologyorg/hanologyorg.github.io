<script setup lang="ts">
import type { Annotation, VerseLine } from '../types'
import { buildVerseAnnotations, renderAnnotatedText, resolveHoveredAnnotations } from '../composables/useAnnotationRenderer'

const props = defineProps<{
  title: string
  author: string
  verses: VerseLine[]
  authorInitial: string
  annotations: Annotation[]
}>()

const emit = defineEmits<{
  annotationHover: [event: MouseEvent, annotations: Annotation[]]
  annotationLeave: []
  openAuthor: [name: string]
}>()

function verseHtml(index: number): string {
  const spans = buildVerseAnnotations(props.annotations, index)
  return renderAnnotatedText(props.verses[index].text, spans)
}

function onHover(event: MouseEvent) {
  const matched = resolveHoveredAnnotations(event, props.annotations)
  if (matched) emit('annotationHover', event, matched)
}

function onLeave() {
  emit('annotationLeave')
}
</script>

<template>
  <div class="vertical-scroll" @mouseover="onHover" @mouseout="onLeave">
    <span class="vs-title">{{ title }}</span>
    <span class="vs-author clickable" @click="emit('openAuthor', author)">{{ author }}</span>
    <div class="vs-body">
      <span
        v-for="(_, i) in verses"
        :key="i"
        class="vs-line"
        v-html="verseHtml(i)"
      />
    </div>
    <div class="seal-stamp">{{ authorInitial }}</div>
  </div>
</template>

<style scoped>
.vertical-scroll {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  height: clamp(400px, 60vh, 560px);
  overflow-x: auto; overflow-y: hidden;
  padding: 32px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: var(--gold) var(--paper);
}
.vertical-scroll::-webkit-scrollbar { height: 4px; }
.vertical-scroll::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

.vs-title {
  font-size: 36px; font-weight: 900; color: var(--ink);
  letter-spacing: 12px; margin-left: 24px;
  padding-left: 24px; border-left: 3px solid var(--vermillion);
  line-height: 1.6;
}
.vs-author {
  font-size: 22px; font-weight: 400; color: var(--ink-light);
  margin-left: 16px; padding-left: 16px; letter-spacing: 6px;
}
.vs-author.clickable { cursor: pointer; transition: color 0.15s; }
.vs-author.clickable:hover { color: var(--vermillion); }
.vs-body { margin-left: 28px; }
.vs-line {
  font-size: 30px; line-height: 2.4; letter-spacing: 8px;
  color: var(--ink); display: block;
}
.seal-stamp {
  position: absolute; bottom: 16px; left: 16px;
  width: 44px; height: 44px;
  border: 2px solid var(--vermillion); border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
  writing-mode: vertical-rl;
  font-size: 14px; font-weight: 900;
  color: var(--vermillion); opacity: 0.5;
}

:deep(.ann-target) {
  border-left: 2px solid var(--vermillion);
  padding-left: 2px;
  cursor: help;
  transition: background 0.15s;
}
:deep(.ann-target:hover) {
  background: rgba(194, 58, 43, 0.08);
}
:deep(.ann-target.pronunciation:hover) {
  background: rgba(58, 107, 94, 0.08);
}
:deep(.ann-target.pronunciation) {
  border-left-color: var(--jade);
}
:deep(.ann-target.pronunciation.semantic) {
  border-left-color: var(--gold);
}
</style>
