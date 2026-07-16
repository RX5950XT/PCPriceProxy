/**
 * Dashboard 樣式 —「交易終端機」風。
 * 版面語言：等寬字主導、細線分隔的看盤表格（非圓角卡片）、直角無圓、大寫標籤、
 * 極淡 CRT 掃描線與青色磷光強調色。比價＝看盤：最低價綠（跌）、最高價紅（漲）。
 * class 契約與 script/HTML 完全一致，勿更名。
 */
export const DASHBOARD_STYLES = `
:root {
  --bg: #0a0a0c;
  --panel: #101013;
  --panel2: #17171c;
  --line: rgba(255,255,255,0.09);
  --line-strong: rgba(255,255,255,0.17);
  --text: #e9e7df;
  --muted: #8b8981;
  --faint: #5c5a53;

  /* 磷光青：品牌 / 選取 / focus（與三通路橘/紅/綠皆不衝突） */
  --accent: #35c9e0;
  --accent-soft: rgba(53,201,224,0.12);
  --accent-line: rgba(53,201,224,0.42);
  --accent-tint: #8fe6f5;

  /* 看盤語意：綠＝最低(跌)、紅＝最高(漲) */
  --green: #35d07f;
  --green-soft: rgba(53,208,127,0.13);
  --green-tint: #7cf0b0;
  --red: #ff5d5d;
  --red-soft: rgba(255,93,93,0.11);
  --red-tint: #ff9a9a;
  --yellow: #f5a623;

  /* 通路識別色 */
  --coolpc: #f5a623;
  --sinya: #ff5d5d;
  --autobuy: #35d07f;

  --radius: 0;
  --mono: 'JetBrains Mono', ui-monospace, monospace;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: 'JetBrains Mono', 'Noto Sans TC', ui-monospace, monospace;
  font-size: 15px;
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
/* CRT 掃描線 + 頂端青色磷光暈（極淡） */
body::before {
  content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background:
    radial-gradient(60% 40% at 50% -6%, rgba(53,201,224,0.08), transparent 66%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px);
}

/* 數字等寬對齊 */
.stat-value, .cat-count, .results-count, .store-val, .lowest-badge,
.tag-saving, .tag-multi, .page-btn { font-variant-numeric: tabular-nums; }

::-webkit-scrollbar { width: 9px; height: 9px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
header, .sidebar, .controls, .results-header { animation: fadeIn 0.4s ease both; }
.controls { animation-delay: 0.08s; }
.results-header { animation-delay: 0.12s; }

/* ─── Header：狀態列 ─── */
header {
  position: sticky; top: 0; z-index: 200;
  background: rgba(10,10,12,0.92);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line-strong);
}
.header-inner {
  max-width: 1520px; margin: 0 auto;
  padding: 0.7rem 1.75rem;
  display: flex; align-items: center; gap: 1.5rem;
}
.logo { display: flex; align-items: center; gap: 0.7rem; text-decoration: none; flex-shrink: 0; }
.logo-mark {
  width: 2.1rem; height: 2.1rem;
  background: var(--accent); color: #04222a;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 1.05rem;
  box-shadow: 0 0 14px rgba(53,201,224,0.4);
}
.logo-words h1 {
  font-size: 1.08rem; font-weight: 700; color: var(--text);
  letter-spacing: 0.04em;
}
.logo-words h1::after {
  content: '_'; color: var(--accent); margin-left: 1px;
  animation: caret 1.1s steps(1) infinite;
}
@keyframes caret { 50% { opacity: 0; } }
.logo-words p { font-size: 0.62rem; color: var(--muted); letter-spacing: 0.14em; text-transform: uppercase; }

.header-stats { display: flex; gap: 1.75rem; margin-left: 1.75rem; }
.stat { display: flex; flex-direction: column; gap: 0.1rem; }
.stat-label { font-size: 0.58rem; color: var(--faint); text-transform: uppercase; letter-spacing: 0.14em; }
.stat-value { font-size: 0.86rem; font-weight: 700; color: var(--accent-tint); }
.header-right { margin-left: auto; display: flex; align-items: center; gap: 0.75rem; }
.btn-refresh {
  display: flex; align-items: center; gap: 0.45rem;
  background: transparent; border: 1px solid var(--accent-line);
  color: var(--accent-tint); padding: 0.5rem 0.9rem;
  font-size: 0.74rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  font-family: inherit; cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-refresh:hover:not(:disabled) { background: var(--accent); color: #04222a; }
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-refresh svg { transition: transform 0.3s; flex-shrink: 0; }
.btn-refresh.spinning svg { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Main Layout ─── */
.main-container {
  max-width: 1520px; margin: 0 auto; padding: 1.5rem 1.75rem 4rem;
  display: flex; gap: 1.5rem;
}
.sidebar {
  width: 250px; flex-shrink: 0;
  background: var(--panel); border: 1px solid var(--line);
  padding: 1rem 0.6rem;
  align-self: start; position: sticky; top: 82px;
  max-height: calc(100vh - 108px); overflow-y: auto;
}
.main-content { flex: 1; min-width: 0; }

/* ─── Controls Bar ─── */
.controls { display: flex; gap: 0.6rem; align-items: stretch; margin-bottom: 1.1rem; flex-wrap: wrap; }
.search-wrap { position: relative; flex: 1; min-width: 240px; display: flex; }
.search-icon { position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: var(--faint); pointer-events: none; }
.search-input {
  width: 100%; background: var(--panel);
  border: 1px solid var(--line); border-radius: 0;
  padding: 0.62rem 1rem 0.62rem 2.4rem;
  color: var(--text); font-size: 0.86rem; font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.search-input::placeholder { color: var(--faint); }
.search-input:focus { outline: none; border-color: var(--accent-line); box-shadow: inset 0 0 0 1px var(--accent-line); }

.sort-select {
  background: var(--panel); border: 1px solid var(--line); border-radius: 0;
  color: var(--text); padding: 0.5rem 0.75rem;
  font-size: 0.74rem; font-family: inherit; cursor: pointer; min-width: 150px;
  text-transform: uppercase; letter-spacing: 0.04em; transition: border-color 0.15s;
}
.sort-select:hover { border-color: var(--line-strong); }
.sort-select:focus { outline: none; border-color: var(--accent-line); }

/* ─── 跨店比價 Toggle ─── */
.multi-toggle {
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--panel); border: 1px solid var(--line); border-radius: 0;
  padding: 0.5rem 0.8rem; font-size: 0.72rem; color: var(--muted); cursor: pointer;
  user-select: none; transition: all 0.15s; white-space: nowrap;
  text-transform: uppercase; letter-spacing: 0.04em;
}
.multi-toggle:hover { border-color: var(--line-strong); color: var(--text); }
.multi-toggle.active { border-color: var(--green); color: var(--green-tint); }
.switch-track {
  width: 30px; height: 16px; border-radius: 0;
  background: rgba(255,255,255,0.14); position: relative; transition: background 0.15s; flex-shrink: 0;
}
.multi-toggle.active .switch-track { background: var(--green); }
.switch-thumb {
  position: absolute; top: 2px; left: 2px; width: 12px; height: 12px;
  border-radius: 0; background: #0a0a0c; transition: transform 0.15s;
}
.multi-toggle.active .switch-thumb { transform: translateX(14px); }

/* ─── 價格區間篩選 ─── */
.price-filter {
  display: flex; align-items: center; gap: 0.28rem;
  background: var(--panel); border: 1px solid var(--line); border-radius: 0;
  padding: 0 0.45rem 0 0.65rem; min-height: 100%;
  transition: border-color 0.15s;
}
.price-filter:focus-within { border-color: var(--accent-line); box-shadow: inset 0 0 0 1px var(--accent-line); }
.price-filter-label {
  color: var(--faint); font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.04em; user-select: none;
}
.price-filter-sep { color: var(--faint); font-size: 0.78rem; user-select: none; }
.price-input {
  width: 4.6rem; background: transparent; border: 0;
  color: var(--text); font-size: 0.78rem; font-family: inherit;
  padding: 0.5rem 0.15rem; text-align: right;
  /* 隱藏 number spinner，維持終端機風格 */
  -moz-appearance: textfield;
}
.price-input::-webkit-outer-spin-button,
.price-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.price-input::placeholder { color: var(--faint); letter-spacing: 0.02em; }
.price-input:focus { outline: none; }
.price-clear {
  background: transparent; border: 0; color: var(--faint);
  font-size: 1rem; line-height: 1; cursor: pointer; padding: 0.2rem 0.3rem;
  font-family: inherit; transition: color 0.14s; display: none;
}
.price-clear.visible { display: block; }
.price-clear:hover { color: var(--text); }

/* ─── 分類專用 facet（螢幕／主機板等，工具列上方） ─── */
.category-filters {
  display: flex; flex-wrap: wrap; gap: 0.55rem; align-items: stretch;
  margin-top: 0.55rem;
}
.category-filters[hidden] { display: none !important; }
.facet-filter {
  display: flex; gap: 0; align-items: stretch;
  background: var(--panel); border: 1px solid var(--line); border-radius: 0;
  flex-wrap: wrap;
}
.facet-label {
  display: flex; align-items: center;
  padding: 0.45rem 0.65rem; font-size: 0.68rem; font-weight: 700;
  color: var(--faint); letter-spacing: 0.04em; text-transform: uppercase;
  border-right: 1px solid var(--line); white-space: nowrap; user-select: none;
}
.facet-btn {
  padding: 0.45rem 0.65rem; border-radius: 0; font-size: 0.72rem;
  border: 0; border-right: 1px solid var(--line); background: transparent; color: var(--muted);
  cursor: pointer; transition: all 0.14s; white-space: nowrap; font-weight: 600;
  font-family: inherit;
}
.facet-btn:last-child { border-right: 0; }
.facet-btn:hover { color: var(--text); background: rgba(255,255,255,0.04); }
.facet-btn.active { color: var(--text); font-weight: 700; background: var(--panel2); box-shadow: inset 0 -2px 0 var(--accent); }

/* ─── 通路篩選 ─── */
.source-filter {
  display: flex; gap: 0; align-items: stretch;
  background: var(--panel); border: 1px solid var(--line); border-radius: 0;
}
.src-btn {
  padding: 0.5rem 0.7rem; border-radius: 0; font-size: 0.72rem;
  border: 0; border-right: 1px solid var(--line); background: transparent; color: var(--muted);
  cursor: pointer; transition: all 0.14s; white-space: nowrap; font-weight: 600;
  font-family: inherit; display: flex; align-items: center; gap: 0.32rem;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.src-btn:last-child { border-right: 0; }
.src-btn:hover { color: var(--text); background: rgba(255,255,255,0.04); }
.src-btn.active { color: var(--text); font-weight: 700; background: var(--panel2); }
.src-btn .src-dot { width: 6px; height: 6px; border-radius: 0; }
.src-btn[data-src="coolpc"] .src-dot { background: var(--coolpc); }
.src-btn[data-src="sinya"] .src-dot { background: var(--sinya); }
.src-btn[data-src="autobuy"] .src-dot { background: var(--autobuy); }
.src-btn.active[data-src="coolpc"] { box-shadow: inset 0 -2px 0 var(--coolpc); }
.src-btn.active[data-src="sinya"] { box-shadow: inset 0 -2px 0 var(--sinya); }
.src-btn.active[data-src="autobuy"] { box-shadow: inset 0 -2px 0 var(--autobuy); }

/* ─── Sidebar Category Tree ─── */
.sidebar-title {
  font-size: 0.62rem; font-weight: 700; color: var(--faint);
  padding: 0 0.4rem 0.7rem; margin-bottom: 0.55rem;
  border-bottom: 1px solid var(--line);
  letter-spacing: 0.18em; text-transform: uppercase;
}
.sidebar-title::before { content: '// '; color: var(--accent); }
.category-tree { display: flex; flex-direction: column; }
.tree-node, .tree-node-parent {
  padding: 0.5rem 0.5rem; border-radius: 0;
  font-size: 0.82rem; color: var(--muted); cursor: pointer;
  transition: background 0.13s, color 0.13s, box-shadow 0.13s;
  display: flex; align-items: center; gap: 0.4rem;
  user-select: none; position: relative;
}
.cat-icon { display: none; }
.tree-node::before, .tree-node-parent::before {
  content: '·'; color: var(--faint); width: 0.6rem; flex-shrink: 0; text-align: center;
}
.tree-node:hover, .tree-node-parent:hover { background: var(--panel2); color: var(--text); }
.tree-node:hover::before, .tree-node-parent:hover::before { color: var(--muted); }
.tree-node.active, .tree-node-parent.active {
  background: var(--accent-soft); color: var(--accent-tint); font-weight: 700;
  box-shadow: inset 2px 0 0 var(--accent);
}
.tree-node.active::before, .tree-node-parent.active::before { content: '▸'; color: var(--accent); }
.tree-branch { display: flex; flex-direction: column; }
.tree-node-parent.expanded .chevron { transform: rotate(90deg); }
.cat-label { flex: 1; min-width: 0; }
.cat-count {
  font-size: 0.64rem; color: var(--faint);
  background: rgba(255,255,255,0.05); padding: 0.04rem 0.35rem;
}
.tree-node.active .cat-count,
.tree-node-parent.active .cat-count { color: var(--accent-tint); background: rgba(53,201,224,0.16); }
.chevron { width: 11px; height: 11px; color: var(--faint); transition: transform 0.15s; flex-shrink: 0; }

.tree-node-children {
  display: flex; flex-direction: column;
  padding-left: 0.6rem; margin: 0.1rem 0 0.15rem 0.7rem;
  border-left: 1px solid var(--line);
}
.tree-branch-inner { display: flex; flex-direction: column; }
.tree-node-parent-inner {
  padding: 0.4rem 0.5rem; border-radius: 0;
  font-size: 0.76rem; color: var(--muted); cursor: pointer;
  transition: background 0.13s, color 0.13s;
  display: flex; align-items: center; justify-content: space-between; user-select: none;
}
.tree-node-parent-inner:hover { background: rgba(255,255,255,0.03); color: var(--text); }
.tree-node-parent-inner.expanded .chevron { transform: rotate(90deg); }
.tree-node-children-inner {
  display: flex; flex-direction: column;
  padding-left: 0.6rem; border-left: 1px dashed var(--line);
  margin: 0.1rem 0 0.15rem 0.45rem;
}
.tree-sub-node {
  padding: 0.4rem 0.5rem; border-radius: 0;
  font-size: 0.76rem; color: var(--muted); cursor: pointer;
  transition: background 0.13s, color 0.13s;
  display: flex; align-items: center; justify-content: space-between; user-select: none;
}
.tree-sub-node:hover { color: var(--text); background: rgba(255,255,255,0.03); }
.tree-sub-node.active { color: var(--green-tint); font-weight: 700; box-shadow: inset 2px 0 0 var(--green); background: var(--green-soft); }

/* ─── Results Header ─── */
.results-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.75rem; gap: 1rem; flex-wrap: wrap; }
.results-title { font-size: 0.92rem; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
.results-title::before { content: '> '; color: var(--accent); }
.results-title .title-icon { display: none; }
.results-count { font-size: 0.74rem; color: var(--muted); letter-spacing: 0.03em; }

/* ─── Product List：看盤表格 ─── */
#product-list { display: flex; flex-direction: column; border: 1px solid var(--line); background: var(--panel); }
.product-row-group {
  background: transparent;
  border: 0; border-bottom: 1px solid var(--line); border-radius: 0;
  padding: 0.7rem 1rem;
  display: flex; justify-content: space-between; align-items: center;
  gap: 1.25rem; position: relative;
  transition: background 0.12s, box-shadow 0.12s;
}
.product-row-group:last-child { border-bottom: 0; }
.product-row-group:hover { background: rgba(53,201,224,0.06); box-shadow: inset 2px 0 0 var(--accent); }
.product-info-col { flex: 1; min-width: 0; }
.product-name {
  font-size: 0.86rem; font-weight: 500; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.product-name a { color: var(--text); text-decoration: none; transition: color 0.13s; }
.product-name a:hover { color: var(--accent-tint); }
.product-tags { display: flex; gap: 0.3rem; margin-top: 0.4rem; flex-wrap: wrap; }
.tag {
  font-size: 0.62rem; padding: 0.1rem 0.4rem; border-radius: 0;
  border: 1px solid var(--line); color: var(--muted);
  background: transparent; display: inline-flex; align-items: center; gap: 0.2rem;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.tag-cat { border-color: var(--line-strong); color: #cfccc2; }
.tag-saving { border-color: var(--green); color: var(--green-tint); font-weight: 700; }
.tag-multi { border-color: var(--accent-line); color: var(--accent-tint); }

.product-prices-col { display: flex; gap: 0; flex-shrink: 0; border-left: 1px solid var(--line); }
.store-price-link {
  display: flex; flex-direction: column; align-items: flex-end; justify-content: center;
  padding: 0.35rem 0.75rem; border-radius: 0;
  border: 0; border-right: 1px solid var(--line);
  background: transparent; text-decoration: none; color: inherit; min-width: 108px;
  transition: background 0.13s; position: relative;
}
.store-price-link:last-child { border-right: 0; }
.store-price-link:hover { background: rgba(255,255,255,0.05); }
.store-price-link.is-lowest { background: var(--green-soft); box-shadow: inset 0 -2px 0 var(--green); }
.store-price-link.is-highest { background: var(--red-soft); box-shadow: inset 0 -2px 0 rgba(255,93,93,0.5); }
.store-name-mini { font-size: 0.56rem; color: var(--faint); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.18rem; }
.store-val { font-size: 0.98rem; font-weight: 700; letter-spacing: -0.01em; color: var(--muted); }
.store-price-link.is-lowest .store-val { color: var(--green-tint); }
.store-price-link.is-highest .store-val { color: var(--red-tint); }
.store-price-link.is-lowest .store-val::before { content: '▼ '; font-size: 0.62rem; vertical-align: 1px; }
.store-price-link.is-highest .store-val::before { content: '▲ '; font-size: 0.62rem; vertical-align: 1px; }
.store-price-link .lowest-badge { display: none; }
.store-price-empty {
  display: flex; align-items: center; justify-content: center;
  min-width: 108px; padding: 0.35rem 0;
  color: rgba(255,255,255,0.16); font-size: 0.85rem;
  border-right: 1px solid var(--line);
}

/* ─── Skeleton ─── */
#product-list:has(.skeleton-row) { border-color: transparent; background: transparent; }
.skeleton-row {
  height: 58px; border-radius: 0; margin-bottom: 1px;
  background: linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.055) 50%, rgba(255,255,255,0.02) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite;
  border: 1px solid var(--line);
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

/* ─── Empty / Error States ─── */
.empty-state { text-align: center; padding: 4.5rem 2rem; color: var(--muted); }
.empty-state .icon { font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.4; }
.empty-state p { font-size: 0.95rem; font-weight: 600; color: var(--text); text-transform: uppercase; letter-spacing: 0.05em; }
.empty-state small { font-size: 0.78rem; margin-top: 0.5rem; display: block; color: var(--muted); }

/* ─── Pagination ─── */
.pagination { display: flex; gap: 0; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap; border: 1px solid var(--line); width: fit-content; margin-left: auto; margin-right: auto; }
.page-btn {
  padding: 0.4rem 0.8rem; border-radius: 0;
  border: 0; border-right: 1px solid var(--line); background: var(--panel);
  color: var(--muted); font-size: 0.76rem; font-family: inherit; cursor: pointer; transition: all 0.14s;
}
.page-btn:last-child { border-right: 0; }
.page-btn:hover:not(:disabled) { color: var(--accent-tint); background: var(--panel2); }
.page-btn.active { background: var(--accent-soft); color: var(--accent-tint); font-weight: 700; }
.page-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ─── Toast ─── */
.toast {
  position: fixed; bottom: 1.25rem; right: 1.25rem; z-index: 999;
  background: var(--panel); border: 1px solid var(--accent-line); border-radius: 0;
  padding: 0.75rem 1.1rem;
  display: flex; align-items: center; gap: 0.7rem;
  box-shadow: 0 8px 30px rgba(0,0,0,0.6);
  transform: translateY(120%); opacity: 0;
  transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s;
  pointer-events: none; max-width: 320px;
}
.toast.show { transform: translateY(0); opacity: 1; pointer-events: auto; }
.toast-icon { font-size: 1rem; flex-shrink: 0; }
.toast-msg { font-size: 0.8rem; line-height: 1.45; }

@media (max-width: 820px) {
  .header-inner { flex-wrap: wrap; padding: 0.65rem 1rem; }
  .header-stats { display: none; }
  .main-container { flex-direction: column; padding: 1rem 1rem 3rem; }
  .sidebar { width: 100%; position: static; max-height: none; }
  .controls { flex-direction: column; align-items: stretch; }
  .product-row-group { flex-direction: column; align-items: stretch; gap: 0.7rem; }
  .product-prices-col { border-left: 0; border-top: 1px solid var(--line); }
  .store-price-link, .store-price-empty { flex: 1; min-width: 0; align-items: center; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
}
`;
