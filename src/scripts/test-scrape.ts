import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import { CoolPCScraper } from '../scrapers/coolpc.js';
import { SinyaScraper } from '../scrapers/sinya.js';
import { AutobuyScraper } from '../scrapers/autobuy.js';
import { categorizeProduct } from '../processing/categorizer.js';
import { isDiyProduct } from '../processing/diy-filter.js';
import { normalizeProduct } from '../processing/normalizer.js';
import { MIN_VALID_PRICE } from '../shared/constants.js';
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
  const rawCategories = [...new Set(result.products.map(p => p.category))];
  const processed = result.products
    .map(normalizeProduct)
    .map(categorizeProduct)
    .filter(p => p.price >= MIN_VALID_PRICE)
    .filter(p => isDiyProduct(p));
  const categories = [...new Set(processed.map(p => p.category))];

  console.log(`\nSource categories (${rawCategories.length}): ${rawCategories.join(', ')}`);
  console.log(`Pipeline categories (${categories.length}): ${categories.join(', ')}`);
  console.log('\nPipeline sample products:');

  for (const cat of categories.slice(0, 3)) {
    const sample = processed.find(p => p.category === cat);
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
