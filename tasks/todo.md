# PCPriceProxy — 第二十輪：交易終端機介面改版 + 側欄體驗 + 文件/部署維護

## 本輪目標
Dashboard 視覺大改（擺脫模板感）、零件分類側欄體驗、API 文件對齊程式、部署就緒。

## 執行項目
- [x] Dashboard 改「交易終端機」風格：JetBrains Mono + Noto Sans TC、radius 0、hairline 分隔、CRT 掃描線、磷光青 accent（#35c9e0，避開三通路 amber/red/green）、綠▼紅▲漲跌價板、閃爍游標 logo。
- [x] 移除品牌篩選欄位、通路狀態健康點（使用者要求）；修正 logo 全大寫黏字。
- [x] 側欄第二點修復：深層子分類樹（A > B > C）改**預設全展開**，不用逐層點；`載入中` 只切分類時閃一次。
- [x] 文件維護：README API 段補完整（12 端點 + 篩選參數 + 範例）、新增部署段（Docker）；AGENTS.md 修 H1 標題並補部署指令；CLAUDE.md 補部署指令；CONTEXT.md API 端點段補齊（漏列的 compare/sources/products:id/history/:name/refresh/categories:cat）。

## 待辦（未動，等使用者拍板）
- [ ] 側欄第 1/3/4 點：點分類=選取+手風琴自動收合其他；18 分類無側欄內搜尋；`·` dot marker 可掃描性。
- [ ] 候選新增主分類（第十八輪盤點）：擴充卡 / 外接盒硬碟座 / UPS / Webcam / 隨身碟記憶卡。

## 回顧
- **API 完善度**：功能完整可用（讀取/篩選/分頁/比價/單品/價格歷史/重爬），但先前文件過時漏一半端點；本輪已把 README 對齊為單一準確來源。
- **部署形式**：`Dockerfile` + `docker-compose.yml` 早已備妥；SQLite 本機檔需持久 volume（`./data`），不適合純 serverless。
- 文件改動不影響 build；程式未變動故無需重跑 test/audit。
