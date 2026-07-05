import { Hono } from 'hono';
import { ProductRepository } from '../../storage/product-repository.js';
import { getScraper, getAllScrapers } from '../../scrapers/registry.js';
import { MemoryCache } from '../../storage/cache.js';
import { normalizeProduct } from '../../processing/normalizer.js';
import { categorizeProduct } from '../../processing/categorizer.js';
import { MIN_VALID_PRICE } from '../../shared/constants.js';
import { isDiyProduct } from '../../processing/diy-filter.js';
import type { ApiResponse, SourceStatus, Source } from '../../shared/types.js';
import { ApiError } from '../../shared/errors.js';

export const sourceRoutes = new Hono();
const mainCache = new MemoryCache();

sourceRoutes.get('/', (c) => {
  const repo = new ProductRepository();
  const statuses = repo.getSourceStatus();

  const response: ApiResponse<SourceStatus[]> = {
    success: true,
    data: statuses,
  };
  return c.json(response);
});

/** POST /refresh — 觸發全部來源非同步重新爬取，立即回傳 */
sourceRoutes.post('/refresh', (c) => {
  const scrapers = getAllScrapers();

  // Fire-and-forget：不等待，直接在背景跑
  Promise.allSettled(
    scrapers.map(async (scraper) => {
      const repo = new ProductRepository();
      try {
        const result = await scraper.scrape();
        const processed = result.products
          .map(normalizeProduct)
          .map(categorizeProduct)
          .filter(p => p.price >= MIN_VALID_PRICE)
          .filter(p => isDiyProduct(p));
        repo.upsertMany(processed);
        repo.logScrape(scraper.source, 'success', processed.length, result.durationMs);
        console.log(`[Refresh API] ${scraper.source}: ${processed.length} products`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        repo.logScrape(scraper.source, 'error', 0, 0, message);
        console.error(`[Refresh API] ${scraper.source} failed: ${message}`);
      }
    }),
  ).then(() => {
    try {
      console.log(`[Refresh API] Running product matching...`);
      const repo = new ProductRepository();
      const removed = repo.deleteNonDiyProducts();
      if (removed > 0) console.log(`[Refresh API] Removed ${removed} non-DIY products.`);
      repo.updateMatchGroups();
      mainCache.invalidate();
      console.log(`[Refresh API] Product matching completed.`);
    } catch (matchErr) {
      console.error(`[Refresh API] Product matching failed:`, matchErr);
    }
  }).catch(() => {});

  return c.json({
    success: true,
    data: { message: '重新整理已在背景執行，約需 30~60 秒完成' },
  });
});

/** POST /:name/refresh — 觸發單一來源同步重新爬取 */
sourceRoutes.post('/:name/refresh', async (c) => {
  const sourceName = c.req.param('name') as Source;
  const validSources: Source[] = ['coolpc', 'sinya', 'autobuy'];
  if (!validSources.includes(sourceName)) {
    throw new ApiError(`Invalid source: ${sourceName}`, 400);
  }

  const scraper = getScraper(sourceName);
  if (!scraper) {
    throw new ApiError(`Scraper not registered: ${sourceName}`, 404);
  }

  const repo = new ProductRepository();

  try {
    const result = await scraper.scrape();
    const processed = result.products
      .map(normalizeProduct)
      .map(categorizeProduct)
      .filter(p => p.price >= MIN_VALID_PRICE)
      .filter(p => isDiyProduct(p));

    repo.upsertMany(processed);
    const removed = repo.deleteNonDiyProducts();
    if (removed > 0) console.log(`[Refresh API] ${sourceName}: removed ${removed} non-DIY products.`);
    repo.logScrape(sourceName, 'success', processed.length, result.durationMs);
    
    try {
      repo.updateMatchGroups();
    } catch (matchErr) {
      console.error(`[Refresh API] Product matching failed for ${sourceName}:`, matchErr);
    }
    
    mainCache.invalidate();

    return c.json({
      success: true,
      data: {
        source: sourceName,
        productsUpdated: processed.length,
        durationMs: result.durationMs,
        errors: result.errors,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    repo.logScrape(sourceName, 'error', 0, 0, message);
    throw new ApiError(`Scrape failed: ${message}`, 502);
  }
});
