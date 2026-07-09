import cron from 'node-cron';
import { getAllScrapers } from './scrapers/registry.js';
import { ProductRepository } from './storage/product-repository.js';
import { MemoryCache } from './storage/cache.js';
import { ingestScrapeResult } from './ingest.js';

export class Scheduler {
  private task: cron.ScheduledTask | null = null;
  private readonly cache: MemoryCache;
  private isRunning = false;

  constructor(cache: MemoryCache) {
    this.cache = cache;
  }

  start(intervalMinutes: number = 30): void {
    const cronExpr = `*/${intervalMinutes} * * * *`;
    console.log(`[Scheduler] Starting with interval: every ${intervalMinutes} minutes`);

    // Run immediately on start
    this.runAll();

    this.task = cron.schedule(cronExpr, () => {
      this.runAll();
    });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[Scheduler] Stopped');
    }
  }

  async runAll(): Promise<void> {
    if (this.isRunning) {
      console.log('[Scheduler] Already running, skipping');
      return;
    }

    this.isRunning = true;
    const scrapers = getAllScrapers();
    console.log(`[Scheduler] Running ${scrapers.length} scraper(s)...`);

    for (const scraper of scrapers) {
      try {
        console.log(`[Scheduler] Scraping ${scraper.source}...`);
        const result = await scraper.scrape();

        const repo = new ProductRepository();
        const { stored, stale } = ingestScrapeResult(repo, result);
        repo.logScrape(scraper.source, 'success', stored, result.durationMs);

        if (stale > 0) console.log(`[Scheduler] ${scraper.source}: removed ${stale} stale products.`);
        console.log(`[Scheduler] ${scraper.source}: ${stored} products, ${result.durationMs}ms`);

        if (result.errors.length > 0) {
          console.warn(`[Scheduler] ${scraper.source}: ${result.errors.length} parse errors`);
        }

        // Stagger requests between scrapers
        await sleep(randomDelay(2000, 5000));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Scheduler] ${scraper.source} failed: ${message}`);

        const repo = new ProductRepository();
        repo.logScrape(scraper.source, 'error', 0, 0, message);
      }
    }

    // Run matching to group products across sources
    try {
      const repo = new ProductRepository();
      const removed = repo.deleteNonDiyProducts();
      if (removed > 0) console.log(`[Scheduler] Removed ${removed} non-DIY products.`);
      repo.updateMatchGroups();
    } catch (matchErr) {
      console.error('[Scheduler] Product matching failed:', matchErr);
    }

    // Invalidate cache after all scrapers finish
    this.cache.invalidate();
    this.isRunning = false;
    console.log('[Scheduler] All scrapers completed');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
