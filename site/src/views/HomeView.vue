<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useData } from '../composables/useData'
import { useTitle } from '../composables/useTitle'
import PoemCard from '../components/PoemCard.vue'

const { poems, authors } = useData()
const router = useRouter()
const searchQuery = ref('')
useTitle(() => undefined)

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return poems.value
  return poems.value.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.author.toLowerCase().includes(q) ||
    p.verses.some(v => v.text.toLowerCase().includes(q))
  )
})

const authorCount = computed(() => new Set(poems.value.map(p => p.author)).size)

function openPoem(num: number) {
  router.push(`/poem/${num}`)
}

function scrollToCatalog() {
  if (import.meta.env.SSR) return
  document.querySelector('.catalog')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div>
    <section class="hero">
      <div style="position:relative;z-index:1;text-align:center">
        <div class="hero-ornament">◆ ◇ ◆</div>
        <h1 class="hero-title">積累與感興</h1>
        <p class="hero-subtitle">小學古詩文誦讀材料選編（修訂）</p>
        <div class="hero-divider"></div>
        <div class="hero-stats">
          <div>
            <div class="hero-stat-num">{{ poems.length }}</div>
            <div class="hero-stat-label">篇詩文</div>
          </div>
          <div>
            <div class="hero-stat-num">{{ authorCount }}</div>
            <div class="hero-stat-label">位作者</div>
          </div>
          <div>
            <div class="hero-stat-num">跨越千年</div>
            <div class="hero-stat-label">秦至清</div>
          </div>
        </div>
        <button class="hero-cta" @click="scrollToCatalog">
          進 入 文 庫 ↓
        </button>
      </div>
    </section>

    <section class="catalog">
      <div class="catalog-header">
        <h2>詩 文 總 目</h2>
        <div class="line"></div>
        <p>教育局課程發展處 · 中國語文教育</p>
      </div>
      <div class="filter-bar">
        <input
          v-model="searchQuery"
          class="filter-search"
          placeholder="搜索詩題、作者…"
        />
      </div>
      <div class="catalog-grid">
        <PoemCard
          v-for="poem in filtered"
          :key="poem.num"
          :poem="poem"
          @click="openPoem(poem.num)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%);
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute; inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0v60M0 30h60' stroke='%23d8cdb8' stroke-width='.3' fill='none'/%3E%3C/svg%3E") repeat;
  opacity: 0.3;
  pointer-events: none;
}
.hero-ornament {
  font-size: 48px; color: var(--vermillion);
  opacity: 0.6; letter-spacing: 20px; margin-bottom: 32px;
}
.hero-title {
  font-size: clamp(36px, 6vw, 64px);
  font-weight: 900; letter-spacing: 12px;
  color: var(--ink); margin-bottom: 12px;
}
.hero-subtitle {
  font-size: clamp(14px, 2vw, 18px);
  font-weight: 300; color: var(--ink-light);
  letter-spacing: 6px; margin-bottom: 48px;
  font-family: var(--sans);
}
.hero-divider {
  width: 120px; height: 2px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  margin: 0 auto 48px;
}
.hero-stats { display: flex; gap: 48px; justify-content: center; margin-bottom: 48px; }
.hero-stat-num { font-size: 36px; font-weight: 200; color: var(--ink); letter-spacing: 2px; }
.hero-stat-label {
  font-size: 12px; color: var(--ink-faint);
  letter-spacing: 4px; font-family: var(--sans);
  margin-top: 4px; text-align: center;
}
.hero-cta {
  display: inline-flex; align-items: center; gap: 12px;
  padding: 14px 40px;
  background: var(--ink); color: var(--paper);
  font-family: var(--sans); font-size: 15px;
  font-weight: 500; letter-spacing: 3px;
  border: none; border-radius: 2px; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.hero-cta:hover {
  background: var(--vermillion);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(var(--shadow-rgb), 0.12);
}

.catalog {
  max-width: 1200px;
  margin: 0 auto; padding: 80px 40px;
}
.catalog-header { text-align: center; margin-bottom: 60px; }
.catalog-header h2 { font-size: 28px; font-weight: 700; letter-spacing: 8px; color: var(--ink); margin-bottom: 8px; }
.catalog-header .line { width: 60px; height: 2px; background: var(--vermillion); margin: 16px auto; }
.catalog-header p { font-size: 14px; color: var(--ink-faint); font-family: var(--sans); letter-spacing: 2px; }

.filter-bar { display: flex; justify-content: center; margin-bottom: 40px; }
.filter-search {
  padding: 10px 20px; border: 1px solid var(--border);
  border-radius: 2px; background: var(--surface);
  font-family: var(--sans); font-size: 14px;
  color: var(--ink); width: 320px; outline: none;
  transition: border-color 0.2s;
}
.filter-search:focus { border-color: var(--gold); }
.filter-search::placeholder { color: var(--ink-faint); }

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .hero-stats { gap: 24px; }
  .hero-stat-num { font-size: 28px; }
  .catalog { padding: 40px 20px; }
  .catalog-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
  .filter-search { width: 100%; }
}
</style>
