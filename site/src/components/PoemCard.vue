<script setup lang="ts">
import type { Poem } from '../types'

defineProps<{ poem: Poem }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <div class="poem-card" @click="$emit('click')">
    <div class="card-accent"></div>
    <div class="card-body">
      <div class="card-num">{{ String(poem.num).padStart(3, '0') }}</div>
      <h3 class="card-title">{{ poem.title }}</h3>
      <div class="card-author">{{ poem.author }}</div>
      <p class="card-preview">{{ poem.verses.map(v => v.text).join('') }}</p>
    </div>
  </div>
</template>

<style scoped>
.poem-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.card-accent {
  position: absolute;
  top: 0; left: 0;
  width: 3px; height: 0;
  background: var(--vermillion);
  transition: height 0.35s ease;
}

.poem-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(var(--shadow-rgb), 0.1);
  border-color: var(--gold-light);
}
.poem-card:hover .card-accent { height: 100%; }

.card-body { padding: 24px; }
.card-num {
  font-size: 11px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 2px;
  margin-bottom: 10px;
}
.card-title {
  font-size: 20px; font-weight: 700;
  letter-spacing: 2px; margin-bottom: 6px;
  color: var(--ink);
}
.card-author {
  font-size: 13px; color: var(--ink-light);
  font-family: var(--sans); letter-spacing: 1px;
}
.card-preview {
  font-size: 13px; color: var(--ink-faint);
  margin-top: 14px; line-height: 1.7;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
</style>
