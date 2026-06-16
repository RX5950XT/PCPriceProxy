export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PCPriceProxy - 電腦零組件即時比價</title>
  <meta name="description" content="即時彙整原價屋、欣亞、Autobuy 三大通路電腦零件報價，跨店整合比對與分類排序。">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Noto+Sans+TC:wght@300;400;700&display=swap" rel="stylesheet">

  <style>
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
    .source-dots { display: flex; gap: 0.5rem; align-items: center; }
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      transition: transform 0.2s;
    }
    .dot.healthy { box-shadow: 0 0 6px currentColor; }
    .dot-coolpc { background: var(--coolpc); color: var(--coolpc); }
    .dot-sinya { background: var(--sinya); color: var(--sinya); }
    .dot-autobuy { background: var(--autobuy); color: var(--autobuy); }

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
      width: 260px; flex-shrink: 0;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 1.25rem 1rem;
      align-self: start;
      position: sticky; top: 85px;
      max-height: calc(100vh - 120px); overflow-y: auto;
    }
    .main-content {
      flex: 1; min-width: 0;
    }

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

    /* ─── Sidebar Category Tree ─── */
    .sidebar-title {
      font-size: 0.9rem; font-weight: 700; color: var(--text);
      padding-bottom: 0.625rem; margin-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
      letter-spacing: 0.5px; text-transform: uppercase;
    }
    .category-tree {
      display: flex; flex-direction: column; gap: 0.25rem;
    }
    .tree-node {
      padding: 0.625rem 0.875rem; border-radius: 0.5rem;
      font-size: 0.875rem; color: var(--muted); cursor: pointer;
      transition: all 0.2s; display: flex; align-items: center; justify-content: space-between;
      user-select: none; border: 1px solid transparent;
    }
    .tree-node:hover {
      background: var(--surface2); color: var(--text);
    }
    .tree-node.active {
      background: var(--primary-dim); border-color: rgba(59,130,246,0.3);
      color: #93c5fd; font-weight: 600;
    }
    
    .tree-branch {
      display: flex; flex-direction: column;
    }
    .tree-node-parent {
      padding: 0.625rem 0.875rem; border-radius: 0.5rem;
      font-size: 0.875rem; color: var(--muted); cursor: pointer;
      transition: all 0.2s; display: flex; align-items: center; justify-content: space-between;
      user-select: none; border: 1px solid transparent;
    }
    .tree-node-parent:hover {
      background: var(--surface2); color: var(--text);
    }
    .tree-node-parent.active {
      background: var(--primary-dim); border-color: rgba(59,130,246,0.3);
      color: #93c5fd; font-weight: 600;
    }
    .tree-node-parent.expanded .chevron {
      transform: rotate(90deg);
    }
    .chevron {
      width: 12px; height: 12px; color: var(--muted);
      transition: transform 0.2s;
    }
    
    .tree-node-children {
      display: flex; flex-direction: column; gap: 0.15rem;
      padding-left: 0.875rem; margin-top: 0.15rem; border-left: 1px solid var(--border);
      margin-left: 0.75rem;
    }
    .tree-branch-inner {
      display: flex; flex-direction: column;
    }
    .tree-node-parent-inner {
      padding: 0.45rem 0.75rem; border-radius: 0.375rem;
      font-size: 0.8rem; color: var(--muted); cursor: pointer;
      transition: all 0.2s; display: flex; align-items: center; justify-content: space-between;
      user-select: none;
    }
    .tree-node-parent-inner:hover {
      background: rgba(255,255,255,0.02); color: var(--text);
    }
    .tree-node-parent-inner.expanded .chevron {
      transform: rotate(90deg);
    }
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
    .tree-sub-node:hover {
      color: var(--text);
      background: rgba(255,255,255,0.02);
    }
    .tree-sub-node.active {
      color: #34d399; font-weight: 600;
      background: rgba(16,185,129,0.08);
    }

    /* ─── Results Header ─── */
    .results-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem;
    }
    .results-title { font-size: 1rem; font-weight: 700; }
    .results-count { font-size: 0.8rem; color: var(--muted); }

    /* ─── Mode Tabs ─── */
    .mode-tabs { display: flex; gap: 0.25rem; }
    .mode-tab {
      padding: 0.3rem 0.75rem; border-radius: 0.375rem; font-size: 0.8rem;
      border: 1px solid transparent; cursor: pointer; transition: all 0.18s; font-weight: 500;
      background: transparent; color: var(--muted);
    }
    .mode-tab.active { background: var(--primary-dim); border-color: rgba(59,130,246,0.4); color: #93c5fd; }

    /* ─── Product Row Group (比價卡片) ─── */
    #product-list { display: flex; flex-direction: column; gap: 0.75rem; }

    .product-row-group {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
      transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
    }
    .product-row-group:hover {
      border-color: rgba(59, 130, 246, 0.25);
      transform: translateX(2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .product-info-col {
      flex: 1;
      min-width: 0;
    }
    .product-name {
      font-size: 0.95rem; font-weight: 600; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .product-name a {
      color: #f8fafc;
      text-decoration: none;
      transition: color 0.18s;
    }
    .product-name a:hover {
      color: #60a5fa;
      text-decoration: underline;
    }
    .product-tags { display: flex; gap: 0.375rem; margin-top: 0.4rem; flex-wrap: wrap; }
    .tag {
      font-size: 0.65rem; padding: 0.125rem 0.375rem; border-radius: 0.25rem;
      border: 1px solid var(--border); color: var(--muted);
      background: rgba(255,255,255,0.03);
    }
    .tag-saving {
      border-color: rgba(16,185,129,0.35);
      color: #34d399;
      background: var(--green-dim);
      font-weight: 700;
    }

    .product-prices-col {
      display: flex;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .store-price-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 0.875rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: rgba(0,0,0,0.2);
      text-decoration: none;
      color: inherit;
      min-width: 110px;
      transition: all 0.18s;
      position: relative;
    }
    .store-price-link:hover {
      background: rgba(255,255,255,0.03);
      border-color: rgba(255,255,255,0.25);
    }
    .store-price-link.is-lowest {
      border-color: var(--green);
      background: var(--green-dim);
    }
    .store-price-link.store-coolpc { border-left: 3px solid var(--coolpc); }
    .store-price-link.store-sinya { border-left: 3px solid var(--sinya); }
    .store-price-link.store-autobuy { border-left: 3px solid var(--autobuy); }
    
    .store-name-mini {
      font-size: 0.65rem;
      color: var(--muted);
      margin-bottom: 0.15rem;
    }
    .store-val {
      font-size: 0.95rem;
      font-weight: 800;
    }
    .store-price-link.is-lowest .store-val {
      color: var(--green);
    }
    .store-price-link .lowest-badge {
      position: absolute;
      right: 4px;
      top: -6px;
      background: var(--green);
      color: #042f1a;
      font-size: 0.55rem;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 0.25rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .store-price-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 110px;
      padding: 0.5rem 0;
      color: rgba(255,255,255,0.12);
      font-size: 0.9rem;
      border: 1px dashed var(--border);
      border-radius: 0.5rem;
      background: rgba(255,255,255,0.01);
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
    .empty-state {
      text-align: center; padding: 5rem 2rem; color: var(--muted);
    }
    .empty-state .icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }
    .empty-state p { font-size: 1rem; }
    .empty-state small { font-size: 0.8rem; margin-top: 0.5rem; display: block; }

    /* ─── Pagination ─── */
    .pagination {
      display: flex; gap: 0.5rem; justify-content: center;
      margin-top: 2rem; flex-wrap: wrap;
    }
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
    .brand-title {
      font-size: 0.8rem; font-weight: 700; color: var(--muted); margin-bottom: 0.5rem;
    }
    .sub-chips {
      display: flex; gap: 0.4rem; flex-wrap: wrap;
    }
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
      .controls { flex-direction: column; }
      .product-row-group { flex-direction: column; align-items: stretch; gap: 1rem; }
      .product-prices-col { justify-content: space-between; gap: 0.5rem; }
      .store-price-link, .store-price-empty { flex: 1; min-width: 80px; }
    }
  </style>
</head>
<body>

<header>
  <div class="header-inner">
    <a class="logo" href="/">
      <div class="logo-mark">$</div>
      <div class="logo-words">
        <h1>PCPriceProxy</h1>
        <p>電腦零件三通路即時比價</p>
      </div>
    </a>

    <div class="header-stats" id="header-stats">
      <div class="stat">
        <span class="stat-label">商品總量</span>
        <span class="stat-value" id="stat-total">—</span>
      </div>
      <div class="stat">
        <span class="stat-label">通路狀態</span>
        <div class="source-dots" id="source-dots">
          <span class="dot dot-coolpc" title="原價屋"></span>
          <span class="dot dot-sinya" title="欣亞"></span>
          <span class="dot dot-autobuy" title="Autobuy"></span>
        </div>
      </div>
      <div class="stat">
        <span class="stat-label">最後更新</span>
        <span class="stat-value" id="stat-updated">—</span>
      </div>
    </div>

    <div class="header-right">
      <button class="btn-refresh" id="btn-refresh" onclick="triggerRefresh()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
          <path d="M8 16H3v5"/>
        </svg>
        重新整理
      </button>
    </div>
  </div>
</header>

<main class="main-container">
  <!-- 左側分類導航欄 -->
  <aside class="sidebar">
    <div class="sidebar-title">商品分類</div>
    <nav class="category-tree" id="category-tree">
      <div class="tree-node active" id="node-all" data-cat="">全部商品</div>
      
      <div class="tree-branch" data-cat="cpu">
        <div class="tree-node-parent" data-cat="cpu">
          <span>CPU 處理器</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>
      
      <div class="tree-branch" data-cat="motherboard">
        <div class="tree-node-parent" data-cat="motherboard">
          <span>主機板</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>
      
      <div class="tree-branch" data-cat="gpu">
        <div class="tree-node-parent" data-cat="gpu">
          <span>顯示卡</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="ram">
        <div class="tree-node-parent" data-cat="ram">
          <span>記憶體</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="ssd">
        <div class="tree-node-parent" data-cat="ssd">
          <span>固態硬碟</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="hdd">
        <div class="tree-node-parent" data-cat="hdd">
          <span>傳統硬碟</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="psu">
        <div class="tree-node-parent" data-cat="psu">
          <span>電源供應器</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="case">
        <div class="tree-node-parent" data-cat="case">
          <span>機殼</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="cooler">
        <div class="tree-node-parent" data-cat="cooler">
          <span>散熱器</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="monitor">
        <div class="tree-node-parent" data-cat="monitor">
          <span>螢幕</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="package">
        <div class="tree-node-parent" data-cat="package">
          <span>🎁 組合搭配</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="fan">
        <div class="tree-node-parent" data-cat="fan">
          <span>系統風扇</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="keyboard">
        <div class="tree-node-parent" data-cat="keyboard">
          <span>鍵盤</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="mouse">
        <div class="tree-node-parent" data-cat="mouse">
          <span>滑鼠</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="headset">
        <div class="tree-node-parent" data-cat="headset">
          <span>耳機 / 麥克風</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="speaker">
        <div class="tree-node-parent" data-cat="speaker">
          <span>音響 / 喇叭</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="network">
        <div class="tree-node-parent" data-cat="network">
          <span>網通設備</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="os">
        <div class="tree-node-parent" data-cat="os">
          <span>作業系統</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="software">
        <div class="tree-node-parent" data-cat="software">
          <span>應用軟體</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>

      <div class="tree-branch" data-cat="optical_drive">
        <div class="tree-node-parent" data-cat="optical_drive">
          <span>光碟機</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="tree-node-children" style="display:none;"></div>
      </div>
    </nav>
  </aside>

  <!-- 右側商品展示區 -->
  <section class="main-content">
    <!-- Controls -->
    <div class="controls">
      <div class="search-wrap">
        <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" id="search-input" class="search-input"
          placeholder="搜尋零件（例如：9800X3D、RTX 5070、DDR5 32G）"
          oninput="onSearchInput()">
      </div>
      <select class="sort-select" id="sort-select" onchange="onSortChange()">
        <option value="updated">最新更新</option>
        <option value="price_asc">價格低→高</option>
        <option value="price_desc">價格高→低</option>
        <option value="name">名稱排序</option>
      </select>
    </div>

    <!-- Brand Chips -->
    <div class="brand-wrap" id="brand-wrap" style="display:none;">
      <div class="brand-title">品牌篩選</div>
      <div class="sub-chips" id="brand-chips"></div>
    </div>

    <!-- Results Header -->
    <div class="results-header">
      <div>
        <span class="results-title" id="results-title">商品列表</span>
        <span class="results-count" id="results-count"></span>
      </div>
    </div>

    <!-- Product List -->
    <div id="product-list">
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    </div>

    <!-- Pagination -->
    <div class="pagination" id="pagination"></div>
  </section>

<div class="toast" id="toast">
  <span class="toast-icon" id="toast-icon">ℹ️</span>
  <span class="toast-msg" id="toast-msg"></span>
</div>

<script>
  // ── State ──
  let category = '';
  let subcategory = '';
  let brand = '';
  let query = '';
  let sort = 'updated';
  let page = 1;
  const PER_PAGE = 50;
  let searchTimer = null;
  let refreshPollTimer = null;
  let totalProducts = 0;

  // ── Source name map ──
  const SOURCE_NAMES = { coolpc: '原價屋', sinya: '欣亞', autobuy: 'Autobuy' };

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    fetchStatus();
    fetchProducts();

    // 全部商品點擊
    document.getElementById('node-all').addEventListener('click', () => {
      resetTreeActive();
      document.getElementById('node-all').classList.add('active');
      category = '';
      subcategory = '';
      brand = '';
      page = 1;
      sort = 'updated';
      document.getElementById('sort-select').value = 'updated';
      
      collapseAllBranches();
      loadBrands();
      fetchProducts();
    });
    
    // 主分類 parent 點擊
    document.querySelectorAll('.tree-node-parent').forEach(p => {
      p.addEventListener('click', () => {
        const catVal = p.dataset.cat;
        
        resetTreeActive();
        p.classList.add('active');
        
        category = catVal;
        subcategory = '';
        brand = '';
        page = 1;
        sort = 'updated';
        document.getElementById('sort-select').value = 'updated';
        
        fetchProducts();
        
        const branch = p.closest('.tree-branch');
        const childrenEl = branch.querySelector('.tree-node-children');
        
        if (p.classList.contains('expanded')) {
          p.classList.remove('expanded');
          childrenEl.style.display = 'none';
        } else {
          collapseAllBranches();
          p.classList.add('expanded');
          childrenEl.style.display = 'flex';
          loadSubcategoriesTree(branch, childrenEl);
        }
        loadBrands();
      });
    });
  });

  function resetTreeActive() {
    document.getElementById('node-all').classList.remove('active');
    document.querySelectorAll('.tree-node-parent').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tree-sub-node').forEach(x => x.classList.remove('active'));
  }
  
  function collapseAllBranches() {
    document.querySelectorAll('.tree-node-parent').forEach(x => {
      x.classList.remove('expanded');
      const branch = x.closest('.tree-branch');
      if (branch) {
        branch.querySelector('.tree-node-children').style.display = 'none';
      }
    });
  }

  // ── compareNodes ──
  function compareNodes(cat, a, b) {
    const ua = a.toUpperCase();
    const ub = b.toUpperCase();

    // 1. 記憶體世代排序優先
    if (ua.includes('DDR5') && !ub.includes('DDR5')) return -1;
    if (!ua.includes('DDR5') && ub.includes('DDR5')) return 1;
    if (ua.includes('DDR4') && !ub.includes('DDR4')) return -1;
    if (!ua.includes('DDR4') && ub.includes('DDR4')) return 1;
    if (ua.includes('D5') && !ub.includes('D5')) return -1;
    if (!ua.includes('D5') && ub.includes('D5')) return 1;
    if (ua.includes('D4') && !ub.includes('D4')) return -1;
    if (!ua.includes('D4') && ub.includes('D4')) return 1;

    // 2. PCIe 世代排序
    if (ua.includes('PCIE 5.0') || ua.includes('GEN5')) return -1;
    if (ub.includes('PCIE 5.0') || ub.includes('GEN5')) return 1;
    if (ua.includes('PCIE 4.0') || ua.includes('GEN4')) return -1;
    if (ub.includes('PCIE 4.0') || ub.includes('GEN4')) return 1;

    // 3. 預定義之常見規格層級排序表
    const orderList = [
      // 品牌
      'INTEL', 'AMD',
      // CPU 腳位
      'LGA1851', 'LGA1700', 'LGA1200', 'AM5', 'AM4',
      // CPU 系列
      'CORE I9', 'ULTRA 9', 'CORE I7', 'ULTRA 7', 'CORE I5', 'ULTRA 5', 'CORE I3',
      'RYZEN 9', 'RYZEN 7', 'RYZEN 5', 'RYZEN 3',
      // GPU 系列
      'NVIDIA RTX 50系列', 'RTX 50 系列', 'NVIDIA RTX 40系列', 'RTX 40 系列', 'NVIDIA RTX 30系列', 'RTX 30 系列', 
      'AMD RX 9000系列', 'RX 9000 系列', 'AMD RX 8000系列', 'RX 8000 系列', 'AMD RX 7000系列', 'RX 7000 系列',
      'NVIDIA 專業繪圖卡', 'AMD 專業繪圖卡',
      // 主機板晶片組
      'Z890', 'Z790', 'B760', 'H610', 'B660', 'X870E', 'X870', 'X670E', 'X670', 'B650E', 'B650', 'A620', 'B550', 'A520',
      // 主機板尺寸
      'E-ATX', 'ATX', 'MICRO-ATX', 'MINI-ITX',
      // 裝置類型
      '桌上型 UDIMM', '桌上型', '筆電用 SO-DIMM', '筆電用',
      // SSD / HDD 類型
      'M.2 NVME SSD', 'SATA 2.5吋', '行動外接式', 'NAS 專用碟', '企業級硬碟', '一般監控/桌上型',
      // 散熱器類型
      '一體式水冷 (AIO)', '雙塔空冷', '單塔空冷', '下吹式空冷', '散熱膏/配件',
    ];

    let idxA = -1;
    let idxB = -1;
    for (let i = 0; i < orderList.length; i++) {
      const item = orderList[i].toUpperCase();
      if (idxA === -1 && (ua === item || ua.includes(item))) idxA = i;
      if (idxB === -1 && (ub === item || ub.includes(item))) idxB = i;
    }

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    // 4. 解析容量大小進行排序 (如 64G, 32G, 16G, 8G, 4TB, 2TB, 1TB, 500GB)
    const getCapacityVal = (str) => {
      const m = str.match(/^(\d+)\s*(GB|TB|G|T|MB)/i);
      if (!m) return 0;
      const num = parseFloat(m[1]);
      const unit = m[2].toUpperCase();
      if (unit.startsWith('T')) return num * 1024 * 1024;
      if (unit.startsWith('G')) return num * 1024;
      if (unit.startsWith('M')) return num;
      return num;
    };
    const capA = getCapacityVal(a);
    const capB = getCapacityVal(b);
    if (capA > 0 || capB > 0) return capB - capA;

    // 5. 解析頻率或數字 (如 6000MHz, 3200MHz, 7200轉)
    const getNumVal = (str) => {
      const m = str.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const numA = getNumVal(a);
    const numB = getNumVal(b);
    if (numA > 0 || numB > 0) return numB - numA;

    return a.localeCompare(b, 'zh-TW');
  }

  // ── Load Subcategories ──
  async function loadSubcategoriesTree(branch, container) {
    container.innerHTML = '<div style="font-size:0.75rem;color:var(--muted);padding:0.45rem 0.75rem;">載入中...</div>';
    try {
      const response = await fetch('/api/v1/categories/' + category + '/subcategories');
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        
        // 1. 組建嵌套樹
        const tree = {};

        data.data.forEach(item => {
          const parts = item.subcategory.split(' > ');
          if (parts.length > 1) {
            let current = tree;
            parts.forEach((part, index) => {
              if (!current[part]) {
                current[part] = {
                  name: part,
                  children: {},
                  count: 0,
                  fullPath: parts.slice(0, index + 1).join(' > ')
                };
              }
              if (index === parts.length - 1) {
                current[part].count = item.count;
              }
              current = current[part].children;
            });
          } else {
            tree[item.subcategory] = {
              name: item.subcategory,
              children: null,
              count: item.count,
              fullPath: item.subcategory
            };
          }
        });

        // 2. 遞迴渲染 HTML
        function renderTreeHtml(nodes, isRoot = true) {
          let html = '';
          if (isRoot) {
            html += '<div class="tree-sub-node active" data-sub="">全部子分類</div>';
          }
          
          // 針對 nodes 進行自定義語義排序
          const sortedNodes = Object.values(nodes).sort((a, b) => compareNodes(category, a.name, b.name));

          sortedNodes.forEach(node => {
            const hasChildren = node.children && Object.keys(node.children).length > 0;
            if (hasChildren) {
              html += '<div class="tree-branch-inner">' +
                      '  <div class="tree-node-parent-inner">' +
                      '    <span>' + escHtml(node.name) + '</span>' +
                      '    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
                      '  </div>' +
                      '  <div class="tree-node-children-inner" style="display:none;">' +
                      renderTreeHtml(node.children, false) +
                      '  </div>' +
                      '</div>';
            } else {
              html += '<div class="tree-sub-node" data-sub="' + escHtml(node.fullPath) + '">' +
                      '  <span>' + escHtml(node.name) + '</span>' +
                      '  <span style="font-size:0.7rem;opacity:0.6;">(' + node.count + ')</span>' +
                      '</div>';
            }
          });
          return html;
        }

        container.innerHTML = renderTreeHtml(tree);

        // 3. 綁定多級展開/收合事件與選取事件
        container.querySelectorAll('.tree-node-parent-inner').forEach(parentInner => {
          parentInner.addEventListener('click', (e) => {
            e.stopPropagation();
            const branchInner = parentInner.closest('.tree-branch-inner');
            const childrenInner = branchInner.querySelector('.tree-node-children-inner');
            
            if (parentInner.classList.contains('expanded')) {
              parentInner.classList.remove('expanded');
              childrenInner.style.display = 'none';
            } else {
              parentInner.classList.add('expanded');
              childrenInner.style.display = 'flex';
            }
          });
        });

        container.querySelectorAll('.tree-sub-node').forEach(sn => {
          sn.addEventListener('click', (e) => {
            e.stopPropagation();
            container.querySelectorAll('.tree-sub-node').forEach(x => x.classList.remove('active'));
            sn.classList.add('active');
            
            subcategory = sn.dataset.sub;
            page = 1;
            
            if (subcategory || brand) {
              sort = 'price_asc';
              document.getElementById('sort-select').value = 'price_asc';
            } else {
              sort = 'updated';
              document.getElementById('sort-select').value = 'updated';
            }
            
            fetchProducts();
            loadBrands();
          });
        });

      } else {
        container.innerHTML = '<div style="font-size:0.75rem;color:var(--muted);padding:0.45rem 0.75rem;">無子分類</div>';
      }
    } catch (e) {
      container.innerHTML = '<div style="font-size:0.75rem;color:var(--red);padding:0.45rem 0.75rem;">載入失敗</div>';
    }
  }

  // ── Load Brands ──
  async function loadBrands() {
    const brandWrap = document.getElementById('brand-wrap');
    const brandContainer = document.getElementById('brand-chips');
    if (!category) {
      brandWrap.style.display = 'none';
      brandContainer.innerHTML = '';
      return;
    }

    try {
      const url = '/api/v1/categories/' + category + '/brands' + (subcategory ? '?subcategory=' + encodeURIComponent(subcategory) : '');
      const response = await fetch(url);
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        brandWrap.style.display = 'block';
        
        let isBrandStillAvailable = false;
        let html = '<div class="brand-chip' + (!brand ? ' active' : '') + '" data-brand="">全部品牌</div>';
        data.data.forEach(item => {
          const isActive = brand === item.brand;
          if (isActive) isBrandStillAvailable = true;
          html += '<div class="brand-chip' + (isActive ? ' active' : '') + '" data-brand="' + escHtml(item.brand) + '">' + escHtml(item.brand) + ' (' + item.count + ')</div>';
        });

        if (!isBrandStillAvailable && brand) {
          brand = '';
          if (!subcategory && !brand) {
            sort = 'updated';
            document.getElementById('sort-select').value = 'updated';
          }
        }
        
        brandContainer.innerHTML = html;
        
        brandContainer.querySelectorAll('.brand-chip').forEach(bc => {
          bc.addEventListener('click', () => {
            brandContainer.querySelectorAll('.brand-chip').forEach(x => x.classList.remove('active'));
            bc.classList.add('active');
            brand = bc.dataset.brand;
            page = 1;

            if (subcategory || brand) {
              sort = 'price_asc';
              document.getElementById('sort-select').value = 'price_asc';
            } else {
              sort = 'updated';
              document.getElementById('sort-select').value = 'updated';
            }
            
            fetchProducts();
          });
        });
      } else {
        brandWrap.style.display = 'none';
        brandContainer.innerHTML = '';
        if (brand) {
          brand = '';
          if (!subcategory && !brand) {
            sort = 'updated';
            document.getElementById('sort-select').value = 'updated';
          }
        }
      }
    } catch (e) {
      brandWrap.style.display = 'none';
      brandContainer.innerHTML = '';
    }
  }



  // ── Search / Sort ──
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = document.getElementById('search-input').value.trim();
      page = 1;
      fetchProducts();
    }, 280);
  }

  function onSortChange() {
    sort = document.getElementById('sort-select').value;
    page = 1;
    fetchProducts();
  }

  // ── Fetch Status ──
  async function fetchStatus() {
    try {
      const r = await fetch('/api/v1/sources');
      const j = await r.json();
      if (!j.success) return;

      let total = 0;
      let latestTime = null;
      const dots = document.getElementById('source-dots');

      j.data.forEach(s => {
        total += s.productCount;
        if (s.lastScrapedAt) {
          const t = new Date(s.lastScrapedAt.includes('T') ? s.lastScrapedAt : s.lastScrapedAt.replace(' ', 'T') + 'Z');
          if (!latestTime || t > latestTime) latestTime = t;
        }
        const dot = dots.querySelector('.dot-' + s.source);
        if (dot) {
          dot.className = 'dot dot-' + s.source + (s.status === 'healthy' ? ' healthy' : '');
          dot.title = SOURCE_NAMES[s.source] + '：' + s.productCount.toLocaleString() + ' 件 (' + s.status + ')';
        }
      });

      document.getElementById('stat-total').textContent = total.toLocaleString() + ' 件';
      totalProducts = total;
      if (latestTime) {
        document.getElementById('stat-updated').textContent = latestTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) { /* silent */ }
  }

  // ── Fetch Products ──
  async function fetchProducts() {
    showListSkeleton();
    document.getElementById('results-title').textContent = query ? '搜尋結果' : (category ? getCatName(category) : '全部商品');
    document.getElementById('results-count').textContent = '';

    const params = new URLSearchParams({ limit: PER_PAGE, page, sort });
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    if (subcategory) params.set('subcategory', subcategory);
    if (brand) params.set('brand', brand);

    try {
      const r = await fetch('/api/v1/products?' + params);
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'API error');

      const total = j.metadata?.total ?? 0;
      document.getElementById('results-count').textContent = '　共 ' + total.toLocaleString() + ' 組';
      renderProducts(j.data);
      renderPagination(total);
    } catch (e) {
      document.getElementById('product-list').innerHTML = errorState(e.message);
      document.getElementById('pagination').innerHTML = '';
    }
  }

  function renderProducts(groups) {
    const el = document.getElementById('product-list');
    if (!groups.length) {
      el.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>找不到符合條件的商品</p><small>請嘗試不同的關鍵字或分類</small></div>';
      return;
    }
    
    el.innerHTML = groups.map(g => {
      const coolpc = g.products.find(p => p.source === 'coolpc');
      const sinya = g.products.find(p => p.source === 'sinya');
      const autobuy = g.products.find(p => p.source === 'autobuy');
      
      const renderPrice = (prod, sourceKey) => {
        if (!prod) return '<div class="store-price-empty">—</div>';
        const isLowest = prod.price === g.lowestPrice && g.products.length > 1;
        return '<a href="' + escHtml(prod.sourceUrl) + '" target="_blank" rel="noopener" ' +
               'class="store-price-link store-' + sourceKey + (isLowest ? ' is-lowest' : '') + '">' +
               (isLowest ? '<span class="lowest-badge">最低價</span>' : '') +
               '<span class="store-name-mini">' + SOURCE_NAMES[sourceKey] + '</span>' +
               '<span class="store-val">$' + prod.price.toLocaleString() + '</span>' +
               '</a>';
      };
      
      const diff = g.highestPrice - g.lowestPrice;
      const savingBadge = (diff > 0 && g.products.length > 1) 
        ? '<span class="tag tag-saving">💰 省 $' + diff.toLocaleString() + '</span>' 
        : '';
        
      const googleSearchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(g.name + ' 官網');
      return '<div class="product-row-group">' +
             '  <div class="product-info-col">' +
             '    <div class="product-name"><a href="' + googleSearchUrl + '" target="_blank" rel="noopener">' + escHtml(g.name) + '</a></div>' +
             '    <div class="product-tags">' +
             (g.brand ? '      <span class="tag">' + escHtml(g.brand) + '</span>' : '') +
             '      <span class="tag">' + (g.products[0]?.category || '').toUpperCase() + '</span>' +
             savingBadge +
             '    </div>' +
             '  </div>' +
             '  <div class="product-prices-col">' +
             renderPrice(coolpc, 'coolpc') +
             renderPrice(sinya, 'sinya') +
             renderPrice(autobuy, 'autobuy') +
             '  </div>' +
             '</div>';
    }).join('');
  }

  function renderPagination(total) {
    const totalPages = Math.ceil(total / PER_PAGE);
    if (totalPages <= 1) { document.getElementById('pagination').innerHTML = ''; return; }

    const el = document.getElementById('pagination');
    let html = '';
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    if (page > 1) html += '<button class="page-btn" onclick="goPage(' + (page-1) + ')">‹ 上一頁</button>';
    if (start > 1) { html += '<button class="page-btn" onclick="goPage(1)">1</button>'; if (start > 2) html += '<span style="color:var(--muted);padding:0 0.25rem">…</span>'; }
    for (let i = start; i <= end; i++) {
      html += '<button class="page-btn' + (i === page ? ' active' : '') + '" onclick="goPage(' + i + ')">' + i + '</button>';
    }
    if (end < totalPages) { if (end < totalPages - 1) html += '<span style="color:var(--muted);padding:0 0.25rem">…</span>'; html += '<button class="page-btn" onclick="goPage(' + totalPages + ')">' + totalPages + '</button>'; }
    if (page < totalPages) html += '<button class="page-btn" onclick="goPage(' + (page+1) + ')">下一頁 ›</button>';

    el.innerHTML = html;
  }

  function goPage(p) { page = p; fetchProducts(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  // ── Refresh ──
  async function triggerRefresh() {
    const btn = document.getElementById('btn-refresh');
    btn.disabled = true;
    btn.classList.add('spinning');
    showToast('ℹ️', '已送出重新整理請求，約 30~60 秒後完成...');

    try {
      const r = await fetch('/api/v1/sources/refresh', { method: 'POST' });
      const j = await r.json();
      if (j.success) {
        startRefreshPoll();
      }
    } catch (e) {
      showToast('❌', '重新整理請求失敗：' + e.message);
      btn.disabled = false;
      btn.classList.remove('spinning');
    }
  }

  function startRefreshPoll() {
    let attempts = 0;
    const initialTotal = totalProducts;
    clearInterval(refreshPollTimer);
    refreshPollTimer = setInterval(async () => {
      attempts++;
      await fetchStatus();
      const newTotal = parseInt(document.getElementById('stat-total').textContent.replace(/[^\\d]/g, '')) || 0;
      if (newTotal !== initialTotal || attempts > 20) {
        clearInterval(refreshPollTimer);
        const btn = document.getElementById('btn-refresh');
        btn.disabled = false;
        btn.classList.remove('spinning');
        if (attempts <= 20) {
          showToast('✅', '資料已更新完成！');
          fetchProducts();
        } else {
          showToast('⚠️', '重新整理已觸發，請稍後手動刷新頁面查看結果');
        }
      }
    }, 3000);
  }

  // ── Helpers ──
  function showListSkeleton() {
    const el = document.getElementById('product-list');
    el.innerHTML = Array(5).fill('<div class="skeleton-row"></div>').join('');
  }

  function showToast(icon, msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-icon').textContent = icon;
    document.getElementById('toast-msg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 5000);
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function errorState(msg) {
    return '<div class="empty-state"><div class="icon">⚠️</div><p>載入失敗</p><small>' + escHtml(msg) + '</small></div>';
  }

  const CAT_NAMES = { cpu:'CPU 處理器', motherboard:'主機板', gpu:'顯示卡', ram:'記憶體', ssd:'固態硬碟', hdd:'硬碟', psu:'電源供應器', 'case':'機殼', cooler:'散熱器', monitor:'螢幕' };
  function getCatName(c) { return CAT_NAMES[c] || c; }
</script>
</body>
</html>
`;
