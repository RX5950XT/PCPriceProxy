# PCPriceProxy — 第十九輪：全庫複驗 + 內顯整機漏網修正

## 本輪目標（/goal）
研究零件分類、側欄易用性、資料真實性、分類正確性、同型號跨店比價。

## 執行項目
- [x] 全庫複驗：test 102、audit 29 PASS、build、三家 live scrape 皆正常。
- [x] Live API 抽查 `cpu&q=12400`：只剩 autobuy 一張乾淨卡——sinya 現售版已改標【組裝價】歸 PACKAGE，屬真實庫存變化，非回歸。
- [x] 修正內顯整機漏網：`isCompleteSpecSystem` 補「GPU 或晶片組」訊號，`華碩【I5/R5管理者】` 2 筆從 ssd 歸位 `整機電腦 > ASUS`。
- [x] 全庫雙向掃描：新規則只吸走該 2 筆，12,137 筆零件零誤殺。
- [x] regression test +1（103 passed）、clean-and-rebuild、audit 29 PASS、build。
- [x] 同步 CLAUDE.md / AGENTS.md / CONTEXT.md，提交。

## 回顧
- 資料真實性：三來源 scrape logs 全 success，孤兒列汰除運作中；「同型號卡變少」要先查來源是否真的改了售價條件，不要先假設回歸。
- 完整主機簽章現涵蓋：CPU+(GPU或晶片組)+RAM+儲存（斜線規格清單），內顯機不再漏。
