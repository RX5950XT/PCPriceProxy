/**
 * Dashboard 樣式（深色玻璃風）。獨立成模組以符合單檔 <800 行規範。
 */
export const DASHBOARD_STYLES = `
:root {
  --bg: #080c14;
  --surface: rgba(15, 23, 42, 0.8);
  --surface2: rgba(30, 41, 59, 0.6);
  --border: rgba(148, 163, 184, 0.12);
  --text: #f8fafc;
  --muted: #cbd5e1;
  --primary: #3b82f6;
  --primary-dim: rgba(59,130,246,0.18);
  --green: #10b981;
  --green-dim: rgba(16,185,129,0.15);
  --yellow: #f59e0b;
  --red: #ef4444;
  --coolpc: #f59e0b;
  --sinya: #ef4444;
  --autobuy: #10b981;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
  --radius: 0.875rem;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  background-image:
    radial-gradient(ellipse at 10% 0%, rgba(59,130,246,0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 90% 100%, rgba(16,185,129,0.08) 0%, transparent 50%);
  background-attachment: fixed;
  color: var(--text);
  font-family: 'Outfit', 'Noto Sans TC', sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* ─── Header ─── */
header {
  position: sticky; top: 0; z-index: 200;
  background: rgba(8,12,20,0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
}
.header-inner {
  max-width: 1440px; margin: 0 auto;
  padding: 0.875rem 2rem;
  display: flex; align-items: center; gap: 1.5rem;
}
.logo { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; flex-shrink: 0; }
.logo-mark {
  width: 2.25rem; height: 2.25rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--green) 100%);
  border-radius: 0.625rem;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 1rem; color: #fff;
  box-shadow: 0 0 20px rgba(59,130,246,0.4);
}
.logo-words h1 { font-size: 1.1rem; font-weight: 800; color: var(--text); letter-spacing: 0.3px; }
.logo-words p { font-size: 0.7rem; color: var(--muted); }

.header-stats { display: flex; gap: 2rem; margin-left: 2rem; }
.stat { display: flex; flex-direction: column; }
.stat-label { font-size: 0.65rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 0.9rem; font-weight: 700; color: var(--text); }
.source-dots { display: flex; gap: 0.75rem; align-items: center; }
.source-dot-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.7rem; color: var(--muted); }
.dot {
  width: 8px; height: 8px; border-radius: 50%;
  transition: transform 0.2s; background: rgba(255,255,255,0.2);
}
.dot.healthy { box-shadow: 0 0 6px currentColor; }
.dot-coolpc.healthy { background: var(--coolpc); color: var(--coolpc); }
.dot-sinya.healthy { background: var(--sinya); color: var(--sinya); }
.dot-autobuy.healthy { background: var(--autobuy); color: var(--autobuy); }

.header-right { margin-left: auto; display: flex; align-items: center; gap: 0.75rem; }

.btn-refresh {
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--primary-dim); border: 1px solid rgba(59,130,246,0.3);
  color: var(--primary); padding: 0.5rem 1rem;
  border-radius: 0.5rem; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
  white-space: nowrap;
}
.btn-refresh:hover:not(:disabled) {
  background: var(--primary); color: #fff;
  box-shadow: 0 0 16px rgba(59,130,246,0.4);
}
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-refresh svg { transition: transform 0.3s; flex-shrink: 0; }
.btn-refresh.spinning svg { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Main Layout ─── */
.main-container {
  max-width: 1440px; margin: 0 auto; padding: 1.5rem 2rem 4rem;
  display: flex; gap: 2rem;
}
.sidebar {
  width: 268px; flex-shrink: 0;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.25rem 1rem;
  align-self: start;
  position: sticky; top: 85px;
  max-height: calc(100vh - 120px); overflow-y: auto;
}
.main-content { flex: 1; min-width: 0; }

/* ─── Controls Bar ─── */
.controls {
  display: flex; gap: 1rem; align-items: center;
  margin-bottom: 1.25rem; flex-wrap: wrap;
}
.search-wrap { position: relative; flex: 1; min-width: 220px; }
.search-icon {
  position: absolute; left: 0.875rem; top: 50%; transform: translateY(-50%);
  color: var(--muted); pointer-events: none;
}
.search-input {
  width: 100%; background: var(--surface);
  border: 1px solid var(--border); border-radius: 0.625rem;
  padding: 0.625rem 1rem 0.625rem 2.5rem;
  color: var(--text); font-size: 0.925rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-input::placeholder { color: var(--muted); }
.search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }

.sort-select {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 0.625rem; color: var(--text); padding: 0.625rem 0.875rem;
  font-size: 0.85rem; cursor: pointer; min-width: 130px;
}
.sort-select:focus { outline: none; border-color: var(--primary); }

/* ─── 跨店比價 Toggle ─── */
.multi-toggle {
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 0.625rem; padding: 0.5rem 0.875rem;
  font-size: 0.82rem; color: var(--muted); cursor: pointer;
  user-select: none; transition: all 0.2s; white-space: nowrap;
}
.multi-toggle:hover { border-color: rgba(59,130,246,0.4); color: var(--text); }
.multi-toggle.active { background: var(--green-dim); border-color: rgba(16,185,129,0.4); color: #34d399; font-weight: 600; }
.switch-track {
  width: 32px; height: 18px; border-radius: 999px;
  background: rgba(255,255,255,0.15); position: relative; transition: background 0.2s; flex-shrink: 0;
}
.multi-toggle.active .switch-track { background: var(--green); }
.switch-thumb {
  position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
  border-radius: 50%; background: #fff; transition: transform 0.2s;
}
.multi-toggle.active .switch-thumb { transform: translateX(14px); }

/* ─── 通路篩選（選看單一通路） ─── */
.source-filter {
  display: flex; gap: 0.3rem; align-items: center;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 0.625rem; padding: 0.25rem;
}
.src-btn {
  padding: 0.4rem 0.7rem; border-radius: 0.45rem; font-size: 0.8rem;
  border: 1px solid transparent; background: transparent; color: var(--muted);
  cursor: pointer; transition: all 0.18s; white-space: nowrap; font-weight: 500;
  display: flex; align-items: center; gap: 0.3rem;
}
.src-btn:hover { color: var(--text); background: rgba(255,255,255,0.03); }
.src-btn.active { color: var(--text); font-weight: 700; background: var(--surface2); }
.src-btn .src-dot { width: 7px; height: 7px; border-radius: 50%; }
.src-btn[data-src="coolpc"] .src-dot { background: var(--coolpc); }
.src-btn[data-src="sinya"] .src-dot { background: var(--sinya); }
.src-btn[data-src="autobuy"] .src-dot { background: var(--autobuy); }
.src-btn.active[data-src="coolpc"] { box-shadow: inset 0 -2px 0 var(--coolpc); }
.src-btn.active[data-src="sinya"] { box-shadow: inset 0 -2px 0 var(--sinya); }
.src-btn.active[data-src="autobuy"] { box-shadow: inset 0 -2px 0 var(--autobuy); }

/* ─── Sidebar Category Tree ─── */
.sidebar-title {
  font-size: 0.9rem; font-weight: 700; color: var(--text);
  padding-bottom: 0.625rem; margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
  letter-spacing: 0.5px; text-transform: uppercase;
}
.category-tree { display: flex; flex-direction: column; gap: 0.25rem; }
.tree-node {
  padding: 0.625rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.875rem; color: var(--muted); cursor: pointer;
  transition: all 0.2s; display: flex; align-items: center; justify-content: space-between;
  user-select: none; border: 1px solid transparent;
}
.tree-node:hover { background: var(--surface2); color: var(--text); }
.tree-node.active {
  background: var(--primary-dim); border-color: rgba(59,130,246,0.3);
  color: #93c5fd; font-weight: 600;
}

.tree-branch { display: flex; flex-direction: column; }
.tree-node-parent {
  padding: 0.625rem 0.875rem; border-radius: 0.5rem;
  font-size: 0.875rem; color: var(--muted); cursor: pointer;
  transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem;
  user-select: none; border: 1px solid transparent;
}
.tree-node-parent:hover { background: var(--surface2); color: var(--text); }
.tree-node-parent.active {
  background: var(--primary-dim); border-color: rgba(59,130,246,0.3);
  color: #93c5fd; font-weight: 600;
}
.tree-node-parent.expanded .chevron { transform: rotate(90deg); }
.cat-icon { font-size: 1rem; flex-shrink: 0; width: 1.25rem; text-align: center; }
.cat-label { flex: 1; min-width: 0; }
.cat-count {
  font-size: 0.7rem; color: var(--muted); opacity: 0.7;
  background: rgba(255,255,255,0.05); padding: 0.05rem 0.4rem; border-radius: 0.75rem;
}
.tree-node-parent.active .cat-count { color: #93c5fd; opacity: 0.9; }
.chevron { width: 12px; height: 12px; color: var(--muted); transition: transform 0.2s; flex-shrink: 0; }

.tree-node-children {
  display: flex; flex-direction: column; gap: 0.15rem;
  padding-left: 0.875rem; margin-top: 0.15rem; border-left: 1px solid var(--border);
  margin-left: 0.75rem;
}
.tree-branch-inner { display: flex; flex-direction: column; }
.tree-node-parent-inner {
  padding: 0.45rem 0.75rem; border-radius: 0.375rem;
  font-size: 0.8rem; color: var(--muted); cursor: pointer;
  transition: all 0.2s; display: flex; align-items: center; justify-content: space-between;
  user-select: none;
}
.tree-node-parent-inner:hover { background: rgba(255,255,255,0.02); color: var(--text); }
.tree-node-parent-inner.expanded .chevron { transform: rotate(90deg); }
.tree-node-children-inner {
  display: flex; flex-direction: column; gap: 0.15rem;
  padding-left: 0.75rem; border-left: 1px dashed var(--border);
  margin-left: 0.5rem; margin-top: 0.15rem;
}
.tree-sub-node {
  padding: 0.45rem 0.75rem; border-radius: 0.375rem;
  font-size: 0.8rem; color: var(--muted); cursor: pointer;
  transition: all 0.18s; display: flex; align-items: center; justify-content: space-between;
  user-select: none;
}
.tree-sub-node:hover { color: var(--text); background: rgba(255,255,255,0.02); }
.tree-sub-node.active { color: #34d399; font-weight: 600; background: rgba(16,185,129,0.08); }

/* ─── Results Header ─── */
.results-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap;
}
.results-title { font-size: 1rem; font-weight: 700; }
.results-title .title-icon { margin-right: 0.4rem; }
.results-count { font-size: 0.8rem; color: var(--muted); }

/* ─── Product Row Group (比價卡片) ─── */
#product-list { display: flex; flex-direction: column; gap: 0.75rem; }

.product-row-group {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  display: flex; justify-content: space-between; align-items: center;
  gap: 1.5rem;
  transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
}
.product-row-group:hover {
  border-color: rgba(59, 130, 246, 0.25);
  transform: translateX(2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.product-info-col { flex: 1; min-width: 0; }
.product-name {
  font-size: 0.95rem; font-weight: 600; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.product-name a { color: #f8fafc; text-decoration: none; transition: color 0.18s; }
.product-name a:hover { color: #60a5fa; text-decoration: underline; }
.product-tags { display: flex; gap: 0.375rem; margin-top: 0.4rem; flex-wrap: wrap; }
.tag {
  font-size: 0.65rem; padding: 0.125rem 0.45rem; border-radius: 0.25rem;
  border: 1px solid var(--border); color: var(--muted);
  background: rgba(255,255,255,0.03); display: inline-flex; align-items: center; gap: 0.2rem;
}
.tag-cat { border-color: rgba(59,130,246,0.3); color: #93c5fd; background: var(--primary-dim); }
.tag-saving {
  border-color: rgba(16,185,129,0.35); color: #34d399;
  background: var(--green-dim); font-weight: 700;
}
.tag-multi { border-color: rgba(245,158,11,0.35); color: var(--yellow); background: rgba(245,158,11,0.1); }

.product-prices-col { display: flex; gap: 0.75rem; flex-shrink: 0; }
.store-price-link {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 0.5rem 0.875rem; border-radius: 0.5rem;
  border: 1px solid var(--border); background: rgba(0,0,0,0.2);
  text-decoration: none; color: inherit; min-width: 110px;
  transition: all 0.18s; position: relative;
}
.store-price-link:hover { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.25); }
.store-price-link.is-lowest { border-color: var(--green); background: var(--green-dim); }
.store-price-link.store-coolpc { border-left: 3px solid var(--coolpc); }
.store-price-link.store-sinya { border-left: 3px solid var(--sinya); }
.store-price-link.store-autobuy { border-left: 3px solid var(--autobuy); }
.store-name-mini { font-size: 0.65rem; color: var(--muted); margin-bottom: 0.15rem; }
.store-val { font-size: 0.95rem; font-weight: 800; }
.store-price-link.is-lowest .store-val { color: var(--green); }
.store-price-link .lowest-badge {
  position: absolute; right: 4px; top: -6px;
  background: var(--green); color: #042f1a;
  font-size: 0.55rem; font-weight: 800; padding: 1px 4px; border-radius: 0.25rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.store-price-empty {
  display: flex; align-items: center; justify-content: center;
  width: 110px; padding: 0.5rem 0;
  color: rgba(255,255,255,0.12); font-size: 0.9rem;
  border: 1px dashed var(--border); border-radius: 0.5rem; background: rgba(255,255,255,0.01);
}

/* ─── Skeleton ─── */
.skeleton-row {
  height: 72px; border-radius: var(--radius);
  background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%);
  background-size: 200% 100%; animation: shimmer 1.5s infinite;
  border: 1px solid var(--border);
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

/* ─── Empty / Error States ─── */
.empty-state { text-align: center; padding: 5rem 2rem; color: var(--muted); }
.empty-state .icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }
.empty-state p { font-size: 1rem; }
.empty-state small { font-size: 0.8rem; margin-top: 0.5rem; display: block; }

/* ─── Pagination ─── */
.pagination { display: flex; gap: 0.5rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap; }
.page-btn {
  padding: 0.4rem 0.875rem; border-radius: 0.5rem;
  border: 1px solid var(--border); background: var(--surface);
  color: var(--muted); font-size: 0.8rem; cursor: pointer; transition: all 0.18s;
}
.page-btn:hover { border-color: var(--primary); color: var(--primary); }
.page-btn.active { background: var(--primary-dim); border-color: rgba(59,130,246,0.5); color: #93c5fd; font-weight: 700; }
.page-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ─── Brand Section ─── */
.brand-wrap {
  margin-bottom: 1.5rem; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 0.875rem 1.25rem;
}
.brand-title { font-size: 0.8rem; font-weight: 700; color: var(--muted); margin-bottom: 0.5rem; }
.sub-chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.brand-chip {
  padding: 0.25rem 0.75rem; border-radius: 1.5rem;
  border: 1px solid var(--border); background: transparent;
  color: var(--muted); font-size: 0.75rem; font-weight: 500;
  cursor: pointer; transition: all 0.18s; user-select: none;
}
.brand-chip:hover { border-color: rgba(59,130,246,0.4); color: var(--text); }
.brand-chip.active {
  background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd; font-weight: 600;
}

/* ─── Toast ─── */
.toast {
  position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 999;
  background: rgba(15,23,42,0.95); border: 1px solid var(--border);
  border-radius: 0.625rem; padding: 0.875rem 1.25rem;
  display: flex; align-items: center; gap: 0.75rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  transform: translateY(120%); opacity: 0;
  transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s;
  pointer-events: none; max-width: 320px;
}
.toast.show { transform: translateY(0); opacity: 1; pointer-events: auto; }
.toast-icon { font-size: 1.1rem; flex-shrink: 0; }
.toast-msg { font-size: 0.85rem; line-height: 1.4; }

@media (max-width: 768px) {
  .header-inner { flex-wrap: wrap; }
  .header-stats { display: none; }
  .controls { flex-direction: column; align-items: stretch; }
  .product-row-group { flex-direction: column; align-items: stretch; gap: 1rem; }
  .product-prices-col { justify-content: space-between; gap: 0.5rem; }
  .store-price-link, .store-price-empty { flex: 1; min-width: 80px; }
}
`;
