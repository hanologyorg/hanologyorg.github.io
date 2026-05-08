# 漢流 — 古典漢語文本數位圖書館

古典漢語文本數位圖書館，收錄五部典籍共 271 篇：

| 典籍 | 篇數 | 文體 |
|------|------|------|
| 積累與感興（教育局小學古詩文誦讀材料） | 100 | 詩歌 |
| 積學與涵泳（教育局中學古詩文誦讀材料） | 150 | 詩文 |
| 帛書老子 甲本 | 26 | 散文（多層注釋） |
| 帝範 | 17 | 散文 |
| 臣軌 | 13 | 散文 |

## 快速開始

```bash
# 安裝依賴
npm install
cd site && npm install && cd ..

# 開發伺服器
cd site && npm run dev

# 生產建置（SSG）
cd site && npm run build

# 本地預覽
cd site && npm run preview
```

## 專案結構

```
├── content/                 # CHAM 格式文本（管線輸入）
│   ├── primary/             # 積累與感興（100 篇）
│   ├── secondary/           # 積學與涵泳（150 篇）
│   ├── laozi/               # 帛書老子（26 章）
│   ├── difan/               # 帝範（17 篇）
│   └── shengui/             # 臣軌（13 篇）
├── data/                    # 註冊表（YAML）
│   ├── authors.yaml         # 人物/作者
│   ├── dynasties.yaml       # 朝代
│   ├── eras.yaml            # 紀年（652 行）
│   ├── lexicon.yaml         # 全局發音詞表
│   ├── places.yaml          # 地名
│   └── events.yaml          # 事件
├── resources/               # 權威來源（PDF、text.md、MP3）
├── src/                     # 後端管線（TypeScript）
│   └── cham/                # CHAM 解析器、序列化器、管線
├── scripts/                 # 建構與轉換腳本
├── site/                    # 前端（Vue 3 + vite-ssg）
│   ├── src/
│   │   ├── types.ts         # 資料型別
│   │   ├── composables/     # Vue composables
│   │   ├── components/      # Vue 元件
│   │   └── views/           # 頁面元件
│   └── public/data/         # 管線輸出 JSON
│       ├── library.json     # 圖書館索引
│       ├── books/           # 各典籍資料
│       ├── authors.json     # 作者索引
│       └── dynasties.json   # 朝代索引
└── reference-docs/          # W3C 直排參考、ISO 文件
```

## 資料格式

內容使用 **CHAM**（Classical Han Annotation Markup）格式，以 `{N}...{/N}` 標記注釋範圍，支援多層注釋（如王弼註、河上公註）。詳見 `CHAM-spec.md`。

管線從 `content/`（CHAM）+ `data/`（註冊表）生成 `site/public/data/` JSON，前端直接載入。

## 開發指南

- SSR 環境禁止使用 `document`、`window`（用 `import.meta.env.SSR` 保護）
- `createRouterInstance()` 必須每次建立新實例（vite-ssg 要求）
- 支援直排（vertical-rl）與橫排雙模式

## 部署

推送至 `main` 分支即自動部署至 GitHub Pages（`.github/workflows/deploy.yml`）。

## 技術棧

| 層 | 技術 |
|----|------|
| 前端 | Vue 3 Composition API + TypeScript |
| 建置 | Vite + vite-ssg（Static Site Generation） |
| 樣式 | CSS Custom Properties（無框架） |
| 內容格式 | CHAM（自訂標記語言） |
| 資料管線 | TypeScript |
| 部署 | GitHub Pages + GitHub Actions |
| 字體 | Noto Serif TC / Noto Sans TC |
