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

## 10. 含「螢幕/LCD/顯示」字樣的非螢幕商品會污染 MONITOR
- **問題**：AIO 水冷頭（LCD 水冷頭）、PSU（OLED 顯示螢幕）、可觸控鍵盤、升降桌（3螢幕）因含「LCD/螢幕/顯示器」被誤收為螢幕，並產生「0吋」垃圾子分類。
- **規則**：MONITOR 關鍵字勿用過廣的 'LCD'；把 MONITOR 優先序排到 COOLER/PSU/KEYBOARD/CASE **之後**；加 `isMonitorContaminated`（水冷/水冷頭/THOR/RYUJIN/可觸控/鍵盤/電源/升降桌/投影機）；尺寸需限合理範圍（10–120 吋）。

## 11. regex `\b` 對「數字緊接單位」會失效
- **問題**：`\b(6000)\b` 無法匹配「6000MHz」（0 與 M 皆 word char，無邊界）；同理 `\b(360)\b` 不匹配「360mm」。導致 RAM 頻率、AIO 水冷排尺寸大量抓不到。
- **規則**：抽取「數字＋可能緊接單位」時改用數字前後界 `(?<!\d)(\d+)(?!\d)`，不要用 `\b`。

## 12. 子字串品牌比對對短 token 會誤命中；別名勿過短
- **問題**：`includes('LG')` 命中「FLG 掛燈」；`includes('TEAM')` 把「Steam Deck」抽成 TEAMGROUP。長度排序只防長短互覆蓋，防不了短 token 對非品牌字串誤命中。
- **規則**：短純英數品牌（≤3 字）改用詞邊界比對 `(?:^|[^A-Z0-9])X(?:[^A-Z0-9]|$)`；別名表勿放過短片段（用 'T-FORCE' 取代 'TEAM'）；`KNOWN_BRANDS` 勿放大小寫重複（GIGABYTE/Gigabyte）或子品牌（ROG）。

## 13. 變動深度的階層子分類會造成前端樹節點碰撞
- **問題**：`hierarchy()` 截斷未知層級後，同一值可能同時是葉節點（「27吋」）與分支（「27吋 > 4K UHD」），舊建樹邏輯用 `tree[x]=` 會互相覆蓋，使只有上層的商品在側欄無法選取。
- **規則**：統一建樹（每節點皆有 children 物件與終點 count）；渲染時分支若自身 count>0 就在展開內容首列注入可選的「全部 X」葉節點。

## 14. `||` 與 `??` 混用對空字串的陷阱
- **問題**：`extractBrand(obj.brand || name) ?? obj.brand`，當 `obj.brand===''` 時 `?? ''` 會把空字串當有效值寫入 DB（`''` 非 nullish，後續 `?? extractBrand(name)` 永不回補）。
- **規則**：先把空字串正規化為 `undefined`（`s && s.trim() ? s.trim() : undefined`）再做 nullish 合併。

## 15. tsx watch 每次存檔重啟並立刻重爬，且殘留 watcher 進程
- **問題**：`npm run dev`（tsx watch）每次存檔重啟 → `scheduler.start` 立即重爬；killport 只殺 listener，watcher 母程序仍存活並持續重爬，干擾驗證。
- **規則**：批次改完再驗證；要乾淨重跑時用 PowerShell 依 CommandLine 過濾 `*PCPriceProxy*` 殺光 node 程序，再用 `clean-and-rebuild`（不重爬）套用分類變更。

## 16. 筆電/整機混入 CPU、顯卡分類
- **問題**：Acer Nitro / 微星 Titan 等電競筆電品名含 mobile CPU（Ryzen AI 7）與獨顯（RTX5060），被 CPU 'Ryzen' 關鍵字或隱式 GPU 偵測收進零件分類；品名無「筆電」二字故舊排除詞無效。
- **規則**：用「品名含螢幕吋數（吋）」當筆電/整機的可靠訊號（CPU、顯卡本體永遠沒有吋數），抽成共用 `isLaptopLike` 同時加入 CPU 與 GPU 的否定過濾；注意別誤傷 Sapphire NITRO+ 等含筆電線名的顯卡（吋數訊號可避免）。

