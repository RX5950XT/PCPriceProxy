# PCPriceProxy 核心零組件命名分析與分類規劃

## 核心任務
分析 `data/pcprice.db` 中核心零組件（CPU, 主機板, 顯示卡, 記憶體 RAM, SSD, HDD, 散熱器）的 `raw_name` 命名特徵，調查三大通路在品名中放置容量、頻率、世代、晶片、大小等規格的規律，並提出一套更為精細、對齊的零件多層級分類規劃（包含如何用 Regex 或 Keyword 提取），最後將調查結果與優化分類規劃彙整回報。

---

## 規劃項目

### 1. 資料庫探勘與通路命名特徵調查 [x]
- [x] 撰寫探勘腳本（Python 或 Node.js）讀取 `data/pcprice.db`。
- [x] 統計與分析各大通路（原價屋、欣亞、Autobuy）對於 CPU、主機板、顯示卡、記憶體 RAM、SSD、HDD、散熱器的品名結構。
- [x] 分析規格（如容量、頻率、世代、晶片組、尺寸大小等）在品名中的常見位置、格式規律。

### 2. 多層級分類規劃設計 [x]
- [x] 為 7 大核心零組件設計標準化的多層級樹狀結構（例如：`主分類 > 第一層 > 第二層 > [第三層]`）。
- [x] 定義每層分類的 Regex 提取規則或關鍵字條件。
- [x] 提供精確的欄位提取對照表。

### 3. 重構分類器與否定過濾器 [x]
- [x] 重構 `src/processing/categorizer.ts`。
- [x] 為 CPU, 主機板, 顯示卡, RAM, SSD, HDD, 散熱器實作「否定過濾器 (Negative Filters)」，排除污染源。
- [x] 根據報告中設計的規則，實作 7 大零組件的多層級 `detectSubcategory` 提取邏輯。
- [x] 驗證 TypeScript 編譯無誤。

### 4. 資料庫最終大清洗與重建 [x]
- [x] 撰寫清洗腳本 `src/scripts/clean-and-rebuild.ts`。
- [x] 執行清洗腳本，重新校正 `data/pcprice.db` 的 `category` 與 `subcategory`，並重新跑 Jaccard 重建 `match_groups`。
- [x] 前端 Dashboard 導航驗證。
- [x] 在前端實作 `compareNodes` 自定義語義排序，解決分類選單順序混亂問題。

### 5. 彙整報告與成果提交 [x]
- [x] 在 artifact 目錄產出 `analysis_results.md` 詳細報告。
- [x] 更新 `CONTEXT.md` 以記載此次分析與重構清洗成果。
- [x] 使用 `send_message` 向 parent 匯報關鍵結論與文件路徑。

---

## 回顧 (Review)
- **命名與規格規律**：整理出三大通路命名時的字眼隔離符號（圓括號、中括號、角括號、斜線）與規格位置特徵。
- **資料污染定位**：明確定位了筆電/掌機/迷你電腦污染 CPU 分類，支撐架/顯卡長度描述機殼污染顯示卡分類，以及 SSD/外接盒/散熱片污染硬碟分類的現狀。
- **多層級提取規則**：針對 7 大核心硬體設計了標準多層級分類，並提供了對應的否定過濾器、Regex 與 Keyword 提取條件，儲存於 [analysis_results.md](file:///C:/Users/rx595/.gemini/antigravity-cli/brain/1f28e5b8-b2ad-41e0-8245-e7094f16fc0e/analysis_results.md) 報告中。
- **分類器重構完成**：已將上述規則與排除機制落實於 `src/processing/categorizer.ts`，並通過 TypeScript 類型編譯。
- **自定義語義排序**：前端已追加語義排序器，解決了子選單中記憶體世代、頻率、容量、CPU腳位/系列、GPU晶片代別等一團混亂的無序狀態。
