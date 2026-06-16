# 開發教訓與重複錯誤預防

## 1. 前端 Dashboard 不可用無參數的 O(n²) Match
- **問題**：預設載入時呼叫 `matchProducts(15000筆)` → O(n²) Jaccard 比較 → 頁面卡死或空白
- **規則**：Compare API 不帶 query 時限制商品數（加 `limit`）；前端預設展示 `/api/v1/products` 列表，compare 只在有搜尋詞時觸發

## 2. Hono 路由順序：靜態優先於動態
- **問題**：`/:name/refresh` 動態路由若比 `/refresh` 靜態路由先定義，`POST /refresh` 會被誤判為 name='refresh' 觸發動態路由
- **規則**：Hono 路由定義順序—靜態路由必須在動態路由（`:param`）之前

## 3. 非同步 Scraper 不要同步等待
- **問題**：重新整理按鈕直接 `await` 多個 scraper（最慢 24 秒），導致 HTTP timeout、前端誤判失敗
- **規則**：長時間 scraping 操作用 fire-and-forget；前端用輪詢（polling status endpoint）判斷完成時機

## 4. SQLite UTC 時間需加 'Z' suffix
- **問題**：`datetime('now')` 回傳 `2026-06-16 11:00:00`，JS `new Date()` 解析為本地時間（UTC+8），導致計算 age 差 8 小時，所有 source 被誤判為 `stale`
- **規則**：從 SQLite 取出時間字串後，若不含 `T` 需做 `.replace(' ', 'T') + 'Z'` 再餵給 `new Date()`

## 5. replace_file_content 工具有時會意外引入不存在的 import
- **問題**：修改 sources.ts 時，工具自動加入了 `import { runAllScrapers } from '../../scheduler/runner.js'`（不存在的模組）
- **規則**：大範圍重寫用 `write_to_file` + `Overwrite:true`，不用 replace 避免工具推斷錯誤

## 6. 關鍵字分類器之優先權與排除規則
- **問題**：簡短關鍵字（如 "CPU"）容易被其他零組件（如 "支援 CPU 限高" 的機殼）規格品名污染，若優先級太高會導致大量錯置。
- **規則**：容易被污染的分類（如 CPU）應排在最後偵測，並加上嚴格排除詞名單（機殼、散熱、主機板、限高、支架等）。

## 7. SQLite 分頁效能與實體化聚合表 (Materialized View)
- **問題**：在 SQLite 2萬筆資料上頻繁執行 `GROUP BY` 與聚合函數（`MIN` / `MAX`）及分頁，每次查詢耗時 100-200ms。
- **規則**：可在背景將匹配統計結果預先計算並寫入一張獨立的實體化表 `match_groups`，API 分頁直接讀取該表，耗時可降至 <3ms。

## 8. SQLite 暫存檔 (.db-wal / .db-shm) 需排除 Git 提交
- **問題**：寫入 SQLite 時生成的 `-shm` 與 `-wal` 臨時寫前日誌，如果僅寫 `data/*.db` 會被 Git 追蹤並意外 Commit。
- **規則**：`.gitignore` 中必須補上 `data/*.db-*` 以完整排除所有資料庫快取與鎖定檔。

## 9. 顯示卡分類被機殼規格字眼（顯卡長）與配件（顯卡排線）污染
- **問題**：機殼品名含 "顯卡長32cm"、配件品名含 "顯卡排線" 導致被誤判成 GPU 類別。
- **規則**：除了設定嚴格的 GPU 排除詞，亦應在 `detectCategory` 加強「隱式機殼判定」（如同時含顯卡長與CPU高之品名），直接歸類為 CASE，且對 GPU 追加 "排線"、"播放器" 等否定詞。
