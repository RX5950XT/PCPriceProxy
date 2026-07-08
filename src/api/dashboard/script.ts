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
  const PER_PAGE = 50;
  let searchTimer = null;
  let refreshPollTimer = null;
  let totalProducts = 0;
  let lastUpdatedMs = 0; // 最近一次來源爬取時間（ms），用於可靠判定重新整理是否完成

  // 分類顯示中繼資料（label/icon），由 /api/v1/categories 載入後填入。
  const CAT_META = {};

  // ── Source name map ──
  const SOURCE_NAMES = { coolpc: '原價屋', sinya: '欣亞', autobuy: 'Autobuy' };

  // ── Init ──
  document.addEventListener('DOMContentLoaded', () => {
    buildSidebar();
    fetchStatus();
    fetchProducts();
    bindMultiToggle();
    bindSourceFilter();
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

  function catLabel(c) { return (CAT_META[c] && CAT_META[c].label) || (c || '').toUpperCase(); }
  function catIcon(c) { return (CAT_META[c] && CAT_META[c].icon) || '📦'; }

  // ── 資料驅動側欄 ──
  async function buildSidebar() {
    const tree = document.getElementById('category-tree');
    try {
      const r = await fetch('/api/v1/categories');
      const j = await r.json();
      const cats = (j.success && Array.isArray(j.data)) ? j.data : [];

      let html = '<div class="tree-node active" id="node-all" data-cat=""><span class="cat-icon">🗂️</span><span class="cat-label">全部商品</span></div>';
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
      bindSidebarEvents();
    } catch (e) {
      tree.innerHTML = '<div class="tree-node active" id="node-all" data-cat=""><span class="cat-icon">🗂️</span><span class="cat-label">全部商品</span></div>';
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
      const upper = label.toUpperCase();
      for (let i = 0; i < order.length; i++) {
        const item = order[i].toUpperCase();
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
      if (upper.includes('THREADRIPPER')) return 400;
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
      return Number.MAX_SAFE_INTEGER;
    };

    const semA = semanticRank(a), semB = semanticRank(b);
    if (semA !== semB) return semA - semB;

    const genericOrder = [
      'DDR5', 'DDR4', 'D5', 'D4',
      'PCIE 5.0', 'GEN5', 'PCIE 4.0', 'GEN4',
      'LGA1851', 'LGA1700', 'LGA1200', 'AM5', 'AM4',
      'CORE I9', 'ULTRA 9', 'CORE I7', 'ULTRA 7', 'CORE I5', 'ULTRA 5', 'CORE I3',
      'RYZEN 9', 'RYZEN 7', 'RYZEN 5', 'RYZEN 3',
      'E-ATX', 'ATX', 'MICRO-ATX', 'MINI-ITX',
      '桌上型 UDIMM', '桌上型', '筆電用 SO-DIMM', '筆電用', '伺服器記憶體',
      'M.2 NVME SSD', 'SATA 2.5吋', '行動外接式', 'NAS 專用碟', '企業級硬碟', '一般監控/桌上型', '行動外接硬碟',
      '一體式水冷 (AIO)', '雙塔空冷', '單塔空冷', '下吹式空冷', '散熱膏/配件',
      // PSU 尺寸（頂層，須早於機殼 'ATX' 以精確命中 'ATX 電源'）
      'ATX 電源', 'SFX 電源', 'SFX-L 電源', 'TFX 電源', 'Flex 電源',
      '1000W 以上', '750W~1000W', '600W~750W', '600W 以下',
      '80+ 鈦金牌', '80+ 白金牌', '80+ 金牌', '80+ 銀牌', '80+ 銅牌', '80+ 白牌',
      '全模組', '半模組', '直出非模組',
      '全塔 (E-ATX)', 'ATX 中塔', 'MICRO-ATX 機殼', 'MINI-ITX 機殼', '玻璃透側', '網孔通風',
      '4K UHD', '2K QHD', 'FHD 1080P',
    ];
    const genA = orderedRank(a, genericOrder), genB = orderedRank(b, genericOrder);
    if (genA !== genB) return genA - genB;

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
              current[part] = { name: part, children: {}, count: 0, fullPath: parts.slice(0, index + 1).join(' > ') };
            }
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
              // 若本層自身也是某些商品的終點，於展開內容首列加上可直接選取的「全部 X」
              const selfLeaf = node.count > 0
                ? '<div class="tree-sub-node" data-sub="' + escHtml(node.fullPath) + '"><span>全部 ' + escHtml(node.name) + '</span><span style="font-size:0.7rem;opacity:0.6;">(' + node.count + ')</span></div>'
                : '';
              html += '<div class="tree-branch-inner">' +
                      '  <div class="tree-node-parent-inner">' +
                      '    <span>' + escHtml(node.name) + '</span>' +
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

  // ── Load Brands ──
  async function loadBrands() {
    const brandWrap = document.getElementById('brand-wrap');
    const brandContainer = document.getElementById('brand-chips');
    if (!category) { brandWrap.style.display = 'none'; brandContainer.innerHTML = ''; return; }

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
          if (!subcategory && !brand) { sort = 'updated'; document.getElementById('sort-select').value = 'updated'; }
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
          if (!subcategory && !brand) { sort = 'updated'; document.getElementById('sort-select').value = 'updated'; }
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
      if (query) {
        // 全站搜尋：清除分類/子分類/品牌與側欄高亮，讓標題「搜尋結果」與實際篩選一致
        category = ''; subcategory = ''; brand = '';
        resetTreeActive();
        const allNode = document.getElementById('node-all');
        if (allNode) allNode.classList.add('active');
        collapseAllBranches();
        loadBrands();
      }
      fetchProducts();
    }, 280);
  }
  function onSortChange() { sort = document.getElementById('sort-select').value; page = 1; fetchProducts(); }

  // ── Fetch Status ──
  async function fetchStatus() {
    try {
      const r = await fetch('/api/v1/sources');
      const j = await r.json();
      if (!j.success) return;
      let total = 0, latestTime = null;
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
      const hint = multiOnly ? '目前篩選「只看跨店比價」，可關閉以顯示更多商品' : '請嘗試不同的關鍵字或分類';
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
