---
name: pcprice
description: "查全新電腦零件價（原價屋/欣亞/Autobuy）用 pcprice CLI。"
version: 1.0.0
---

# PCPriceProxy — Agent 查價

台灣三大**全新** DIY 通路比價：原價屋（coolpc）、欣亞（sinya）、Autobuy。
不是蝦皮、不是二手、不是 BigGo 歷史價。

契約：[`docs/agent-cli.md`](../../docs/agent-cli.md)

## When to Use

- 查 CPU／顯卡／主板等**全新通路淨價**
- 問原價屋、欣亞、Autobuy 多少錢
- 組裝清單要可單買的零件價（不是搭板價）

不要用在：二手、海外電商、歷史價曲線、原廠規格手冊核對。

## 入口

優先順序：

```bash
# 1) PATH 上已有
pcprice …

# 2) 在本 repo 根目錄
./bin/pcprice …
npm run cli -- …
```

預設 JSON（給模型）。人要掃讀加 `--table`。

## 先做

```bash
pcprice health --pretty
```

- `ok=true` 且 `totalMatchGroups>0` → 可以 search
- `empty_database`／連不上 → `pcprice refresh`（約 1 分鐘）或 `npm run dev` / `./start.sh`
- 資料超過 2 小時且使用者要「現價」→ 再 `refresh`

連線：先試 `http://127.0.0.1:3000`，沒起來讀 `data/pcprice.db`。`--offline` 只讀 DB。

## 查價

```bash
pcprice search 9800X3D --parts-only --in-stock --sort price_asc
pcprice search --category gpu --q "5070 Ti" --in-stock --sort price_asc --limit 10
pcprice search --category motherboard --q "B850" --mb-ddr DDR5
pcprice show <id>
pcprice categories cpu
pcprice brands gpu
```

分類：`cpu gpu motherboard ram ssd hdd psu case cooler monitor keyboard mouse headset speaker fan network cable os package`

常用旗標：`--parts-only`（排除整機／搭購）、`--in-stock`、`--multi`（跨店）、`--price-min` / `--price-max`、`--source coolpc|sinya|autobuy`

等價 HTTP：`GET /api/v1/agent/search?q=…&parts_only=true`

## 怎麼讀

- 單位＝**比價組**，不是 `products` 列。各通路在 `stores[]`。
- 價格＝**TWD 整數**。
- `in_stock=true`＝至少一家有貨；交付仍附 `url`，下單前點原站。
- `category=package` 或子分類含「搭購價單品」＝條件價，**不可**當可單買淨價。
- 未加 `--category` 時，結果會把零件淨價排在整機／搭購前面；查零件請再加 `--parts-only`。
- 品名像零件、分類卻是 `motherboard`／低得離譜的價，多半是搭板價漏網，不要當淨價。

交付主表只放零件淨價；搭購／整機另表或略過。

## 禁止

- 為了查價去 curl 三家官網（CLI 已包好）
- 把本庫價格跟蝦皮二手混成「最低價」
- 把 `totalProducts` 或 `stores.length` 加成「有幾顆 CPU」
- 為此專案安裝 MCP
