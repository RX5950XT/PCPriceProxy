# PCPriceProxy — 第十三輪：分類側欄準確化 + 儲存/RAM 合併鍵強化

## 本輪需求（使用者）
- [x] 側欄分類更易用、更符合電腦零件特性。
- [x] 確認爬到真實資料（三家 live 爬取成功）。
- [x] 相同型號零件合併比價（HDD/RAM 合併鍵強化）。
- [x] 優化網站與 API、更新維護文件。

## 執行計畫
- [x] P1 修 NETWORK 污染（掌機→PACKAGE、印表機/充電座/耳麥/鍵鼠→重判）並拆「其他網通設備」為 攝影機/Mesh/路由器/網卡/NAS/線材。
- [x] P2 修 HDD 污染（Razer 梭魚耳機、RPM 風扇、HDMI 線）、監控碟獨立子分類；SSD 外接盒（USB10G）過濾與容量抽取修正；FAN 尺寸從型號抓（TF120/TL140）。
- [x] P3 修 `RE_GPU_MODEL` Ti/XT 黏尾漏判（→(?!\d)）；FAN 污染過濾器（GPU/PSU/AIO/配件）；KEYBOARD 家具過濾（電競椅/桌 277 件）。
- [x] P4 matcher：HDD 料號鍵（MPN 優先，分 SATA/SAS）＋規格鍵（品牌+系列+容量+轉速）；exact key 改 token 集合（語序不敏感）；RAM 產品線+套件判別鍵；加購優惠→條件價。
- [x] P5 驗證：72 tests、build、clean-and-rebuild、audit 22 項全 PASS、live 三家重爬 + API 抽樣。
- [x] P6 更新 CLAUDE/AGENTS/CONTEXT/README/tasks 文件。

## 驗證規格
- [x] audit 全 PASS（新增 HDD non-disk / FAN non-fan / NETWORK non-network / Furniture 四項，皆 0）。
- [x] 跨店組 1,167 → 1,358（+16%）；誤併防護：EXOS SATA/SAS 分開、KVR/FURY 分開、單條/雙通分開、價差異常=0。

### 本輪回顧
- 側欄清理：FAN「其他尺寸」545→176、NETWORK「其他網通」694→288、HDD 污染 -131 件、KEYBOARD 家具 -277 件、SSD 假「10GB」節點歸零。
- 合併強化：HDD 內接碟以原廠料號（ST*/WD*/HDW*）為最強鍵；exact key token 集合化讓 RAM/周邊跨店語序差異不再擋合併（RAM 跨店 17→33 組、FAN 1→98 組）。
- 關鍵原則：display name 給人看、合併 key 從 raw_name 抽判別資訊（括號內的 KVR/KF、雙通、料號都會被 normalizeName 剝掉）。

---

# PCPriceProxy — 第十二輪：跨店相同商品落單收斂

## 本輪需求（使用者）
- [x] 仔細分析資料，把一樣的商品放在同一張跨店比價卡。
- [x] 不讓同商品落在外面，也避免不同 SKU 被誤併。

## 執行計畫
- [x] P1 全庫分析：找出 exact key 已覆蓋外的跨店高可信落單候選。
- [x] P2 補 regression tests 與 audit 指標，先鎖住真實落單樣本。
- [x] P3 修正 matcher/normalizer/品牌或分類 key，提升同商品跨店合併。
- [x] P4 重建 DB，跑 `npm run test`、`npm run build`、`npm run audit`、`npm run scrape:test`。
- [x] P5 live API 驗證代表樣本與全庫指標，更新 lessons/CONTEXT/AGENTS/CLAUDE，重啟 dev server。

## 驗證規格
- [x] `Exact duplicate split keys = 0` 維持不退步。
- [x] 新增跨店落單候選指標，不能留下高可信同商品未合併。
- [x] 代表落單樣本應合併成跨店卡，且不同容量/顏色/軸體/版本仍不可誤併。

