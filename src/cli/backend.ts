import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { ProductFilters, Product, PriceHistoryEntry, MatchGroup, Source } from '../shared/types.js';
import type { AgentCard, AgentHealthData, AgentSearchData, AgentShowData } from '../shared/agent.js';
import { compactCard, compactCards, refineCards } from '../shared/agent.js';
import { CATEGORY_META } from '../shared/constants.js';
import type { CliOptions, SourceName } from './args.js';
import { ProductCategory } from '../shared/types.js';

export interface Backend {
  readonly via: 'http' | 'local-db';
  search(opts: CliOptions): Promise<AgentSearchData>;
  show(id: string): Promise<AgentShowData>;
  history(id: string): Promise<{ product_id: string; points: PriceHistoryEntry[] }>;
  categories(category?: string): Promise<unknown>;
  brands(category: string, subcategory?: string): Promise<unknown>;
  health(): Promise<AgentHealthData>;
  sources(): Promise<AgentHealthData['sources']>;
  refresh(source?: SourceName): Promise<unknown>;
}

const DEFAULT_URL = 'http://127.0.0.1:3000';

export function defaultDbPath(projectRoot: string): string {
  return resolve(projectRoot, 'data/pcprice.db');
}

export async function probeHttp(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const res = await fetch(new URL('/api/v1/health', baseUrl), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function openBackend(opts: CliOptions, projectRoot: string): Promise<Backend> {
  const baseUrl = opts.url ?? DEFAULT_URL;
  if (!opts.offline && await probeHttp(baseUrl)) {
    return new HttpBackend(baseUrl);
  }
  if (opts.url && !opts.offline) {
    throw new Error(`連不上 API：${baseUrl}`);
  }
  const dbPath = opts.db ?? defaultDbPath(projectRoot);
  if (!existsSync(dbPath)) {
    throw Object.assign(new Error('empty_database'), {
      code: 'empty_database',
      hint: `本機尚無資料庫。先執行：pcprice refresh（或 npm run dev）`,
    });
  }
  return LocalBackend.open(dbPath);
}

export class HttpBackend implements Backend {
  readonly via = 'http' as const;

  constructor(private readonly baseUrl: string) {}

  async search(opts: CliOptions): Promise<AgentSearchData> {
    const compact = await this.tryAgentSearch(opts);
    if (compact) return compact;
    const payload = await this.getJson<{ data: MatchGroup[]; metadata?: { total: number } }>(
      '/api/v1/products',
      toQuery(opts),
    );
    let items = compactCards(payload.data ?? []);
    items = refineCards(items, opts);
    return {
      query: opts.query,
      total: payload.metadata?.total ?? items.length,
      page: opts.page,
      limit: opts.limit,
      items,
    };
  }

  async show(id: string): Promise<AgentShowData> {
    const agent = await this.tryGet(`/api/v1/agent/show/${encodeURIComponent(id)}`);
    if (agent && isRecord(agent) && isRecord(agent.data) && isRecord(agent.data.card)) {
      return agent.data as unknown as AgentShowData;
    }
    const product = await this.getJson<{ data: Product }>(`/api/v1/products/${encodeURIComponent(id)}`);
    const group: MatchGroup = {
      id: product.data.matchGroupId ?? product.data.id,
      name: product.data.name,
      brand: product.data.brand,
      model: product.data.model,
      products: [product.data],
      lowestPrice: product.data.price,
      highestPrice: product.data.price,
      priceDiff: 0,
    };
    return showFromGroup(group);
  }

  async history(id: string): Promise<{ product_id: string; points: PriceHistoryEntry[] }> {
    const payload = await this.getJson<{ data: PriceHistoryEntry[] }>(
      `/api/v1/products/${encodeURIComponent(id)}/history`,
    );
    return { product_id: id, points: payload.data ?? [] };
  }

  async categories(category?: string): Promise<unknown> {
    if (!category) {
      const payload = await this.getJson<{ data: unknown }>('/api/v1/categories');
      return payload.data;
    }
    const payload = await this.getJson<{ data: unknown }>(
      `/api/v1/categories/${encodeURIComponent(category)}/subcategories`,
    );
    return payload.data;
  }

  async brands(category: string, subcategory?: string): Promise<unknown> {
    const payload = await this.getJson<{ data: unknown }>(
      `/api/v1/categories/${encodeURIComponent(category)}/brands`,
      subcategory ? { subcategory } : {},
    );
    return payload.data;
  }

  async health(): Promise<AgentHealthData> {
    const payload = await this.getJson<{ data: AgentHealthData }>('/api/v1/health');
    return payload.data;
  }

  async sources(): Promise<AgentHealthData['sources']> {
    const payload = await this.getJson<{ data: AgentHealthData['sources'] }>('/api/v1/sources');
    return payload.data;
  }

  async refresh(source?: SourceName): Promise<unknown> {
    const path = source ? `/api/v1/sources/${source}/refresh` : '/api/v1/sources/refresh';
    return this.postJson(path);
  }

  private async tryAgentSearch(opts: CliOptions): Promise<AgentSearchData | null> {
    const body = await this.tryGet('/api/v1/agent/search', toQuery(opts));
    if (!body || !isRecord(body) || !isRecord(body.data) || !Array.isArray(body.data.items)) {
      return null;
    }
    return body.data as unknown as AgentSearchData;
  }

  private async tryGet(path: string, query: Record<string, string> = {}): Promise<unknown | null> {
    try {
      const url = withQuery(this.baseUrl, path, query);
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  private async getJson<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const url = withQuery(this.baseUrl, path, query);
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} (${url.pathname})`);
    }
    return res.json() as Promise<T>;
  }

  private async postJson(path: string): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(180_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
  }
}

export class LocalBackend implements Backend {
  readonly via = 'local-db' as const;

  private constructor(
    private readonly repo: import('../storage/product-repository.js').ProductRepository,
  ) {}

  static async open(dbPath: string): Promise<LocalBackend> {
    process.env.DATABASE_PATH = dbPath;
    const { closeDatabase, getDatabase } = await import('../storage/database.js');
    closeDatabase();
    getDatabase(dbPath);
    const { ProductRepository } = await import('../storage/product-repository.js');
    return new LocalBackend(new ProductRepository());
  }

  async search(opts: CliOptions): Promise<AgentSearchData> {
    const result = this.repo.findAllGroups(toFilters(opts));
    let items = compactCards(result.groups);
    items = refineCards(items, opts);
    return {
      query: opts.query,
      total: result.total,
      page: opts.page,
      limit: opts.limit,
      items,
    };
  }

  async show(id: string): Promise<AgentShowData> {
    const group = this.repo.findGroupById(id);
    if (!group) {
      throw Object.assign(new Error(`not_found: ${id}`), { code: 'not_found' });
    }
    return showFromGroup(group);
  }

  async history(id: string): Promise<{ product_id: string; points: PriceHistoryEntry[] }> {
    const product = this.repo.findById(id);
    if (!product) {
      throw Object.assign(new Error(`not_found: ${id}`), { code: 'not_found' });
    }
    return { product_id: id, points: this.repo.getPriceHistory(id) };
  }

  async categories(category?: string): Promise<unknown> {
    if (!category) {
      return this.repo.getCategories().map(({ category: key, count }) => {
        const meta = CATEGORY_META[key as ProductCategory];
        return {
          category: key,
          label: meta?.label ?? key,
          icon: meta?.icon ?? '📦',
          order: meta?.order ?? 98,
          count,
        };
      }).sort((a, b) => a.order - b.order);
    }
    return this.repo.getSubcategories(category);
  }

  async brands(category: string, subcategory?: string): Promise<unknown> {
    return this.repo.getBrands(category, subcategory);
  }

  async health(): Promise<AgentHealthData> {
    const sources = this.repo.getSourceStatus();
    return {
      status: 'ok',
      totalMatchGroups: this.repo.getMatchGroupCount(),
      totalProducts: sources.reduce((sum, item) => sum + item.productCount, 0),
      sources,
    };
  }

  async sources(): Promise<AgentHealthData['sources']> {
    return this.repo.getSourceStatus();
  }

  async refresh(source?: SourceName): Promise<unknown> {
    const { runRefresh } = await import('./refresh.js');
    return runRefresh(source);
  }
}

export function toFilters(opts: CliOptions): ProductFilters {
  return {
    query: opts.query,
    category: opts.category,
    subcategory: opts.subcategory,
    brand: opts.brand,
    source: opts.source,
    priceMin: opts.priceMin,
    priceMax: opts.priceMax,
    inStock: opts.inStock || undefined,
    hasMultipleSources: opts.multi || undefined,
    sort: opts.sort,
    page: opts.page,
    limit: opts.limit,
    panel: opts.panel,
    refreshTier: opts.refreshTier,
    resolution: opts.resolution,
    mbForm: opts.mbForm,
    mbDimm: opts.mbDimm,
    mbWifi: opts.mbWifi,
    mbDdr: opts.mbDdr,
    mbLan: opts.mbLan,
  };
}

function toQuery(opts: CliOptions): Record<string, string> {
  const pairs: Array<[string, string | number | boolean | undefined]> = [
    ['q', opts.query],
    ['category', opts.category],
    ['subcategory', opts.subcategory],
    ['brand', opts.brand],
    ['source', opts.source],
    ['price_min', opts.priceMin],
    ['price_max', opts.priceMax],
    ['in_stock', opts.inStock ? 'true' : undefined],
    ['parts_only', opts.partsOnly ? 'true' : undefined],
    ['has_multiple_sources', opts.multi ? 'true' : undefined],
    ['sort', opts.sort],
    ['page', opts.page],
    ['limit', opts.limit],
    ['panel', opts.panel],
    ['refresh_tier', opts.refreshTier],
    ['resolution', opts.resolution],
    ['mb_form', opts.mbForm],
    ['mb_dimm', opts.mbDimm],
    ['mb_wifi', opts.mbWifi],
    ['mb_ddr', opts.mbDdr],
    ['mb_lan', opts.mbLan],
  ];
  const query: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (value !== undefined && value !== '') query[key] = String(value);
  }
  return query;
}

function withQuery(baseUrl: string, path: string, query: Record<string, string>): URL {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function showFromGroup(group: MatchGroup): AgentShowData {
  const card = compactCard(group);
  const specs = mergeSpecs(group.products);
  return {
    card,
    specs,
    raw_names: group.products.map((item) => ({ source: item.source, raw: item.rawName })),
  };
}

function mergeSpecs(products: readonly Product[]): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const product of products) {
    for (const [key, value] of Object.entries(product.specs)) {
      if (value && merged[key] === undefined) merged[key] = value;
    }
  }
  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type { AgentCard, Source };
