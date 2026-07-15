# 開發交接上下文 (CONTEXT.md)

## 專案現況
PCPriceProxy 整合原價屋、欣亞、Autobuy 三大通路的電腦零件價格，支援 MatchGroup 跨店整合比價卡片，並提供左側多級展開摺疊選單樹。

## 系統運作狀態（已驗證，2026-07-15）
資料流：scrape → normalize → categorize → **diy-filter** → **ingest（upsert + 汰除孤兒列）** → match → `products` / `match_groups`。`npm run test` **124 tests**、audit / build 通過。

### 第二十三輪重點（機殼改「最大板型 > 品牌 > 系列」）
- **DIY 直覺**：裝機先問「板子進不進得去」→ 側欄第一層改最大支援主機板板型：`Mini-ITX` / `M-ATX` / `ATX` / `E-ATX` / `未標板型`，其下才是品牌與系列。
- 判定序：E-ATX → M-ATX → Mini-ITX → ATX；排序 `exactTopRank` 避免 `ATX` 誤中 `E-ATX`。
- 順手清配件：支撐架 / 燈條套件 / `↪` 促銷列 → `isCaseContaminated` 不入庫。
- 其他 DIY 指標（塔型、雙艙、網孔/全景、背插、顏色）可作後續第二層，本輪先落地相容性。

### 第二十二輪重點（滑鼠類型優先 + 線材細分 + 價格篩選）
- **滑鼠**＝`用途 > 有線/無線 > 品牌`：`電競滑鼠` 364 / `一般滑鼠` 311 / `垂直滑鼠` 11；例 `電競滑鼠 > 無線 > Logitech`。
- **線材**改兩層 `大類 > 細類`：`影音線 > HDMI`、`網路線 > CAT.6`、`USB / 傳輸線 > Type-C to C`、`機內排線 / 延長線 > 12VHPWR 電源延長` 等。Type-C 充電線帶 DP Alt Mode 不再被影音線吸走。
- **Dashboard 價格篩選**：工具列 `$ 最低 – 最高`，debounce 後打 API `price_min`/`price_max`（後端與 repo 本就支援）；最低>最高自動對調；× 清除。
- **驗證**：test 123、rebuild、audit 32 PASS、build 通過；price 1000–3000 → 3581 組。

### 第二十一輪重點（鍵盤 / 網通 / 耳機麥克風側欄改「類型優先」）
- **鍵盤**＝`機制 > [軸體] > 有線/無線 > 品牌`；**網通**＝`設備類型 > 品牌`；**耳機 / 麥克風**＝`產品大類 > 品牌`。
- 喇叭仍 `品牌 > 類型`。

### 第十九輪重點（全庫複驗 + 內顯整機漏網修正）
- **全庫複驗**：test 103 / audit 29 PASS / build 通過；三家 live scrape 正常（coolpc 5,854 / sinya 4,305 / autobuy 3,659）。CPU `i5-12400` 只剩 autobuy 一張乾淨卡是真實狀態——sinya 現售版本已改標「【組裝價】」，正確歸入 PACKAGE 搭購價單品。
- **內顯整機漏網**：`華碩【I5管理者】I5-12400 / H610 / 8G DDR4 / 512G SSD`（$13,500）與 R5 3400G 版落在 **ssd** 分類——`isCompleteSpecSystem` 要求 GPU 型號，內顯機（無獨顯、無電源、無 Windows）全部簽章都不吃。修正：GPU **或** 晶片組皆可當第三訊號。全庫雙向掃描確認只吸走這 2 筆、12,137 筆零件零誤殺。
- **驗證**：`npm run test` 103 passed（+1）、`clean-and-rebuild` 後 13,728 商品 / 1,290 groups、`npm run audit` 29 PASS、`npm run build` 通過。

### 第十八輪重點（CPU 子分類清理 + 候選分類盤點）
- **Intel CPU label 修正**：第 10/12/14 代 Core i 系列不再顯示 `Core i5 / Ultra 5` 這種混名；現在為 `Intel > 第 14 代 > Core i5/Core i7/Core i3`。Core Ultra 只出現在 `Intel > Core Ultra 200S > Ultra 9/7/5`。
- **Threadripper 展開世代**：`AMD > Threadripper` 改為世代層，支援 `Threadripper 7960X`、`Ryzen TR 9960X`、`TR PRO 9995WX` 等短寫。現有 DB：`Threadripper 9000` 19 筆、`Threadripper 7000` 2 筆。
- **候選新增主分類（尚未實作）**：最值得讓使用者決定的是 `影音 / PCIe 擴充卡`、`儲存外接盒 / 硬碟座`、`UPS / 不斷電系統`、`視訊鏡頭 / Webcam`、`可攜式快閃儲存（隨身碟/記憶卡）`。次要候選：`麥克風 / 錄音設備`、`印表機 / 掃描器`、`投影機`。不要先全加；擴充卡與外接盒最貼近 PC 零件，且要用白名單避免污染。
- **驗證**：`npm run test` 102 passed；`clean-and-rebuild` 後 13,683 商品 / 1,293 groups；`npm run audit` 29 PASS；`npm run build` 通過。

