import { Hono } from 'hono';
import { ProductRepository } from '../../storage/product-repository.js';
import { matchProducts } from '../../processing/matcher.js';
import { MemoryCache } from '../../storage/cache.js';
import type { ApiResponse, MatchGroup } from '../../shared/types.js';

export const compareRoutes = new Hono();
const cache = new MemoryCache();

compareRoutes.get('/', (c) => {
  const repo = new ProductRepository();
  const query = c.req.query('q');

  if (!query) {
    // Return all match groups
    const cacheKey = 'compare:all';
    const cached = cache.get<MatchGroup[]>(cacheKey);
    if (cached) {
      return c.json({
        success: true,
        data: cached.data,
        metadata: { total: cached.data.length, page: 1, limit: cached.data.length, cachedAt: cached.cachedAt },
      });
    }

    const { products } = repo.findAll({ limit: 10000 });
    const groups = matchProducts(products);
    cache.set(cacheKey, groups);

    const response: ApiResponse<MatchGroup[]> = {
      success: true,
      data: groups,
      metadata: { total: groups.length, page: 1, limit: groups.length },
    };
    return c.json(response);
  }

  // Search-based comparison
  const cacheKey = `compare:${query}`;
  const cached = cache.get<MatchGroup[]>(cacheKey);
  if (cached) {
    return c.json({
      success: true,
      data: cached.data,
      metadata: { total: cached.data.length, page: 1, limit: cached.data.length, cachedAt: cached.cachedAt },
    });
  }

  const { products } = repo.findAll({ query, limit: 1000 });
  const groups = matchProducts(products);
  cache.set(cacheKey, groups);

  const response: ApiResponse<MatchGroup[]> = {
    success: true,
    data: groups,
    metadata: { total: groups.length, page: 1, limit: groups.length },
  };
  return c.json(response);
});
