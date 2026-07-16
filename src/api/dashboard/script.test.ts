import { describe, expect, it } from 'vitest';
import { DASHBOARD_SCRIPT } from './script.js';

describe('Dashboard 側邊欄子分類樹', () => {
  it('載入分類後只顯示第一層，內層分支須等使用者點擊才展開', () => {
    expect(DASHBOARD_SCRIPT).toContain('<div class="tree-node-parent-inner">');
    expect(DASHBOARD_SCRIPT).toContain(
      '<div class="tree-node-children-inner" style="display:none;">',
    );
    expect(DASHBOARD_SCRIPT).not.toContain('<div class="tree-node-parent-inner expanded">');
    expect(DASHBOARD_SCRIPT).not.toContain(
      '<div class="tree-node-children-inner" style="display:flex;">',
    );
  });

  it('點擊個別內層節點後仍可展開或收合該節點', () => {
    expect(DASHBOARD_SCRIPT).toContain("parentInner.classList.add('expanded');");
    expect(DASHBOARD_SCRIPT).toContain("childrenInner.style.display = 'flex';");
    expect(DASHBOARD_SCRIPT).toContain("parentInner.classList.remove('expanded');");
    expect(DASHBOARD_SCRIPT).toContain("childrenInner.style.display = 'none';");
  });

  it('螢幕側欄只依 monitorSize 排序；panel/refresh/resolution 走 facet 篩選', () => {
    expect(DASHBOARD_SCRIPT).toContain('SIDEBAR_ORDERS.monitorSize');
    expect(DASHBOARD_SCRIPT).toContain('buildMonitorFacetButtons');
    expect(DASHBOARD_SCRIPT).toContain('params.set(\'panel\'');
    expect(DASHBOARD_SCRIPT).toContain('params.set(\'refresh_tier\'');
    expect(DASHBOARD_SCRIPT).toContain('params.set(\'resolution\'');
    expect(DASHBOARD_SCRIPT).toContain('SIDEBAR_ORDERS.monitorResolution');
    expect(DASHBOARD_SCRIPT).toContain('syncMonitorFiltersVisibility');
  });
});