### 第十七輪重點（光碟機移除、OS/軟體合併、線材獨立、孤兒列汰除）
- **使用者回饋**：光碟機分類裡怎麼會有伺服器工作站？光碟機不需要子分類、也不該單獨一類，裡面應該還有雜物；作業系統與應用軟體合併；線材應該單獨一類。
- **光碟機的伺服器**：`HP Z6 G5 商用工作站`（$104,900）與 `ASUS RS300-E12-RS4 伺服器`（$49,900）被品名裡的 `DVD-RW` 拉進光碟機——Xeon 料號 `W5-3423` / `E-2436` 不在 `RE_CPU_MODEL` 內，所有整機規則都漏判。新增 `isServerWorkstation`（整機字樣＋斜線規格＋記憶體＋(儲存或瓦數)，排除 `isLaptopLike` 與零件字樣），歸 PACKAGE 新第一層「伺服器 / 工作站」（23 筆）。HP ZBOOK「行動工作站」帶吋數，仍歸筆電。
- **光碟機分類移除**（使用者拍板：燒錄機視為周邊不入庫）：coolpc `n23` / autobuy `6` → `OTHER`。autobuy 光碟機群組混有 `Windows 11 隨機版《含DVD》`，交給 `detectCategory` 判別；`isOsContaminated` 因此**不可用 `DVD` 當排除詞**。
- **OS + SOFTWARE 合併為 `OS`**（label「作業系統 / 軟體」），子分類兩層 `作業系統 > Windows 11` / `應用軟體 > 防毒軟體`。關鍵字**移除裸 `OS`**——`支援 Mac OS`、`NON-OS`、`TosLink`、以及 `TOSHIBA` 都含子字串 `OS`。
- **線材（`CABLE`）獨立主分類**（340 筆）：coolpc `n28` 直接映射；sinya/autobuy 靠關鍵字＋`looksLikeCable` 隱式簽章（接頭配對 / `A to B` / `CAT.6` ＋線長）。子分類 8 型：影音線 107 / 機內排線・延長線 52 / USB・傳輸線 51 / 轉接頭・轉接線 50 / 網路線 42 / 切換器・分配器 24 / 電源延長線・插座 13 / 其他 1。網路線改歸線材，NETWORK 移除「網路線材」層。
- **雙向檢查抓到的回歸**（都已修）：`KVM` 當關鍵字會把 9 台內建 KVM 的電競螢幕吸走 → 移出關鍵字（只留在子分類判定）＋`isCableContaminated` 加 `【27型】/電競螢幕/液晶螢幕`；電源規格寫「黑色線材 / 雙色線材」→ `isCableContaminated` 加「認證＋模組化」簽章，且 `isPsuContaminated` **移除裸「線材」**（既有 bug，會把整顆電源踢出 PSU）；`軟體最高1500萬畫素` 的羅技視訊鏡頭與 `附加密備份軟體` 的 Toshiba 外接硬碟 → `isOsContaminated` 補硬體字樣。
- **孤兒列汰除（真正的「雜七雜八」來源）**：`os` 分類裡混著 Toshiba 外接硬碟、電競椅、USB HUB，`scraped_at` 停在上一輪——它們早已從來源下架，卻因分類屬 DIY 而永遠不被 `deleteNonDiyProducts` 清掉。新增 `src/ingest.ts`（`processScrapeResult` + `ingestScrapeResult`），upsert 後刪同來源 `scraped_at` 落後的列；scheduler 與兩個 refresh route 共用，消除三處重複管線。首次執行清掉 **2,897 筆**孤兒列。空結果不清，避免爬取異常清空來源。
- **移除分類的安全網**：`categorizeProduct` 的 `needsRecategorize` 從 `cat === OTHER || cat === PACKAGE` 改為 `!isDiyCategory(cat) || cat === PACKAGE`，舊資料（`optical_drive` / `software`）被強制重判而非直接刪除。
- **驗證**：`npm run test` **102 tests**（+12）、`npm run build`、重爬三家、`clean-and-rebuild`、`npm run audit` **29 項全 PASS**（新增 `Legacy category rows`、`Optical drive residue`、`Non-cable in cable`、`CABLE without subcategory`）。`Optical drive residue` 只抓「燒錄機/燒錄器」——機殼有「光碟機版」規格字樣。

### 第十六輪重點（條件價單品移出零件分類 + 整機/組合分區）
- **使用者回饋**：CPU 分類裡 `i5-12400` 出現 8 張價格不一的卡；理論上只該有 `12400` 與 `12400F` 兩樣，其餘搭板/組裝價要移到「整機組合」；並要求把「整機/組合」分區。
- **根因（兩層）**：
  1. 第五輪的「條件價單品仍歸真分類、只排除跨店比價」在列表視角是錯的——6 張卡都帶 `priceCondition`（組裝價/搭板價/限組裝），它們是買主機板才有的價格，不是零件淨價。
  2. PACKAGE 本身也髒：autobuy 的 11 筆全是**假加號誤判**（`NITRO+ … 顯示卡`、`FK1+-B 電競滑鼠`、`M.2+ WIFI … 主機板`、`低藍光+不閃屏 IPS螢幕`、`Arctis Pro + GameDAC 耳機`），另有 `mini PCIE`→`MINI PC`、`DS225+【2Bay】`、機殼「內含 850W 電源」等。
- **診斷法**：把 `isRealBundle` 拆出 `bundleReason()` 回傳規則名（laptop / plus-part / case-plus-psu…），對全庫 PACKAGE 跑規則命中分布，直接定位是哪條規則誤判。
- **A+B 判定改用品牌 guard**：真組合一律寫「商品A + **品牌** 商品B」，假加號後接規格詞。`plusFollowedByBrand()` 對每個加號取後 28 字（跳過 `【…】`）餵 `extractBrand`。配套 `neutralizeFakePlus` 補「電源相位」與連鎖加號 `18+3+3`；新增 `isBuiltInPsu`（`內含 850W` 緊接瓦數才算，`內附顯卡支撐架` 不誤殺）、`isNasAppliance`、`isCableAccessory`。
- **雙向檢查抓到的回歸**（都已修）：`螢幕支架組`/`優惠組合` 9+1 筆真組合被誤殺 → 補 bundle-keyword；Snapdragon 筆電落 RAM → `isLaptop` 去掉 CPU 型號必要條件；`1TB含散熱片` SSD 落 OTHER → `isSsdContaminated` 散熱片改條件式（無讀寫/TLC 才算配件）；`NCORE 100 機殼(內含SFX 850W)` 落 PSU → `looksLikePsu` 排除；`不含風扇` 的盒裝 CPU 落 FAN → `isFanContaminated` 擋。
- **條件價單品 → PACKAGE**：`搭購價單品 > {原零件分類} > {條件}`。**三處連動**：`diy-filter.isDiyProduct`、`ProductRepository.deleteNonDiyProducts()`（它自己用 `isRealBundle` 判，漏改會把 409 筆直接刪光，且刪掉只能重爬）、`matcher`（本就排除）。
- **PACKAGE 六大分區**（2,069 筆，無子分類節點 = 0）：筆電 826 / 零件組合 490 / 整機電腦 347 / 搭購價單品 296 / 準系統・迷你 PC 106 / 掌機 9。整機品牌走 `systemBrand`（**只掃品名開頭 4 token**，避免抓到規格裡的零件品牌）＋ `PACKAGE_VENDORS`（酷!PC / 欣亞PC / 欣亞精選主機 / 捷元 / DeskMini→ASRock）；`comboType` 依搭配類型分 9 種，電源訊號含 `looksLikePsuModel`（`SX850P`/`A1000GS` 瓦數藏在字母後綴）。
- **驗證**：`npm run test` **90 tests**（+9）、`npm run build`、重爬三家、`clean-and-rebuild`、`npm run audit` **25 項全 PASS**（新增 `PACKAGE without subcategory`、`Price-condition leak in part categories`、`CPU duplicate model cards`，並把 `Package false positive` 改為容許條件價）。live API：`?category=cpu&q=12400` → `total=2`（`i5-12400` sinya $6,100 + autobuy $5,600 兩店卡；`i5-12400F` sinya $5,100）。