### 本輪回顧
- 全庫掃描先從 exact split、相近價位高相似跨來源候選與代表樣本下手，修掉 GPU ICE/AERO/Low Profile、TR120 正反向與單顆/3IN1、DeathAdder 黑/白、TF8 2g/5.8g、主機板供電相數/socket、AIO 黑白/白龍、darkFlash 特殊色、Mercusys/ASUS headset 描述差等落單。
- `normalizer` 改為先剝離來源噪音再加 canonical 變體：顏色、鍵盤軸體、風扇包裝/方向、散熱膏克數、主機板供電相數/socket/白色描述、AIO 色版/三代冗字。
- `matcher.exactMatchKey` 增加品牌/別名剝離、default 黑與 G/GB 容量正規化；`match_groups` 價格統計改用每來源最低代表，避免同來源重複高價造成價差異常。
- 最終 live DB：15,806 件商品、14,182 張商品卡、1,167 組跨店比價；`Exact duplicate split keys=0`、`Price anomalies=0`、污染檢查全 PASS。`npm run test` 52 tests、`npm run build`、`clean-and-rebuild`、`npm run audit`、`npm run scrape:test`、live scheduler/API 全通過。
- live API 代表：G213 total=1（三店）；TR120 total=8（黑/白、單顆/3IN1、正/反向各自兩店）；RTX5060 ICE/RTX5050 Low Profile/RTX5080 AERO total=1（三店）；TF8 total=2（2g/5.8g 分開）；B650M、PZ 背插、MA530、Cetra、darkFlash GD100 皆按 SKU 收斂。條件價與套裝仍單例，不進跨店比價。

---

# PCPriceProxy — 第十一輪：全庫重複卡掃描與變體保留

## 本輪需求（使用者）
- [x] 檢查其他商品是否也有 `5800X3D` 類似的重複卡問題。
- [x] 對發現的同類問題修正，不把不同 SKU 當成重複刪掉。

## 執行計畫
- [x] P1 全庫掃描 CPU/GPU exact key：可比價 773 筆、288 keys，split=0、singleton leak=0。
- [x] P2 全庫掃描同顯示名分裂：發現鍵盤/滑鼠/散熱器/主機板等 54 類同名多卡，主因是 normalizer 移除顏色/軸體等 SKU 變體。
- [x] P3 補 normalizer/matcher regression tests，鎖住顏色、鍵盤軸體與同顯示名 exact group。
- [x] P4 修正 normalizer 保留變體、matcher 增加 display exact key 與 fuzzy 變體衝突保護。
- [x] P5 重建 DB，跑 test/build/audit/scrape:test 與 live API 驗證。
- [x] P6 更新 lessons/CONTEXT/AGENTS/CLAUDE 並重啟 dev server。

## 驗證規格
- [x] CPU/GPU exact key split 與 singleton leak 維持 0。
- [x] 非 CPU/GPU 的同顯示名跨 group 分裂不得再產生可見重複卡。
- [x] irocks K71M/Gateron 顯示名需保留黑/白與紅/茶/青軸；Logitech 滑鼠與 ASUS 水冷需保留顏色。
- [x] `npm run audit` 要能檢查全分類 exact duplicate split keys。

### 本輪回顧
- 全庫檢查：CPU/GPU exact key 初始 split=0、singleton leak=0；同顯示名跨 group 風險初始 54 類，集中在鍵盤/滑鼠/散熱器/主機板等非 CPU/GPU 品項。
- 根因：`normalizeName` 把括號與斜線規格全部移除，導致顏色、鍵盤軸體等 SKU 變體消失；fuzzy 也可能把顏色/軸體不同但文字高度相似的商品併錯。
- 修正：normalizer 保留顏色與鍵盤軸體；matcher 增加全分類 `exactMatchKey`（非 PACKAGE 用分類+品牌+顯示名）並全員回寫同 group；fuzzy 對顏色/軸體衝突直接跳過。
- 補洞：`RTX PRO 4500` 加入 GPU 型號/key；`麗臺 NVIDIA`/`Leadtek 麗臺` 正規化為 Leadtek，避免專業卡被品牌拆散。
- 驗證：`npm run test` 34 tests、`npm run build`、`clean-and-rebuild`、`npm run audit`、`npm run scrape:test`、live scheduler/API 全通過；live DB `exactSplitKeys=0`、`exactSingletonKeys=0`、`sameNameRisks=0`。
- live API：`5800X3D total=1`；`K71M-Gateron total=6` 且每張都帶黑/白與紅/茶/青軸；`RTX PRO 4500 total=1`，Autobuy/CoolPC/Sinya 四筆都在同一張三店卡。dev server 已開在 `http://localhost:3000`。

