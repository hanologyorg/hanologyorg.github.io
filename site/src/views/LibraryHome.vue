<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLibrary } from '../composables/useLibrary'
import { useBook } from '../composables/useBook'
import { useTitle } from '../composables/useTitle'
import { useReadingMode } from '../composables/useReadingMode'
import { useHorizontalScroll } from '../composables/useHorizontalScroll'
import BookCard from '../components/BookCard.vue'
import SideNav from '../components/SideNav.vue'
import ReadingToolbar from '../components/ReadingToolbar.vue'

const { scale, books, singleBook, loadLibrary } = useLibrary()
await loadLibrary()

useTitle('古典詩文圖書館')

// Single-book: redirect to book home
if (scale.value === 'single-book' && singleBook.value) {
  const router = useRouter()
  router.replace(`/${singleBook.value.id}`)
}

// Single-piece: redirect to the piece
if (scale.value === 'single-piece' && singleBook.value) {
  const router = useRouter()
  const { load } = useBook()
  await load(singleBook.value.id)
  const { pieces } = useBook()
  if (pieces.value.length === 1) {
    router.replace(`/${singleBook.value.id}/${pieces.value[0].num}`)
  }
}

const router = useRouter()
const { layout } = useReadingMode()
const isVertical = computed(() => layout.value === 'vertical')
const vPageRef = ref<HTMLElement | null>(null)
const vScroll = useHorizontalScroll(vPageRef)

function openBook(bookId: string) {
  router.push(`/${bookId}`)
}
</script>

<template>
  <div v-if="scale === 'library'">
    <!-- ═══════ 直排模式 ═══════ -->
    <div v-if="isVertical" class="v-root">
      <SideNav @home="router.push('/')" @back="router.push('/')" />
      <div ref="vPageRef" class="v-page">
        <section class="v-hero">
          <h1 class="v-title">古 典 詩 文 圖 書 館</h1>
          <p class="v-subtitle">Classical Chinese Text Library</p>
          <div class="v-divider"></div>
        </section>

        <section class="v-cards-col">
          <div
            v-for="book in books"
            :key="book.id"
            class="v-book-card"
            @click="openBook(book.id)"
          >
            <div class="v-book-accent"></div>
            <h2 class="v-book-title">{{ book.title }}</h2>
            <p v-if="book.subtitle" class="v-book-sub">{{ book.subtitle }}</p>
            <div class="v-book-stats">
              <span class="v-book-count">{{ book.count }} 篇</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- ═══════ 橫排模式 ═══════ -->
    <div v-else class="lib-root">
      <header class="lib-hero">
        <div class="lib-seal">漢流</div>
        <h1>古典詩文圖書館</h1>
        <p class="lib-subtitle">Classical Chinese Text Library</p>
      </header>
      <div class="lib-grid">
        <div
          v-for="book in books"
          :key="book.id"
          class="lib-card"
          @click="openBook(book.id)"
        >
          <div class="lib-card-accent"></div>
          <div class="lib-card-body">
            <h2 class="lib-card-title">{{ book.title }}</h2>
            <p v-if="book.subtitle" class="lib-card-sub">{{ book.subtitle }}</p>
            <div class="lib-card-stats">
              <span class="lib-card-count">{{ book.count }} 篇</span>
            </div>
          </div>
        </div>
      </div>
      <ReadingToolbar />
    </div>
  </div>
</template>

<style scoped>
/* ═══════ 直排模式 ═══════ */

.v-page {
  height: 100vh;
  display: flex;
  flex-direction: row-reverse;
  overflow-x: auto;
  overflow-y: hidden;
  margin-right: var(--nav-width, 56px);
  padding: 0 32px;
  background: linear-gradient(90deg, var(--paper) 0%, var(--paper-warm) 100%);
  scrollbar-width: thin;
  scrollbar-color: var(--gold) transparent;
}
.v-page::-webkit-scrollbar { height: 4px; }
.v-page::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