### 第十五輪重點（全類別稽核除污 + PSU/RAM 結構 + 機殼/周邊品牌分類）
- **使用者回饋**：逐類別檢查是否真爬到且正確分類、疑似「無中生有」；記憶體是否還有伺服器類、電源要分 SFX 尺寸、機殼依品牌再依系列、鍵鼠/耳機/喇叭/網通依品牌分類。
- **稽核結論**：資料是真的（三來源 source_url 全有）；但確有誤分類污染——CPU 混入 AIO 水冷（`MasterLiquid`「Core II」誤中關鍵字 `Core i`）與相變導熱貼（`適用於CPU` 誤中）；PSU 混入電源擴充線/免電源轉換線/硬碟外接盒（232 筆空子類多是這些）；RAM 伺服器 ECC RDIMM（$1.5萬~16萬）被錯標桌上型 UDIMM；network 混入 Edifier 聲霸/A4 滑鼠/HP 工作站。
- **除污修正**：CPU 關鍵字改列具體 `Core i3/5/7/9`＋`isCpuContaminated` 補水冷/導熱貼；COOLER 關鍵字補 `Liquid/冷排/冷頭`；`isPsuContaminated` 補 擴充線/轉換/外接盒/抽換/Bay；`isNetworkContaminated` 補 滑鼠/喇叭/聲霸/工作站；`RE_CPU_MODEL` 支援 `Ultra7-265` 連字號（HP 工作站歸整機）。CPU/PSU 空子類 5/232→0。
- **PSU 結構**：子分類改 `尺寸 > 瓦數 > 認證 > 模組`（`detectPsuForm` SFX-L→SFX→TFX→Flex→ATX，須早於 ATX）；瓦數藏型號（UD750GM→750W、Ai1600T→1600W）用 `psuWattFromModel`（黏字母、50 倍數、450~2000W）。ATX 977 / SFX 42 / SFX-L 10。
- **RAM 結構**：頂層新增「伺服器記憶體」（ECC/RDIMM/Reg，19 筆移出桌上型）；修正 D4/D5 世代偵測改用詞邊界（料號 `KSM64R52BD4` 內 `BD4` 會把 D5 誤判成 DDR4）。
- **機殼＝`品牌 > 系列`**：`CASE_SERIES` 品牌範圍表（Thermaltake View/The Tower、Lian Li O11/Lancool、Fractal Meshify/Define、Corsair iCUE、Cooler Master MasterBox/HAF、MSI MAG/MPG…）；未知系列只到品牌。補品牌別名（曜越/迎廣/銀欣/全漢/振華/富鈞/Cougar/HYTE/SAMA…）後機殼無品牌 319→89（95% 有品牌）。
- **鍵鼠/耳機/喇叭/網通＝`品牌 > 類型`**：`withBrand()` 抓不到品牌退回類型層（0 遺漏）；擴充 `KNOWN_BRANDS`＋`BRAND_ALIASES`（i-Rocks/Cherry/Keychron/Rapoo/Edifier漫步者/EPOS/AIWA愛華/合勤Zyxel/圓剛AverMedia/TOTOLINK…）。喇叭無品牌 78%→~2%。
- **驗證**：`npm run test` **81 tests**（+6）、`npm run build`、`clean-and-rebuild`（1350 筆重分類、8 筆移除）、`npm run audit` **22 項全 PASS**；live API 抽樣 `SFX-L 電源 > 750W~1000W > 80+ 白金牌`、`伺服器記憶體 > DDR5 > …`、`Lian Li > O11`、`Logitech > 無線`、`Edifier > 藍牙 / 無線喇叭` 皆正確。

### 第十四輪重點（主機板/顯卡側欄樹重構：依實際資料設計層級）
- **使用者回饋**：主機板底下 DDR5/DDR4 等層級多餘，改在最上層加 CPU 腳位；顯卡底下要分品牌（AIB 廠），顯存容量「不只一種」才需要獨立分層（截圖 `RTX 5090 > 32G` 單一子節點很冗餘）。
- **主機板樹改為 `CPU 腳位 > 晶片組 > 板廠`**：`detectMotherboardSubcategory` 用 `CHIPSET_SOCKET` 把晶片組映射到腳位（Z890/W890/B860/H810→Intel LGA1851、Z790/B760/H610/W680→LGA1700、W790→LGA4677、X870E/X870/B850/B650→AMD AM5、B550/A520→AM4、TRX50/WRX90→sTR5）；晶片組抓不到時退品名 socket token；移除 DDR/板型層級。64 種子分類，如 `AMD AM5 > B850 > MSI`。
- **顯卡樹改為 `系列 > 型號 > [多顯存才有容量層] > 品牌`**：`MULTI_VRAM_MODELS`（GT 730 / RTX 3050 / RTX 3060 / RTX 4060 Ti / RTX 5060 Ti / RX 9060 XT / RTX PRO 5000）才插入 VRAM 層，其餘型號直接到品牌；`detectGpuSubcategory` 用 `extractBrand` 抓 AIB 廠。126 種子分類，如 `RTX 5090 > GIGABYTE`、`RTX 5060 Ti > 16G > MSI`。另補 `RX 9070 GRE` 型號（原誤判成 RX 9070 12G 變體）。
- **排序單一真相注入**：`subcategory-sort.ts` 匯出 `SIDEBAR_ORDERS`（socket/chipset/vendor/gpuSeries/hddType/network/fan），Dashboard `script.ts` 以 `${JSON.stringify(ORDERS)}` 注入，client `compareNodes` 不再自帶清單（消除第八輪殘留的 `Intel Z890` 硬編碼，違反單一真相）。MB flat API 用加權排序 `sr*100000+cr*100+vr`；`vendorRank` 取 `>` 最後一段葉節點，讓 flat API 品牌順序與樹一致。
- **成效/驗證**：MB 64 子類、GPU 126 子類；`clean-and-rebuild` 套用免重爬；`npm run test` 75 tests、`npm run build`、`npm run audit` 22 項全 PASS；live server API 抽樣 `motherboard`/`gpu` 子分類樹排序正確（`Intel LGA1851 > Z890 > ASUS…`、`RTX 5090 > GIGABYTE`、`RTX 5060 Ti > 16G/8G > 品牌`）。

