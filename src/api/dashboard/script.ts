/**
 * Dashboard 前端互動腳本。獨立成模組以符合單檔 <800 行規範。
 * 重點：側欄分類樹完全資料驅動（來自 /api/v1/categories，含圖示與數量）、
 * 中文分類標籤、跨店比價切換。
 * 排序表由 shared/subcategory-sort 的 SIDEBAR_ORDERS 注入（單一真相，client 不自帶清單）。
 */
import { SIDEBAR_ORDERS as ORDERS } from '../../shared/subcategory-sort.js';

export const DASHBOARD_SCRIPT = `
  // ── 排序表（伺服端注入） ──
  const SIDEBAR_ORDERS = ${JSON.stringify(ORDERS)};
  // ── State ──
  let category = '';
  let subcategory = '';
  let brand = '';
  let query = '';
  let sort = 'updated';
  let page = 1;
  let multiOnly = false;
  let source = ''; // 通路篩選：''=全部 / coolpc / sinya / autobuy
  let priceMin = ''; // 最低價（字串，空＝不限）
  let priceMax = ''; // 最高價
  let panel = ''; // 螢幕面板（specs.panel）
  let refreshTier = ''; // 螢幕更新率階（specs.refreshTier）
  let resolution = ''; // 螢幕解析度（specs.resolution）
  let mbForm = ''; // 主機板板型（specs.mbForm）
  let mbDimm = ''; // 主機板記憶體槽（specs.mbDimm）
  let mbWifi = ''; // 主機板 Wi-Fi（specs.mbWifi）
  let mbDdr = ''; // 主機板 DDR（specs.mbDdr）
  let mbLan = ''; // 主機板有線網（specs.mbLan）
  const PER_PAGE = 50;
  let searchTimer = null;
  let priceTimer = null;
  let refreshPollTimer = null;
  let totalGroups = 0; // 比價組總數（與側欄分類 count 合計、列表「共 N 組」同一單位）
  let lastUpdatedMs = 0; // 最近一次來源爬取時間（ms），用於可靠判定重新整理是否完成

  // 分類顯示中繼資料（label/icon），由 /api/v1/categories 載入後填入。
  const CAT_META = {};

  // ── Source name map ──
  const SOURCE_NAMES = { coolpc: '原價屋', sinya: '欣亞', autobuy: 'Autobuy' };

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    buildSidebar();
    buildMonitorFacetButtons();
    buildMotherboardFacetButtons();
    fetchStatus();
    fetchProducts();
    bindMultiToggle();
    bindSourceFilter();
    bindPriceFilter();
    bindMonitorFilters();
    bindMotherboardFilters();
    syncCategoryFiltersVisibility();
  });

  function bindSourceFilter() {
    const filter = document.getElementById('source-filter');
    if (!filter) return;
    filter.querySelectorAll('.src-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filter.querySelectorAll('.src-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        source = btn.dataset.src || '';
        page = 1;
        fetchProducts();
      });
    });
  }

  function buildMonitorFacetButtons() {
    const panelEl = document.getElementById('panel-filter');
    const refreshEl = document.getElementById('refresh-filter');
    const resolutionEl = document.getElementById('resolution-filter');
    if (panelEl) {
      const panels = SIDEBAR_ORDERS.monitorPanel || [];
      panels.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'facet-btn';
        btn.dataset.panel = p;
        btn.textContent = p;
        panelEl.appendChild(btn);
      });
    }
    if (refreshEl) {
      const tiers = SIDEBAR_ORDERS.monitorRefresh || [];
      tiers.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'facet-btn';
        btn.dataset.refresh = t;
        btn.textContent = t;
        refreshEl.appendChild(btn);
      });
    }
    if (resolutionEl) {
      const resList = SIDEBAR_ORDERS.monitorResolution || [];
      resList.forEach(r => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'facet-btn';
        btn.dataset.resolution = r;
        btn.textContent = r;
        resolutionEl.appendChild(btn);
      });
    }
  }

  function bindMonitorFilters() {
    const panelEl = document.getElementById('panel-filter');
    const refreshEl = document.getElementById('refresh-filter');
    const resolutionEl = document.getElementById('resolution-filter');
    if (panelEl) {
      panelEl.querySelectorAll('.facet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          panelEl.querySelectorAll('.facet-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          panel = btn.dataset.panel || '';
          page = 1;
          fetchProducts();
        });
      });
    }
    if (refreshEl) {
      refreshEl.querySelectorAll('.facet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          refreshEl.querySelectorAll('.facet-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          refreshTier = btn.dataset.refresh || '';
          page = 1;
          fetchProducts();
        });
      });
    }
    if (resolutionEl) {
      resolutionEl.querySelectorAll('.facet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          resolutionEl.querySelectorAll('.facet-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          resolution = btn.dataset.resolution || '';
          page = 1;
          fetchProducts();
        });
      });
    }
  }

  function clearMonitorFilters() {
    panel = '';
    refreshTier = '';
    resolution = '';
    const panelEl = document.getElementById('panel-filter');
    const refreshEl = document.getElementById('refresh-filter');
    const resolutionEl = document.getElementById('resolution-filter');
    if (panelEl) {
      panelEl.querySelectorAll('.facet-btn').forEach(b => b.classList.remove('active'));
      const all = panelEl.querySelector('.facet-btn[data-panel=""]');
      if (all) all.classList.add('active');
    }
    if (refreshEl) {
      refreshEl.querySelectorAll('.facet-btn').forEach(b => b.classList.remove('active'));
      const all = refreshEl.querySelector('.facet-btn[data-refresh=""]');
      if (all) all.classList.add('active');
    }
    if (resolutionEl) {
      resolutionEl.querySelectorAll('.facet-btn').forEach(b => b.classList.remove('active'));
      const all = resolutionEl.querySelector('.facet-btn[data-resolution=""]');
      if (all) all.classList.add('active');
    }
  }

  function buildMotherboardFacetButtons() {
    const defs = [
      { id: 'mb-form-filter', orderKey: 'mbForm', dataKey: 'mbForm' },
      { id: 'mb-dimm-filter', orderKey: 'mbDimm', dataKey: 'mbDimm' },
      { id: 'mb-wifi-filter', orderKey: 'mbWifi', dataKey: 'mbWifi' },
      { id: 'mb-ddr-filter', orderKey: 'mbDdr', dataKey: 'mbDdr' },
      { id: 'mb-lan-filter', orderKey: 'mbLan', dataKey: 'mbLan' },
    ];
    defs.forEach(({ id, orderKey, dataKey }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const list = SIDEBAR_ORDERS[orderKey] || [];
      list.forEach(v => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'facet-btn';
        btn.dataset[dataKey] = v;
        btn.textContent = v;
        el.appendChild(btn);
      });
    });
  }

  function bindMotherboardFilters() {
    const bind = (id, dataAttr, setter) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.querySelectorAll('.facet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          el.querySelectorAll('.facet-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          setter(btn.dataset[dataAttr] || '');
          page = 1;
          fetchProducts();
        });
      });
    };
    bind('mb-form-filter', 'mbForm', v => { mbForm = v; });
    bind('mb-dimm-filter', 'mbDimm', v => { mbDimm = v; });
    bind('mb-wifi-filter', 'mbWifi', v => { mbWifi = v; });
    bind('mb-ddr-filter', 'mbDdr', v => { mbDdr = v; });
    bind('mb-lan-filter', 'mbLan', v => { mbLan = v; });
  }

  function clearMotherboardFilters() {
    mbForm = '';
    mbDimm = '';
    mbWifi = '';
    mbDdr = '';
    mbLan = '';
    const clear = (id, dataAttr) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.querySelectorAll('.facet-btn').forEach(b => b.classList.remove('active'));
      const all = el.querySelector('.facet-btn[data-' + dataAttr + '=""]');
      if (all) all.classList.add('active');
    };
    clear('mb-form-filter', 'mb-form');
    clear('mb-dimm-filter', 'mb-dimm');
    clear('mb-wifi-filter', 'mb-wifi');
    clear('mb-ddr-filter', 'mb-ddr');
    clear('mb-lan-filter', 'mb-lan');
  }

  function syncMonitorFiltersVisibility() {
    const el = document.getElementById('monitor-filters');
    if (!el) return;
    if (category === 'monitor') {
      el.hidden = false;
    } else {
      el.hidden = true;
      if (panel || refreshTier || resolution) clearMonitorFilters();
    }
  }

  function syncMotherboardFiltersVisibility() {
    const el = document.getElementById('motherboard-filters');
    if (!el) return;
    if (category === 'motherboard') {
      el.hidden = false;
    } else {
      el.hidden = true;
      if (mbForm || mbDimm || mbWifi || mbDdr || mbLan) clearMotherboardFilters();
    }
  }

  function syncCategoryFiltersVisibility() {
    syncMonitorFiltersVisibility();
    syncMotherboardFiltersVisibility();
  }

  function catLabel(c) { return (CAT_META[c] && CAT_META[c].label) || (c || '').toUpperCase(); }
  function catIcon(c) { return (CAT_META[c] && CAT_META[c].icon) || '📦'; }

  /** 頂欄／「全部商品」統一顯示比價組總數（與側欄各分類 count 合計必須相等） */
  function setTotalGroups(n) {
    totalGroups = n;
    const el = document.getElementById('stat-total');
    if (el) el.textContent = n.toLocaleString() + ' 組';
    const allCount = document.getElementById('node-all-count');
    if (allCount) allCount.textContent = n.toLocaleString();
  }

  // ── 資料驅動側欄 ──
  async function buildSidebar() {
    const tree = document.getElementById('category-tree');
    try {
      const r = await fetch('/api/v1/categories');
      const j = await r.json();
      const cats = (j.success && Array.isArray(j.data)) ? j.data : [];
      const sum = cats.reduce((s, item) => s + (item.count || 0), 0);

      let html = '<div class="tree-node active" id="node-all" data-cat="">' +
                '<span class="cat-icon">🗂️</span><span class="cat-label">全部商品</span>' +
                '<span class="cat-count" id="node-all-count">' + sum.toLocaleString() + '</span></div>';
      cats.forEach(item => {
        CAT_META[item.category] = { label: item.label, icon: item.icon };
        html += '<div class="tree-branch" data-cat="' + escHtml(item.category) + '">' +
                '  <div class="tree-node-parent" data-cat="' + escHtml(item.category) + '">' +
                '    <span class="cat-icon">' + escHtml(item.icon) + '</span>' +
                '    <span class="cat-label">' + escHtml(item.label) + '</span>' +
                '    <span class="cat-count">' + item.count.toLocaleString() + '</span>' +
                '    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
                '  </div>' +
                '  <div class="tree-node-children" style="display:none;"></div>' +
                '</div>';
      });
      tree.innerHTML = html;
      setTotalGroups(sum);
      bindSidebarEvents();
    } catch (e) {
      tree.innerHTML = '<div class="tree-node active" id="node-all" data-cat="">' +
                      '<span class="cat-icon">🗂️</span><span class="cat-label">全部商品</span>' +
                      '<span class="cat-count" id="node-all-count">—</span></div>';
      bindSidebarEvents();
    }
  }

  function bindSidebarEvents() {
    const allNode = document.getElementById('node-all');
    if (allNode) {
      allNode.addEventListener('click', () => {
        resetTreeActive();
        allNode.classList.add('active');
        category = ''; subcategory = ''; brand = ''; page = 1;
        sort = 'updated';
        document.getElementById('sort-select').value = 'updated';
        collapseAllBranches();
        loadBrands();
        syncCategoryFiltersVisibility();
        fetchProducts();
      });
    }

    document.querySelectorAll('.tree-node-parent').forEach(p => {
      p.addEventListener('click', () => {
        const catVal = p.dataset.cat;
        resetTreeActive();
        p.classList.add('active');
        category = catVal; subcategory = ''; brand = ''; page = 1;
        sort = 'updated';
        document.getElementById('sort-select').value = 'updated';
        syncCategoryFiltersVisibility();
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
  }

  function bindMultiToggle() {
    const toggle = document.getElementById('multi-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      multiOnly = !multiOnly;
      toggle.classList.toggle('active', multiOnly);
      page = 1;
      fetchProducts();
    });
  }

  function bindPriceFilter() {
    const minEl = document.getElementById('price-min');
    const maxEl = document.getElementById('price-max');
    const clearBtn = document.getElementById('price-clear');
    if (!minEl || !maxEl) return;

    const apply = () => {
      priceMin = (minEl.value || '').trim();
      priceMax = (maxEl.value || '').trim();
      // 若最低 > 最高，自動對調，避免空結果
      const lo = priceMin ? Number(priceMin) : null;
      const hi = priceMax ? Number(priceMax) : null;
      if (lo !== null && hi !== null && !Number.isNaN(lo) && !Number.isNaN(hi) && lo > hi) {
        priceMin = String(hi);
        priceMax = String(lo);
        minEl.value = priceMin;
        maxEl.value = priceMax;
      }
      if (clearBtn) clearBtn.classList.toggle('visible', Boolean(priceMin || priceMax));
      page = 1;
      fetchProducts();
    };

    const onInput = () => {
      clearTimeout(priceTimer);
      priceTimer = setTimeout(apply, 320);
    };
    minEl.addEventListener('input', onInput);
    maxEl.addEventListener('input', onInput);
    minEl.addEventListener('change', apply);
    maxEl.addEventListener('change', apply);
    minEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    maxEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        minEl.value = '';
        maxEl.value = '';
        priceMin = '';
        priceMax = '';
        clearBtn.classList.remove('visible');
        page = 1;
        fetchProducts();
      });
    }
  }

  function resetTreeActive() {
    const allNode = document.getElementById('node-all');
    if (allNode) allNode.classList.remove('active');
    document.querySelectorAll('.tree-node-parent').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tree-sub-node').forEach(x => x.classList.remove('active'));
  }

  function collapseAllBranches() {
    document.querySelectorAll('.tree-node-parent').forEach(x => {
      x.classList.remove('expanded');
      const branch = x.closest('.tree-branch');
      if (branch) branch.querySelector('.tree-node-children').style.display = 'none';
    });
  }

  // ── compareNodes：子分類語義排序 ──
  function compareNodes(cat, a, b) {
    const orderedRank = (label, order) => {
      if (!label || !order || !order.length) return Number.MAX_SAFE_INTEGER;
      const upper = label.toUpperCase();
      for (let i = 0; i < order.length; i++) {
        const item = String(order[i]).toUpperCase();
        if (upper === item || upper.includes(item)) return i;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    const cpuRank = (label) => {
      const upper = label.toUpperCase();
      if (upper === 'INTEL') return 0;
      if (upper === 'AMD') return 1;
      if (upper.includes('CORE ULTRA 200S')) return 10;
      const intelGen = label.match(/第\\s*(\\d{1,2})\\s*代/);
      if (intelGen) return 100 - Number(intelGen[1]);
      const ryzenGen = upper.match(/RYZEN\\s*(\\d{4})/);
      if (ryzenGen) return 300 - Number(ryzenGen[1]) / 100;
      const threadripperOrder = ['Threadripper 9000', 'Threadripper 7000', 'Threadripper 5000', 'Threadripper 3000', 'Threadripper TR4', 'Threadripper'];
      const tr = orderedRank(label, threadripperOrder);
      if (tr !== Number.MAX_SAFE_INTEGER) return 400 + tr;
      if (/CORE I9|ULTRA 9|RYZEN 9/.test(upper)) return 500;
      if (/CORE I7|ULTRA 7|RYZEN 7/.test(upper)) return 510;
      if (/CORE I5|ULTRA 5|RYZEN 5/.test(upper)) return 520;
      if (/CORE I3|ULTRA 3|RYZEN 3/.test(upper)) return 530;
      return Number.MAX_SAFE_INTEGER;
    };
    const vendorRank = (label) => {
      const idx = SIDEBAR_ORDERS.vendor.map(v => v.toUpperCase()).indexOf(label.trim().toUpperCase());
      return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
    };
    const layeredRank = (label, layers) => {
      const matches = layers.map(order => orderedRank(label, order));
      const first = matches.findIndex(rank => rank !== Number.MAX_SAFE_INTEGER);
      if (first < 0) return Number.MAX_SAFE_INTEGER;
      let rank = 0;
      for (let i = first; i < matches.length; i++) {
        rank = rank * 1000 + (matches[i] === Number.MAX_SAFE_INTEGER ? 0 : matches[i]);
      }
      return first * 1000000000000 + rank;
    };
    const semanticRank = (label) => {
      if (cat === 'cpu') return cpuRank(label);
      if (cat === 'motherboard') {
        const s = orderedRank(label, SIDEBAR_ORDERS.socket);
        if (s !== Number.MAX_SAFE_INTEGER) return s;
        const c = orderedRank(label, SIDEBAR_ORDERS.chipset);
        if (c !== Number.MAX_SAFE_INTEGER) return 100 + c;
        const v = vendorRank(label);
        return v === Number.MAX_SAFE_INTEGER ? v : 200 + v;
      }
      if (cat === 'gpu') {
        const s = orderedRank(label, SIDEBAR_ORDERS.gpuSeries);
        if (s !== Number.MAX_SAFE_INTEGER) return s;
        const v = vendorRank(label);
        return v === Number.MAX_SAFE_INTEGER ? v : 100 + v;
      }
      if (cat === 'hdd') return orderedRank(label, SIDEBAR_ORDERS.hddType);
      if (cat === 'network') return orderedRank(label, SIDEBAR_ORDERS.network);
      if (cat === 'fan') return orderedRank(label, SIDEBAR_ORDERS.fan);
      if (cat === 'cable') return orderedRank(label, SIDEBAR_ORDERS.cable);
      if (cat === 'ram') return layeredRank(label, [SIDEBAR_ORDERS.ramDevice, SIDEBAR_ORDERS.ddr]);
      if (cat === 'ssd') return layeredRank(label, [SIDEBAR_ORDERS.ssdType, SIDEBAR_ORDERS.pcie]);
      if (cat === 'psu') {
        return layeredRank(label, [SIDEBAR_ORDERS.psuForm, SIDEBAR_ORDERS.psuWatt, SIDEBAR_ORDERS.psuRating, SIDEBAR_ORDERS.psuModular]);
      }
      if (cat === 'cooler') {
        return layeredRank(label, [SIDEBAR_ORDERS.coolerType, SIDEBAR_ORDERS.coolerSize, SIDEBAR_ORDERS.lighting]);
      }
      // 螢幕樹：尺寸 > 品牌（面板／Hz 走工具列 facet）
      if (cat === 'monitor') {
        return layeredRank(label, [SIDEBAR_ORDERS.monitorSize]);
      }
      if (cat === 'case') return orderedRank(label, SIDEBAR_ORDERS.caseForm);
      if (cat === 'keyboard') {
        return layeredRank(label, [SIDEBAR_ORDERS.keyboardType, SIDEBAR_ORDERS.keyboardSwitch, SIDEBAR_ORDERS.keyboardConn]);
      }
      if (cat === 'mouse') return layeredRank(label, [SIDEBAR_ORDERS.mouseType, SIDEBAR_ORDERS.keyboardConn]);
      if (cat === 'headset') return orderedRank(label, SIDEBAR_ORDERS.headsetType);
      if (cat === 'speaker') return orderedRank(label, SIDEBAR_ORDERS.speakerType);
      if (cat === 'os') {
        const t = orderedRank(label, SIDEBAR_ORDERS.osTop);
        const l = orderedRank(label, SIDEBAR_ORDERS.osLeaf);
        if (t !== Number.MAX_SAFE_INTEGER) return t * 100 + (l === Number.MAX_SAFE_INTEGER ? 0 : l);
        return l;
      }
      if (cat === 'package') {
        const t = orderedRank(label, SIDEBAR_ORDERS.packageType);
        if (t !== Number.MAX_SAFE_INTEGER) return t;
        const c = orderedRank(label, SIDEBAR_ORDERS.combo);
        if (c !== Number.MAX_SAFE_INTEGER) return 100 + c;
        const b = orderedRank(label, SIDEBAR_ORDERS.packageBase);
        return b === Number.MAX_SAFE_INTEGER ? b : 200 + b;
      }
      return Number.MAX_SAFE_INTEGER;
    };

    const semA = semanticRank(a), semB = semanticRank(b);
    if (semA !== semB) return semA - semB;

    const getCapacityVal = (str) => {
      const m = str.match(/^(\\d+)\\s*(GB|TB|G|T|MB)/i);
      if (!m) return 0;
      const num = parseFloat(m[1]);
      const unit = m[2].toUpperCase();
      if (unit.startsWith('T')) return num * 1024 * 1024;
      if (unit.startsWith('G')) return num * 1024;
      if (unit.startsWith('M')) return num;
      return num;
    };
    const capA = getCapacityVal(a), capB = getCapacityVal(b);
    if (capA !== capB) return capB - capA;

    const kitRank = (str) => /[*xX]\\s*\\d|\\(\\d+G[*xX]\\d+\\)/.test(str) ? 0 : 1;
    const kitA = kitRank(a), kitB = kitRank(b);
    if (kitA !== kitB) return kitA - kitB;

    const getNumVal = (str) => { const m = str.match(/(\\d+)/); return m ? parseInt(m[1], 10) : 0; };
    const numA = getNumVal(a), numB = getNumVal(b);
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
        // 統一建樹：每個節點都可同時是「某些商品的終點 (count)」與「更深層的分支 (children)」，
        // 避免同一層級值（如 27吋）既是葉節點又是分支時互相覆蓋。
        const tree = {};
        data.data.forEach(item => {
          const parts = item.subcategory.split(' > ');
          let current = tree;
          parts.forEach((part, index) => {
            if (!current[part]) {
              current[part] = { name: part, children: {}, count: 0, totalCount: 0, fullPath: parts.slice(0, index + 1).join(' > ') };
            }
            // 累加子孫數量，讓中間層「全部 X」可用前綴匹配撈整桶
            current[part].totalCount += item.count;
            if (index === parts.length - 1) current[part].count = item.count;
            current = current[part].children;
          });
        });

        function renderTreeHtml(nodes, isRoot = true) {
          let html = '';
          if (isRoot) html += '<div class="tree-sub-node active" data-sub="">全部子分類</div>';
          const sortedNodes = Object.values(nodes).sort((a, b) => compareNodes(category, a.name, b.name));
          sortedNodes.forEach(node => {
            const hasChildren = node.children && Object.keys(node.children).length > 0;
            if (hasChildren) {
              // 中間層一律提供「全部 X」（API 子分類前綴匹配）；數量用子孫合計
              const selfLeaf = '<div class="tree-sub-node" data-sub="' + escHtml(node.fullPath) + '"><span>全部 ' + escHtml(node.name) + '</span><span style="font-size:0.7rem;opacity:0.6;">(' + node.totalCount + ')</span></div>';
              // 內層分支預設收合，只在使用者點擊該節點時逐層展開。
              html += '<div class="tree-branch-inner">' +
                      '  <div class="tree-node-parent-inner">' +
                      '    <span>' + escHtml(node.name) + '</span>' +
                      '    <span style="font-size:0.7rem;opacity:0.55;margin-left:auto;padding-right:0.35rem;">' + node.totalCount + '</span>' +
                      '    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
                      '  </div>' +
                      '  <div class="tree-node-children-inner" style="display:none;">' +
                      selfLeaf + renderTreeHtml(node.children, false) +
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

  // ── Load Brands（品牌篩選欄位已移除，保留 no-op 以相容既有呼叫點） ──
  async function loadBrands() { /* 品牌篩選欄位已移除 */ }

  // ── Search / Sort ──
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = document.getElementById('search-input').value.trim();
      page = 1;
      if (query) {
        // 全站搜尋：清除分類/子分類/品牌與側欄高亮，讓標題「搜尋結果」與實際篩選一致
        category = ''; subcategory = ''; brand = '';
        resetTreeActive();
        const allNode = document.getElementById('node-all');
        if (allNode) allNode.classList.add('active');
        collapseAllBranches();
        loadBrands();
        syncCategoryFiltersVisibility();
      }
      fetchProducts();
    }, 280);
  }
  function onSortChange() { sort = document.getElementById('sort-select').value; page = 1; fetchProducts(); }

  // ── Fetch Status ──
  // 頂欄「商品總量」= 比價組合計（與側欄一致）；來源 productCount 只用於判定最後更新時間，不灌進總量。
  async function fetchStatus() {
    try {
      const [srcRes, catRes] = await Promise.all([
        fetch('/api/v1/sources'),
        fetch('/api/v1/categories'),
      ]);
      const j = await srcRes.json();
      const catJ = await catRes.json();
      if (catJ.success && Array.isArray(catJ.data)) {
        setTotalGroups(catJ.data.reduce((s, item) => s + (item.count || 0), 0));
      }
      if (!j.success) return;
      let latestTime = null;
      j.data.forEach(s => {
        if (s.lastScrapedAt) {
          const t = new Date(s.lastScrapedAt.includes('T') ? s.lastScrapedAt : s.lastScrapedAt.replace(' ', 'T') + 'Z');
          if (!latestTime || t > latestTime) latestTime = t;
        }
      });
      if (latestTime) {
        lastUpdatedMs = latestTime.getTime();
        document.getElementById('stat-updated').textContent = latestTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) { /* silent */ }
  }

  // ── Fetch Products ──
  async function fetchProducts() {
    showListSkeleton();
    const titleEl = document.getElementById('results-title');
    if (query) {
      titleEl.innerHTML = '<span class="title-icon">🔍</span>搜尋結果';
    } else if (category) {
      titleEl.innerHTML = '<span class="title-icon">' + escHtml(catIcon(category)) + '</span>' + escHtml(catLabel(category));
    } else {
      titleEl.innerHTML = '<span class="title-icon">🗂️</span>全部商品';
    }
    document.getElementById('results-count').textContent = '';

    const params = new URLSearchParams({ limit: PER_PAGE, page, sort });
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    if (subcategory) params.set('subcategory', subcategory);
    if (brand) params.set('brand', brand);
    if (multiOnly) params.set('has_multiple_sources', 'true');
    if (source) params.set('source', source);
    if (priceMin !== '' && !Number.isNaN(Number(priceMin))) params.set('price_min', String(Number(priceMin)));
    if (priceMax !== '' && !Number.isNaN(Number(priceMax))) params.set('price_max', String(Number(priceMax)));
    if (panel) params.set('panel', panel);
    if (refreshTier) params.set('refresh_tier', refreshTier);
    if (resolution) params.set('resolution', resolution);
    if (mbForm) params.set('mb_form', mbForm);
    if (mbDimm) params.set('mb_dimm', mbDimm);
    if (mbWifi) params.set('mb_wifi', mbWifi);
    if (mbDdr) params.set('mb_ddr', mbDdr);
    if (mbLan) params.set('mb_lan', mbLan);

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
      let hint = '請嘗試不同的關鍵字或分類';
      if (panel || refreshTier || resolution) hint = '目前有螢幕面板／更新率／解析度篩選，可改回「全部」';
      else if (mbForm || mbDimm || mbWifi || mbDdr || mbLan) hint = '目前有主機板規格篩選，可改回「全部」';
      else if (priceMin || priceMax) hint = '目前有價格區間篩選，可放寬最低／最高價';
      else if (multiOnly) hint = '目前篩選「只看跨店比價」，可關閉以顯示更多商品';
      el.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>找不到符合條件的商品</p><small>' + hint + '</small></div>';
      return;
    }

    el.innerHTML = groups.map(g => {
      // 同店若有多個變體，取該店最低價代表（比價卡應呈現各店最便宜選項）
      const bySource = {};
      g.products.forEach(p => {
        if (!bySource[p.source] || p.price < bySource[p.source].price) bySource[p.source] = p;
      });
      const coolpc = bySource['coolpc'];
      const sinya = bySource['sinya'];
      const autobuy = bySource['autobuy'];

      const renderPrice = (prod, sourceKey) => {
        if (!prod) return '<div class="store-price-empty">――</div>';
        const spread = g.highestPrice !== g.lowestPrice && g.products.length > 1;
        const isLowest = g.products.length > 1 && prod.price === g.lowestPrice;
        const isHighest = spread && !isLowest && prod.price === g.highestPrice;
        const mark = isLowest ? ' is-lowest' : (isHighest ? ' is-highest' : '');
        return '<a href="' + escHtml(prod.sourceUrl) + '" target="_blank" rel="noopener" ' +
               'class="store-price-link store-' + sourceKey + mark + '">' +
               (isLowest ? '<span class="lowest-badge">最低</span>' : '') +
               '<span class="store-name-mini">' + SOURCE_NAMES[sourceKey] + '</span>' +
               '<span class="store-val">$' + prod.price.toLocaleString() + '</span>' +
               '</a>';
      };

      const diff = g.highestPrice - g.lowestPrice;
      // 以「不同通路」計數，而非商品數（同店可能有多個變體）
      const sourceCount = new Set(g.products.map(p => p.source)).size;
      const savingBadge = (diff > 0 && sourceCount > 1)
        ? '<span class="tag tag-saving">💰 最高省 $' + diff.toLocaleString() + '</span>'
        : '';
      const multiBadge = (sourceCount > 1)
        ? '<span class="tag tag-multi">🔀 ' + sourceCount + ' 店比價</span>'
        : '';
      const cat = g.products[0]?.category || '';
      const catTag = cat ? '<span class="tag tag-cat">' + escHtml(catIcon(cat)) + ' ' + escHtml(catLabel(cat)) + '</span>' : '';

      const googleSearchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(g.name + ' 官網');
      return '<div class="product-row-group">' +
             '  <div class="product-info-col">' +
             '    <div class="product-name"><a href="' + googleSearchUrl + '" target="_blank" rel="noopener">' + escHtml(g.name) + '</a></div>' +
             '    <div class="product-tags">' +
             (g.brand ? '<span class="tag">' + escHtml(g.brand) + '</span>' : '') +
             catTag + multiBadge + savingBadge +
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
      if (j.success) startRefreshPoll();
    } catch (e) {
      showToast('❌', '重新整理請求失敗：' + e.message);
      btn.disabled = false;
      btn.classList.remove('spinning');
    }
  }

  function startRefreshPoll() {
    let attempts = 0;
    // 以「來源爬取時間是否前進」判定完成，而非總數變動（重爬後總數常不變，但時間戳必前進）
    const initialMs = lastUpdatedMs;
    clearInterval(refreshPollTimer);
    refreshPollTimer = setInterval(async () => {
      attempts++;
      await fetchStatus();
      const advanced = lastUpdatedMs > initialMs;
      if (advanced || attempts > 20) {
        clearInterval(refreshPollTimer);
        const btn = document.getElementById('btn-refresh');
        btn.disabled = false;
        btn.classList.remove('spinning');
        if (advanced) {
          showToast('✅', '資料已更新完成！');
          buildSidebar();
          fetchProducts();
        } else {
          showToast('⚠️', '重新整理已觸發，請稍後手動刷新頁面查看結果');
        }
      }
    }, 3000);
  }

  // ── Helpers ──
  function showListSkeleton() {
    document.getElementById('product-list').innerHTML = Array(5).fill('<div class="skeleton-row"></div>').join('');
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
`;
