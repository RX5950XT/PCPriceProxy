import { describe, expect, it, afterEach } from 'vitest';
import { extractMonitorModelKey } from './monitor-model-key.js';
import {
  mergeMonitorSpecs,
  setMonitorCatalogForTest,
  enrichMonitorSpecFields,
} from './monitor-specs.js';

afterEach(() => {
  setMonitorCatalogForTest(null);
});

describe('extractMonitorModelKey', () => {
  it('抽出 MAG / PA / 三星料號', () => {
    expect(extractMonitorModelKey('MSI MAG 272F〈1H1P/IPS/200Hz〉')).toBe('mag272f');
    expect(extractMonitorModelKey('華碩 ProArt PA32USD〈2H1P1TB4/OLED/240Hz〉')).toBe('pa32usd');
    expect(extractMonitorModelKey('三星 Odyssey 3D S27FG900XC〈2H1P/IPS/165Hz〉')).toBe('s27fg900xc');
  });
});

describe('mergeMonitorSpecs', () => {
  it('只填未標示，不覆寫品名已抽值', () => {
    const merged = mergeMonitorSpecs(
      { panel: 'IPS', refreshTier: '未標示', resolution: '未標示' },
      { panel: 'OLED', refreshTier: '170–240Hz', resolution: '4K / UHD', confidence: 0.95 },
    );
    expect(merged.panel).toBe('IPS');
    expect(merged.refreshTier).toBe('170–240Hz');
    expect(merged.resolution).toBe('4K / UHD');
  });

  it('無 catalog 時原樣回傳', () => {
    const from = { panel: '未標示', refreshTier: '未標示', resolution: '未標示' };
    expect(mergeMonitorSpecs(from, null)).toEqual(from);
  });
});

describe('enrichMonitorSpecFields + catalog', () => {
  it('catalog 可補 PA32USD 解析度', () => {
    setMonitorCatalogForTest({
      pa32usd: { resolution: '4K / UHD', confidence: 0.95 },
    });
    const out = enrichMonitorSpecFields(
      '華碩 ProArt PA32USD〈2H1P1TB4/OLED/240Hz〉',
      { panel: 'OLED', refreshTier: '170–240Hz', resolution: '未標示' },
    );
    expect(out.resolution).toBe('4K / UHD');
    expect(out.panel).toBe('OLED');
  });

  it('catalog 前綴近接：vg27aql5aw → vg27aql5a；不覆寫品名 IPS', () => {
    setMonitorCatalogForTest({
      vg27aql5a: { resolution: '2K / QHD', panel: 'OLED', confidence: 0.95 },
      xg27acs: { resolution: '2K / QHD', confidence: 0.95 },
    });
    const a = enrichMonitorSpecFields(
      '華碩 TUF Gaming VG27AQL5A-W〈2H1P/IPS/210Hz〉',
      { panel: 'IPS', refreshTier: '170–240Hz', resolution: '未標示' },
    );
    expect(a.resolution).toBe('2K / QHD');
    expect(a.panel).toBe('IPS'); // 品名 IPS 不可被 catalog OLED 覆寫

    const b = enrichMonitorSpecFields(
      '華碩 ROG Strix XG27ACS-W〈1H1P1C/IPS/180Hz〉',
      { panel: 'IPS', refreshTier: '170–240Hz', resolution: '未標示' },
    );
    expect(b.resolution).toBe('2K / QHD');
  });
});