### 第十三輪重點（側欄分類準確化 + 儲存/RAM 合併鍵）
- **側欄大掃除（audit 抓不到的真實污染）**：
  * HDD 藏了 Razer Barracuda（梭魚）耳機（`BARRACUDA` 誤中）、「1600 RPM」風扇（`\bRPM\b` 誤中）、HDMI 線（型號 `HDD2012AA`）→ `looksLikeHdd` 拿掉 RPM 改用「N轉」、excludes 補 耳機/RAZER/HDMI/PWM/ARGB/入組/3Pin/燈效；新增**隱式風扇偵測**（3/4Pin+RPM）接住 Noctua FLX。
  * FAN 藏了 GPU（`RTX 5070Ti`/`RX9070XT` 黏尾使 `\b` 失效→改 `(?!\d)`）、PSU（UD750GM 無獨立瓦數 token→`looksLikePsu` 支援認證+模組化雙訊號）、AIO/集線器/燈條 → 新增 `isFanContaminated`；尺寸從型號抓 120/140（TF120/TL140），「其他尺寸」545→176。
  * NETWORK 藏了印表機/無線充電座/無線耳麥/鍵鼠組/掌機 → 新增 `isNetworkContaminated`；掌機（ALLY/Claw/Steam Deck/Legion Go+儲存簽章）歸 PACKAGE；「其他網通」694→288，拆出 網路攝影機/Mesh/路由器/網卡接收器/NAS/線材。
  * KEYBOARD 藏了 277 件電競椅/電競桌 → 新增 `isKeyboardContaminated`（家具），注意 Cooler Master 電競桌重判時品牌名會再誤中 COOLER 關鍵字，keyword 迴圈也要套過濾。
  * SSD「PCIe 4.0 > 10GB」假容量節點＝USB10G 外接盒 → 無容量的 USB10G/雙模判外接盒；容量抽取先剝 USB 頻寬。
  * HDD 子分類拆 桌上型硬碟/NAS 專用碟/監控碟/企業級硬碟/行動外接硬碟；`subcategory-sort.ts` 補 HDD/NETWORK/FAN 語意排序。
- **合併鍵強化（matcher）**：
  * HDD：三家內接碟品名都附**原廠料號**（ST8000DM004/WD20EZBX/HDWD320UZSVA）→ `HDD-MPN-*` 最優先（能分 SATA 017B vs SAS 018B）；缺料號退規格鍵 `HDD-SPEC-品牌-系列-容量-轉速`（`HDD_SERIES` 中英正規化：新梭魚=BarraCuda、藍標=BLUE、監控鷹=SkyHawk）；外接碟無轉速自然交 NAME/fuzzy。
  * `exactNameIdentity` 改 **token 集合**：英數連續段一 token、中文逐字、去重、排序——語序與中英黏接不再擋合併（「美光16GB DDR5-5600 NB」=「Micron Crucial NB DDR5-5600 16G 筆記型記憶體」）。RAM 另 canonical：D5→DDR5、16G*2→16GX2、筆記型/SO-DIMM→NB、剝桌上型/記憶體/CL 時序。
  * RAM key 追加 `ramKeyExtras(rawName)`：產品線（KVR≠FURY Beast；`RAM_LINES` 中英表）+ 雙條 KIT2——這些判別在括號內會被 `normalizeName` 剝掉，**key 一律回 raw_name 抽**。
  * `detectPriceCondition` 補「加購優惠→加購價」（coolpc 加購 RAM 不再污染跨店比價）。
  * 品牌：Micron→Crucial 統一、新增 Toshiba/東芝；`chooseBrand` 對既有 brand 也走別名正規化。
- **成效**：跨店組 1,167→1,358；RAM 跨店 17→33 組、FAN 1→98 組、HDD 0.2%→1.8%（可比池小：coolpc HDD 幾乎全限組裝被排除）；EXOS SATA/SAS、KVR/FURY、單條/雙通皆正確分開，價差異常=0。
- **驗證**：`npm run test` 72、`npm run build`、`clean-and-rebuild`、`npm run audit` 22 項全 PASS、三家 live 重爬 + API 抽樣（HDD 跨店卡、network/hdd 子分類樹）全通過。

