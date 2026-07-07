# PCPriceProxy — 台灣電腦零組件即時比價

整合 **原價屋（CoolPC）**、**欣亞（Sinya）**、**Autobuy** 三大通路的 DIY 電腦零件價格，
將同一型號商品跨店合併成一張比價卡，並提供依零件特性設計的多層分類側欄。

## 功能特色

- **跨店比價**：同 SKU 以精確鍵合併（CPU 型號、GPU 晶片+產品線+VRAM、HDD 原廠料號、RAM 規格+產品線），輔以模糊比對與價差護欄，寧可分開也不誤併。
- **零件語意分類**：20 個主分類、多層子分類（如 `Intel Z890 > MSI > ATX > DDR5`、`桌上型硬碟 > 3.5 吋 > 8TB > 7200轉`），依晶片組世代 / GPU 世代 / 容量做語意排序。
- **資料清洗**：整機/筆電/掌機歸「整機/組合」；搭板價、限組裝、加購優惠等條件價單品標記後排除跨店比價；電競椅、印表機、充電座等非 DIY 商品自動過濾。
- **管線稽核**：`npm run audit` 22 項自動化檢查（分類污染、重複卡分裂、假組合、價差異常），全 PASS 才算健康。

## 快速開始

```bash
npm install
npm run dev            # 啟動開發伺服器（tsx watch，啟動即爬一次三家）
# 開啟 http://localhost:3000
```

常用指令：

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器（含排程爬取，每 30 分鐘一輪） |
| `npm run build` | TypeScript 編譯（注意：不會複製 `schema.sql` 到 dist） |
| `npm run test` | Vitest 測試（分類/正規化/比對 regression） |
| `npm run scrape:test` | 測試爬取，輸出 source 與 pipeline 分類對照 |
| `npm run audit` | 管線稽核（污染 / 重複卡 / 價差異常 全項須 PASS） |
| `npx tsx src/scripts/clean-and-rebuild.ts` | 用最新分類邏輯清洗既有 DB 並重建比價組（免重爬） |

## API

Base URL：`http://localhost:3000/api/v1`

| 端點 | 說明 |
|---|---|
| `GET /health` | 各來源爬取狀態與商品數 |
| `GET /products` | 比價卡列表（`category` / `subcategory` / `brand` / `q` / `sort` / `has_multiple_sources` / 分頁） |
| `GET /categories` | 主分類（含中文 label、icon、排序、組數） |
| `GET /categories/:category/subcategories` | 子分類樹統計（語意排序） |
| `GET /categories/:category/brands` | 品牌統計 |
| `POST /sources/refresh` | 背景重爬並重建比價組 |

回應格式統一 `{ success, data, metadata? }`。

## 架構

```
src/
├── scrapers/       # coolpc / sinya / autobuy 三家爬蟲
├── processing/
│   ├── normalizer.ts   # 名稱清理、品牌/型號抽取（KNOWN_BRANDS + BRAND_ALIASES）
│   ├── categorizer.ts  # 分類 + 多層子分類（關鍵字、否定過濾器、隱式偵測）
│   ├── diy-filter.ts   # 非 DIY 分類不入庫
│   └── matcher.ts      # 跨店合併（精確鍵 → 模糊比對 + 價差護欄）
├── storage/        # SQLite（better-sqlite3）+ match_groups 聚合表
├── api/            # Hono routes + Dashboard（伺服端模板）
└── scripts/        # audit-pipeline / clean-and-rebuild / scrape-test
```

資料流：`scrape → normalize → categorize → diy-filter → match → products / match_groups`。

## 開發須知

維護規範見 [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md)，
開發交接紀錄見 [CONTEXT.md](CONTEXT.md)，歷史教訓見 [tasks/lessons.md](tasks/lessons.md)。
改動分類或比對邏輯後，務必依序執行：`npm run test` → `clean-and-rebuild` → `npm run audit`（全 PASS）。
