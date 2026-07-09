# PCPriceProxy — 第十七輪：光碟機移除、OS/軟體合併、線材獨立、孤兒列汰除

## 本輪需求（使用者）
- [x] 光碟機分類裡怎麼會有伺服器工作站？
- [x] 光碟機不需要子分類，也不該單獨一類（裡面還有其他雜物）。
- [x] 作業系統與應用軟體合併。
- [x] 線材應該單獨拎出來一類。

## 執行計畫
- [x] 查 DB：光碟機 30 筆全數列出，找出污染來源。
- [x] 根因：Xeon 料號不在 `RE_CPU_MODEL` → 伺服器/工作站漏判整機 → 被 `DVD-RW` 拉進光碟機。
- [x] 新增 `isServerWorkstation`，PACKAGE 加第一層「伺服器 / 工作站」；排除 `isLaptopLike`（行動工作站是筆電）。
- [x] 移除 `OPTICAL_DRIVE` enum；coolpc n23 / autobuy 6 → OTHER；`Windows 隨機版《含DVD》` 交給 detectCategory。
- [x] 合併 `SOFTWARE` 進 `OS`，label 改「作業系統 / 軟體」，子分類兩層。
- [x] 移除裸 `OS` 關鍵字（`Mac OS` / `NON-OS` / `TosLink` / `TOSHIBA` 都含 `OS`）。
- [x] 新增 `CABLE` 主分類 + `looksLikeCable` 隱式簽章 + 8 型子分類；網路線改歸線材。
- [x] 雙向檢查：離線快照比對進出分類的商品，逐筆檢視。
- [x] 修 5 個回歸：KVM 螢幕、電源「黑色線材」、`isPsuContaminated` 裸「線材」、視訊鏡頭「軟體最高畫素」、外接硬碟「備份軟體」。
- [x] 抽 `src/ingest.ts`：upsert 後汰除同來源孤兒列（三處爬取流程共用）。
- [x] `needsRecategorize` 改用 `!isDiyCategory(cat)`，讓被移除的舊分類自癒。
- [x] audit 加 4 項檢查；測試 +12；重爬 + clean-and-rebuild + audit 全 PASS。

## 回顧
- **使用者的直覺是對的**：「裡面應該還有其他雜七雜八的東西」——真兇不是分類規則，是**沒有人刪孤兒列**。`os` 分類混著外接硬碟、電競椅、USB HUB，`scraped_at` 停在上一輪，早已從來源下架。`deleteNonDiyProducts` 只看分類，救不了它們。首次汰除清掉 2,897 筆。
- **一個關鍵字可以毀掉一個分類**：裸 `OS` 讓 `TOSHIBA` 整批外接硬碟落進作業系統；`KVM` 讓 9 台內建 KVM 的電競螢幕落進線材。三字元以下、或會出現在規格描述裡的關鍵字，都要先想「哪些不相干的品名含這個子字串」。
- **新分類會照出舊 bug**：`isPsuContaminated` 把「線材」當排除詞，過去沒事（電源落 OTHER 被刪，看不出來）；線材分類一開，電源就跑進去了。新增分類時要順手檢查「哪些既有排除詞會跟新分類搶」。
- **離線快照有陷阱**：sinya/autobuy 的 scraper 自己會呼叫 `detectCategory`，快照裡的 `srcCat` 是舊程式算出來的。用快照做雙向檢查時，被污染的來源分類會產生假回歸——必須重爬或直接單測 `detectCategory`。
- 最終：13,690 商品 / 1,293 比價組 / 19 主分類 / 29 項 audit 全 PASS / 102 tests。