### 第十二輪重點（跨店相同商品落單收斂）
- **全庫策略**：不只看 exact split，另跑「跨來源、同分類品牌、相近價位、高相似標題但不同 match group」候選，逐批分辨真落單與不同 SKU。最終 live audit 全 PASS：`Exact duplicate split keys=0`、`Price anomalies=0`、污染檢查全 0。
- **normalizer 規則**：來源噪音先剝離再補 canonical 變體。保留/正規化顏色、鍵盤軸體、風扇單顆/2IN1/3IN1與反向、散熱膏克數、主機板供電相數/socket/白色描述、AIO `黑色版/白龍王/白龍神/飛龍三代`、darkFlash 特殊色。
- **matcher 規則**：非 PACKAGE exact key 剝品牌與別名；default 未標色可對黑色款但不吃白色款；Network/Headset 去除通用描述差；SSD/HDD/RAM exact key 統一 `G/GB`；`match_groups.lowest/highest` 改以每來源最低代表價統計。
- **品牌與 GPU 補洞**：補 `Cooler Master/酷碼`、`Lian Li/聯力`、`Mercusys/水星`、`darkFlash/大飛`、`JONSBO/喬思伯`、`ZhiTai/致態`；`gpuMatchKey` 加 Low Profile line，ICE/AERO 視為白色變體。
- **代表驗證**：G213 total=1（三店）；TR120 total=8（黑/白、單顆/3IN1、正/反向各自兩店）；RTX5060 ICE、RTX5050 Low Profile、RTX5080 AERO 各 total=1（三店）；TF8 total=2（2g/5.8g 分開）；B650M、PZ 背插、MA530、Cetra、darkFlash GD100 皆按 SKU 收斂。條件價與套裝仍單例，不污染跨店比價。
- **驗證完成**：`npm run test` 52 tests、`npm run build`、`npx tsx src/scripts/clean-and-rebuild.ts`、`npm run audit`、`npm run scrape:test`、live scheduler/API 全通過。dev server 已開在 `http://localhost:3000`。

### 第十一輪重點（全庫重複卡掃描 + SKU 變體保留）
- **全庫檢查結果**：CPU/GPU exact key 初始 split=0、singleton leak=0；同顯示名跨 group 風險初始 54 類，集中在鍵盤、滑鼠、散熱器、主機板等非 CPU/GPU 品項。修正後 live DB `exactSplitKeys=0`、`exactSingletonKeys=0`、`sameNameRisks=0`。
- **根因**：`normalizeName` 移除括號與斜線規格時，把顏色、鍵盤軸體、水冷黑白等 SKU 變體清掉；fuzzy match 也可能把顏色/軸體不同但 token 很相近的 SKU 併錯。
- **修正**：`normalizer` 保留顏色與鍵盤軸體；`matcher.exactMatchKey` 對非 PACKAGE 品項使用「分類 + 品牌 + 顯示名」做 exact group 並全員共享 `match_group_id`；fuzzy 遇到顏色或鍵盤軸體衝突直接跳過。
- **專業卡補洞**：`RTX PRO 4500` 加入 GPU 型號/key；`麗臺 NVIDIA` / `Leadtek 麗臺` 正規化成 Leadtek，讓 RTX PRO 4500 三店四筆進同一張卡。
- **代表驗證**：live API `5800X3D total=1`；`K71M-Gateron total=6` 且每張帶黑/白與紅/茶/青軸；`RTX PRO 4500 total=1`，Autobuy/CoolPC/Sinya 四筆同 group。`npm run test` 34 tests、`npm run build`、`clean-and-rebuild`、`npm run audit`、`npm run scrape:test` 全通過。

### 第十輪重點（同型號重複卡片收斂）
- **根因**：`matcher` exact group 原本只回傳每來源最低代表列，`ProductRepository.updateMatchGroups()` 只會回寫 group.products；同 exact key 的非代表列沒有 `match_group_id`，後續被補成 `mg-*` 單例，造成同一顆 CPU 同時出現跨店卡與單店重複卡。
- **修正**：`groupByKey()` 改回傳同 key 的完整成員並全員共享同一個 `match_group_id`；Dashboard render 維持從 group products 選每來源最低價，所以畫面仍是一店一格，不會重複顯示同店價格。
- **CPU 簡寫補洞**：`R7 5800X3D` 這類 AMD 簡寫可推到 `AMD > Ryzen 5000 (Zen3) > Ryzen 7`，避免同型號來源列落在不同 CPU 子分類。
- **audit 擴充**：新增 `CPU exact duplicate singletons`，只檢查非 `priceCondition` 的可比價 CPU；條件價仍維持單例且不跨店比價。
- **驗證完成**：`AMD Ryzen7 5800X3D 十週年紀念版` 5 筆商品都在 `match-03c11d330b1d`，只剩一張跨三店卡；`npm run test`（29 tests）、`npm run build`、`clean-and-rebuild`、`npm run audit`、`npm run scrape:test` 全通過。

### 第九輪重點（CPU label 清理 + GPU 整機污染修正）
- **CPU 子分類清理**：`Ryzen 9 / 高階` 改為 `Ryzen 9`；Threadripper 停止掛在 Ryzen 9 子系列下；Intel 世代節點只保留 10 代以上，Autobuy 舊 `i7-5960X` 不再產生 `第 5 代` 側欄節點。
- **GPU 整機污染修正**：欣亞 `欣亞PC【天秤座】.../RTX5060/.../Windows 11 Home`、Acer `Predator Orion ... 電競電腦`、捷元 `ZEUS 15G /C7-250H/RTX5070/16G/500G` 這類完整主機即使來源標成 GPU，也由 `isRealBundle` 先歸 PACKAGE；`RE_STORAGE` 補 `500GB/M.2`，`RE_CPU_MODEL` 補 `C7-250H` 這類 Core 縮寫。
- **GPU 型號裸數字防誤判**：`gpuModelSearchText()` 在比對 `GPU_MODELS` 前移除價格、MHz、cm、瓦數等非型號數字，避免 `$476000` 被判成 RX 7600、`3060MHz` 被判成 RTX 3060；RTX PRO 6000 正確落 NVIDIA 專業繪圖卡，RX 9070 XT 正確落 AMD RX 9000。
- **audit 擴充**：`npm run audit` 新增 `GPU system residue`、`GPU model collision` 與 `Legacy CPU generation nodes`，直接 fail 掉 GPU 中的 `欣亞PC/品牌電腦/電競電腦/Win11/ZEUS` 殘留、RX/RTX 型號碰撞，以及 CPU 的第 1~9 代孤立節點。
- **驗證完成**：`npm run test`（3 files / 29 tests）、`npm run build`、`clean-and-rebuild`、`npm run audit`、`npm run scrape:test` 全通過。重建後 GPU 674 件、489 組；CPU 114 組；精準 DB 查詢確認 `高階`、`第 5 代`、GPU `欣亞PC`、錯誤 GPU 子分類（`RX 7600 > 96G` / `RTX 3060 > 16G` / `RTX 5070 > 15G` / `RTX 5060 > 16G`）均為 0。