## 17. 來源分類非 OTHER 的品項，改判須在 categorizeProduct 早攔截
- **問題**：「搭板/組裝價」散落在 CPU/RAM/HDD 等，因其來源分類非 OTHER、也不觸發污染過濾器，`categorizeProduct` 不會重判，無法靠加 PACKAGE 關鍵字移動它們。
- **規則**：要無條件改判某類品項（不論來源原本分類），在 `categorizeProduct` 最前面做專門攔截（如 `isBundlePrice → PACKAGE`），不要只依賴 `detectCategory` 的關鍵字優先序。

## 19. 預設「最新更新」排序會被「最後爬取的來源」佔滿首頁
- **問題**：scheduler 依序爬 coolpc→sinya→autobuy，autobuy 的 `updated_at` 最新；`match_groups.updated_at=MAX(updated_at)`，導致預設 `ORDER BY updated_at DESC` 時前數頁全是 autobuy 單店商品，使用者誤以為「只爬到 autobuy」。
- **規則**：跨店比價站的預設排序應 `has_multiple_sources DESC, updated_at DESC`（跨店可比價群組優先），首頁即同時呈現三家；避免單純以更新時間排序造成來源分群。

## 20. brand+model 合併鍵未含分類，會把同型號的不同分類品項併在一起
- **問題**：「搭板版 Ultra 5 245KF（PACKAGE）」與「乾淨版 Ultra 5 245KF（CPU）」brand+model 相同，被 `groupByBrandModel` 併成一組，破壞「搭板另外放」，且群組分類/卡片標籤錯亂。
- **規則**：`groupByBrandModel` 的鍵須含 `category`（`category-brand-model`），讓不同分類的同型號不互相併入；`fuzzyMatch` 本就比對同分類，無此問題。

## 21. 用晶片層級型號當合併鍵會把不同 SKU 全併（把商品藏起來）
- **問題**：GPU 用 `extractModel`＝晶片型號（RTX-5060-TI）當 brand+model 鍵，導致同晶片所有 SKU（WINDFORCE/EAGLE/8G/16G…）併成一組（一組曾 26 件），使用者「感覺漏掉很多東西」。
- **規則**：精確合併鍵必須能唯一識別 SKU。CPU 型號＝唯一產品可用；GPU 須「晶片＋產品線＋VRAM」，且**認不出產品線就不給精確鍵**（交模糊比對，寧可分開顯示也不要誤併藏商品）。模糊比對加「每組每通路最多 1 件」+ 較高門檻(0.7)。

## 22. 件數 vs 組數：聚合視圖的計數要與列表一致
- **問題**：列表顯示「比價組數」，但側欄/子分類/品牌計數查的是 `products`（件數）。同型號跨店合併後，124 件 CPU → 60 組，使用者看到 124 卻只列 60，誤以為篩選漏東西。
- **規則**：聚合（match_groups）視圖下，所有計數（分類/子分類/品牌）都要查同一張聚合表，與列表「共 N 組」一致；件數只放在「總量」這類整體統計。

## 23. 名稱清理：安全移除 + 規格標記截斷，勿用 inline token 移除
- **問題**：用 inline regex 移除規格（如 `/ZEN\d/`）會誤砍「Ryzen→Ry」、緒數殘留等。
- **規則**：先做安全移除（HTML/括號內容/價格/保固/促銷/符號），再「在第一個規格標記（核/GHz/讀寫/風扇/cm/斜線…）處截斷」保留品牌＋型號＋容量；多店合併時群組名取**最短**者（通常最乾淨）。

