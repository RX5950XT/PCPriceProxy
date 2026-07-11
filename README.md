# PCPriceProxy — 台灣電腦零組件即時比價

整合 **原價屋（CoolPC）**、**欣亞（Sinya）**、**Autobuy** 三大通路的 DIY 電腦零件價格，
將同一型號商品跨店合併成一張比價卡，並提供依零件特性設計的多層分類側欄。

## 功能特色

- **跨店比價**：同 SKU 以精確鍵合併（CPU 型號、GPU 晶片+產品線+VRAM、HDD 原廠料號、RAM 規格+產品線），輔以模糊比對與價差護欄，寧可分開也不誤併。
- **零件語意分類**：19 個主分類、依實際資料設計的多層子分類——主機板 `CPU 腳位 > 晶片組 > 板廠`（`AMD AM5 > B850 > MSI`）、顯卡 `系列 > 型號 > [多顯存才分容量] > 品牌`（`RTX 5090 > GIGABYTE`）、電源 `尺寸 > 瓦數 > 認證 > 模組`（`SFX-L 電源 > 750W~1000W > 80+ 白金牌`）、記憶體含「伺服器記憶體」層、機殼 `品牌 > 系列`（`Lian Li > O11`）、鍵鼠/耳機/喇叭/網通 `品牌 > 類型`（`Logitech > 無線`）、線材 `類型`（`影音線`・`機內排線 / 延長線`）、作業系統 / 軟體 `作業系統 > Windows 11`・`應用軟體 > 防毒軟體`、整機/組合 `整機電腦・伺服器 / 工作站・筆電・準系統・掌機・零件組合・搭購價單品`；依晶片組世代 / GPU 世代 / 容量做語意排序。
- **零件分類只放單品淨價**：搭板價、限組裝、組裝價、加購優惠等**條件價單品**（買主機板才有的價格）移到「整機/組合 > 搭購價單品 > 原零件分類」，避免同一顆 CPU 出現多張價格不一的卡。
- **資料清洗**：整機/筆電/掌機/工作站歸「整機/組合」；電競椅、印表機、電源擴充線、硬碟外接盒、AIO 水冷誤入 CPU、伺服器 RDIMM 誤入桌上型等污染自動修正/過濾。組合判定以「加號後接品牌」為準，不讓 `NITRO+ 顯示卡`、`FK1+-B 電競滑鼠`、`低藍光+不閃屏 IPS螢幕` 這類假加號被當成搭售組合。
- **孤兒列自動汰除**：每輪爬完清掉同來源未被刷新的商品（已下架、或改分類後不再入庫），空結果不清以免爬取異常清空來源。
- **管線稽核**：`npm run audit` 29 項自動化檢查（分類污染、重複卡分裂、假組合、條件價外洩、舊分類殘留、價差異常），全 PASS 才算健康。

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

Base URL：`http://localhost:3000/api/v1`。所有回應統一 `{ success, data, error?, metadata? }`；分頁資訊在 `metadata`（`total / page / limit`），命中快取加 `cachedAt`。全域 rate limit 100 req/分、已開 CORS。

### 讀取

| 方法 | 端點 | 說明 |
|---|---|---|
| GET | `/health` | 健康檢查：狀態、uptime、商品總量、各來源件數 |
| GET | `/products` | 比價卡列表（讀 `match_groups`）；篩選參數見下表 |
| GET | `/products/:id` | 單一商品明細 |
| GET | `/products/:id/history` | 該商品價格歷史 |
| GET | `/categories` | 主分類（含中文 label、icon、排序、組數，依 order 排序） |
| GET | `/categories/:category` | 該分類的商品列表（分頁） |
| GET | `/categories/:category/subcategories` | 子分類樹統計（語意排序） |
| GET | `/categories/:category/brands` | 品牌統計（可帶 `?subcategory=`） |
| GET | `/compare` | 即時跨店比價組；帶 `?q=` 只比對搜尋結果，不帶則全庫（重運算，日常用 `/products`） |
| GET | `/sources` | 三來源爬取狀態與件數 |

### 觸發重爬

| 方法 | 端點 | 說明 |
|---|---|---|
| POST | `/sources/refresh` | 背景非同步重爬三家並重建比價組，立即回覆 |
| POST | `/sources/:name/refresh` | 同步重爬單一來源（`coolpc` / `sinya` / `autobuy`），完成才回覆 |

**`/products` 篩選參數**：`category`、`subcategory`、`brand`、`q`（關鍵字）、`source`（coolpc/sinya/autobuy）、`price_min`、`price_max`、`in_stock`、`has_multiple_sources`（只看跨店可比價）、`sort`（`updated`/`price_asc`/`price_desc`/`name`）、`page`、`limit`（預設 50）。

```bash
curl 'http://localhost:3000/api/v1/products?category=cpu&q=9800X3D&has_multiple_sources=true'
```

## 部署

專案是**帶排程的常駐 Node 服務**（SQLite 本機檔，非 serverless），已備妥容器化：

```bash
docker compose up -d --build   # 3000 埠、掛 ./data 持久化 SQLite、每 30 分自動重爬
```

`docker-compose.yml` 已設好 volume（`./data`）、埠與環境變數（`PORT` / `SCRAPE_INTERVAL_MINUTES` / `DATABASE_PATH`）；`Dockerfile` 多階段建置並代為複製 `schema.sql`（`npm run build` 本身不複製）。前面再擋 Nginx / Caddy 上 HTTPS、綁網域即為正式站；資料備份只需備份 `./data`。

## 架構

```
src/
├── scrapers/       # coolpc / sinya / autobuy 三家爬蟲
├── processing/
│   ├── normalizer.ts   # 名稱清理、品牌/型號抽取（KNOWN_BRANDS + BRAND_ALIASES）
│   ├── categorizer.ts  # 分類 + 多層子分類（關鍵字、否定過濾器、隱式偵測）
│   ├── diy-filter.ts   # 非 DIY 分類不入庫
│   └── matcher.ts      # 跨店合併（精確鍵 → 模糊比對 + 價差護欄）
├── ingest.ts       # 管線 + upsert + 汰除孤兒列（scheduler / refresh API 共用）
├── storage/        # SQLite（better-sqlite3）+ match_groups 聚合表
├── api/            # Hono routes + Dashboard（伺服端模板）
└── scripts/        # audit-pipeline / clean-and-rebuild / scrape-test
```

資料流：`scrape → normalize → categorize → diy-filter → upsert + 汰除孤兒列 → match → products / match_groups`。

## 開發須知

維護規範見 [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md)，
開發交接紀錄見 [CONTEXT.md](CONTEXT.md)，歷史教訓見 [tasks/lessons.md](tasks/lessons.md)。
改動分類或比對邏輯後，務必依序執行：`npm run test` → `clean-and-rebuild` → `npm run audit`（全 PASS）。
