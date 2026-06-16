import { createHash } from 'crypto';
import type { Scraper } from './base.js';
import type { Product, ScraperResult, Source } from '../shared/types.js';
import { ProductCategory } from '../shared/types.js';
import { AUTOBUY_CATEGORY_MAP, USER_AGENTS } from '../shared/constants.js';
import { ScraperError } from '../shared/errors.js';

const AUTOBUY_BASE_URL = 'https://www.autobuy.tw';

export class AutobuyScraper implements Scraper {
  readonly source: Source = 'autobuy';

  async scrape(): Promise<ScraperResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const products: Product[] = [];
    const scrapedAt = new Date().toISOString();

    try {
      // 1. Get session cookie from home page
      const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
      const homeResponse = await fetch(`${AUTOBUY_BASE_URL}/`, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html',
        },
      });

      if (!homeResponse.ok) {
        throw new ScraperError('autobuy', `Failed to fetch home page: ${homeResponse.status}`);
      }

      const setCookie = homeResponse.headers.get('set-cookie');
      let cookie = '';
      if (setCookie) {
        const match = setCookie.match(/PHPSESSID=[^;]+/);
        if (match) {
          cookie = match[0];
        }
      }

      // 2. Iterate all group IDs mapped in category map
      const groupIds = Object.keys(AUTOBUY_CATEGORY_MAP);
      console.log(`[Autobuy Scraper] Scraping ${groupIds.length} product groups...`);

      for (const groupId of groupIds) {
        try {
          const category = AUTOBUY_CATEGORY_MAP[groupId];
          const postUrl = `${AUTOBUY_BASE_URL}/ajax_get_diy_products_${groupId}`;

          const response = await fetch(postUrl, {
            method: 'POST',
            headers: {
              'User-Agent': ua,
              'Referer': `${AUTOBUY_BASE_URL}/diy`,
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With': 'XMLHttpRequest',
              'Cookie': cookie,
            },
          });

          if (!response.ok) {
            errors.push(`Group ${groupId} failed: HTTP ${response.status}`);
            continue;
          }

          const text = await response.text();
          if (text.startsWith('<!DOCTYPE')) {
            errors.push(`Group ${groupId} failed: Redirected to HTML (possibly session expired or blocked)`);
            continue;
          }

          const data = JSON.parse(text);
          if (data.ErrCode !== 1) {
            errors.push(`Group ${groupId} error: ${data.ErrMessage || 'Unknown error'}`);
            continue;
          }

          const items = data.ProductsData || [];
          let count = 0;

          for (const item of items) {
            if (!item.ProdId || !item.ProdName || !item.Price) continue;

            const price = parseInt(item.Price, 10);
            if (isNaN(price) || price <= 0) continue;

            // Clean name: remove suffix like "☆71899元" or "★71899元"
            const name = item.ProdName.replace(/[☆★]\d+元$/, '').trim();

            const product: Product = {
              id: `autobuy-${item.ProdId}`,
              name,
              price,
              category,
              specs: {},
              inStock: true, // Typically in config list is in stock
              priceChange: item.IsNew === 1 ? 'new' : null,
              source: 'autobuy',
              sourceUrl: `${AUTOBUY_BASE_URL}/3c/prod_${item.ProdId}`,
              rawName: item.ProdName,
              scrapedAt,
            };

            products.push(product);
            count++;
          }

          // Stagger requests
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        } catch (err) {
          errors.push(`Error scraping group ${groupId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError('autobuy', err instanceof Error ? err.message : String(err));
    }

    return {
      source: 'autobuy',
      products,
      scrapedAt,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(AUTOBUY_BASE_URL, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}