## 24. 模糊比對需「價格合理性護欄」，避免單顆 vs 套裝、不同容量被誤併
- **問題**：fuzzy Jaccard 把名稱相近但其實不同的商品併成一組——單顆風扇 $599 vs 三入裝 $1690、16GB vs 32GB 記憶體、滑鼠 SE 版 vs 正式版。
- **規則**：跨店同一商品價格很少差超過 ~1.6 倍；在 fuzzyMatch 加價格護欄：併入時若 `max/min > 1.6` 就跳過。簡單但能擋掉絕大多數價差型誤併。稽核指標：`highest_price > lowest_price*1.8` 的跨店群組數應趨近 0。

## 25. 整機/工作站會洩漏進顯卡；但「工作站繪圖卡」是真顯卡要保留
- **問題**：「HP Z2 G1i 商用工作站」（內含 RTX）被隱式 GPU 偵測收進顯卡。
- **規則**：`isGpuContaminated` 排除整機訊號（商用工作站/準系統/迷你主機/套裝主機/Mini PC），但須加 `&& !/繪圖卡|顯示卡/` 例外，保留「NVIDIA RTX PRO … 工作站繪圖卡」這類專業顯卡。

## 27. 分類靠關鍵字時，最大陷阱是「規格提及 ≠ 真零件」
- **問題**：把「含某零件字樣」當成「是該零件/組合」造成大量假陽性：
  * 機殼寫「顯卡408mm/顯示卡支撐架/CPU高16/塔散172mm」(clearance) → 被當含 GPU/CPU。
  * 主機板寫「8+2+1相電源」(VRM 相數) → 被當「+電源」組合；只用晶片組命名(B760M WIFI) → 落 network(無線)。
  * 電源寫「80+/85+/92+ 金牌」(效率認證) → `+` 被當組合符號；GPU「32G」VRAM、主機板「DDR5」→ 被當記憶體。
  * 「套裝搭購優惠 羅技鍵盤」/「限組裝 硬碟」(購買條件) → 單品被當組合。
- **規則**：
  1. 組合判定(`isRealBundle`)走 A+B 前**先中和假加號**：`N+N+N相電源`、`顯卡\d+mm/支撐架`、`塔散\d+`、`(8\d|9[0-2])+`(PSU認證)、`8G+8G`、`2+2`。
  2. 「零件類別計數」啟發式**不可靠**（機殼動輒提及多種零件）；改用強訊號：系統關鍵字、`+` 接**真產品名詞**、完整主機簽章(CPU型號+電源+機殼/晶片)。
  3. 條件價(搭板/限組裝/套裝搭購)是**單品購買條件**非組合 → `detectPriceCondition` 記 `specs.priceCondition`、歸真分類，matcher 排除其跨店比價(價偏低污染最低價)。
  4. 真筆電＝筆電字樣**且** CPU型號＋吋＋儲存；否則「筆電記憶體/散熱器/支架」配件被誤當整機。
  5. 污染詞清單別放零件自身常見字（主機板宣傳「散熱片」就把 `散熱片` 移除）。
  6. 信任既有 category 的重分類觸發要涵蓋洩漏路徑（如 NETWORK→主機板），否則隱式偵測在 `detectCategory` 不會被呼叫到。
- **驗證**：tsx 腳本對 DB 全量重算，**雙向**檢查（移出去向＋反向誤拉），逐輪盯假陽性收斂到 0；中文 LIKE 經 shell 易亂碼，查詢一律走 tsx/JS 字串比對。

## 28. 子分類樹排序必須是分類語意排序，不可用泛用品牌或 count
- **問題**：Dashboard 以泛用 `INTEL/AMD` 字串與 DB count 排所有子分類，導致主機板 `Intel Z890/B760/H610/Z790...`、GPU `Intel Arc/AMD/NVIDIA...`、RAM 容量順序混亂。
- **規則**：子分類排序集中在 `src/shared/subcategory-sort.ts`，主機板依晶片組世代、GPU 依世代與型號（Ti/Super/XT 先於 base）、CPU 依品牌/世代、RAM/SSD/HDD 依容量；Dashboard tree 也要使用同一套語意，而不是靠 API count 或 locale。

