import type { Scraper } from './base.js';
import type { Source } from '../shared/types.js';

/** Global registry of scraper instances keyed by source */
const scrapers = new Map<Source, Scraper>();

export function registerScraper(scraper: Scraper): void {
  scrapers.set(scraper.source, scraper);
}

export function getScraper(source: Source): Scraper | undefined {
  return scrapers.get(source);
}

export function getAllScrapers(): Scraper[] {
  return Array.from(scrapers.values());
}

export function getRegisteredSources(): Source[] {
  return Array.from(scrapers.keys());
}
