<script setup lang="ts">
import { ref } from 'vue'
import { useReadingMode, THEMES, THEME_LABELS } from '../composables/useReadingMode'
import type { LayoutMode } from '../composables/useReadingMode'

defineProps<{
  context?: string
}>()

const emit = defineEmits<{
  back: []
  home: []
}>()

const { theme, layout, setTheme, setLayout } = useReadingMode()
const settingsOpen = ref(false)

function toggleSettings() { settingsOpen.value = !settingsOpen.value }
</script>

<template>
  <nav class="sidenav">
    <button class="sn-brand" @click="emit('home')" title="首頁">
      <span class="sn-seal">積</span>
    </button>

    <button class="sn-btn" @click="emit('back')" title="返回">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </button>

    <div v-if="context" class="sn-context">{{ context }}</div>

    <div class="sn-spacer" />

    <button
      class="sn-btn"
      :class="{ active: settingsOpen }"
      @click="toggleSettings"
      title="設定"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    </button>

    <div v-if="layout === 'vertical'" class="sn-layout-tag">直</div>

    <Transition name="slide-left">
      <div v-if="settingsOpen" class="sn-settings" @click.stop>
        <div class="ss-group">
          <div class="ss-label">版面</div>
          <div class="ss-options">
            <button class="ss-opt" :class="{ active: layout === 'horizontal' }" @click="setLayout('horizontal' as LayoutMode)">橫排</button>
            <button class="ss-opt" :class="{ active: layout === 'vertical' }" @click="setLayout('vertical' as LayoutMode)">直排</button>
          </div>
        </div>
        <div class="ss-group">
          <div class="ss-label">主題</div>
          <div class="ss-options">
            <button
              v-for="t in THEMES"
              :key="t"
              class="ss-opt"
              :class="{ active: theme === t }"
              @click="setTheme(t)"
            >{{ THEME_LABELS[t] }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <div v-if="settingsOpen" class="sn-overlay" @click="settingsOpen = false" />
  </nav>
</template>

<style scoped>
.sidenav {
  position: fixed;
  top: 0; right: 0;
  width: 56px; height: 100vh;
  background: var(--paper);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  align-items: center;
  padding: 12px 0;
  z-index: 200;
  gap: 8px;
}

.sn-brand {
  width: 40px; height: 40px;
  border: 2px solid var(--vermillion);
  border-radius: 3px;
  background: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
}
.sn-brand:hover { background: var(--vermillion); }
.sn-brand:hover .sn-seal { color: var(--paper); }
.sn-seal {
  font-family: var(--serif);
  font-size: 18px; font-weight: 900;
  color: var(--vermillion);
  transition: color 0.2s;
}

.sn-btn {
  width: 36px; height: 36px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  color: var(--ink-light);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.sn-btn:hover { border-color: var(--ink); color: var(--ink); }
.sn-btn.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.sn-context {
  writing-mode: vertical-rl;
  font-size: 11px;
  color: var(--ink-faint);
  letter-spacing: 2px;
  max-height: 120px;
  overflow: hidden;
  font-family: var(--sans);
  text-align: center;
}

.sn-spacer { flex: 1; }

.sn-layout-tag {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--paper);
  font-size: 11px; font-weight: 700;
  font-family: var(--sans);
  display: flex; align-items: center; justify-content: center;
}

.sn-settings {
  position: absolute;
  top: 50%;
  right: 64px;
  transform: translateY(-50%);
  width: 200px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(var(--shadow-rgb), 0.16);
  padding: 16px;
  z-index: 210;
}

.slide-left-enter-active, .slide-left-leave-active {
  transition: all 0.2s ease;
}
.slide-left-enter-from, .slide-left-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(12px);
}

.ss-group { margin-bottom: 14px; }
.ss-group:last-child { margin-bottom: 0; }
.ss-label {
  font-family: var(--sans);
  font-size: 11px; font-weight: 600;
  color: var(--ink-faint);
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.ss-options { display: flex; gap: 6px; }
.ss-opt {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  font-family: var(--sans);
  font-size: 12px;
  color: var(--ink-mid);
  cursor: pointer;
  transition: all 0.15s;
}
.ss-opt:hover { border-color: var(--ink); color: var(--ink); }
.ss-opt.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

.sn-overlay {
  position: fixed; inset: 0;
  z-index: -1;
}

@media (max-width: 768px) {
  .sidenav { width: 44px; padding: 8px 0; gap: 6px; }
  .sn-brand { width: 32px; height: 32px; }
  .sn-seal { font-size: 15px; }
  .sn-btn { width: 30px; height: 30px; }
  .sn-context { font-size: 10px; max-height: 80px; }
}
</style>
