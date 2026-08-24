import type { MatchGroup, Product, Source } from './types.js';

/** Agent 精簡回傳的跨店報價。價格單位一律新台幣整數。 */
export interface AgentStoreOffer {
  readonly source: Source;
  readonly price: number;
  readonly in_stock: boolean;
  readonly url: string;
  readonly product_id: string;
  readonly name: string;
}

/** 一張比價卡（對應 match_groups 一列，不是 products 列）。 */
export interface AgentCard {
  readonly id: string;
  readonly name: string;
  readonly brand?: string;
  readonly model?: string;
  readonly category?: string;
  readonly subcategory?: string;
  readonly lowest: number;
  readonly highest: number;
  readonly diff: number;
  readonly in_stock: boolean;
  readonly stores: readonly AgentStoreOffer[];
}

export interface AgentEnvelope<T> {
  readonly ok: boolean;
  readonly data: T | null;
  readonly error?: string;
  readonly hint?: string;
  readonly via?: 'http' | 'local-db';
  readonly fetched_at: string;
  readonly currency?: 'TWD';
}

export interface AgentSearchData {
  readonly query?: string;
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly items: readonly AgentCard[];
}

export interface AgentShowData {
  readonly card: AgentCard;
  readonly specs: Readonly<Record<string, string>>;
  readonly raw_names: readonly { source: Source; raw: string }[];
}

export interface AgentHealthData {
  readonly status: string;
  readonly totalMatchGroups: number;
  readonly totalProducts: number;
  readonly sources: readonly {
    source: Source;
    status: string;
    productCount: number;
    lastScrapedAt: string | null;
    lastError?: string;
  }[];
}

export function compactOffer(product: Product): AgentStoreOffer {
  return {
    source: product.source,
    price: product.price,
    in_stock: product.inStock,
    url: product.sourceUrl,
    product_id: product.id,
    name: product.name,
  };
}

export function compactCard(group: MatchGroup): AgentCard {
  const stores = [...group.products]
    .map(compactOffer)
    .sort((a, b) => a.price - b.price);
  const first = group.products[0];
  return {
    id: group.id,
    name: group.name,
    brand: group.brand ?? first?.brand,
    model: group.model ?? first?.model,
    category: first?.category,
    subcategory: first?.subcategory,
    lowest: group.lowestPrice,
    highest: group.highestPrice,
    diff: group.priceDiff,
    in_stock: group.products.some((item) => item.inStock),
    stores,
  };
}

export function compactCards(groups: readonly MatchGroup[]): AgentCard[] {
  return groups.map(compactCard);
}

/** 搜尋後處理：可選剔除整機／搭購；未指定分類時零件淨價排前面。 */
export function refineCards(
  items: readonly AgentCard[],
  opts: { inStock?: boolean; partsOnly?: boolean; category?: string },
): AgentCard[] {
  let next = [...items];
  if (opts.inStock) next = next.filter((card) => card.in_stock);
  if (opts.partsOnly) next = next.filter((card) => card.category !== 'package');
  if (!opts.category && !opts.partsOnly) {
    const parts = next.filter((card) => card.category !== 'package');
    const packs = next.filter((card) => card.category === 'package');
    next = [...parts, ...packs];
  }
  return next;
}

export function envelope<T>(
  data: T,
  extras: Partial<Omit<AgentEnvelope<T>, 'ok' | 'data' | 'fetched_at'>> = {},
): AgentEnvelope<T> {
  return {
    ok: true,
    data,
    fetched_at: new Date().toISOString(),
    currency: 'TWD',
    ...extras,
  };
}

export function fail(
  error: string,
  hint?: string,
  via?: AgentEnvelope<null>['via'],
): AgentEnvelope<null> {
  return {
    ok: false,
    data: null,
    error,
    hint,
    via,
    fetched_at: new Date().toISOString(),
    currency: 'TWD',
  };
}

export const AGENT_OUTPUT_SCHEMA = {
  currency: 'TWD',
  unit: '比價組 match_groups，不是 products 列',
  sources: ['coolpc', 'sinya', 'autobuy'],
  note: '全新零件通路價，不是蝦皮／二手。條件價單品在 package > 搭購價單品。',
  card: {
    id: 'match group id',
    lowest: '跨店最低價',
    highest: '跨店最高價',
    in_stock: '任一通路有貨即 true',
    stores: '由低到高的通路報價',
  },
} as const;
