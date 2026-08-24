import { describe, expect, it } from 'vitest';
import { ProductCategory, type MatchGroup, type Product } from './types.js';
import { compactCard, envelope, fail, refineCards, type AgentCard } from './agent.js';

function product(partial: Partial<Product> & Pick<Product, 'id' | 'name' | 'price' | 'source'>): Product {
  return {
    category: ProductCategory.CPU,
    specs: {},
    inStock: true,
    priceChange: null,
    sourceUrl: `https://example.test/${partial.source}`,
    rawName: partial.name,
    scrapedAt: '2026-08-24T00:00:00Z',
    ...partial,
  };
}

describe('agent compact projection', () => {
  it('把比價組壓成 token 友善卡片，通路價由低到高', () => {
    const group: MatchGroup = {
      id: 'mg-9800x3d',
      name: 'AMD Ryzen 7 9800X3D',
      brand: 'AMD',
      model: '9800X3D',
      lowestPrice: 18900,
      highestPrice: 19900,
      priceDiff: 1000,
      products: [
        product({
          id: 'sinya-1',
          name: '9800X3D 欣亞',
          price: 19900,
          source: 'sinya',
          inStock: false,
        }),
        product({
          id: 'coolpc-1',
          name: '9800X3D 原價屋',
          price: 18900,
          source: 'coolpc',
        }),
      ],
    };

    const card = compactCard(group);
    expect(card.id).toBe('mg-9800x3d');
    expect(card.lowest).toBe(18900);
    expect(card.in_stock).toBe(true);
    expect(card.stores.map((s) => s.source)).toEqual(['coolpc', 'sinya']);
    expect(card.stores[0]?.price).toBe(18900);
    expect(JSON.stringify(card)).not.toContain('rawName');
  });

  it('envelope / fail 維持統一外包', () => {
    const ok = envelope({ items: [] }, { via: 'local-db' });
    expect(ok.ok).toBe(true);
    expect(ok.currency).toBe('TWD');
    expect(ok.via).toBe('local-db');

    const ng = fail('empty_database', 'pcprice refresh');
    expect(ng.ok).toBe(false);
    expect(ng.data).toBeNull();
    expect(ng.hint).toBe('pcprice refresh');
  });

  it('parts-only 剔除搭購，未指定分類時零件排前面', () => {
    const part: AgentCard = {
      id: 'p', name: 'CPU', category: 'cpu', lowest: 16000, highest: 16000, diff: 0, in_stock: true, stores: [],
    };
    const pack: AgentCard = {
      id: 'b', name: '套裝', category: 'package', lowest: 15000, highest: 15000, diff: 0, in_stock: true, stores: [],
    };
    expect(refineCards([pack, part], {}).map((c) => c.id)).toEqual(['p', 'b']);
    expect(refineCards([pack, part], { partsOnly: true }).map((c) => c.id)).toEqual(['p']);
  });
});