### 第八輪重點（全分類資料正確性稽核 + 子分類樹排序）
- **修正側欄排序根因**：原 Dashboard `compareNodes` 用泛用 `INTEL/AMD` 字串與 DB count，導致主機板/GPU/RAM/CPU 樹亂序。新增 `src/shared/subcategory-sort.ts`，API `getSubcategories()` 與前端 tree 都改為分類語意排序：CPU 世代、主機板晶片組、GPU 世代/型號、RAM 容量。
- **來源分類覆核擴大**：CPU 來源中的主機板（含 `mATX`）、U 版 CPU+主機板真組合、完整 CPU+GPU+RAM+儲存主機、ASUS GX10/ROG/GM700TZ 類整機、PSU 行動電源、CASE 掌機收納包、SSD 外接 HDD、SPEAKER 內建喇叭螢幕、OS 外接燒錄機都補 regression tests。
- **GPU/MB 子分類補洞**：新增 GT1030/GT730/GT710 舊卡、Intel W890/W790/W680、AMD WRX90/TRX50/B860/H810 等工作站/新晶片組；GPU API 平面排序會把 Ti/Super/XT 排在 base 型號前。
- **audit 擴充**：`npm run audit` 新增 CPU motherboard leakage、PSU portable/audio、CASE accessory、SSD external-HDD、System residue in SSD/COOLER 檢查。最新結果全 PASS：OTHER=0、所有污染=0、PACKAGE false positive=0、price anomalies=0。
- **驗證完成**：`npm run build`、`npm run test`（3 files / 24 tests）、`npm run audit`、`npm run scrape:test`、`clean-and-rebuild`、本機 API `/api/v1/categories/*/subcategories` 均通過。dev server 已開在 `http://localhost:3000`。

### 第七輪重點（全域複檢 + 分類順序精準化）
- **新增 regression tests**：`categorizer.test.ts` / `matcher.test.ts` 鎖定 A+B GPU 套裝、AI TOP 完整工作站、MONITOR 污染重判、NITRO+ 假加號、GPU 白色版精確鍵、exact group 每來源單代表。
- **分類順序補強**：`isRealBundle` 先於來源分類處理「括號型號 + GPU 型號」與 `【AI TOP ...】` 完整工作站規格；`categorizeProduct` 對來源 `MONITOR` 也套 `isMonitorContaminated` 重判，投影機/螢幕掛燈等不再保留在螢幕。
- **GPU SKU 精確鍵**：`gpuMatchKey` 追加顏色/OC/版本變體，`DUAL-RTX5060-O8G` 與 `DUAL-RTX5060-O8G-WHITE` 不再合併。
- **比價組回寫**：exact match 需回傳同 key 的完整成員，DB 全員共享同一個 `match_group_id`；顯示層再取每來源最低價，避免非代表列變成重複單例卡。
- **audit 擴充**：新增 Monitor pollution、GPU bundle residue 檢查；最終 `npm run build` / `npm run test` / `npm run audit` 全通過。

### 第六輪重點（三店合併比價 + 刪除非 DIY 雜訊）
- **`DIY_CATEGORIES` + `isDiyProduct`**（`constants.ts` / `diy-filter.ts`）：爬取管線只寫入 DIY 白名單分類；PACKAGE 須通過 `isRealBundle` 才保留（刪 VR 追蹤器、筆電搭購列等假組合）。
- **`deleteNonDiyProducts`**：清除 OTHER（原 ~2,069 件）與 DB 內假 PACKAGE；scheduler / refresh API 每次爬完自動執行。
- **`npm run audit`**（`audit-pipeline.ts`）：輸出三家件數、**各 category 分布與 OTHER 件數**、跨店率、污染殘留、package 假陽性、價差異常；全項 PASS。
- 合併策略維持：CPU/GPU 精確鍵 + 模糊比對（0.7 門檻 + 價差 1.6 護欄）；`isRealBundle` 補 Core 5/7/9H、Infinite/AORUS PRIME 整機、排除「加購優惠」假組合。

### 第五輪重點（組合分類正確性：把「不是組合」的單品歸回真分類）
使用者回報「組合搭配有些不是組合」。根因：舊 `isBundlePrice` 把**單品的條件價**與**規格提及**誤判成組合。已重寫分類核心（`categorizer.ts`）：
- **`isBundlePrice` → 拆成 `detectPriceCondition` + `isRealBundle`**：
  * `isRealBundle`＝真組合/整機：`isLaptop`（筆電字樣＋CPU型號＋吋＋儲存）、`isPrebuiltSystem`（CPU型號＋Win/NON-OS＋儲存）、`isSlashBuild`（CPU＋電源＋機殼/晶片/顯卡）、準系統/NUC/CUBI/BRIX/迷你、明確「組合/套餐/大全配」字、`A+B` 接核心零件名詞、機殼＋電源。
  * `detectPriceCondition`：限組裝/組裝價/搭板/任搭/搭購/套裝搭購→寫入 `specs.priceCondition`，**單品仍歸真分類**，不再塞進組合。
- **假加號中和**（A+B 前處理，關鍵）：`N+N+N相電源`(主機板VRM)、`顯卡408mm/顯示卡支撐架/塔散172mm`(機殼clearance)、`80+/85+/90+/92+`(PSU效率認證)、`8G+8G`(容量)、`2+2`(數量)。否則單品被自身規格誤判成組合。
- **新增隱式偵測**（`detectCategory`，補品名無關鍵字者）：隱式 PSU（瓦數＋牌/模組）、隱式 SSD（讀寫速度＋TLC/PCIe）、隱式主機板（晶片組＋相電源/DIMM/ATX）；並修 `isMbContaminated` 誤排「散熱片」、加 NETWORK→主機板重判（晶片組板因「無線」落網通）。
- **比價防污染**：`matcher` 排除帶 `priceCondition` 的單品（搭購價偏低），留作單例呈現在各自分類。
- **PACKAGE 標籤**改「整機 / 組合」。效果：package 1399→~1056，**單品殘留 0**；電源 +180、主機板 +255、HDD +85 等條件價單品歸位；條件價誤入跨店比價 0。
- 稽核法：寫 tsx 腳本對 DB 全量重算 `isRealBundle`/`detectCategory`，雙向檢查（package 移出去向 vs 非package 反拉），逐輪收斂假陽性。