## 29. 判斷爬到的東西是否分類好，要看 pipeline 後結果，不看 source category
- **問題**：`scrape:test` 原本只列 scraper 原始 category，會看到來源把主機板標 CPU、外接燒錄機標 OS、螢幕標 speaker，容易誤判管線仍錯；實際入庫前還有 normalize/categorize/diy-filter。
- **規則**：`npm run scrape:test` 輸出 source category 與 pipeline category；分類正確性以 pipeline 後樣本、`clean-and-rebuild` 後 DB、`npm run audit` 為準。source category 只作為來源品質參考。

## 30. exact match 不可只回寫代表列，否則同型號重複卡會回來
- **問題**：exact group 只把每來源最低代表列寫回 `match_group_id`，同 exact key 的非代表列會在 `updateMatchGroups()` 補成 `mg-*` 單例，畫面出現「同一顆 CPU 的跨店卡 + 同店單例卡」重複。
- **規則**：matcher 的 exact group 要回傳同 key 的完整成員，讓 DB 全員共享同一個 `match_group_id`；前端 render 再從 group products 取每來源最低價顯示。條件價仍以 `specs.priceCondition` 排除跨店比價，audit 的 duplicate singleton 檢查只看非條件價商品。

## 31. 不可把 SKU 變體清成同名卡；同顯示名也要 exact 收斂
- **問題**：normalizer 移除括號與斜線規格時，把鍵盤顏色/軸體、滑鼠顏色、水冷黑白等 SKU 變體一起清掉；結果不同 SKU 看起來同名，或同顯示名分裂成多張跨店/單店卡。
- **規則**：`normalizeName` 要保留顏色與鍵盤軸體這種會影響 SKU 的變體；`matcher.exactMatchKey` 對非 PACKAGE 品項使用「分類 + 品牌 + 顯示名」做 exact group 並全員回寫；fuzzy match 遇到顏色或鍵盤軸體衝突必須跳過。
- **驗證**：全庫掃描要維持 `exactSplitKeys=0`、`exactSingletonKeys=0`、`sameNameRisks=0`；`npm run audit` 的 `Exact duplicate split keys = 0` 必須通過。

## 30. 來源分類非 OTHER 也可能錯，categorizeProduct 要針對高風險來源覆核
- **問題**：CPU 來源內有 `任搭CPU` 主機板與準系統，PSU 來源有行動電源/音響，CASE 來源有掌機收納包，SPEAKER 來源有內建喇叭螢幕，OS 來源有支援 Mac OS 的外接 DVD。
- **規則**：污染覆核不可只處理 OTHER/PACKAGE；`categorizeProduct` 要對高風險來源類別主動重判。新增檢查時先補 regression tests，再擴 `audit-pipeline`，避免只靠人工抽樣。

## 31. CPU 子分類 label 不可混入行銷詞或舊世代孤立節點
- **問題**：`Ryzen 9 / 高階` 這種 label 不是規格分類；舊款 `i7-5960X` 只有 1 筆卻產生 `第 5 代` 側欄節點，讓 CPU 樹看起來像資料錯亂。
- **規則**：CPU 子分類保持規格詞：`Ryzen 9/7/5`、Intel 10 代以上、Core Ultra 200S；Threadripper 獨立，不掛在 Ryzen 9；Intel 1~9 代不建立世代節點，audit 要檢查 legacy generation count 為 0。

## 32. 來源 GPU 內的通路整機名稱要先用 isRealBundle 攔截
- **問題**：欣亞 GPU 分類內會出現 `欣亞PC【天秤座】.../RTX5060/.../Windows 11 Home`、Acer `Predator Orion ... 電競電腦` 這類整機，若只看 RTX 型號會污染 GPU 側欄與商品卡。
- **規則**：`isRealBundle` 要涵蓋通路整機詞（`欣亞PC`、`電競電腦`、品牌/套裝/桌上型電腦）與完整主機簽章；儲存簽章需支援 `500GB`、`M.2`。`audit-pipeline` 必須檢查 GPU system residue，不能只檢查 A+B GPU bundle。

