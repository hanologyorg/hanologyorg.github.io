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
