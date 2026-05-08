<script setup lang="ts">
import { useReadingMode } from '../composables/useReadingMode'
import { annotationToPronSegment } from '../utils/annotationParser'
import PronunciationGroup from './PronunciationGroup.vue'
import type { Annotation } from '../types'

const props = defineProps<{
  visible: boolean
  annotations: Annotation[]
  layerLabels?: Record<string, string>
  style?: Record<string, string>
}>()

const { layout } = useReadingMode()

function getSegment(ann: Annotation) {
  return annotationToPronSegment(ann)
}

function layerLabel(ann: Annotation): string {
  if (!props.layerLabels || !ann.id) return ''
  for (const [prefix, label] of Object.entries(props.layerLabels)) {
    if (ann.id.startsWith(prefix)) return label
  }
  return ''
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ann-fade">
      <div
        v-if="visible && annotations.length"
        class="ann-tooltip"
        :class="{ 'ann-vertical': layout === 'vertical' }"
        :style="style"
      >
        <div
          v-for="ann in annotations"
          :key="ann.id"
          class="ann-entry"
          :class="ann.kind"
        >
          <div class="ann-header">
            <span class="ann-kind">{{ ann.kind === 'pronunciation' ? '音' : '義' }}</span>
            <span v-if="layerLabel(ann)" class="ann-layer">{{ layerLabel(ann) }}</span>
          </div>
          <PronunciationGroup v-if="getSegment(ann)" :segment="getSegment(ann)!" />
          <div v-else class="ann-body">{{ ann.text }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ann-tooltip {
  position: fixed;
  padding: 12px 16px;
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(var(--shadow-rgb), 0.14);
  max-width: 320px;
  max-height: 60vh;
  overflow-y: auto;
  z-index: 1000;
}

.ann-entry {
  margin-bottom: 10px;
  letter-spacing: 1px;
  font-size: 15px;
  color: var(--ink-mid);
}
.ann-entry:last-child { margin-bottom: 0; }

.ann-kind {
  display: inline-block;
  font-size: 10px;
  font-family: var(--sans);
  padding: 1px 3px;
  border-radius: 2px;
  font-weight: 600;
  letter-spacing: 1px;
  margin-right: 3px;
  line-height: 1;
  vertical-align: middle;
}
.ann-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.ann-layer {
  font-size: 11px;
  font-family: var(--sans);
  color: var(--ink-faint);
  letter-spacing: 1px;
}
.pronunciation .ann-kind {
  background: var(--jade);
  color: #fff;
}
.semantic .ann-kind {
  background: var(--vermillion);
  color: #fff;
}

.ann-body {
  margin-top: 4px;
  line-height: 1.8;
}

/* ─── 直排模式 tooltip ─── */
.ann-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  max-width: none;
  max-height: 60vh;
  padding: 16px 12px;
}
.ann-vertical .ann-entry {
  margin-bottom: 0;
  margin-left: 12px;
}
.ann-vertical .ann-kind {
  margin-right: 0;
  text-combine-upright: all;
  vertical-align: baseline;
}
.ann-vertical .ann-body {
  margin-top: 0;
  margin-left: 6px;
}

/* ─── Transition ─── */
.ann-fade-enter-active, .ann-fade-leave-active {
  transition: opacity 0.15s ease;
}
.ann-fade-enter-from, .ann-fade-leave-to {
  opacity: 0;
}
</style>