### 第四輪重點（爬取與合併稽核修正）
- **爬取健檢**：三家皆正常（coolpc ~6800、sinya ~5400、autobuy ~3800；無 $0、URL 齊全、scrape_logs 成功）。
- **誤併修正（合併比價正確性）**：fuzzy 加「價格合理性護欄」——併入時 `max/min > 1.6` 即跳過，擋掉單顆 vs 套裝(3IN1)、16GB vs 32GB、滑鼠 SE vs 正式版等價差型誤併。稽核：價差>1.8倍的跨店群組 11 → 0。
- **整機洩漏**：`isGpuContaminated` 排除「商用工作站/準系統/迷你主機」等整機（但保留「工作站繪圖卡」專業卡，加 `!繪圖卡/顯示卡` 例外）。
- **$1 假項**：新增 `MIN_VALID_PRICE=10`，處理管線過濾 `price<10`；clean-and-rebuild 一併 `DELETE` 既有低價假項。

### 第三輪重點（資料清理、計數一致、合併精準）
- **數量一致**：側欄/子分類/品牌計數改查 `match_groups`（＝列表「共 N 組」），消除「件數 vs 組數」落差造成的困惑。`getCategories/getSubcategories/getBrands` 已改。
- **修正過度合併（藏商品的真因）**：舊 `groupByBrandModel` 用晶片層級型號（RTX-5060-TI）把同晶片所有 SKU 全併（一組曾達 26 件）。重構 matcher：
  * `extractModel` 收斂為「僅 CPU」（型號即唯一產品）。
  * 新增 `gpuMatchKey`＝晶片＋產品線(GPU_LINES)＋VRAM；**認不出產品線就不給精確鍵**，交模糊比對（寧可分開不誤併）。
  * 模糊門檻 0.6→0.7，且「每組每通路最多 1 件」。
  * `has_multiple_sources` 改用 `COUNT(DISTINCT source)>1`。
- **名稱清理**：`normalizeName` 移除 HTML、括號內細部規格、價格(元/$)、保固、行銷話術、搭購折扣(↓任搭NNN↓)，並「在第一個規格標記處截斷」保留品牌＋型號＋容量；`match_groups.name` 與 in-memory 群組皆取組內**最短（最乾淨）**名稱。
- **搭售組合**：`isBundlePrice` 增加「A+電源/主機板/記憶體」組合偵測 → PACKAGE。
- `clean-and-rebuild` 已改為完整重跑 `normalizeProduct→categorizeProduct`（含 name/model），可不重爬套用名稱與合併變更。
- 效果：GPU 群組由過併的 224 → 精準 380（同 SKU 才併）；CPU 跨店同型號合一卡；側欄計數＝列表組數。

### 第二輪重點（更精準分類與篩選）
- **CPU 改世代分類**：`品牌 > 世代 > 系列`。世代由品名推導——Intel `i5-14400→第14代`（5/4 位數判斷）、`Core Ultra 2xx→Core Ultra 200S`、直讀「第N代」涵蓋 Celeron/Pentium；AMD 4 位數首碼→`Ryzen 9000 (Zen5)`/`7000 (Zen4)`/`5000 (Zen3)`/`8000`、Threadripper 獨立。
- **主機板加品牌層**：`晶片組 > 品牌 > 尺寸 > DDR`（如 `Intel Z890 > MSI > ATX > DDR5`）。`detectMbBrand` 支援中文/子品牌（ROG/AORUS…）。
- **筆電排除**：新增共用 `isLaptopLike`（品名含「吋」或筆電字樣），同時擋 CPU 與 GPU 誤收（顯卡/CPU 本體永無吋數），且不誤傷 Sapphire NITRO+ 顯卡。
- **搭版/組裝價另放**：`isBundlePrice`（搭板/組裝價/限組裝/任搭主機板…）於 `categorizeProduct` 最前攔截，一律歸 PACKAGE，保持單品列表乾淨。
- **同型號合併**：強化 `normalizer.extractModel`（CPU 全型號正規化）+ 正規化 matcher 比對鍵；同一顆 CPU 跨三店合併成一張比價卡（213→280 跨店組）。GPU 同廠多 SKU 風險仍交模糊比對。
- **通路篩選**：前端新增「全部/原價屋/欣亞/Autobuy」選看單一通路（用既有 `?source=` API）。
- **預設排序修正**：原預設「最新更新」會被最後爬取的 Autobuy 單店商品佔滿首頁（誤以為只有 Autobuy）。改為「綜合排序（跨店優先）」= `has_multiple_sources DESC, updated_at DESC`，首頁即同時呈現三家比價卡。三家實際商品數：coolpc ~6800、sinya ~5400、autobuy ~3800。
- **合併鍵含分類**：`matcher.groupByBrandModel` 的鍵改為 `category-brand-model`，避免搭板組合(PACKAGE)與乾淨單品(CPU)同型號被併在一起。

### 分類引擎（src/processing/categorizer.ts）
- **多層子分類覆蓋 10 大核心類**：CPU / 主機板 / 顯示卡 / 記憶體 / SSD / HDD / 散熱器（既有）＋ **新增 PSU / 機殼 / 螢幕**。
  * PSU：`瓦數區間 > 80PLUS 認證 > 模組化`（例 `750W~1000W > 80+ 金牌 > 全模組`）。
  * 機殼：`尺寸塔型 > 側板`（例 `ATX 中塔 > 玻璃透側`）。
  * 螢幕：`尺寸 > 解析度 > 更新率`；尺寸支援「型號數字啟發式」（台灣慣例把吋數藏在型號，如 `XV272`→27吋），白名單 `MONITOR_SIZES` 把關。
