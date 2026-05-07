<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useReadingMode } from './composables/useReadingMode'
import ReadingToolbar from './components/ReadingToolbar.vue'

const router = useRouter()
const { toggleLayout, cycleTheme } = useReadingMode()

function onKey(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
  if (event.key === 'Escape') router.push('/')
  if (event.key === 'v' || event.key === 'V') toggleLayout()
  if (event.key === 't' || event.key === 'T') cycleTheme()
}
</script>

<template>
  <div @keydown="onKey">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <ReadingToolbar />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
