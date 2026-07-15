# AGENTS.md - 專案通用規範

## 開發指令
- 啟動開發伺服器：`npm run dev`
- 編譯 TypeScript：`npm run build`
- 執行測試：`npm run test`
- 執行測試爬取：`npm run scrape:test`
- 管線稽核：`npm run audit`
- 清洗 DB 並重建比價組：`npx tsx src/scripts/clean-and-rebuild.ts`
- 容器部署：`docker compose up -d --build`（掛 `./data` volume 持久化 SQLite，Dockerfile 已代複製 `schema.sql`）

## 程式碼規範
- 一律使用 **TypeScript**，遵循嚴格模式（strict: true）。
- 模組導入使用 ESM 格式，本地檔案導入須加副檔名 `.js` (例如 `import { foo } from './bar.js'`)。
- 優先不可變資料，不直接修改既有物件。
- 函數盡量小於 50 行，檔案盡量小於 800 行，巢狀不超過 4 層。
- 錯誤處理：使用 `src/shared/errors.ts` 定義的結構化錯誤，不可靜默吞掉錯誤。
- 語言與回覆：一律使用繁體中文（臺灣用語）。

## 架構與關鍵模組
- 資料流：scrape → `normalizer` → `categorizer` → `diy-filter` → `ingest`（upsert + 汰除孤兒列）→ `matcher` → `products` / `match_groups`（聚合表）。非 `DIY_CATEGORIES` 與假 PACKAGE 不寫入 DB。
- **孤兒列必須每輪汰除**：`ingest.ts` 的 `ingestScrapeResult` 在 upsert 後刪掉同來源 `scraped_at` 落後的列（`deleteStaleProducts`）。少了這步，「已下架商品」與「改分類前被誤歸 DIY 分類的商品」會永遠卡在 DB——`deleteNonDiyProducts` 只看分類，救不了它們（`TOSHIBA` 含子字串 `OS` 曾讓整批外接硬碟卡在作業系統分類數輪）。爬取結果為空時不清，避免異常清空來源。scheduler 與兩個 refresh route 一律走 `ingestScrapeResult`，不要各自重寫管線。
- 分類邏輯集中在 `src/processing/categorizer.ts`：`detectCategory`（關鍵字＋否定過濾器＋隱式偵測 PSU/SSD/MB/GPU/HDD/FAN）與 `detectSubcategory`（多層 `A > B > C`，用 `hierarchy()` 截斷未知層級、避免「其他X」噪音）。來源 category 不可信時要在 `categorizeProduct` 覆核，尤其 CPU 來源主機板/水冷（MasterLiquid「Core II」子字串誤中關鍵字 `Core i`，故 CPU 關鍵字改列具體 `Core i3/5/7/9`）/導熱貼、GPU 來源整機、PSU 行動電源/電源擴充線/免電源轉換線/硬碟外接盒（獨立電源開關/抽換/多 Bay）、CASE 掌機包、OS 燒錄機、SPEAKER 內建喇叭螢幕、FAN 來源水冷/GPU/PSU/集線器、NETWORK 來源印表機/充電座/耳麥/鍵鼠/滑鼠/喇叭/聲霸/工作站整機/掌機、KEYBOARD/MOUSE/COOLER 來源電競椅/電競桌家具（家具落 OTHER 由 diy-filter 刪除）。重判後的 `detectCategory` 關鍵字迴圈要套同一組污染過濾器（品牌名也會誤中關鍵字：Cooler Master 電競桌）。`RE_CPU_MODEL` 要能吃連字號型號（`Ultra7-265`）否則 HP 商用工作站會漏判整機。
- 隱式偵測訊號詞要避開他品類常用詞：HDD 用「N轉」不用 `RPM`（風扇）、`BARRACUDA` 防 Razer 梭魚耳機、`HDD` 關鍵字防 HDMI 線型號；GPU 型號數字後界用 `(?!\d)` 不用 `\b`（`RTX 5070Ti`/`RX9070XT` 黏尾會漏）；風扇隱式簽章＝3/4Pin＋RPM，且 `isFanContaminated` 要擋盒裝 CPU 的「不含風扇」標示；PSU 隱式簽章支援「認證＋模組化/ATX3」（瓦數藏在型號如 UD750GM），但 `isBuiltInPsu` 的機殼要先排除。SSD 的「散熱片」只有在**無讀寫/TLC 簽章**時才算配件污染（`1TB含散熱片/讀14700/TLC` 是 SSD 本體）。筆電判定＝`筆電字樣 + 吋 + 儲存`，**不要求 CPU 型號**（Snapdragon X 不在 `RE_CPU_MODEL` 內）。
- **組合 vs 條件價單品**：`isRealBundle`/`bundleReason`（真組合/整機/筆電/掌機 ALLY・Claw・Steam Deck：A+B 接真零件、CPU+(GPU或晶片組)+RAM+儲存完整主機（內顯整機無獨顯無電源也算）、欣亞PC/電競電腦等通路整機、周邊套裝、系統關鍵字）歸 PACKAGE。`detectPriceCondition`（搭板/限組裝/套裝搭購/加購優惠…）標記的**條件價單品也歸 PACKAGE**（子分類 `搭購價單品 > 原零件分類 > 條件`），因為它不是「可單買的零件淨價」——留在零件分類會讓同一顆 CPU 出現多張價格不一的卡。`categorizeProduct` 先算出真實零件分類再轉入 PACKAGE（`cat === OTHER` 不救回）；`diy-filter` 與 `deleteNonDiyProducts` 保留條件（真組合 **或** 有 `priceCondition`）；`matcher` 仍排除其跨店比價。audit 的 `Price-condition leak in part categories` 與 `CPU duplicate model cards` 必須為 0。
- **A+B 組合判定的關鍵是「加號後接品牌」**：真組合寫成「商品A + 品牌 商品B」；假加號後面接規格詞（`M.2+ WIFI`、`NITRO+ 氮動`、`低藍光+不閃屏`、`FK1+-B`、`Wi-Fi 6E+BT 5.3`、`HDMI+Display`）。`plusFollowedByBrand` 用 `extractBrand` 檢查每個加號後 28 字。仍須先 `neutralizeFakePlus`（相電源/電源相位/clearance/PSU認證/連鎖數量加號 `18+3+3`）。另有 `isBuiltInPsu`（機殼「內含 850W 電源」是本體規格，非搭售也非電源本體）、`isNasAppliance`（`DS225+【2Bay】` 型號帶加號）、`isCableAccessory`（延長線「組合包」）三個排除器。`bundleReason` 回傳規則名，供 audit 與診斷定位誤判來源。
- **PACKAGE 子分類＝`整機電腦 > 品牌` / `筆電 > 品牌` / `準系統 / 迷你 PC > 品牌` / `掌機 > 品牌` / `零件組合 > 搭配類型` / `搭購價單品 > 零件分類 > 條件`**：整機品牌用 `systemBrand`（**只掃品名開頭 4 個 token**，`extractBrand` 掃全名會抓到規格裡的零件品牌，如 `筆電 > HyperX`、`準系統 > Kingston`；長品牌優先亦會讓 `ASUS…Intel N100` 抓成 Intel）；通路自組整機走 `PACKAGE_VENDORS`（酷!PC/欣亞PC/欣亞精選主機/捷元/DeskMini→ASRock）。`comboType` 的電源訊號要含 `looksLikePsuModel`（`SX850P`/`A1000GS` 把瓦數藏在字母後綴，不寫 W）。
- CPU 子分類＝`品牌 > 世代 > 系列`：Intel 10 代以上輸出 `第 N 代 > Core i9/i7/i5/i3`，**不要把 Ultra 寫進 Core i 系列 label**；Core Ultra 只有 `Core Ultra 200S > Ultra 9/7/5/3`；AMD Ryzen 輸出 Ryzen 9/7/5/3；Threadripper 依世代展開（`Threadripper 9000/7000/5000/3000/TR4`，支援 `Threadripper 7960X`、`Ryzen TR 9960X`、`TR PRO 9995WX` 短寫）。不要加入 `高階` 這類行銷詞，也不要讓 Intel 第 1~9 代孤立節點污染側欄。
- **主機板子分類＝`CPU 腳位 > 晶片組 > 板廠`**：`detectMotherboardSubcategory` 先抓晶片組，用 `CHIPSET_SOCKET` 映射到腳位（新增晶片組要同步補這張表與 `subcategory-sort.ts` 的 `CHIPSET_ORDER`）；晶片組抓不到才退品名 socket token。**不要再加 DDR/板型層級**（使用者明確要求移除，冗餘）。
- **顯卡子分類＝`系列 > 型號 > [多顯存才有容量層] > 品牌`**：只有 `MULTI_VRAM_MODELS`（同型號實際存在多種 VRAM，如 RTX 5060 Ti 8G/16G）才插入 VRAM 層，單一顯存型號直接到品牌（避免 `RTX 5090 > 32G` 這種單子節點冗餘）；品牌走 `extractBrand` 抓 AIB 廠。新增多顯存型號時維護 `MULTI_VRAM_MODELS` 集合。
- **PSU 子分類＝`尺寸 > 瓦數 > 認證 > 模組`**：尺寸 `detectPsuForm`（SFX-L→SFX→TFX→Flex→ATX，SFX 判斷須早於 ATX，因 SFX 電源也標 ATX3.0）；瓦數藏型號（UD750GM/Ai1600T）用 `psuWattFromModel`（黏字母、50 倍數、450~2000W）。污染詞新增 擴充線/轉換/外接盒/抽換/Bay/獨立電源開關。尺寸排序在 client `genericOrder`（`'ATX 電源'…`），與既有瓦數/認證 tier 同處。
- **RAM 子分類頂層含「伺服器記憶體」**：ECC/RDIMM/Registered 不可混入桌上型 UDIMM（$1.5萬~16萬會污染消費級比價）。D4/D5 世代偵測**必用詞邊界** `\bD4\b`/`\bD5\b`——伺服器料號 `KSM64R52BD4` 內 `BD4` 會誤判 D5 記憶體成 DDR4。
- **機殼子分類＝`最大板型 > 品牌 > 系列`**（DIY 先看主機板相容）：`Mini-ITX` / `M-ATX` / `ATX` / `E-ATX` / `未標板型`；判定序 E-ATX→M-ATX→Mini-ITX→ATX（E-/M- 必須早於裸 ATX）。`CASE_SERIES` 為**品牌範圍**表（避免跨廠系列名碰撞），未知系列只到品牌層；中文品牌補 `BRAND_ALIASES`。側欄板型排序用 `exactTopRank`（不可 `includes('ATX')` 誤中 E-ATX）。配件（支撐架/燈條套件/↪ 促銷列）走 `isCaseContaminated` 不入庫。
- **線材是獨立主分類（`CABLE`），子分類單層類型**：coolpc `n28` 直接映射；sinya/autobuy 靠關鍵字＋`looksLikeCable` 隱式簽章（接頭配對 `公-公` / `A to B` / `CAT.6` ＋ 線長，缺一不可）。關鍵字**不可列入 `KVM`**（內建 KVM 的電競螢幕會被整批吸走，KVM 只用在子分類判定）。`isCableContaminated` 要擋顯卡立架/集線器/外接盒/讀卡機、`【27型】`＋電競螢幕/液晶螢幕、以及「認證＋模組化」的電源本體（電源規格會寫「黑色線材 / 雙色線材」）。反過來 `isPsuContaminated` **不可列入裸「線材」**，否則整顆電源被踢出 PSU。子分類料號黏字：`SFF8643`/`4SAS`/`USB5G` 不可用 `\b`。網路線歸線材，`NETWORK` 不再有「網路線材」層，`isNetworkContaminated` 要擋 `網路線|CAT.[5-8]`。
- **`OS` 分類含作業系統與應用軟體**（使用者要求合併），子分類＝`作業系統 > Windows 11` / `應用軟體 > 防毒軟體`。關鍵字**不可列入裸 `OS`**（`支援 Mac OS`、`NON-OS`、`TOSHIBA`、`TosLink` 都含子字串 `OS`）。`isOsContaminated` 擋燒錄機/藍光，也要擋「附加密備份軟體」的外接硬碟、「支援監控軟體」的 UPS、「軟體最高 1500 萬畫素」的視訊鏡頭；但不可用 `DVD` 當排除詞——Windows 隨機版標示「《含DVD》」。
- **光碟機不是分類**：外接燒錄機視為周邊不入庫（coolpc `n23` / autobuy `6` → `OTHER`）。autobuy 光碟機群組混有「Windows 隨機版《含DVD》」，必須交給 `detectCategory` 判別。audit 的 `Optical drive residue` 只抓「燒錄機/燒錄器」——機殼有「光碟機版 / 無光碟機版」（5.25 吋槽）規格字樣。
- **伺服器 / 商用工作站是 PACKAGE 的獨立第一層**：Xeon 料號（`W5-3423`、`E-2436`）不在 `RE_CPU_MODEL` 內，`isServerWorkstation` 改以「整機字樣＋斜線規格＋記憶體＋(儲存或瓦數)」判定，否則會被品名裡的 `DVD-RW` 拖走。要排除 `isLaptopLike`（HP ZBOOK「行動工作站」是筆電）與主機板/機殼/記憶體等零件。
- **喇叭＝`品牌 > 類型`**（`withBrand(type)`，抓不到品牌退回類型層）。**鍵盤＝`機制 > [軸體] > 有線/無線 > 品牌`**（`機械式鍵盤 > 紅軸 > 無線 > Keychron`；軸體用 `extractKeyboardSwitch`，機械無軸標→`未標軸`）。**滑鼠＝`用途 > 有線/無線 > 品牌`**（`電競滑鼠 > 無線 > Logitech`、`垂直滑鼠 > 無線 > Logitech`、`一般滑鼠 > 有線 > …`）。**耳機 / 麥克風＝`產品大類 > 品牌`**（`有線耳機` / `無線耳機` / `USB 麥克風` / `專業麥克風` / `無線麥克風` / `麥克風`）。**網通＝`設備類型 > 品牌`**（`無線路由器 > Mesh 網狀 > ASUS`）。**線材＝`大類 > 細類`**（`影音線 > HDMI`、`網路線 > CAT.6`、`USB / 傳輸線 > Type-C to C`、`機內排線 / 延長線 > 12VHPWR 電源延長`；Type-C 充電線帶 DP Alt Mode 不可被影音線吸走）。品牌覆蓋率靠 `KNOWN_BRANDS`＋`BRAND_ALIASES`。
- GPU 型號比對不可掃未清理的裸數字；`gpuModelSearchText()` 需先移除價格、MHz、cm、瓦數，避免價格/時脈被誤判成 RX/RTX 型號。audit 的 `GPU model collision` 必須維持 0。
- GPU 精確比對鍵在 `categorizer.gpuMatchKey`，需含晶片、產品線、VRAM 與顏色/OC 等 SKU 變體；非 PACKAGE 分類用 `matcher.exactMatchKey` 的「分類 + 品牌 + 顯示名 token 集合」收斂同顯示名重複列。exact group 必須把同 key 全部商品回寫同一個 `match_group_id`，避免非代表列變成 `mg-*` 重複卡；Dashboard render 再從 group products 選每來源最低價顯示。
- **合併 key 從 raw_name 抽判別資訊**（display name 給人看、key 給機器看）：HDD 內接碟以原廠料號（ST*/WD*/HDW*）最優先（能分 SATA/SAS），缺料號退「品牌+系列+容量+轉速」規格鍵（`HDD_SERIES` 中英正規化：新梭魚=BarraCuda、藍標=BLUE）；RAM key 追加 `ramKeyExtras`（產品線 KVR≠FURY、雙條 KIT2——括號內判別會被 normalizeName 剝掉）。`exactNameIdentity` 用 token 集合（英數段一 token、中文逐字、去重排序），對語序與中英黏接不敏感；RAM canonical：D5→DDR5、16G*2→16GX2、筆記型/SO-DIMM→NB。
- `normalizer.normalizeName` 不可清掉會影響 SKU 的變體：顏色、鍵盤軸體、風扇單顆/3IN1/反向、散熱膏克數、主機板 W/ICE、AIO 白龍/黑白等要保留；來源噪音（供電相數、socket、主機板/水冷等通用詞、色版、`G/GB`）要 canonicalize，不要讓同 SKU 跨店落單。`matcher` fuzzy 比對遇到顏色或鍵盤軸體衝突必須跳過。
- 跨店合併驗證不能只看 exact split；還要掃「跨來源、同分類品牌、相近價位、高相似標題但不同 match group」候選，並用 live API 驗證代表樣本。`match_groups.lowest_price/highest_price` 必須用每來源最低代表價計算，避免同來源重複高價造成假價差異常。全庫驗證以 `Exact duplicate split keys = 0`、`Price anomalies = 0` 與候選掃描為準。
- 子分類排序單一邏輯在 `src/shared/subcategory-sort.ts`，API 與 Dashboard 都要用分類語意排序；不可用泛用 `Intel/AMD` 字串或 DB count 排主機板/GPU/CPU/RAM 樹。排序清單集中在 `SIDEBAR_ORDERS`（socket/chipset/vendor/gpuSeries/hddType/network/fan/packageType/combo/packageBase），由 `dashboard/script.ts` 以 `${JSON.stringify(ORDERS)}` 注入 client；**client `compareNodes` 不可自帶硬編碼清單**。PACKAGE 用 `packageRank` 加權（`top*10000 + combo*100 + base`），`packageBase` 由 `CATEGORY_META.order` 推導以免兩處維護。MB flat API 用加權組合 `sr*100000+cr*100+vr`（同時支援裸節點名與完整 `A > B > C` 字串）；`vendorRank` 取 `>` 最後一段葉節點，讓 flat API 品牌順序與樹一致。
- 分類顯示名/圖示/排序集中在 `src/shared/constants.ts` 的 `CATEGORY_META`（單一真相）；品牌正規化用 `KNOWN_BRANDS` + `BRAND_ALIASES`，抽取一律走 `normalizer.extractBrand`（勿在 scraper 重複實作）。
- 前端 Dashboard 拆成 `src/api/dashboard.ts`（模板）＋ `dashboard/styles.ts`＋`dashboard/script.ts`；側欄分類樹資料驅動自 `/api/v1/categories`。
- 新增主分類時：在 `ProductCategory` enum、`CATEGORY_META`、`DIY_CATEGORIES`、各來源 category map 補齊即可，側欄會自動出現。**移除主分類時**：`categorizeProduct` 的 `needsRecategorize` 判定用 `!isDiyCategory(cat)`，舊資料（`optical_drive` / `software`）會被強制重判而非直接刪除；新增排序表時記得同步 `SIDEBAR_ORDERS` 與 client 的 `semanticRank` 分支。

## 開發注意
- tsx watch 每次存檔會重啟並立即重爬；批次改完再驗證。
- `npm run build` 不會複製 `schema.sql` 到 `dist`，純 `node dist` 啟動需另行複製。
- 改分類後可用 `npx tsx src/scripts/clean-and-rebuild.ts` 套用到既有 DB（無需重爬）。
- `npm run scrape:test` 會顯示 source category 與 pipeline category；判斷分類正確性以 pipeline 後結果與 `npm run audit` 為準。
