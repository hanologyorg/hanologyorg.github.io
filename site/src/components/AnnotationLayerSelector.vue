<script setup lang="ts">
import type { AnnotationLayer } from '../types'

const props = defineProps<{
  layers: AnnotationLayer[]
  activeIds: string[]
}>()

const emit = defineEmits<{
  'update:activeIds': [ids: string[]]
}>()

function toggle(id: string) {
  const current = props.activeIds
  if (current.includes(id)) {
    emit('update:activeIds', current.filter(x => x !== id))
  } else {
    emit('update:activeIds', [...current, id])
  }
}
</script>

<template>
  <div v-if="layers.length > 1" class="layer-selector">
    <button
      v-for="layer in layers"
      :key="layer.id"
      :class="['layer-btn', { active: activeIds.includes(layer.id) }]"
      :title="layer.label"
      @click="toggle(layer.id)"
    >
      {{ layer.shortLabel }}
    </button>
  </div>
</template>

<style scoped>
.layer-selector {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.layer-btn {
  border: 1px solid var(--c-border);
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 13px;
  background: var(--c-bg);
  color: var(--c-text);
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.layer-btn:hover {
  border-color: var(--c-brand);
}

.layer-btn.active {
  background: var(--c-brand);
  color: #fff;
  border-color: var(--c-brand);
}
</style>
