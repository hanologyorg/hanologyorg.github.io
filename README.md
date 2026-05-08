# 古典詩文圖書館

古典漢語文本數位圖書館，目前收錄五部典籍共 271 篇：

| 典籍 | 篇數 |
|------|------|
| 積累與感興（教育局小學古詩文誦讀材料） | 100 |
| 積學與涵泳（教育局中學古詩文誦讀材料） | 115 |
| 帛書老子 甲本 | 26 |
| 帝範 | 17 |
| 臣軌 | 13 |

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
│   │   ├── types.ts         # 主要資料型別
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
│       ├── library.json     # 圖書館索引（所有典籍）
│       ├── books/           # 各典籍資料（primary.json, laozi.json…）
│       ├── authors.json     # 作者索引
│       └── dynasties.json   # 朝代索引
├── src/                     # 後端管線（TypeScript, pdfjs-dist）
├── pdfs/                    # 來源 PDF 檔案
├── TODO.classic-han-library/  # 古典文本系統規格文件
├── TODO.resources-pull/       # 資源擴展規格文件
└── reference-docs/            # 參考文獻
```

## 資料格式

注釋使用 **flat annotation model**（每條注釋透過 `TextRange` 精確定位到字元偏移量）：

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

注釋類型（`kind`）：`pronunciation`（注音）、`semantic`（釋義）、`etymology`、`note`、`definition`。

## 開發指南

### SSR 注意事項

- `useData` 在 SSR 時直接讀檔，在 CSR 時 fetch JSON
- 禁止在 SSR 環境使用 `document`、`window`（用 `import.meta.env.SSR` 保護）
- `createRouterInstance()` 必須每次建立新實例（vite-ssg 要求）

### 新增注釋類型

1. 在 `types.ts` 的 `Annotation.kind` union 中新增類型
2. 在 `AnnotationTooltip.vue` 中新增對應的 badge 顯示
3. 在 `VerticalScroll.vue` / `HorizontalDisplay.vue` 的 `:deep(.ann-target)` 樣式中新增對應顏色

## 部署

推送至 `main` 分支即自動部署至 GitHub Pages（透過 GitHub Actions）。

詳見 `.github/workflows/deploy.yml`。

## 技術棧

| 層 | 技術 |
|----|------|
| 前端 | Vue 3 Composition API + TypeScript |
| 建置 | Vite 8 + vite-ssg（Static Site Generation） |
| 樣式 | CSS Custom Properties（無框架） |
| 資料管線 | TypeScript + pdfjs-dist |
| 部署 | GitHub Pages + GitHub Actions |
| 字體 | Noto Serif TC / Noto Sans TC（Google Fonts） |