---

# PCPriceProxy — 第十輪：同型號重複卡片收斂

## 本輪需求（使用者）
- [x] 刪除 `AMD Ryzen7 5800X3D 十週年紀念版` 這類同型號重複卡片。
- [x] 確認 exact match 分組不再留下同 key 非代表列變成 `mg-*` 單例卡。

## 執行計畫
- [x] P1 停掉 dev/watch，查 DB 中 `5800X3D` 的 products 與 match_groups。
- [x] P2 補 matcher regression test，鎖住同 exact key 重複列必須共享同一比價組。
- [x] P3 修正 matcher 回傳整個 exact key group，並補 CPU `R7 5800X3D` 簡寫世代分類。
- [x] P4 重建 DB 並跑 `npm run test`、`npm run build`、`npm run audit`、`npm run scrape:test`。
- [x] P5 驗證 live API 不再輸出重複卡片，更新 lessons/CONTEXT/AGENTS/CLAUDE，重啟 dev server。

## 驗證規格
- [x] `5800X3D` 查詢只剩一張跨店卡，不再有欣亞/原價屋單例重複卡。
- [x] CPU exact key 不得存在有跨來源同型號卻仍是 `mg-*` 單例的列。
- [x] 前端仍以每來源最低價顯示，不因 DB 收進重複列而顯示同店多格價格。

### 本輪回顧
- 根因：exact match 只回寫每來源代表列，非代表列被 `updateMatchGroups()` 補成 `mg-*` 單例，造成同型號重複卡。
- 修正：exact group 改回傳同 key 全部商品並共享同一 `match_group_id`；Dashboard 繼續每來源取最低價顯示。
- 補洞：`AMD R7 5800X3D` 可歸到 `AMD > Ryzen 5000 (Zen3) > Ryzen 7`；audit 新增 `CPU exact duplicate singletons`。
- 驗證：`npm run test` 29 tests、`npm run build`、`clean-and-rebuild`、`npm run audit`、`npm run scrape:test`、live API `/api/v1/products?category=cpu&q=5800X3D` 全通過；API 回 `total=1`、3 來源、5 筆原始商品同在 `match-03c11d330b1d`。dev server 已開在 `http://localhost:3000`。

---

# PCPriceProxy — 第九輪：CPU label 清理 + GPU 整機污染修正

## 本輪需求（使用者）
- [ ] 刪除 CPU `Ryzen 9 / 高階` 這種多餘 label。
- [ ] 移除 Intel `第 5 代` 這種舊款孤立節點，不讓側欄分類雜亂。
- [ ] 確認顯卡資料正確，修掉欣亞整機被歸進 GPU 的污染。

## 執行計畫
- [x] P1 停掉 watch/dev，直接查 DB 中 `高階`、`第 5 代`、GPU `欣亞PC` 的原始列。
- [x] P2 補 CPU/GPU regression tests，先鎖住錯誤案例。
- [x] P3 修正 `isRealBundle`、CPU generation/series label 與 audit 污染檢查。
- [x] P4 重建 DB 並跑 `npm run test`、`npm run build`、`npm run audit`、`npm run scrape:test`。
- [x] P4b 補修 GPU 型號裸數字誤判，移除 `RX 7600 > 96G`、`RTX 3060 > 16G`、`RTX 5070 > 15G` 等錯誤節點。
- [x] P5 驗證 API/側欄資料不再出現錯誤節點，更新交接文件並重啟 dev server。

## 驗證規格
- [x] CPU 子分類不含 `高階`。
- [x] CPU 子分類不含 `第 5 代`。
- [x] GPU 分類與 match_groups 不含 `欣亞PC`、`電競電腦`、`品牌電腦` 這類整機污染。
- [x] `RTX 5060 > 16G` 不再顯示欣亞整機卡片。

