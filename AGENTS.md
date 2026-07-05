# AGENTS.md - 專案通用規範

## 開發指令
- 啟動開發伺服器：`npm run dev`
- 編譯 TypeScript：`npm run build`
- 執行測試：`npm run test`
- 執行測試爬取：`npm run scrape:test`
- 管線稽核：`npm run audit`
- 清洗 DB 並重建比價組：`npx tsx src/scripts/clean-and-rebuild.ts`

## 程式碼規範
- 一律使用 **TypeScript**，遵循嚴格模式（strict: true）。
- 模組導入使用 ESM 格式，本地檔案導入須加副檔名 `.js` (例如 `import { foo } from './bar.js'`)。
- 優先不可變資料，不直接修改既有物件。
- 函數盡量小於 50 行，檔案盡量小於 800 行，巢狀不超過 4 層。
- 錯誤處理：使用 `src/shared/errors.ts` 定義的結構化錯誤，不可靜默吞掉錯誤。
- 語言與回覆：一律使用繁體中文（臺灣用語）。

## 架構與關鍵模組
- 資料流：scrape → `normalizer` → `categorizer` → `diy-filter` → `matcher` → `products` / `match_groups`（聚合表）。非 `DIY_CATEGORIES` 與假 PACKAGE 不寫入 DB。
- 分類邏輯集中在 `src/processing/categorizer.ts`：`detectCategory`（關鍵字＋否定過濾器＋隱式偵測 PSU/SSD/MB/GPU/HDD）與 `detectSubcategory`（多層 `A > B > C`，用 `hierarchy()` 截斷未知層級、避免「其他X」噪音）。來源 category 不可信時要在 `categorizeProduct` 覆核，尤其 CPU 來源主機板、GPU 來源整機、PSU 行動電源、CASE 掌機包、OS 燒錄機、SPEAKER 內建喇叭螢幕。
- **組合 vs 條件價單品**：`isRealBundle`（真組合/整機/筆電、A+B 接真零件、CPU+GPU+RAM+儲存完整規格機、欣亞PC/電競電腦等通路整機、周邊套裝）才歸 PACKAGE；`detectPriceCondition`（搭板/限組裝/套裝搭購…）只記 `specs.priceCondition`、單品仍歸真分類。A+B 比對前**先中和假加號**（相電源/機殼clearance/PSU認證 80+~92+/容量加號），避免單品被自身規格誤判成組合。`matcher` 排除帶 `priceCondition` 者的跨店比價。
- CPU 子分類只輸出規格層級：Ryzen 9/7/5、Threadripper 獨立、Intel 10 代以上與 Core Ultra 200S；不要加入 `高階` 這類行銷詞，也不要讓 Intel 第 1~9 代孤立節點污染側欄。
- GPU 型號比對不可掃未清理的裸數字；`gpuModelSearchText()` 需先移除價格、MHz、cm、瓦數，避免價格/時脈被誤判成 RX/RTX 型號。audit 的 `GPU model collision` 必須維持 0。
- GPU 精確比對鍵在 `categorizer.gpuMatchKey`，需含晶片、產品線、VRAM 與顏色/OC 等 SKU 變體；非 PACKAGE 分類用 `matcher.exactMatchKey` 的「分類 + 品牌 + 顯示名」收斂同顯示名重複列。exact group 必須把同 key 全部商品回寫同一個 `match_group_id`，避免非代表列變成 `mg-*` 重複卡；Dashboard render 再從 group products 選每來源最低價顯示。
- `normalizer.normalizeName` 不可清掉會影響 SKU 的變體：顏色、鍵盤軸體、風扇單顆/3IN1/反向、散熱膏克數、主機板 W/ICE、AIO 白龍/黑白等要保留；來源噪音（供電相數、socket、主機板/水冷等通用詞、色版、`G/GB`）要 canonicalize，不要讓同 SKU 跨店落單。`matcher` fuzzy 比對遇到顏色或鍵盤軸體衝突必須跳過。
- 跨店合併驗證不能只看 exact split；還要掃「跨來源、同分類品牌、相近價位、高相似標題但不同 match group」候選，並用 live API 驗證代表樣本。`match_groups.lowest_price/highest_price` 必須用每來源最低代表價計算，避免同來源重複高價造成假價差異常。全庫驗證以 `Exact duplicate split keys = 0`、`Price anomalies = 0` 與候選掃描為準。
- 子分類排序單一邏輯在 `src/shared/subcategory-sort.ts`，API 與 Dashboard 都要用分類語意排序；不可用泛用 `Intel/AMD` 字串或 DB count 排主機板/GPU/CPU/RAM 樹。
- 分類顯示名/圖示/排序集中在 `src/shared/constants.ts` 的 `CATEGORY_META`（單一真相）；品牌正規化用 `KNOWN_BRANDS` + `BRAND_ALIASES`，抽取一律走 `normalizer.extractBrand`（勿在 scraper 重複實作）。
- 前端 Dashboard 拆成 `src/api/dashboard.ts`（模板）＋ `dashboard/styles.ts`＋`dashboard/script.ts`；側欄分類樹資料驅動自 `/api/v1/categories`。
- 新增主分類時：在 `ProductCategory` enum、`CATEGORY_META`、各來源 category map 補齊即可，側欄會自動出現。

## 開發注意
- tsx watch 每次存檔會重啟並立即重爬；批次改完再驗證。
- `npm run build` 不會複製 `schema.sql` 到 `dist`，純 `node dist` 啟動需另行複製。
- 改分類後可用 `npx tsx src/scripts/clean-and-rebuild.ts` 套用到既有 DB（無需重爬）。
- `npm run scrape:test` 會顯示 source category 與 pipeline category；判斷分類正確性以 pipeline 後結果與 `npm run audit` 為準。
