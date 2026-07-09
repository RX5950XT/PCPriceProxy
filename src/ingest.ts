import { categorizeProduct } from './processing/categorizer.js';
import { isDiyProduct } from './processing/diy-filter.js';
import { normalizeProduct } from './processing/normalizer.js';
import { MIN_VALID_PRICE } from './shared/constants.js';
import type { ProductRepository } from './storage/product-repository.js';
import type { Product, ScraperResult } from './shared/types.js';

/** scrape → normalize → categorize → 過濾低價假項 → 過濾非 DIY。 */
export function processScrapeResult(result: ScraperResult): Product[] {
  return result.products
    .map(normalizeProduct)
    .map(categorizeProduct)
    .filter(p => p.price >= MIN_VALID_PRICE)
    .filter(p => isDiyProduct(p));
}

/**
 * 寫入本輪商品，並清掉同來源未被刷新的孤兒列（已下架、或改分類後不再入庫）。
 * 空結果不清，避免爬取異常把整個來源清空。
 */
export function ingestScrapeResult(
  repo: ProductRepository,
  result: ScraperResult,
): { readonly stored: number; readonly stale: number } {
  const processed = processScrapeResult(result);
  repo.upsertMany(processed);
  const stale = processed.length > 0 ? repo.deleteStaleProducts(result.source, result.scrapedAt) : 0;
  return { stored: processed.length, stale };
}
