<script setup lang="ts">
import type { Annotation } from '../types'

defineProps<{
  visible: boolean
  annotations: Annotation[]
  style?: Record<string, string>
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && annotations.length"
      class="ann-tooltip"
      :style="style"
    >
      <div
        v-for="ann in annotations"
        :key="ann.id"
        class="ann-entry"
        :class="ann.kind"
      >
        <span class="ann-badge">{{ ann.kind === 'pronunciation' ? '音' : '義' }}</span>
        <span class="ann-text">{{ ann.text }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ann-tooltip {
  position: fixed;
  padding: 16px 20px;
  background: var(--surface-warm);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(var(--shadow-rgb), 0.14);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  max-height: 60vh;
  overflow-x: auto;
  z-index: 1000;
}

.ann-entry {
  font-size: 16px;
  line-height: 2;
  letter-spacing: 2px;
  margin-left: 12px;
}
.ann-badge {
  display: inline;
  font-size: 11px;
  font-family: var(--sans);
  padding: 1px 4px;
  border-radius: 2px;
  font-weight: 600;
}
.ann-entry.pronunciation .ann-badge {
  background: var(--jade);
  color: #fff;
}
.ann-entry.semantic .ann-badge {
  background: var(--vermillion);
  color: #fff;
}
.ann-text {
  color: var(--ink-mid);
}
</style>