### 本輪回顧
- CPU：`Ryzen 9 / 高階` 改為 `Ryzen 9`，Threadripper 獨立，Intel 第 1~9 代不再建立側欄世代節點。
- GPU：`欣亞PC`、`電競電腦`、`ZEUS 15G /C7-250H/RTX5070` 等整機不再留在 GPU；`RTX 5060 > 16G` 壞節點已消失。
- GPU 型號抽取：比對前移除價格、MHz、cm、瓦數，修掉 `$476000→RX7600`、`3060MHz→RTX3060` 這類裸數字誤判。
- 驗證：`npm run test` 29 tests、`npm run build`、`clean-and-rebuild`、`npm run audit`、`npm run scrape:test`、live scheduler/API 全通過；dev server 已開在 `http://localhost:3000`。

---

# PCPriceProxy — 第八輪：全分類資料正確性稽核 + 子分類樹排序

## 本輪需求（使用者）
- [x] 確認每個分類都有正確撈到資料。
- [x] 確認撈到的商品是否全部分類好，避免錯類、漏類、未分或子分類混亂。
- [x] 修正側欄子分類順序一團亂的問題。

## 執行計畫
- [x] P1 產出全分類 DB 稽核：主分類 count、子分類覆蓋率、每類樣本、疑似錯類樣本。
- [x] P2 檢查 `/api/v1/categories`、`subcategories` 與 Dashboard tree 建構/排序邏輯。
- [x] P3 補排序與分類 regression tests，鎖定 CPU/主機板/GPU/RAM 等畫面問題。
- [x] P4 修正子分類語義排序與必要的分類補洞。
- [x] P5 重建 DB，跑 `npm run build`、`npm run test`、`npm run audit` 與 API 驗證。
- [x] P6 更新 `tasks/lessons.md`、`CONTEXT.md`、`CLAUDE.md`、`AGENTS.md`，完成 code review。

## 驗證規格
- [x] 所有保留主分類都有 match_groups count，且 API 分類 count 與 DB 一致。
- [x] CPU/主機板/GPU/RAM 子分類依語義排序，不再用 DB count 或字串順序造成混亂。
- [x] 全分類污染檢查通過：OTHER=0、PACKAGE 假陽性=0、監視器/顯卡/CPU/PSU/SSD/HDD 污染=0。
- [x] 測試與 audit 全通過。

### 本輪回顧
- 新增 `src/shared/subcategory-sort.ts` 與 6 個排序 tests，API 與 Dashboard tree 改用 CPU/主機板/GPU/RAM 語意排序，不再讓 `Intel/AMD` 或 count 破壞順序。
- `categorizer.test.ts` 擴到 16 tests，鎖住 CPU 來源主機板、CPU+主機板組合、完整規格主機、行動電源、掌機包、外接 HDD、GT 舊卡、工作站主機板、周邊套裝、內建喇叭螢幕、外接燒錄機。
- `audit-pipeline` 擴充 CPU motherboard、PSU portable/audio、CASE accessory、SSD external-HDD、System residue 檢查；最新 audit 全 PASS。
- `clean-and-rebuild` 後 live scheduler 狀態：15,794 件商品、960 組跨店比價、20 個主分類都有 match group、OTHER=0、價差異常=0。
- `npm run scrape:test` 改顯示 source category 與 pipeline category；三站 scrape errors=0。dev server 已開在 `http://localhost:3000`。

---

# PCPriceProxy — 第七輪：全域複檢 + 分類順序精準化

## 本輪需求（使用者）
- [x] 重新檢查所有代碼與功能，確認目前 build/test/audit 可用。
- [x] 重新研究商品分類順序，讓分類器先處理高可信訊號，再處理容易污染的寬關鍵字。

## 執行計畫
- [x] P1 盤點現有分類管線、來源 category map、normalizer、matcher、diy-filter 與 dashboard/API 依賴。
- [x] P2 以現有 DB 與稽核腳本找出分類順序造成的誤判：規格提及、條件價、整機/筆電、螢幕/電源/主機板污染。
- [x] P3 補上可重複的分類順序測試，鎖定高風險商品名稱與預期 category/subcategory/priceCondition。
- [x] P4 調整分類流程為「早期強規則 → 來源可信分類覆核 → 寬關鍵字 fallback」。
- [x] P5 執行 `npm run build`、`npm run test`、`npm run audit`，失敗即回修。
- [x] P6 更新 `tasks/lessons.md`、`CONTEXT.md`、`CLAUDE.md`、`AGENTS.md`，並做修改後 code review。

