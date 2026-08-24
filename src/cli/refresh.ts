import dns from 'node:dns';
import { getDatabase } from '../storage/database.js';
import { MemoryCache } from '../storage/cache.js';
import { Scheduler } from '../scheduler.js';
import { registerScraper, getScraper, getAllScrapers } from '../scrapers/registry.js';
import { CoolPCScraper } from '../scrapers/coolpc.js';
import { SinyaScraper } from '../scrapers/sinya.js';
import { AutobuyScraper } from '../scrapers/autobuy.js';
import type { SourceName } from './args.js';

dns.setDefaultResultOrder('ipv4first');

function ensureScrapers(): void {
  if (getAllScrapers().length > 0) return;
  registerScraper(new CoolPCScraper());
  registerScraper(new SinyaScraper());
  registerScraper(new AutobuyScraper());
}

export async function runRefresh(source?: SourceName): Promise<unknown> {
  getDatabase();
  ensureScrapers();

  if (!source) {
    const scheduler = new Scheduler(new MemoryCache());
    await scheduler.runAll();
    return { message: '已完成本機三家重爬並重建比價組' };
  }

  const scraper = getScraper(source);
  if (!scraper) {
    throw new Error(`沒有這個來源：${source}`);
  }

  const { ingestScrapeResult } = await import('../ingest.js');
  const { ProductRepository } = await import('../storage/product-repository.js');
  const repo = new ProductRepository();
  const result = await scraper.scrape();
  const { stored, stale } = ingestScrapeResult(repo, result);
  repo.logScrape(source, 'success', stored, result.durationMs);
  repo.deleteNonDiyProducts();
  repo.updateMatchGroups();
  return {
    source,
    productsUpdated: stored,
    staleRemoved: stale,
    durationMs: result.durationMs,
    errors: result.errors,
  };
}
