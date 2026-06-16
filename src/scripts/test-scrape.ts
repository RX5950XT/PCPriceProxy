import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import { CoolPCScraper } from '../scrapers/coolpc.js';
import { SinyaScraper } from '../scrapers/sinya.js';
import { AutobuyScraper } from '../scrapers/autobuy.js';
import type { ScraperResult } from '../shared/types.js';

async function testScraper(name: string, scrape: () => Promise<ScraperResult>): Promise<void> {
  console.log(`\n=== Testing ${name} Scraper ===`);
  try {
    const result = await scrape();
    console.log(`Products found: ${result.products.length}`);
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.products.length > 0) {
      printSampleProducts(result);
    }

    if (result.errors.length > 0) {
      console.log('\nFirst 5 errors:');
      result.errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
    }
  } catch (err) {
    console.error(`${name} scrape failed:`, err);
  }
}

function printSampleProducts(result: ScraperResult): void {
  const categories = [...new Set(result.products.map(p => p.category))];
  console.log(`\nCategories (${categories.length}): ${categories.join(', ')}`);
  console.log('\nSample products:');

  for (const cat of categories.slice(0, 3)) {
    const sample = result.products.find(p => p.category === cat);
    if (sample) {
      console.log(`  [${cat}] ${sample.name} - $${sample.price} (${sample.brand ?? 'unknown brand'})`);
    }
  }
}

async function main(): Promise<void> {
  const coolpc = new CoolPCScraper();
  await testScraper('CoolPC', () => coolpc.scrape());

  const sinya = new SinyaScraper();
  await testScraper('Sinya', () => sinya.scrape());

  const autobuy = new AutobuyScraper();
  await testScraper('Autobuy', () => autobuy.scrape());
}

main();