## 驗證規格
- [x] TypeScript 編譯通過。
- [x] Vitest 測試通過，分類順序案例可防止 regression。
- [x] 管線稽核通過：OTHER 應維持 0，假 PACKAGE/污染殘留不得回升。
- [x] 條件價單品只記 `specs.priceCondition`，不進跨店比價。

### 本輪回顧
- 補 `categorizer.test.ts` / `matcher.test.ts`，新增 9 個 regression tests，原本 5 個失敗案例已修到全綠。
- `isRealBundle` 新增「括號型號 + GPU 型號」與 `【AI TOP ...】` 完整規格工作站判定；`NITRO+` 這類產品線假加號不會被誤當套裝。
- `categorizeProduct` 對來源 `MONITOR` 也執行污染覆核，投影機/螢幕掛燈等清出螢幕分類。
- `gpuMatchKey` 加入 WHITE/OC/版本變體；`matcher` exact group 每來源只取最低價代表，避免同來源變體被藏進跨店卡。
- `audit-pipeline` 新增 Monitor pollution 與 GPU bundle residue；DB 清洗後 15,689 件、880 跨店組、OTHER=0、價差異常=0。

---

# PCPriceProxy — 第六輪：三店合併比價 + 刪除非 DIY 雜訊

## 本輪需求（使用者）
- [x] 實際讀取三家爬蟲資料，規劃分類後合併同型號比價，刪除多餘雜訊。

### 本輪回顧
- 新增 `DIY_CATEGORIES` / `isDiyProduct` / `deleteNonDiyProducts`：刪除 OTHER ~2,069 件 + 假 PACKAGE 27 件（VR/筆電搭購列）。
- 新增 `npm run audit`：含各 category 分布、OTHER 件數、跨店率、污染與價差稽核，全項 PASS。
- 三家 scrape:test 正常；DB 清洗後 14,480 件、782 跨店組；合併維持 CPU/GPU 精確鍵 + 模糊比對。
- `isRealBundle` 補強：排除加購優惠、Core 5/7/9H 整機、Infinite/AORUS PRIME 品牌機。

---

# PCPriceProxy — 第五輪：組合分類正確性（單品條件價歸位）

## 本輪需求（使用者）
- [x] 「組合搭配有些不是組合」→ 讀爬下資料重新思考分類，把非組合移出 PACKAGE。

### 本輪回顧
- 根因：舊 `isBundlePrice` 把**單品條件價**（80+金牌電源、限組裝硬碟、套裝搭購週邊）與**規格提及**（相電源 VRM、機殼 clearance、容量加號）誤判成組合。
- 重寫：`isBundlePrice` → `isRealBundle`（真組合/整機/筆電）+ `detectPriceCondition`（記 `specs.priceCondition`，單品歸真分類）。A+B 前中和假加號（相電源/clearance/PSU認證 80+~92+/容量）。
- 補洞：隱式 PSU/SSD/主機板偵測（品名無關鍵字者）；`isMbContaminated` 移除誤排「散熱片」；NETWORK→主機板重判；`matcher` 排除條件價單品的跨店比價；PACKAGE 標籤→「整機/組合」。
- 驗證：tsx 全量重算雙向稽核 → **package 單品殘留 0**、條件價誤入跨店比價 0；package 1399→~1056，電源 +180/主機板 +255/HDD +85 歸位；tsc 0、三店爬取健康、Dashboard 正常。

---

# PCPriceProxy — 第二輪：更精準分類與篩選

## 本輪需求（使用者）
- [x] R1 CPU 改「世代分類」：`品牌 > 世代 > 系列`（Intel 第N代/Ultra 200S、AMD Ryzen 9000/7000/5000/8000、Threadripper）。
- [x] R2 主機板加一層品牌：`晶片組 > 品牌 > 尺寸 > DDR`。
- [x] R3 筆電從 CPU 與顯卡中排除（共用 `isLaptopLike`：含「吋/筆電」即排除，避開 Sapphire Nitro+ 顯卡）。
- [x] R4 搭版/組裝價「另外放」：`isBundlePrice` 於 categorizeProduct 最前攔截 → PACKAGE。
- [x] R5 一樣型號合併：強化 `extractModel`（CPU 全型號正規化）+ 正規化 matcher 鍵；跨店組 213→280，CPU 三店同型號合一卡。
- [x] R6 新增「選看單一通路」篩選（全部/原價屋/欣亞/Autobuy）。
- [x] R7 驗證：DB 審計（筆電 0 殘留、搭版 0 外漏）+ 瀏覽器（世代樹、3 店比價、通路篩選 60→31）。

