# 第三種使用方式：AI Agent CLI

Dashboard 給人看，REST API 給程式接完整 JSON。
**Agent 模式**給語言模型用：預設精簡 JSON、單位是比價組、價格一律 TWD。

進專案的 Agent 先載 [`skills/pcprice/SKILL.md`](../skills/pcprice/SKILL.md)。

## 入口

```bash
# 專案內
npx tsx src/cli/index.ts search 9800X3D
npm run cli -- search 9800X3D --in-stock --sort price_asc

# 安裝後
pcprice search 9800X3D
pcprice --help
```

包裝腳本：`bin/pcprice`（不需先 `tsc`，直接跑 TypeScript）。

## 指令

| 指令 | 用途 |
|---|---|
| `search [關鍵字]` | 查比價組（預設 15 筆；未指定分類時零件淨價排前面） |
| `show <id>` | 一組明細（比價組或商品 id） |
| `history <商品id>` | 價格歷史 |
| `categories [分類]` | 主分類，或該分類子樹 |
| `brands <分類>` | 品牌統計 |
| `health` / `sources` | 庫存量與三家爬取狀態 |
| `refresh [來源]` | 重爬；有 API 就打 API，否則本機爬 |
| `schema` | 印出精簡 JSON 契約 |

連線順序：本機 API `http://127.0.0.1:3000` → 沒起來再讀 `data/pcprice.db`。
`--offline` 強制本機 DB；`--url` 指定遠端。

## Agent HTTP（給 curl / 其他代理）

Base：`/api/v1/agent`

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/search` | 與 CLI search 同一組篩選，回 `items[]` 精簡卡 |
| GET | `/show/:id` | 精簡卡 + specs + raw_names |
| GET | `/health` | 組數 / 來源狀態 |
| GET | `/categories` | 主分類 |
| GET | `/categories/:c/subcategories` | 子分類 |
| GET | `/categories/:c/brands` | 品牌 |
| GET | `/schema` | 契約 |

外包一律 `{ ok, data, error?, hint?, via?, fetched_at, currency }`。
卡片沒有 `rawName` / 完整 `Product`，省 token。

## 給代理的使用規則

1. 這是**台灣三大全新零件通路**（原價屋 / 欣亞 / Autobuy），不是蝦皮、不是二手。
2. 計數單位是 **比價組**，不要把 `stores.length` 加成「有幾顆 CPU」。
3. `package > 搭購價單品` 是條件價，不是可單買淨價。
4. `in_stock=true` 表示至少一家有貨；下單前仍應點 `stores[].url`。
5. 沒資料時先 `pcprice refresh` 或啟動 `npm run dev`，不要自己去爬三家官網。
