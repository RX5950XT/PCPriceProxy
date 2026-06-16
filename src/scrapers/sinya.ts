import { createHash } from 'crypto';
import type { Scraper } from './base.js';
import type { Product, ScraperResult, Source } from '../shared/types.js';
import { ProductCategory } from '../shared/types.js';
import { USER_AGENTS, KNOWN_BRANDS } from '../shared/constants.js';
import { ScraperError } from '../shared/errors.js';

const SINYA_API_URL = 'https://www.sinya.com.tw/diy/api_prods';
const SINYA_BASE_URL = 'https://www.sinya.com.tw';

import { detectCategory } from '../processing/categorizer.js';

const SINYA_DIY_CATEGORY_MAP: Record<string, ProductCategory> = {
  // 可以預先定義特別確定的 diy_id
  '106': ProductCategory.MOTHERBOARD,
  '105': ProductCategory.SSD,
  '152': ProductCategory.PSU,
};

export class SinyaScraper implements Scraper {
  readonly source: Source = 'sinya';

  async scrape(): Promise<ScraperResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const products: Product[] = [];
    const scrapedAt = new Date().toISOString();

    try {
      const data = await this.fetchApi();
      const items = extractItemsFromResponse(data);

      for (const item of items) {
        try {
          const product = parseSinyaItem(item, scrapedAt);
          if (product) products.push(product);
        } catch (err) {
          errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError('sinya', err instanceof Error ? err.message : String(err));
    }

    return {
      source: 'sinya',
      products,
      scrapedAt,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(SINYA_BASE_URL, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Fetch JSON data from Sinya API with correct headers */
  private async fetchApi(): Promise<unknown> {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const response = await fetch(SINYA_API_URL, {
      headers: {
        'User-Agent': ua,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Referer': `${SINYA_BASE_URL}/diy`,
        'Origin': SINYA_BASE_URL,
      },
    });

    if (!response.ok) {
      throw new ScraperError('sinya', `HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';

    // Cloudflare might return HTML challenge page
    if (contentType.includes('text/html')) {
      throw new ScraperError('sinya', 'Cloudflare challenge detected, received HTML instead of JSON');
    }

    return response.json();
  }
}

/** Extract items array from various possible API response formats */
function extractItemsFromResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    // Check common wrapper keys
    for (const key of ['data', 'products', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }

    // Object with category keys containing arrays
    const items: unknown[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            items.push({ ...(item as Record<string, unknown>), _categoryKey: key });
          }
        }
      }
    }
    if (items.length > 0) return items;
  }

  return [];
}

/** Parse a single Sinya API item into a Product */
function parseSinyaItem(item: unknown, scrapedAt: string): Product | null {
  if (typeof item !== 'object' || item === null) return null;

  const obj = item as Record<string, unknown>;
  const name = String(obj.name ?? obj.prod_name ?? obj.title ?? '');
  const rawPrice = obj.price ?? obj.prod_price ?? obj.sale_price ?? 0;
  const price = typeof rawPrice === 'string'
    ? parseInt(rawPrice.replace(/[^\d]/g, ''), 10)
    : Number(rawPrice);

  if (!name || !price || price <= 0) return null;

  const diyId = String(obj.diy_id ?? '');
  let category = SINYA_DIY_CATEGORY_MAP[diyId] ?? ProductCategory.OTHER;
  if (category === ProductCategory.OTHER) {
    category = detectCategory(name);
  }

  const id = `sinya-${createHash('md5').update(`${name}-${price}`).digest('hex').substring(0, 12)}`;
  const inStock = obj.in_stock !== false && obj.stock !== 0 && obj.status !== 'out_of_stock';

  const url = obj.url ? `${SINYA_BASE_URL}${obj.url}` : `${SINYA_BASE_URL}/diy`;

  return {
    id,
    name: name.trim(),
    price,
    category,
    subcategory: (obj.subcategory ?? obj.sub_cat) as string | undefined,
    brand: (obj.brand as string | undefined) ?? extractBrandFromName(name),
    model: obj.model as string | undefined,
    specs: extractSpecs(obj),
    inStock,
    priceChange: null,
    source: 'sinya',
    sourceUrl: url,
    rawName: name,
    scrapedAt,
  };
}

/** Extract brand from product name using known brands list */
function extractBrandFromName(name: string): string | undefined {
  const upperName = name.toUpperCase();
  for (const brand of KNOWN_BRANDS) {
    if (upperName.includes(brand.toUpperCase())) return brand;
  }
  return undefined;
}

/** Extract spec fields from raw item */
function extractSpecs(item: Record<string, unknown>): Record<string, string> {
  const specs: Record<string, string> = {};
  const specKeys = ['spec', 'specs', 'description', 'barcode', 'prod_no'];
  for (const key of specKeys) {
    if (item[key] && typeof item[key] === 'string') {
      specs[key] = item[key] as string;
    }
  }
  return specs;
}
