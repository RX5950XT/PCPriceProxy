# AGENTS.md - 專案通用規範

## 開發指令
- 啟動開發伺服器：`npm run dev`
- 編譯 TypeScript：`npm run build`
- 執行測試：`npm run test`
- 執行測試爬取：`npm run scrape:test`

## 程式碼規範
- 一律使用 **TypeScript**，遵循嚴格模式（strict: true）。
- 模組導入使用 ESM 格式，本地檔案導入須加副檔名 `.js` (例如 `import { foo } from './bar.js'`)。
- 優先不可變資料，不直接修改既有物件。
- 函數盡量小於 50 行，檔案盡量小於 800 行，巢狀不超過 4 層。
- 錯誤處理：使用 `src/shared/errors.ts` 定義的結構化錯誤，不可靜默吞掉錯誤。
- 語言與回覆：一律使用繁體中文（臺灣用語）。
