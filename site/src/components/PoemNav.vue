<script setup lang="ts">
defineProps<{
  prevTitle: string | undefined
  nextTitle: string | undefined
  currentNum: number
  total: number
}>()

defineEmits<{
  prev: []
  next: []
}>()
</script>

<template>
  <div class="poem-nav">
    <button v-if="currentNum > 1" class="pn-btn" @click="$emit('prev')">
      <div class="pn-label">← 上一篇</div>
      <div class="pn-title">{{ prevTitle }}</div>
    </button>
    <div v-else />
    <button v-if="currentNum < total" class="pn-btn next" @click="$emit('next')">
      <div class="pn-label">下一篇 →</div>
      <div class="pn-title">{{ nextTitle }}</div>
    </button>
  </div>
</template>

<style scoped>
.poem-nav {
  max-width: min(680px, calc(100vw - 80px));
  margin: 0 auto 60px;
  display: flex; justify-content: space-between; gap: 16px;
}
.pn-btn {
  flex: 1; padding: 16px 24px;
  background: var(--surface); border: 1px solid var(--border-light);
  border-radius: 8px; cursor: pointer;
  transition: all 0.2s ease; font-family: var(--serif);
  text-align: left;
}
.pn-btn:hover { border-color: var(--gold); box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08); }
.pn-btn.next { text-align: right; }
.pn-label { font-size: 11px; color: var(--ink-faint); font-family: var(--sans); letter-spacing: 2px; margin-bottom: 4px; }
.pn-title { font-size: 16px; font-weight: 600; letter-spacing: 1px; color: var(--ink); }
</style>
