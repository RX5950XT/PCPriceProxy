import 'dotenv/config';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import { serve } from '@hono/node-server';
import { createApp } from './api/server.js';
import { getDatabase, closeDatabase } from './storage/database.js';
import { MemoryCache } from './storage/cache.js';
import { Scheduler } from './scheduler.js';
import { registerScraper } from './scrapers/registry.js';
import { CoolPCScraper } from './scrapers/coolpc.js';
import { SinyaScraper } from './scrapers/sinya.js';
import { AutobuyScraper } from './scrapers/autobuy.js';

const PORT = Number(process.env.PORT ?? 3000);
const SCRAPE_INTERVAL = Number(process.env.SCRAPE_INTERVAL_MINUTES ?? 30);

async function main() {
  console.log('🚀 PCPriceProxy starting...');

  // Initialize database
  const db = getDatabase();
  console.log('✅ Database initialized');

  // Register scrapers
  registerScraper(new CoolPCScraper());
  registerScraper(new SinyaScraper());
  registerScraper(new AutobuyScraper());
  console.log('✅ Scrapers registered: coolpc, sinya, autobuy');

  // Start scheduler
  const cache = new MemoryCache();
  const scheduler = new Scheduler(cache);
  scheduler.start(SCRAPE_INTERVAL);
  console.log(`✅ Scheduler started (every ${SCRAPE_INTERVAL} minutes)`);

  // Start HTTP server
  const app = createApp();
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`✅ API server running on http://localhost:${info.port}`);
    console.log(`   Health: http://localhost:${info.port}/api/v1/health`);
    console.log(`   Products: http://localhost:${info.port}/api/v1/products`);
    console.log(`   Sources: http://localhost:${info.port}/api/v1/sources`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down...');
    scheduler.stop();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
