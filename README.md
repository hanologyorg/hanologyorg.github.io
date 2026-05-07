# 積累與感興 — 古典詩文圖書館

教育局「積累與感興」小學古詩文誦讀材料選編的數位圖書館，收錄 100 篇經典詩文。

## 快速開始

```bash
# 安裝依賴
cd site && npm install

# 開發伺服器
npm run dev

# 生產建置（SSG）
npm run build

# 本地預覽建置結果
npm run preview
```

## 專案結構

```
├── site/                    # 前端（Vue 3 + vite-ssg）
│   ├── src/
│   │   ├── types.ts         # 主要資料型別（Poem, Annotation, Author, Dynasty）
│   │   ├── models/          # 古典文本擴展模型
│   │   │   └── classical-types.ts
│   │   ├── composables/     # Vue composables
│   │   │   ├── useData.ts          # 資料載入（SSR/CSR 雙路）
│   │   │   ├── useTitle.ts         # 頁面標題管理
│   │   │   └── useAnnotationRenderer.ts  # 注釋渲染共享邏輯
│   │   ├── components/      # Vue 元件
│   │   ├── views/           # 頁面元件
│   │   └── styles/main.css  # 設計系統（CSS 變數）
│   └── public/data/         # JSON 資料檔
│       ├── poems.json       # 100 篇詩文
│       ├── authors.json     # 47 位作者
│       └── dynasties.json   # 朝代索引
├── scripts/
│   └── reprocess-data.py    # PDF → JSON 資料管線
├── pdfs/                    # 來源 PDF 檔案
├── TODO.classic-han-library/  # 古典文本系統規格文件
├── TODO.resources-pull/       # 資源擴展規格文件
└── reference-docs/            # 參考文獻
```

## 資料流程

```
PDF 檔案 (pdfs/*.pdf)
  ↓ pdfjs-dist 提取文本
  ↓ reprocess-data.py 解析結構
  ↓
site/public/data/poems.json (100 篇，含 1112 條注釋)
site/public/data/authors.json (47 位作者)
site/public/data/dynasties.json
  ↓
vite-ssg build → 靜態 HTML（site/dist/）
```

### 重新處理資料

若 PDF 來源有更新，重新執行管線：

```bash
python3 scripts/reprocess-data.py
```

輸出會直接覆寫 `site/public/data/poems.json`。

### 資料格式

每首詩文的注釋使用 **flat annotation model**（每條注釋獨立，透過 `TextRange` 精確定位到字元偏移量）：

```json
{
  "id": "p001-1",
  "range": {
    "type": "range",
    "scope": "verse",
    "verseIndex": 0,
    "start": 0,
    "end": 1
  },
  "kind": "pronunciation",
  "lang": "yue",
  "text": "垓，音該",
  "source": "edb"
}
```

注釋類型（`kind`）：
- `pronunciation` — 注音（顯示「音」標籤，jade 色）
- `semantic` — 釋義（顯示「義」標籤，vermillion 色）
- `etymology`、`note`、`definition` — 預留擴展

## 開發指南

### 新增前端元件

1. 在 `site/src/components/` 建立元件
2. 遵循設計系統的 CSS 變數（見 `styles/main.css`）
3. 注釋渲染使用 `useAnnotationRenderer` composable（DRY）
4. 資料存取使用 `useData` composable（Map 索引，O(1) 查詢）

### SSR 注意事項

- `useData` 在 SSR 時直接讀檔，在 CSR 時 fetch JSON
- 禁止在 SSR 環境使用 `document`、`window`（用 `import.meta.env.SSR` 保護）
- `createRouterInstance()` 必須每次建立新實例（vite-ssg 要求，見 `router.ts`）

### 新增注釋類型

1. 在 `types.ts` 的 `Annotation.kind` union 中新增類型
2. 在 `AnnotationTooltip.vue` 中新增對應的 badge 顯示
3. 在 `VerticalScroll.vue` / `HorizontalDisplay.vue` 的 `:deep(.ann-target)` 樣式中新增對應顏色

## 部署

```bash
cd site && npm run build
```

`site/dist/` 目錄包含所有靜態檔案，可直接部署到：
- **GitHub Pages**：推送 `dist/` 內容到 `gh-pages` 分支
- **Netlify / Vercel / Cloudflare Pages**：指向 `site/` 目錄，建置命令 `npm run build`

部署時需配置 SPA fallback（所有路徑 → `index.html`），或使用 pre-rendered HTML（vite-ssg 已生成）。

## 擴展計劃

詳見規格文件：
- `TODO.classic-han-library/` — 古典文本資料模型、設計系統、前端架構
- `TODO.resources-pull/` — 中學資源、NSS 指定篇章、教師培訓材料
- `TODO.classic-han-library/06-classical-text-model.md` — 古典漢語文本資料模型設計（注疏層級、遞迴注釋、年代編碼）

## 技術棧

| 層 | 技術 |
|----|------|
| 前端 | Vue 3 Composition API + TypeScript |
| 建置 | Vite 8 + vite-ssg（Static Site Generation） |
| 樣式 | CSS Custom Properties（無框架） |
| 資料管線 | Python 3 + pdfjs-dist |
| 字體 | Noto Serif TC / Noto Sans TC（Google Fonts） |
