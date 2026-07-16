import { DASHBOARD_STYLES } from './dashboard/styles.js';
import { DASHBOARD_SCRIPT } from './dashboard/script.js';

/**
 * Dashboard 首頁 HTML 外殼。
 * 樣式與互動腳本拆分至 ./dashboard/styles.ts 與 ./dashboard/script.ts，
 * 以符合單檔 <800 行規範；側欄分類樹由腳本依 /api/v1/categories 動態產生。
 */
export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PCPriceProxy - 電腦零組件即時比價</title>
  <meta name="description" content="即時彙整原價屋、欣亞、Autobuy 三大通路電腦零件報價，跨店整合比對與分類排序。">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
  <style>${DASHBOARD_STYLES}</style>
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
        <span class="stat-label">比價組總量</span>
        <span class="stat-value" id="stat-total">—</span>
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
  <!-- 左側分類導航欄（由 script 依 /api/v1/categories 動態產生） -->
  <aside class="sidebar">
    <div class="sidebar-title">商品分類</div>
    <nav class="category-tree" id="category-tree">
      <div class="tree-node active" id="node-all" data-cat=""><span class="cat-icon">🗂️</span><span class="cat-label">全部商品</span></div>
    </nav>
  </aside>

  <!-- 右側商品展示區 -->
  <section class="main-content">
    <div class="controls">
      <div class="search-wrap">
        <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" id="search-input" class="search-input"
          placeholder="搜尋零件（例如：9800X3D、RTX 5070、DDR5 32G）"
          oninput="onSearchInput()">
      </div>
      <div class="source-filter" id="source-filter" title="選擇只看某一通路的商品">
        <button class="src-btn active" data-src="">全部通路</button>
        <button class="src-btn" data-src="coolpc"><span class="src-dot"></span>原價屋</button>
        <button class="src-btn" data-src="sinya"><span class="src-dot"></span>欣亞</button>
        <button class="src-btn" data-src="autobuy"><span class="src-dot"></span>Autobuy</button>
      </div>
      <div class="price-filter" title="依最低價區間篩選（留空＝不限）">
        <span class="price-filter-label">$</span>
        <input type="number" id="price-min" class="price-input" placeholder="最低" min="0" step="100" inputmode="numeric">
        <span class="price-filter-sep">–</span>
        <input type="number" id="price-max" class="price-input" placeholder="最高" min="0" step="100" inputmode="numeric">
        <button type="button" class="price-clear" id="price-clear" title="清除價格篩選" aria-label="清除價格篩選">×</button>
      </div>
      <div class="multi-toggle" id="multi-toggle" title="只顯示有兩家以上通路的可比價商品">
        <span class="switch-track"><span class="switch-thumb"></span></span>
        <span>只看跨店比價</span>
      </div>
      <select class="sort-select" id="sort-select" onchange="onSortChange()">
        <option value="updated">綜合排序（跨店優先）</option>
        <option value="price_asc">價格低→高</option>
        <option value="price_desc">價格高→低</option>
        <option value="name">名稱排序</option>
      </select>
    </div>
    <!-- 螢幕專用：面板／更新率／解析度（僅 category=monitor 時顯示） -->
    <div class="category-filters" id="monitor-filters" hidden>
      <div class="facet-filter" id="panel-filter" title="面板材質">
        <span class="facet-label">面板</span>
        <button type="button" class="facet-btn active" data-panel="">全部</button>
      </div>
      <div class="facet-filter" id="refresh-filter" title="更新率">
        <span class="facet-label">更新率</span>
        <button type="button" class="facet-btn active" data-refresh="">全部</button>
      </div>
      <div class="facet-filter" id="resolution-filter" title="解析度">
        <span class="facet-label">解析度</span>
        <button type="button" class="facet-btn active" data-resolution="">全部</button>
      </div>
    </div>
    <!-- 主機板專用：板型／插槽／Wi-Fi／DDR／有線網（僅 category=motherboard 時顯示） -->
    <div class="category-filters" id="motherboard-filters" hidden>
      <div class="facet-filter" id="mb-form-filter" title="板型尺寸">
        <span class="facet-label">板型</span>
        <button type="button" class="facet-btn active" data-mb-form="">全部</button>
      </div>
      <div class="facet-filter" id="mb-dimm-filter" title="記憶體插槽數">
        <span class="facet-label">記憶體槽</span>
        <button type="button" class="facet-btn active" data-mb-dimm="">全部</button>
      </div>
      <div class="facet-filter" id="mb-wifi-filter" title="無線網路">
        <span class="facet-label">Wi-Fi</span>
        <button type="button" class="facet-btn active" data-mb-wifi="">全部</button>
      </div>
      <div class="facet-filter" id="mb-ddr-filter" title="記憶體世代">
        <span class="facet-label">記憶體</span>
        <button type="button" class="facet-btn active" data-mb-ddr="">全部</button>
      </div>
      <div class="facet-filter" id="mb-lan-filter" title="有線網路">
        <span class="facet-label">有線網</span>
        <button type="button" class="facet-btn active" data-mb-lan="">全部</button>
      </div>
    </div>

    <div class="results-header">
      <div>
        <span class="results-title" id="results-title">商品列表</span>
        <span class="results-count" id="results-count"></span>
      </div>
    </div>

    <div id="product-list">
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    </div>

    <div class="pagination" id="pagination"></div>
  </section>

  <div class="toast" id="toast">
    <span class="toast-icon" id="toast-icon">ℹ️</span>
    <span class="toast-msg" id="toast-msg"></span>
  </div>
</main>

<script>${DASHBOARD_SCRIPT}</script>
</body>
</html>
`;