## 33. GPU 型號表不可用裸數字直接掃完整 raw_name
- **問題**：GPU 子分類曾把 `$476000` 價格誤判成 RX 7600、把 `3060MHz` 時脈誤判成 RTX 3060，導致 RTX PRO 6000 落到 `RX 7600 > 96G`、RX 9070 XT 落到 `RTX 3060 > 16G`。
- **規則**：比對 `GPU_MODELS` 前先用 `gpuModelSearchText()` 清掉價格、MHz、cm、瓦數等非型號數字；新增高價專業卡與 RX 9070XT 時脈案例 regression test；audit 要檢查 `GPU model collision = 0`。

## 34. 跨店落單不能只看 exact split，要掃來源描述差
- **問題**：同 SKU 可能因來源文字差異落在外面：`ICE/AERO` 未標白色、`REVERSE/反向扇`、單顆/3IN1、散熱膏 2g/5.8g、主機板供電相數/socket/白色描述、AIO `黑色版/白龍王/三代`、`Low Profile` 顯卡、`G/GB` 容量、品牌中英別名與 `藍牙` 等通用描述。
- **規則**：全庫複檢要同時跑 exact split、相近價位高相似跨來源候選、代表 live API；normalizer 要「先剝來源噪音，再加 canonical 變體」，matcher exact key 要剝品牌/別名並保留真正 SKU 變體。`match_groups.lowest/highest` 必須用每來源最低代表價，避免同來源重複高價造成假價差異常。
- **驗證**：`Exact duplicate split keys = 0`、`Price anomalies = 0`、污染檢查全 PASS；代表樣本需涵蓋 GPU、主機板、散熱器/風扇、鍵盤/滑鼠、網通/耳機與儲存容量。

## 26. $1 促銷假項要過濾（最低有效價）
- **問題**：CoolPC 有「$1 登錄送 Office／竊盜險／抽電競椅」等 $1 假商品污染資料與計數。
- **規則**：處理管線過濾 `price < MIN_VALID_PRICE($10)`（無真零件低於此價）；既有資料於 clean-and-rebuild 以 `DELETE FROM products WHERE price < MIN` 清除。

## 18. matcher 跨店合併靠 brand+model；型號須正規化且 model 抽取要夠廣
- **問題**：跨店同一顆 CPU 因 `extractModel` 涵蓋不足或拼寫差異（i5-14400 vs i5 14400）而無法合併，導致大量單店單品卡。
- **規則**：`extractModel` 回傳正規化型號（大寫、去空白、- 連接），matcher 比對鍵也 `.toUpperCase().replace(/\s+/g,'')`；CPU 型號＝唯一產品可安全合併，GPU 同晶片不同 SKU（同廠）勿用晶片型號強合，交給模糊比對以免誤併。

## 28. 來源分類可信但仍要覆核污染邊界
- **問題**：CoolPC 來源 `MONITOR` 分類會包含投影機、螢幕掛燈等非螢幕商品；若 `categorizeProduct` 只對 OTHER/PACKAGE 或部分污染類重判，這些會直接穿過。
- **規則**：每個有污染過濾器的分類都要在 `categorizeProduct` 覆核來源分類；新增污染規則時也要同步補 audit 檢查與 regression test。

## 29. GPU 精確鍵必須含 SKU 變體且 exact group 每來源單代表
- **問題**：只用晶片＋產品線＋VRAM 會把 `DUAL-RTX5060-O8G` 與 `DUAL-RTX5060-O8G-WHITE` 合併；exact group 若收同來源多筆，會把同店變體藏進跨店卡。
- **規則**：GPU key 要納入顏色/OC/版本等變體；exact match 形成跨店組時，每個來源只選最低價代表，其餘商品保持單例，避免誤併與商品消失感。
