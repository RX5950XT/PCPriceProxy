# PCPriceProxy — 第三十一輪：螢幕 M0+M1

## 完成
- [x] M0：detectMonitorResolution（49/57/34、PA/X*U、MAG 24/25 F）
- [x] M1：enrichment model key + catalog + merge
- [x] seed 腳本 `npm run enrich:monitor-seed`
- [x] test 146 / rebuild / audit / build
- [x] AGENTS / CLAUDE / CONTEXT

## 指標
| 項目 | 前 | 後 |
|---|---|---|
| resolution 未標示 | 868 | **581** |
| panel 未標示 | 76 | 76 |
| refresh 未標示 | 434 | 434 |

## 後續（可選）
- 繼續填 `monitor-catalog.json`（seed 高頻）
- M2：spec_enrichment 表 + 非同步外查
