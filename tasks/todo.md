# PCPriceProxy todo
最後更新：2026-11-19

> 交接、現況、待辦都在本檔（嚴格 ≤100 行）。分類／比對規則與地雷見 AGENTS.md（＝CLAUDE.md），教訓見 [lessons.md](./lessons.md)，API 與部署見 README。逐輪歷史查 `git log -- CONTEXT.md`。

## 現況（交接）

- 整合原價屋（coolpc）、欣亞（sinya）、Autobuy 三家價格，MatchGroup 跨店比價卡＋左側多層摺疊分類樹；第三種用法是 Agent CLI／`/api/v1/agent`（`pcprice search`，精簡 JSON，不是 MCP），先載 `skills/pcprice/SKILL.md`，契約見 `docs/agent-cli.md`。
- 資料流：scrape → normalize → categorize → diy-filter → ingest（upsert＋汰除孤兒列）→ match → `products`／`match_groups`。已做到第三十二輪（主機板 facet）。
- **UI 唯一計數單位＝`match_groups`（組）**；`products` 列數只供運維（`/health` 的 `totalProducts`）。
- 改分類或比對後固定流程：`npm run test` → `npx tsx src/scripts/clean-and-rebuild.ts`（免重爬）→ `npm run audit`（全 PASS）→ `npm run build`。

### 各分類側欄現行結構（規則細節見 AGENTS）
- CPU `品牌 > 世代 > 系列`；主機板 `腳位 > 晶片組 > 板廠`＋facet（板型／記憶體槽／Wi-Fi／DDR／有線網）；顯卡 `系列 > 型號 > [多顯存才有容量] > 品牌`。
- RAM 頂層含「伺服器記憶體」；PSU `尺寸 > 瓦數 > 認證 > 模組`；機殼 `最大板型 > 品牌 > 系列`；螢幕 `尺寸 > 品牌`＋facet（面板／Hz／解析度）。
- 散熱：`一體式水冷 (AIO) > 冷排 mm > 燈效`／`單塔|雙塔|下吹空冷 > 高度階 > 燈效`／`散熱膏/配件 > M.2 散熱|分體水冷配件`。
- 喇叭 `型態 > 品牌`；鍵盤 `機制 > [軸體] > 有線/無線 > 品牌`；滑鼠 `用途 > 有線/無線 > 品牌`；耳機麥克風 `產品大類 > 品牌`；網通 `設備類型 > 品牌`；線材 `大類 > 細類`；OS `作業系統|應用軟體 > …`。
- PACKAGE：`整機電腦`／`筆電`／`準系統 / 迷你 PC`／`掌機`／`伺服器 / 工作站`／`零件組合 > 搭配類型`／`搭購價單品 > 零件分類 > 條件`。光碟機不是分類（燒錄機不入庫）。

### 最近幾輪結論
- 第三十二輪主機板：DDR 依平台定案，只有 LGA1700 雙軌、未標 D4 預設 DDR5；`mbDdr` 未標示＝0；覆蓋 842 件（DDR5 ~714／DDR4 ~127）。
- 第三十一輪螢幕 M0＋M1：L0 品名規則＋L1 `monitor-catalog.json`（merge 只填未標示）；1,191 組中解析度未標示 868→20、panel 69、Hz 427。誠實殘留：Google TV、雙模 GX790、品名無訊號者。
- 第三十輪散熱：AIO 漏判補齊、空冷高度只信「高／高度 N」、分體水冷配件先於 AIO 判定；AIO 561／單塔 320／雙塔 179／下吹 57／配件 104。
- 第二十九輪機殼：`未標板型` 41→0，新增 `機架式 / 工業`。
- 原則：「未標示」是誠實缺口標籤，只回收高信心訊號或清雜訊，不瞎猜規格（禁止「沒寫就 FHD」）。
- 稽核法：寫 tsx 腳本對全庫重算判定，雙向檢查（移出去向 vs 反拉），逐輪收斂假陽性；`bundleReason` 回規則名方便定位誤判。

## 待辦

- [ ] 繼續填 `monitor-catalog.json`（`npm run enrich:monitor-seed` 列高頻缺口）。
- [ ] 螢幕 M2：`spec_enrichment` 表＋非同步外查（L2 未實作）。
- [ ] 候選新增主分類（待使用者決定，不要先全加，需白名單防污染）：`影音 / PCIe 擴充卡`、`儲存外接盒 / 硬碟座` 最優先；其次 UPS、Webcam、隨身碟／記憶卡；再次麥克風錄音、印表機掃描器、投影機。
- [ ] 提升跨店率（目前約 1,358 組／8.7%）：方向是 SSD／MONITOR 的型號規格鍵（比照 HDD 料號策略）。

## 已知問題／刻意不處理

- 跨店率天花板：剩餘落單多為單店獨賣或 coolpc 限組裝（條件價刻意排除比價）；coolpc HDD 幾乎全限組裝，HDD 可比池小。
- HDD 規格鍵不含快取容量（64M/256M），同系列同容量同轉速視為同 SKU；出現誤併再加入。
- `npm run build` 不複製 `schema.sql`，純 `node dist/index.js` 會失敗（Dockerfile 已代複製）。
- tsx watch 每次存檔重啟並重爬，批次改完再驗；SQLite 時間字串補 `Z` 再 `new Date()`；`.gitignore` 要排除 `data/*.db-*`。