### 第二輪回顧
- CPU 世代用品名數字推導（Intel i5-**14**400→第14代、5 位/4 位數判斷；Core Ultra 2xx→200S；直讀「第N代」涵蓋 Celeron/Pentium；AMD 4 位數首碼→Zen 世代；Threadripper 獨立）。
- 筆電關鍵訊號＝品名含「吋」（CPU/顯卡本體永遠沒有吋數），抽成 `isLaptopLike` 同時擋 CPU 與 GPU，且不誤傷 Sapphire NITRO+ 顯卡。
- 同型號合併：CPU 型號＝唯一產品，正規化型號後跨店精準合併（安全）；GPU 同廠多 SKU 風險仍交模糊比對（保守）。
- 殘留 ~20% CPU 僅到品牌層（Xeon / 部分 APU），屬難判邊緣，可接受。

---

# PCPriceProxy — 第一輪：分類更清楚 + 整體呈現更好

> 目標：把功能完成、資料更清楚的分類，整體看起來更好。
> 原則：在現有深色玻璃風格上「精修強化」，不做高風險全面重設計。

## Part A — 分類引擎更清楚
- [x] A1 品牌統一與擴充（去重 ASUS/移除子品牌、補齊缺漏、新增 BRAND_ALIASES 正規化；coolpc/sinya 改用共用 extractBrand）。
- [x] A2 新增 `hierarchy()`：未知層級截斷，消除「其他X」噪音；各 detector 改以 null 表未知。
- [x] A3 GPU 結構化型號表取代 startsWith 鏈；detectVram 支援 OC 黏接型。
- [x] A4 新增 PSU / CASE / MONITOR 子分類；MONITOR 尺寸型號數字啟發式。

## Part B — 呈現更好
- [x] B1 CATEGORY_META（label/icon/order）單一真相。
- [x] B2 categories route 充實 meta 並依 order 排序。
- [x] B3 拆分 dashboard.ts → template/styles/script，全部 <800 行，server.ts 相容。
- [x] B4 側欄資料驅動（icon + 數量），移除硬編碼 20 類。
- [x] B5 卡片/標題用中文 label。
- [x] B6 「只看跨店比價」toggle。
- [x] B7 視覺精修 + 比價卡正確性（不同通路數徽章、各店最低價、樹節點碰撞修正）。

## Part C — 驗證
- [x] `npx tsc --noEmit` 通過。
- [x] 真資料驗證：15,307 件、零「其他」噪音、子分類覆蓋 78–100%、PSU/CASE/MONITOR 有樹。
- [x] 瀏覽器驗證：側欄圖示+數量、GPU 子分類樹、跨店切換（213 組）、徽章修正。
- [x] 多代理對抗式 code review（pcprice-change-review workflow）。
- [x] 更新 CONTEXT.md / CLAUDE.md / AGENTS.md。

## 回顧 (Review)
- **分類更清楚**：子分類從 7 類擴到 10 類；以 `hierarchy()` 截斷未知層級，徹底消除「其他系列 > 其他型號…」噪音鏈（驗證為零）。GPU 改結構化型號表更穩。MONITOR 修掉「LCD 水冷頭/OLED 電源/觸控鍵盤」誤收與「0吋」，並用型號數字補回九成尺寸。
- **呈現更好**：1300 行單檔拆成三模組（皆 <800 行）；側欄資料驅動（圖示＋數量）；中文標籤；新增「只看跨店比價」；比價卡改為各店最低價、徽章顯示真實通路數。
- **正確性修正**：徽章誤用商品數→改不同通路數；各店價格 first→最低價；樹節點同值葉/分支碰撞→統一建樹＋注入「全部 X」。
- **後續**：跨店比對命中率偏低（213/14,434），建議下一輪強化 matcher 的 model 抽取與模糊鍵。
