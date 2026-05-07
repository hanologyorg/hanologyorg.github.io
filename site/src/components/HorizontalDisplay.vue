<script setup lang="ts">
import type { Annotation, VerseLine } from '../types'
import { buildVerseAnnotations, renderAnnotatedText, resolveHoveredAnnotations } from '../composables/useAnnotationRenderer'

const props = defineProps<{
  title: string
  author: string
  verses: VerseLine[]
  annotations: Annotation[]
}>()

const emit = defineEmits<{
  annotationHover: [event: MouseEvent, annotations: Annotation[]]
  annotationLeave: []
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
  <div class="horiz-block" @mouseover="onHover" @mouseout="onLeave">
    <div class="hp-title">{{ title }}</div>
    <div class="hp-author">{{ author }}</div>
    <div
      v-for="(_, i) in verses"
      :key="i"
      class="hp-line"
      v-html="verseHtml(i)"
    />
  </div>
</template>

<style scoped>
.horiz-block {
  display: inline-block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 40px 56px;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
  text-align: center;
}
.hp-title {
  font-size: 32px; font-weight: 900;
  color: var(--ink); letter-spacing: 6px;
  margin-bottom: 6px;
}
.hp-author {
  font-size: 16px; color: var(--ink-light);
  margin-bottom: 24px; letter-spacing: 3px;
}
.hp-line {
  font-size: 24px; line-height: 2.6;
  letter-spacing: 4px; color: var(--ink);
}

:deep(.ann-target) {
  border-bottom: 2px solid var(--vermillion);
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
  border-bottom-color: var(--jade);
}
</style>