.v-hero {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px;
}
.v-seal {
  writing-mode: horizontal-tb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px; height: 48px;
  border: 2px solid var(--vermillion);
  color: var(--vermillion);
  font-size: 14px;
  font-family: var(--serif);
  font-weight: 900;
  margin-bottom: 0;
  margin-left: 16px;
  border-radius: 4px;
  letter-spacing: 0;
}
.v-title {
  font-size: 48px; font-weight: 900;
  letter-spacing: 16px; color: var(--ink);
  margin-left: 20px; padding-left: 20px;
  border-left: 4px solid var(--vermillion);
  line-height: 1.6;
}
.v-subtitle {
  font-size: 14px; font-weight: 300;
  color: var(--ink-faint); letter-spacing: 3px;
  margin-left: 16px; font-family: var(--sans);
}
.v-divider {
  width: 2px; height: 80px;
  background: linear-gradient(180deg, transparent, var(--gold), transparent);
  margin-left: 20px;
}

.v-cards-col {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 40px 16px;
  height: 100vh;
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: flex-start;
}

.v-book-card {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 24px 16px;
  border-left: 1px solid var(--border-light);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}
.v-book-card:hover {
  background: var(--surface);
}
.v-book-accent {
  position: absolute;
  top: 0; right: 0;
  width: 0; height: 3px;
  background: var(--vermillion);
  transition: width 0.35s ease;
}
.v-book-card:hover .v-book-accent { width: 100%; }
.v-book-title {
  font-size: 32px; font-weight: 900;
  letter-spacing: 8px; color: var(--ink);
  margin-left: 16px; padding-left: 16px;
  border-left: 3px solid var(--vermillion);
  line-height: 1.6;
}
.v-book-sub {
  font-size: 14px;
  color: var(--ink-light);
  letter-spacing: 3px;
  margin-left: 12px;
  font-family: var(--sans);
}
.v-book-stats {
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--border);
}
.v-book-count {
  font-size: 13px;
  color: var(--ink-faint);
  letter-spacing: 2px;
  font-family: var(--sans);
  padding: 2px 8px;
  background: var(--surface-warm);
  border-radius: 4px;
}

/* ═══════ 橫排模式 ═══════ */

.lib-root {
  max-width: 960px;
  margin: 0 auto;
  padding: 80px 24px 120px;
}
.lib-hero {
  text-align: center;
  margin-bottom: 64px;
}
.lib-seal {
  writing-mode: vertical-rl;
  text-orientation: upright;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px; height: 56px;
  border: 2px solid var(--vermillion);
  color: var(--vermillion);
  font-size: 20px;
  font-family: var(--serif);
  letter-spacing: 2px;
  margin-bottom: 24px;
  border-radius: 4px;
  line-height: 1;
}
.lib-hero h1 {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--ink);
  margin-bottom: 8px;
}
.lib-subtitle {
  font-size: 14px;
  font-family: var(--sans);
  color: var(--ink-faint);
  letter-spacing: 2px;
}
.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.lib-card {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: 32px 24px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  background: var(--surface);
}
.lib-card:hover { border-color: var(--gold); box-shadow: 0 4px 20px rgba(var(--shadow-rgb), 0.1); }
.lib-card-title {
  font-size: 28px; font-weight: 900;
  letter-spacing: 6px; color: var(--ink);
  margin-bottom: 8px;
}
.lib-card-sub {
  font-size: 14px; color: var(--ink-light);
  letter-spacing: 2px; font-family: var(--sans);
  margin-bottom: 16px;
}
.lib-card-stats {
  font-size: 13px; color: var(--ink-faint);
  font-family: var(--sans); letter-spacing: 1px;
}
.lib-card-count {
  padding: 4px 10px;
  background: var(--surface-warm);
  border-radius: 4px;
}

@media (max-width: 768px) {
  .v-page { padding: 0 16px; }
  .v-title { font-size: 36px; letter-spacing: 10px; }
}
</style>
