# PCPriceProxy — 台灣電腦零組件即時比價

整合 **原價屋（CoolPC）**、**欣亞（Sinya）**、**Autobuy** 三大通路的 DIY 電腦零件價格，
將同一型號商品跨店合併成一張比價卡，並提供依零件特性設計的多層分類側欄。

## 功能特色

- **跨店比價**：同 SKU 以精確鍵合併（CPU 型號、GPU 晶片+產品線+VRAM、HDD 原廠料號、RAM 規格+產品線），輔以模糊比對與價差護欄，寧可分開也不誤併。
- **零件語意分類**：19 個主分類、依實際資料設計的多層子分類——主機板 `CPU 腳位 > 晶片組 > 板廠`、顯卡 `系列 > 型號 > [多顯存才分容量] > 品牌`、電源 `尺寸 > 瓦數 > 認證 > 模組`、記憶體含「伺服器記憶體」、**機殼** `最大板型 > 品牌 > 系列`（含 `機架式 / 工業`）、**散熱** `AIO 冷排 mm｜空冷高度階｜配件`（水冷不與空冷混、高度只信「高 N」）、**螢幕**側欄 `尺寸 > 品牌` ＋工具列 facet（面板／更新率／解析度；缺值寫「未標示」）、鍵盤 `機制 > 軸 > 有線/無線 > 品牌`、滑鼠 `用途 > 有線/無線 > 品牌`、耳機/麥克風 `產品大類 > 品牌`、喇叭 `型態 > 品牌`、網通 `設備類型 > 品牌`、線材 `大類 > 細類`、作業系統 / 軟體、整機/組合（含伺服器/工作站、搭購價單品）。
- **零件分類只放單品淨價**：搭板價、限組裝、組裝價、加購優惠等**條件價單品**移到「整機/組合 > 搭購價單品」，避免同一顆 CPU 多張價卡。
- **資料清洗**：整機/筆電/掌機/工作站歸組合；電競椅、印表機、電源擴充線、分體水冷接頭誤入 AIO、筆電散熱墊、伺服器 RDIMM 等自動修正/過濾。組合以「加號後接品牌」為準，不讓 `NITRO+`、`低藍光+不閃屏` 假加號當搭售。
- **孤兒列自動汰除**：每輪爬完清掉同來源未刷新商品；空結果不清。
- **管線稽核**：`npm run audit` 32 項（分類污染、重複卡、假組合、條件價外洩、價差異常等），全 PASS 才算健康。

## 快速開始

Windows 可直接雙擊專案根目錄的 `start.cmd`。腳本會自動檢查環境、在需要時安裝依賴、避免重複啟動服務，並在健康檢查通過後開啟瀏覽器。

```bash
npm install
npm run dev            # 啟動開發伺服器（tsx watch，啟動即爬一次三家）
# 開啟 http://localhost:3000
```

若只想檢查啟動條件而不啟動服務，可執行 `start.cmd -CheckOnly -NoBrowser`。

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
