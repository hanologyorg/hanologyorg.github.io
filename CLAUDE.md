# 積累與感興 — 古典詩文圖書館

## 語言
- 所有回覆使用**繁體中文**

## 專案概述
教育局「積累與感興」小學古詩文誦讀材料選編，收錄 100 篇經典詩文的數位圖書館。

## 技術架構
- **後端管線** (`src/`): TypeScript, pdfjs-dist, NodeNext 模組
- **前端** (`site/`): Vue 3 + vite-ssg (SSG), Composition API
- **資料**: `site/public/data/` (poems.json, authors.json, dynasties.json)

## 關鍵約束
- vite-ssg 需要每次建立新的 router 實例（`createRouterInstance()`），不可用模組級單例
- `createApp()` 在 `main.ts` 中匯出給 vite-ssg，同時在非 SSR 環境自動掛載
- SSR 環境下禁止使用 `document`、`window` 等瀏覽器 API（用 `import.meta.env.SSR` 保護）
- 注釋（annotations）必須精確映射到詩句中的字元範圍

## 直排/橫排 MIRROR 原則
- **橫排模式**：橫向文字 + 垂直捲動 — 所有元素皆橫排
- **直排模式**：直向文字 + 水平捲動 — 所有元素皆直排
- **絕不混用**：任何元件在直排模式下，所有文字（包括標題、按鈕、注釋面板、注釋彈窗、導航）都必須使用 `writing-mode: vertical-rl`
- 注釋面板在直排模式應從左側出現，整體使用直排書寫
