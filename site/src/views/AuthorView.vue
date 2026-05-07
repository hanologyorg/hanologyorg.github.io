<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useData } from '../composables/useData'
import { useTitle } from '../composables/useTitle'

const route = useRoute()
const router = useRouter()
const { poems, authors, getPoemsByAuthor, getAuthor } = useData()

const authorName = computed(() => decodeURIComponent(String(route.params.name || '')))

const author = computed(() => getAuthor(authorName.value))

const authorPoems = computed(() => getPoemsByAuthor(authorName.value))

useTitle(() => authorName.value)

function openPoem(num: number) {
  router.push(`/poem/${num}`)
}

function goBack() { router.push('/') }
</script>

<template>
  <div v-if="author" class="detail-page">
    <nav class="detail-nav">
      <div class="detail-nav-inner">
        <button class="nav-back" @click="goBack">← 返回</button>
        <div class="nav-breadcrumb">
          <span class="sep">作者</span>
          <span class="sep">·</span>
          <span class="author-name">{{ authorName }}</span>
        </div>
        <div class="nav-controls">
          <span class="nav-tag">{{ author.dynasty || '未知朝代' }}</span>
          <span class="nav-tag">{{ authorPoems.length }} 篇</span>
        </div>
      </div>
    </nav>

    <div class="reading-area">
      <div class="author-hero">
        <div class="author-seal">{{ authorName.charAt(0) }}</div>
        <div class="author-info">
          <h1 class="author-name">{{ authorName }}</h1>
          <div class="author-meta">
            <span v-if="author.dynasty" class="author-dynasty">{{ author.dynasty }}</span>
            <span class="author-count">{{ authorPoems.length }} 篇收錄作品</span>
          </div>
        </div>
      </div>

      <div v-if="author.bio" class="author-bio">
        <h3>作者簡介</h3>
        <p>{{ author.bio }}</p>
      </div>

      <div class="author-works">
        <h3>收錄作品</h3>
        <div class="works-grid">
          <div
            v-for="poem in authorPoems"
            :key="poem.num"
            class="work-card"
            @click="openPoem(poem.num)"
          >
            <div class="work-num">{{ String(poem.num).padStart(3, '0') }}</div>
            <div class="work-title">{{ poem.title }}</div>
            <div class="work-preview">{{ poem.verses.map(v => v.text).join('').slice(0, 40) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="reading-area" style="text-align:center;padding-top:120px">
    <p style="font-size:18px;color:var(--ink-faint)">載入中…</p>
  </div>
</template>

<style scoped>
.author-hero {
  display: flex; align-items: center; gap: 32px;
  max-width: min(680px, calc(100vw - 80px));
  margin: 0 auto 48px; padding: 40px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
}
.author-seal {
  width: 80px; height: 80px;
  border: 3px solid var(--vermillion); border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 900;
  color: var(--vermillion); flex-shrink: 0;
}
.author-name {
  font-size: 36px; font-weight: 900;
  letter-spacing: 6px; color: var(--ink);
}
.author-meta {
  display: flex; gap: 16px; margin-top: 8px;
  font-family: var(--sans); font-size: 14px;
}
.author-dynasty {
  color: var(--gold); font-weight: 600; letter-spacing: 2px;
}
.author-count { color: var(--ink-faint); letter-spacing: 1px; }

.author-bio {
  max-width: min(680px, calc(100vw - 80px));
  margin: 0 auto 48px;
  padding: 24px 32px;
  background: var(--surface); border: 1px solid var(--border-light);
  border-radius: 8px;
}
.author-bio h3 {
  font-size: 16px; font-weight: 700;
  letter-spacing: 3px; color: var(--ink);
  margin-bottom: 16px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.author-bio p {
  font-size: 16px; line-height: 2.2;
  color: var(--ink-mid); text-align: justify;
}

.author-works {
  max-width: min(900px, calc(100vw - 80px));
  margin: 0 auto;
}
.author-works h3 {
  font-size: 18px; font-weight: 700;
  letter-spacing: 3px; color: var(--ink);
  margin-bottom: 24px;
}
.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.work-card {
  padding: 20px;
  background: var(--surface); border: 1px solid var(--border-light);
  border-radius: 6px; cursor: pointer;
  transition: all 0.2s ease;
}
.work-card:hover {
  border-color: var(--gold);
  box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.08);
  transform: translateY(-2px);
}
.work-num {
  font-size: 11px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 2px;
}
.work-title {
  font-size: 18px; font-weight: 700;
  letter-spacing: 2px; margin: 6px 0 4px;
}
.work-preview {
  font-size: 12px; color: var(--ink-faint);
  line-height: 1.6;
  display: -webkit-box; -webkit-line-clamp: 1;
  -webkit-box-orient: vertical; overflow: hidden;
}

@media (max-width: 768px) {
  .author-hero { flex-direction: column; text-align: center; padding: 24px; }
  .works-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
}
</style>
