import type { ScraperResult, Source } from '../shared/types.js';

/**
 * Base interface for all scrapers.
 * Each scraper targets a specific source and returns structured product data.
 */
export interface Scraper {
  readonly source: Source;
  scrape(): Promise<ScraperResult>;
  healthCheck(): Promise<boolean>;
}
