import { Hono } from 'hono';
import { ProductRepository } from '../../storage/product-repository.js';
import { CATEGORY_META } from '../../shared/constants.js';
import { ProductCategory } from '../../shared/types.js';
import type { ProductFilters } from '../../shared/types.js';
import { compactCards, envelope, refineCards } from '../../shared/agent.js';
import { AGENT_OUTPUT_SCHEMA } from '../../shared/agent.js';
import { NotFoundError } from '../../shared/errors.js';

export const agentRoutes = new Hono();

agentRoutes.get('/schema', (c) => c.json(envelope(AGENT_OUTPUT_SCHEMA)));

agentRoutes.get('/search', (c) => {
  const repo = new ProductRepository();
  const filters = readFilters(c);
  const result = repo.findAllGroups(filters);
  const items = refineCards(compactCards(result.groups), {
    inStock: filters.inStock,
    partsOnly: c.req.query('parts_only') === 'true',
    category: filters.category,
  });
  return c.json(envelope({
    query: filters.query,
    total: result.total,
    page: filters.page ?? 1,
    limit: filters.limit ?? 15,
    items,
  }));
});

agentRoutes.get('/show/:id', (c) => {
  const repo = new ProductRepository();
  const id = c.req.param('id');
  const group = repo.findGroupById(id);
  if (!group) throw new NotFoundError('MatchGroup', id);
  const [card] = compactCards([group]);
  if (!card) throw new NotFoundError('MatchGroup', id);
  const specs: Record<string, string> = {};
  for (const product of group.products) {
    for (const [key, value] of Object.entries(product.specs)) {
      if (value && specs[key] === undefined) specs[key] = value;
    }
  }
  return c.json(envelope({
    card,
    specs,
    raw_names: group.products.map((item) => ({ source: item.source, raw: item.rawName })),
  }));
});

agentRoutes.get('/health', (c) => {
  const repo = new ProductRepository();
  const sources = repo.getSourceStatus();
  return c.json(envelope({
    status: 'ok',
    totalMatchGroups: repo.getMatchGroupCount(),
    totalProducts: sources.reduce((sum, item) => sum + item.productCount, 0),
    sources,
  }));
});

agentRoutes.get('/categories', (c) => {
  const repo = new ProductRepository();
  const rows = repo.getCategories().map(({ category, count }) => {
    const meta = CATEGORY_META[category as ProductCategory];
    return {
      category,
      label: meta?.label ?? category,
      icon: meta?.icon ?? '📦',
      order: meta?.order ?? 98,
      count,
    };
  }).sort((a, b) => a.order - b.order);
  return c.json(envelope(rows));
});

agentRoutes.get('/categories/:category/subcategories', (c) => {
  const repo = new ProductRepository();
  return c.json(envelope(repo.getSubcategories(c.req.param('category'))));
});

agentRoutes.get('/categories/:category/brands', (c) => {
  const repo = new ProductRepository();
  return c.json(envelope(repo.getBrands(c.req.param('category'), c.req.query('subcategory'))));
});

function readFilters(c: { req: { query: (key: string) => string | undefined } }): ProductFilters {
  const limitRaw = c.req.query('limit');
  const limit = limitRaw ? Number(limitRaw) : 15;
  return {
    source: c.req.query('source') as ProductFilters['source'],
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
    sort: c.req.query('sort') as ProductFilters['sort'],
    page: c.req.query('page') ? Number(c.req.query('page')) : 1,
    limit: Math.min(50, Math.max(1, Number.isFinite(limit) ? limit : 15)),
    hasMultipleSources: c.req.query('has_multiple_sources') === 'true' ? true : undefined,
  };
}
