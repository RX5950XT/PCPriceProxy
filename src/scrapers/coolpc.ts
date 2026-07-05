import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { createHash } from 'crypto';
import type { Scraper } from './base.js';
import type { Product, ScraperResult, Source } from '../shared/types.js';
import { COOLPC_CATEGORY_MAP, USER_AGENTS } from '../shared/constants.js';
import { ProductCategory } from '../shared/types.js';
import { ScraperError } from '../shared/errors.js';
import { extractBrand } from '../processing/normalizer.js';

const COOLPC_URL = 'https://www.coolpc.com.tw/evaluate.php';

export class CoolPCScraper implements Scraper {
  readonly source: Source = 'coolpc';

  async scrape(): Promise<ScraperResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const products: Product[] = [];
    const scrapedAt = new Date().toISOString();

    try {
      const html = await this.fetchPage();
      const $ = cheerio.load(html);

      this.parseSelects($, products, errors, scrapedAt);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError('coolpc', err instanceof Error ? err.message : String(err));
    }

    return {
      source: 'coolpc',
      products,
      scrapedAt,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(COOLPC_URL, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Fetch and decode the Big5-encoded CoolPC page */
  private async fetchPage(): Promise<string> {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const response = await fetch(COOLPC_URL, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
    });

    if (!response.ok) {
      throw new ScraperError('coolpc', `HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return iconv.decode(buffer, 'big5');
  }

  /** Parse all <select> elements to extract products */
  private parseSelects(
    $: cheerio.CheerioAPI,
    products: Product[],
    errors: string[],
    scrapedAt: string,
  ): void {
    $('select').each((_, selectEl) => {
      const selectName = $(selectEl).attr('name') ?? '';
      const category = COOLPC_CATEGORY_MAP[selectName] ?? ProductCategory.OTHER;

      // Skip non-product selects (quantity, etc.)
      if (!selectName || selectName.startsWith('n_') || selectName.startsWith('q_')) return;

      // Parse options within optgroups
      $(selectEl).find('optgroup').each((_, optgroupEl) => {
        const subcategory = $(optgroupEl).attr('label')?.trim() ?? '';
        this.parseOptions($, optgroupEl, category, subcategory, scrapedAt, selectName, products, errors);
      });

      // Parse top-level options (not inside optgroups)
      $(selectEl).children('option').each((_, optionEl) => {
        try {
          const rawText = $(optionEl).text().trim();
          const value = $(optionEl).attr('value') ?? '';
          if (!rawText || rawText.startsWith('=') || !value || rawText.includes('請選擇')) return;

          const parsed = parseCoolPCOption(rawText, category, '', scrapedAt);
          if (parsed) products.push(parsed);
        } catch (err) {
          errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    });
  }

  /** Parse <option> elements within a parent element */
  private parseOptions(
    $: cheerio.CheerioAPI,
    parentEl: any,
    category: ProductCategory,
    subcategory: string,
    scrapedAt: string,
    selectName: string,
    products: Product[],
    errors: string[],
  ): void {
    $(parentEl).find('option').each((_, optionEl) => {
      try {
        const rawText = $(optionEl).text().trim();
        const value = $(optionEl).attr('value') ?? '';

        // Skip empty or header options
        if (!rawText || rawText.startsWith('=') || !value) return;

        const parsed = parseCoolPCOption(rawText, category, subcategory, scrapedAt);
        if (parsed) products.push(parsed);
      } catch (err) {
        errors.push(`Parse error in ${selectName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
  }
}

/**
 * Parse a single CoolPC <option> text into a Product.
 * Format: "Product Name $16990" with optional ↘↗ markers.
 */
function parseCoolPCOption(
  rawText: string,
  category: ProductCategory,
  subcategory: string,
  scrapedAt: string,
): Product | null {
  // Extract price: $NUMBER pattern
  const priceMatch = rawText.match(/\$([\d,]+)/);
  if (!priceMatch) return null;

  const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
  if (isNaN(price) || price <= 0) return null;

  const priceChange = detectPriceChange(rawText);
  const inStock = !rawText.includes('缺貨') && !rawText.includes('停售') && !rawText.includes('售完');

  // Clean the product name
  const name = rawText
    .replace(/\$[\d,]+/g, '')
    .replace(/[↘↗]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const id = `coolpc-${createHash('md5').update(`${category}-${rawText}`).digest('hex').substring(0, 12)}`;

  return {
    id,
    name,
    price,
    category,
    subcategory: subcategory || undefined,
    brand: extractBrand(name),
    specs: {},
    inStock,
    priceChange,
    source: 'coolpc',
    sourceUrl: COOLPC_URL,
    rawName: rawText,
    scrapedAt,
  };
}

/** Detect price change direction from text markers */
function detectPriceChange(text: string): 'up' | 'down' | 'new' | null {
  if (text.includes('↘') || text.includes('降')) return 'down';
  if (text.includes('↗') || text.includes('漲')) return 'up';
  if (text.includes('新品') || text.includes('NEW')) return 'new';
  return null;
}
