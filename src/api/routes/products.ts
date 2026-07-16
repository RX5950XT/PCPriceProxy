import { Hono } from 'hono';
import { ProductRepository } from '../../storage/product-repository.js';
import { MemoryCache } from '../../storage/cache.js';
import type { ApiResponse, Product, PriceHistoryEntry, MatchGroup } from '../../shared/types.js';
import { NotFoundError } from '../../shared/errors.js';

export const productRoutes = new Hono();
const cache = new MemoryCache();

productRoutes.get('/', (c) => {
  const repo = new ProductRepository();

  const filters = {
    source: c.req.query('source') as any,
    category: c.req.query('category'),
    subcategory: c.req.query('subcategory'),
    brand: c.req.query('brand'),
    panel: c.req.query('panel') || undefined,
    refreshTier: c.req.query('refresh_tier') || undefined,
    resolution: c.req.query('resolution') || undefined,
    mbForm: c.req.query('mb_form') || undefined,
    mbDimm: c.req.query('mb_dimm') || undefined,
    mbWifi: c.req.query('mb_wifi') || undefined,
    mbDdr: c.req.query('mb_ddr') || undefined,
    mbLan: c.req.query('mb_lan') || undefined,
    priceMin: c.req.query('price_min') ? Number(c.req.query('price_min')) : undefined,
    priceMax: c.req.query('price_max') ? Number(c.req.query('price_max')) : undefined,
    inStock: c.req.query('in_stock') === 'true' ? true : undefined,
    query: c.req.query('q'),
    sort: c.req.query('sort') as any,
    page: c.req.query('page') ? Number(c.req.query('page')) : 1,
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : 50,
    hasMultipleSources: c.req.query('has_multiple_sources') === 'true' ? true : undefined,
  };

  // Cache key from query params
  const cacheKey = `products:groups:${JSON.stringify(filters)}`;
  const cached = cache.get<{ groups: MatchGroup[]; total: number }>(cacheKey);
  if (cached) {
    const response: ApiResponse<MatchGroup[]> = {
      success: true,
      data: cached.data.groups,
      metadata: {
        total: cached.data.total,
        page: filters.page ?? 1,
        limit: filters.limit ?? 50,
        cachedAt: cached.cachedAt,
      },
    };
    return c.json(response);
  }

  const result = repo.findAllGroups(filters);
  cache.set(cacheKey, result);

  const response: ApiResponse<MatchGroup[]> = {
    success: true,
    data: result.groups,
    metadata: {
      total: result.total,
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
    },
  };
  return c.json(response);
});

productRoutes.get('/:id', (c) => {
  const repo = new ProductRepository();
  const id = c.req.param('id');
  const product = repo.findById(id);

  if (!product) {
    throw new NotFoundError('Product', id);
  }

  const response: ApiResponse<Product> = {
    success: true,
    data: product,
  };
  return c.json(response);
});

productRoutes.get('/:id/history', (c) => {
  const repo = new ProductRepository();
  const id = c.req.param('id');
  const product = repo.findById(id);

  if (!product) {
    throw new NotFoundError('Product', id);
  }

  const history = repo.getPriceHistory(id);
  const response: ApiResponse<PriceHistoryEntry[]> = {
    success: true,
    data: history,
  };
  return c.json(response);
});
