# PCPriceProxy — 第二十二輪：滑鼠 + 線材細分 + 價格篩選

## 本輪目標
- 滑鼠側欄改類型優先
- 線材兩層細分
- Dashboard 價格區間篩選

## 執行項目
- [x] 滑鼠：`用途 > 有線/無線 > 品牌`
- [x] 線材：`大類 > 細類`（HDMI / CAT.x / Type-C to C / 12VHPWR…）
- [x] Dashboard `$最低–最高` 價格篩選（接 `price_min`/`price_max`）
- [x] 測試 / rebuild / audit / 文件

## 回顧
- API 本來就有 `price_min`/`price_max`，缺的是 UI。
- 線材細分後 Type-C+DP Alt 從影音改回 USB，邏輯更正確。