- **消除「其他X」噪音**：新增 `hierarchy(...levels)`，遇到 null 層級即截斷，只輸出有把握的前綴；第一層未知則整段回 null（商品落在平列清單）。驗證結果：**零多層「其他」噪音鏈**。子分類覆蓋率 CPU 90% / 主機板 78% / 顯卡 96% / RAM・SSD・HDD・散熱 100% / PSU 80% / 機殼 92% / 螢幕 90%。
- **GPU 結構化型號表**（`GPU_MODELS`）：以「去空白大寫品名」比對，型號→顯示名→系列一致推導，取代舊的脆弱 `startsWith` 鏈；同世代長型號排前（`5070TI` 先於 `5070`）。`detectVram` 支援 OC 黏接型（`O24G`）與 GDDR 後綴。
- **隱式偵測強化** `detectCategory`：型號帶 RTX/GTX/RX/Arc 但無「顯示卡」字樣→GPU；含轉速/NAS 碟暱稱（IronWolf/那嘶狼/EXOS…）→HDD；並保留隱式機殼判定。皆受對應 contamination 過濾器保護。
- **污染過濾器**：新增 `isPsuContaminated`（排除電源線材/UPS）、`isMonitorContaminated`（排除 LCD 水冷頭、OLED 顯示螢幕電源、可觸控鍵盤、升降桌、投影機）。MONITOR 優先序下移至末段，避免含螢幕字樣的非螢幕商品被誤收（修掉「0吋」與大量誤分類）。

### 品牌正規化（src/processing/normalizer.ts + src/shared/constants.ts）
- 品牌抽取**統一**到 `normalizer.extractBrand`，移除 `coolpc.ts` / `sinya.ts` 內各自重複的版本。
- 新增 `BRAND_ALIASES`：中文名/全寫/變體 → 正規名（WD↔Western Digital、威剛→ADATA、微星→MSI…），避免同品牌碎裂；比對依字串長度由長到短排序。
- `KNOWN_BRANDS` 去除重複 ASUS 與子品牌（ROG），補齊 ADATA/GALAX/Antec/SilverStone/Montech 等。

### 前端 Dashboard（src/api/dashboard.ts + dashboard/{styles,script}.ts）
- **拆分為三檔**（template/styles/script），全部 <800 行，符合規範；`server.ts` 仍 import `DASHBOARD_HTML`，相容不變。
- **側欄分類樹資料驅動**：依 `/api/v1/categories` 動態產生，含 **分類圖示 + 數量徽章**，移除原本硬編碼的 20 類 HTML。
- **中文分類標籤**：卡片標籤與標題改用 `CATEGORY_META.label`（不再直出英文 enum）。
- **「只看跨店比價」toggle**：用既有 `has_multiple_sources` API 凸顯比價核心價值。
- **比價卡正確性**：徽章以「不同通路數」計（非商品數），各店顯示「該店最低價」變體。
- 子分類樹修正「同值既是葉節點又是分支」的碰撞（如 27吋）：統一建樹，分支若自身也是終點則注入可選「全部 X」。

### 分類顯示中繼資料（src/shared/constants.ts）
- 新增 `CATEGORY_META: Record<ProductCategory, {label, icon, order}>` 作為**單一真相**，前端側欄與卡片標籤、`categories` route 排序皆由此驅動。

## API 端點（http://localhost:3000，base `/api/v1`）
回應統一 `{ success, data, error?, metadata? }`；rate limit 100/分、CORS 全開。完整說明見 [README.md](README.md#api)。
- `GET /` — 左側多層折疊分類比價 Dashboard
- `GET /health` — 健康狀態（uptime / 總量 / 各來源件數）
- `GET /products` — 比價卡列表（查 `match_groups`；filters：category/subcategory/brand/q/source/price_min/price_max/in_stock/has_multiple_sources/sort/page/limit）
- `GET /products/:id`、`GET /products/:id/history` — 單品明細、價格歷史
- `GET /categories` — 主分類列表（已充實 label/icon/order，依 order 排序）
- `GET /categories/:category` — 該分類商品列表（分頁）
- `GET /categories/:category/subcategories` — 子分類樹統計（語意排序）
- `GET /categories/:category/brands` — 品牌名單與統計（可帶 `?subcategory=`）
- `GET /compare` — 即時跨店比價組（`?q=` 限搜尋結果，不帶則全庫重運算）
- `GET /sources` — 三來源爬取狀態與件數
- `POST /sources/refresh` — 背景非同步重爬三家並重建 `match_groups`
- `POST /sources/:name/refresh` — 同步重爬單一來源（coolpc/sinya/autobuy）

## 啟動方式
```bash
npm install            # 首次需安裝依賴
npm run dev            # 啟動開發伺服器（tsx watch，啟動即立刻爬一次）
npm run build          # tsc 編譯（注意：tsc 不會複製 schema.sql 到 dist；prod 需另行處理）
npx tsx src/scripts/clean-and-rebuild.ts  # 用最新分類邏輯清洗既有 DB 並重建 match_groups（無需重爬）
docker compose up -d --build              # 容器部署（掛 ./data volume 持久化 SQLite；Dockerfile 已代複製 schema.sql）
```

## 已知限制 / 後續可做
- **跨店率天花板**：目前 1,358 組（8.7%）。剩餘落單多為真實單店獨賣或 coolpc 限組裝（條件價被刻意排除比價）；HDD 可比池尤小（coolpc HDD 幾乎全限組裝）。若要再提升，方向是 SSD/MONITOR 的型號規格鍵（比照 HDD 料號策略）。
- **HDD 規格鍵不含快取容量**（64M/256M）：同系列同容量同轉速視為同 SKU；若未來出現誤併再把快取加入鍵。
- `npm run build` 後 `node dist/index.js` 會因找不到 `dist/storage/schema.sql` 失敗（tsc 不複製非 .ts）；Dockerfile / 啟動腳本需另複製 schema.sql。
- 開發時 tsx watch 會在每次存檔後重啟並重爬；批次改完再驗證，避免重複爬取與 DB 鎖。

## 開發注意（詳見 tasks/lessons.md）
- 大範圍重寫用 Write 整檔（避免 Edit 工具誤推斷 import）。
- 易污染分類（CPU/MONITOR）優先序排後並配嚴格排除詞。
- SQLite 取出的時間字串需補 'Z' 再 `new Date()`。
- `.gitignore` 需排除 `data/*.db-*`（WAL/SHM）。
