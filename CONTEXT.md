# 開發交接上下文 (CONTEXT.md)

## 專案現況
PCPriceProxy 已全面完成重構與性能優化。本專案整合了原價屋、欣亞、Autobuy 三大通路的電腦零件價格，支援 MatchGroup 跨店整合比價卡片，並提供類似欣亞設計的左側多級展開摺疊選單樹。

## 系統運作狀態（已驗證）
- **商品分類純淨度**：✅ 徹底解決命名交叉污染問題！
  * CPU 分類已用過濾器將筆電、掌機 (Ally/Claw/Deck) 及準系統完全排除，CPU 池從數千件髒數據精煉為 256 件純淨 CPU 本體。
  * 顯示卡已將機殼 (如品名含顯卡長)、顯卡支撐架、顯卡排線/轉接線、Shield TV 播放器等非顯卡本體數據徹底過濾。
  * SSD/HDD 已完全排除外接盒、散熱片、托架及轉接卡等配件污染。
- **多級層次子分類 (A > B > C)**：✅ 重構 `detectSubcategory` 以提取階層關係，前端遞迴渲染多層手風琴摺疊選單：
  * **CPU**：`品牌 > 腳位世代 > 系列等級`（例如 `AMD > AM5 > Ryzen 7`）。
  * **主機板**：`晶片組平台 > 尺寸大小 > 記憶體世代`（例如 `Intel B760 > Micro-ATX > DDR5`）。
  * **顯示卡**：`晶片系列 > 核心型號 > 視訊記憶體 VRAM`（例如 `NVIDIA RTX 50系列 > RTX 5060 Ti > 8G`，支援最新 RTX 50 與 RX 9000 系列及工作站繪圖卡分層）。
  * **記憶體 RAM**：`適用裝置 > 世代 > 總容量與通道 > 頻率`（例如 `桌上型 UDIMM > DDR5 > 32G (16G*2) > 6000MHz`）。
  * **SSD**：`介面類型 > PCIe 世代 > 容量 > 尺寸規格`（例如 `M.2 NVMe SSD > PCIe 4.0 > 1TB > 2280`）。
  * **HDD**：`應用領域類型 > 尺寸 > 容量 > 轉速`（例如 `NAS 專用碟 > 3.5 吋 > 4TB > 7200轉`）。
  * **散熱器**：`散熱類型 > 規格尺寸 > 燈光效果`（例如 `一體式水冷 (AIO) > 360mm > ARGB`）。
- **組合促銷過濾**：✅ package 獨立分類，自動過濾並清理 Autobuy 及各大通路的大量搭購組合包。
- **加載速度優化**：✅ 針對 2 萬多筆商品的分群比價建立 `match_groups` 實體聚合表，查詢速度優化至 <3ms。
- **折疊樹狀選單**：✅ 點選主分類展開子分類；當點選最小子分類或品牌時，預設自動將排序改為「價格由低到高」，極致提升比價導航體驗。

## API 端點（http://localhost:3000）
- `GET /` — 左側多層折疊分類與品牌篩選比價 Dashboard
- `GET /api/v1/health` — 健康狀態
- `GET /api/v1/products` — 比價商品（查 `match_groups` 表，支援 limit/page/category/subcategory/brand/q/sort/has_multiple_sources 參數）
- `GET /api/v1/categories` — 主分類列表
- `GET /api/v1/categories/:category/subcategories` — 主分類下子分類統計
- `GET /api/v1/categories/:category/brands` — 指定分類/子分類下的品牌名單與統計
- `POST /api/v1/sources/refresh` — 背景重新整理與重建 `match_groups` 聚合表

## 重大改動與修復歷史
1. **多層級規格分類器**：於 `src/processing/categorizer.ts` 內重構 `detectCategory` 與 `detectSubcategory`，導入針對 CPU, 主機板, 顯示卡, 記憶體, SSD, HDD, 散熱器的「否定過濾器 (Negative Filters)」與精準 Regex，以及對機殼的隱式規格判定。
2. **大數據清洗與重建**：建立 `src/scripts/clean-and-rebuild.ts` 腳本，對資料庫中 20,939 筆商品的 `category` 與 `subcategory` 進行了全面的校正清洗（10,658+ 筆商品修正），並重建了 `match_groups` 聚合表。
3. **前端多級樹狀解析與語義排序**：優化左側垂直 Accordion 手風琴，遞迴解析 `A > B > C > D` 子分類字串並完美展開收起。新增了 `compareNodes` 語義排序器，解決子分類順序混亂問題，且在點選最小子類別或品牌時自動切換為價格由低到高排序。

## 啟動方式
```bash
npm run dev           # 啟動開發伺服器（tsx watch）
npm run scrape:test   # 測試各通路爬蟲
npx tsx src/scripts/clean-and-rebuild.ts # 手動執行資料庫清洗與 match_groups 重建
```

