<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useData } from '../composables/useData'
import { useTitle } from '../composables/useTitle'
import { useAnnotationTooltip } from '../composables/useAnnotationRenderer'
import VerticalScroll from '../components/VerticalScroll.vue'
import SectionBlock from '../components/SectionBlock.vue'
import AnnotationTooltip from '../components/AnnotationTooltip.vue'
import PoemNav from '../components/PoemNav.vue'
import type { Poem, Annotation } from '../types'

const props = defineProps<{ num: string | number }>()
const router = useRouter()
const { getPoem, poems } = useData()

const authorPaneOpen = ref(false)
const tooltip = useAnnotationTooltip()

const poem = computed<Poem | undefined>(() => {
  const n = typeof props.num === 'string' ? parseInt(props.num, 10) : props.num
  return getPoem(n)
})

useTitle(() => poem.value ? `${poem.value.title}·${poem.value.author}` : undefined)

const SECTION_META = [
  { key: 'author_bio', label: '作者簡介', num: '01', special: false },
  { key: 'background', label: '背景資料', num: '02', special: false },
  { key: 'annotations', label: '注釋', num: '03', special: false },
  { key: 'analysis', label: '賞析重點', num: '04', special: false },
  { key: 'preparation', label: '預習活動', num: '◆', special: true },
  { key: 'follow_up', label: '跟進活動', num: '◆', special: true },
  { key: 'think_questions', label: '想一想', num: '◆', special: true },
] as const

function handleAnnotationHover(event: MouseEvent, annotations: Annotation[]) {
  tooltip.show(event, annotations)
}

function handleAnnotationLeave() {
  tooltip.hide()
}

function openAuthorPane() {
  authorPaneOpen.value = true
}

function closeAuthorPane() {
  authorPaneOpen.value = false
}

function goBack() { router.push('/') }

function navigate(delta: number) {
  if (!poem.value) return
  const next = poem.value.num + delta
  if (next >= 1 && next <= 100) router.push(`/poem/${next}`)
}
</script>

<template>
  <div v-if="poem" class="detail-page">
    <nav class="detail-nav">
      <div class="detail-nav-inner">
        <button class="nav-back" @click="goBack">← 返回</button>
        <div class="nav-breadcrumb">
          <span class="sep">{{ poem.num }}.</span>
          {{ poem.title }}
          <span class="sep">·</span>
          <span class="author-link" @click="openAuthorPane">{{ poem.author }}</span>
        </div>
        <div class="nav-controls">
          <span class="nav-tag">{{ poem.verses.length }} 句</span>
          <span class="nav-tag">{{ poem.annotations.length }} 注</span>
        </div>
      </div>
    </nav>

    <div class="reading-area">
      <div class="poem-scroll-section">
        <VerticalScroll
          :title="poem.title"
          :author="poem.author"
          :verses="poem.verses"
          :author-initial="poem.author?.charAt(0) || '詩'"
          :annotations="poem.annotations"
          @annotation-hover="handleAnnotationHover"
          @annotation-leave="handleAnnotationLeave"
          @open-author="openAuthorPane"
        />
      </div>

      <div class="content-sections">
        <SectionBlock
          v-for="(meta, idx) in SECTION_META"
          :key="meta.key"
          :num="meta.num"
          :label="meta.label"
          :special="meta.special"
          :text="poem.sections[meta.key] || ''"
          :is-annotations="meta.key === 'annotations'"
          :style="{ animationDelay: idx * 0.08 + 's' }"
        />
      </div>

      <PoemNav
        :prev-title="poems[poem.num - 2]?.title"
        :next-title="poems[poem.num]?.title"
        :current-num="poem.num"
        :total="100"
        @prev="navigate(-1)"
        @next="navigate(1)"
      />
    </div>

    <AnnotationTooltip
      :visible="tooltip.visible"
      :annotations="tooltip.items"
      :style="tooltip.style"
    />

    <Teleport to="body">
      <div v-if="authorPaneOpen" class="author-overlay" @click="closeAuthorPane">
        <div class="author-pane" @click.stop>
          <button class="pane-close" @click="closeAuthorPane">✕</button>
          <div class="pane-header">
            <div class="pane-seal">{{ poem.author?.charAt(0) || '詩' }}</div>
            <div>
              <div class="pane-name">{{ poem.author }}</div>
              <div class="pane-meta">{{ poem.title }} 等</div>
            </div>
          </div>
          <div v-if="poem.sections.author_bio" class="pane-bio">
            <div v-for="p in poem.sections.author_bio.split('\n').filter(l => l.trim())" :key="p" class="pane-p">
              {{ p.trim() }}
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <div v-else class="reading-area" style="text-align:center;padding-top:120px">
    <p style="font-size:18px;color:var(--ink-faint)">載入中…</p>
  </div>
</template>

<style scoped>
.poem-scroll-section {
  margin-bottom: 60px; display: flex; justify-content: center;
}

.author-link {
  color: var(--ink-light); font-weight: 400;
  cursor: pointer; transition: color 0.15s;
}
.author-link:hover { color: var(--vermillion); }

.author-overlay {
  position: fixed; inset: 0;
  background: rgba(var(--shadow-rgb), 0.3);
  z-index: 200;
  display: flex; justify-content: flex-end;
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.author-pane {
  width: min(420px, 90vw);
  height: 100vh;
  background: var(--paper);
  padding: 32px;
  overflow-y: auto;
  animation: slideIn 0.25s ease;
  box-shadow: -8px 0 32px rgba(var(--shadow-rgb), 0.1);
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

.pane-close {
  display: block; margin-left: auto;
  width: 36px; height: 36px;
  border: 1px solid var(--border); border-radius: 4px;
  background: none; font-size: 16px;
  color: var(--ink-light); cursor: pointer;
  transition: all 0.15s;
}
.pane-close:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.pane-header {
  display: flex; align-items: center; gap: 20px;
  margin: 24px 0 32px;
}
.pane-seal {
  width: 64px; height: 64px;
  border: 2px solid var(--vermillion); border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 900;
  color: var(--vermillion); flex-shrink: 0;
}
.pane-name {
  font-size: 28px; font-weight: 900;
  letter-spacing: 4px; color: var(--ink);
}
.pane-meta {
  font-size: 14px; color: var(--ink-faint);
  letter-spacing: 2px; margin-top: 4px;
}

.pane-bio {
  border-top: 1px solid var(--border);
  padding-top: 24px;
}
.pane-p {
  font-size: 16px; line-height: 2.2;
  color: var(--ink-mid); text-align: justify;
  text-indent: 2em; margin-bottom: 12px;
}
</style>
