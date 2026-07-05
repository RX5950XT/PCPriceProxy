import 'dotenv/config';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import { getDatabase, closeDatabase } from '../storage/database.js';
import { MemoryCache } from '../storage/cache.js';
import { Scheduler } from '../scheduler.js';
import { registerScraper } from '../scrapers/registry.js';
import { CoolPCScraper } from '../scrapers/coolpc.js';
import { SinyaScraper } from '../scrapers/sinya.js';
import { AutobuyScraper } from '../scrapers/autobuy.js';

async function main(): Promise<void> {
  getDatabase();
  registerScraper(new CoolPCScraper());
  registerScraper(new SinyaScraper());
  registerScraper(new AutobuyScraper());

  const scheduler = new Scheduler(new MemoryCache());
  await scheduler.runAll();
  closeDatabase();
}

main().catch(err => {
  console.error('[ScrapeOnce] Failed:', err);
  process.exit(1);
});