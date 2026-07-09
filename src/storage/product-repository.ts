import type Database from 'better-sqlite3';
import type { Product, PriceHistoryEntry, SourceStatus, Source, MatchGroup, ProductFilters } from '../shared/types.js';
import { getDatabase } from './database.js';
import { matchProducts } from '../processing/matcher.js';
import { DIY_CATEGORIES } from '../shared/constants.js';
import { isRealBundle } from '../processing/categorizer.js';
import { ProductCategory } from '../shared/types.js';
import { sortSubcategories } from '../shared/subcategory-sort.js';

interface ProductRow {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  category: string;
  subcategory: string | null;
  brand: string | null;
  model: string | null;
  specs: string;
  in_stock: number;
  price_change: string | null;
  source: string;
  source_url: string | null;
  raw_name: string;
  scraped_at: string;
  match_group_id: string | null;
}

interface CountRow {
  count: number;
}

interface ScrapeLogRow {
  created_at: string;
  status: string;
  error_message: string | null;
}

export class ProductRepository {
  private readonly db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase();
  }

  upsert(product: Product): void {
    const existing = this.db.prepare(
      'SELECT price, match_group_id FROM products WHERE id = ?'
    ).get(product.id) as { price: number; match_group_id: string | null } | undefined;

    const matchGroupId = existing?.match_group_id ?? `mg-${product.id}`;

    const stmt = this.db.prepare(`
      INSERT INTO products (id, name, price, original_price, category, subcategory, brand, model, specs, in_stock, price_change, source, source_url, raw_name, scraped_at, match_group_id, updated_at)
      VALUES (@id, @name, @price, @originalPrice, @category, @subcategory, @brand, @model, @specs, @inStock, @priceChange, @source, @sourceUrl, @rawName, @scrapedAt, @matchGroupId, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = @name, price = @price, original_price = @originalPrice, category = @category,
        subcategory = @subcategory, brand = @brand, model = @model, specs = @specs,
        in_stock = @inStock, price_change = @priceChange, source_url = @sourceUrl,
        raw_name = @rawName, scraped_at = @scrapedAt, updated_at = datetime('now')
    `);

    stmt.run({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice ?? null,
      category: product.category,
      subcategory: product.subcategory ?? null,
      brand: product.brand ?? null,
      model: product.model ?? null,
      specs: JSON.stringify(product.specs),
      inStock: product.inStock ? 1 : 0,
      priceChange: product.priceChange,
      source: product.source,
      sourceUrl: product.sourceUrl,
      rawName: product.rawName,
      scrapedAt: product.scrapedAt,
      matchGroupId,
    });

    // Record price history if price changed
    if (!existing || existing.price !== product.price) {
      this.db.prepare(
        'INSERT INTO price_history (product_id, price) VALUES (?, ?)'
      ).run(product.id, product.price);
    }
  }

  upsertMany(products: readonly Product[]): void {
    const transaction = this.db.transaction((items: readonly Product[]) => {
      for (const product of items) {
        this.upsert(product);
      }
    });
    transaction(products);
  }

  findAll(filters: ProductFilters = {}): { products: Product[]; total: number } {
    const conditions: string[] = ['1=1'];
    const params: Record<string, unknown> = {};

    if (filters.source) {
      conditions.push('source = @source');
      params.source = filters.source;
    }
    if (filters.category) {
      conditions.push('category = @category');
      params.category = filters.category;
    }
    if (filters.subcategory) {
      conditions.push('subcategory = @subcategory');
      params.subcategory = filters.subcategory;
    }
    if (filters.brand) {
      conditions.push('brand = @brand');
      params.brand = filters.brand;
    }
    if (filters.priceMin !== undefined) {
      conditions.push('price >= @priceMin');
      params.priceMin = filters.priceMin;
    }
    if (filters.priceMax !== undefined) {
      conditions.push('price <= @priceMax');
      params.priceMax = filters.priceMax;
    }
    if (filters.inStock !== undefined) {
      conditions.push('in_stock = @inStock');
      params.inStock = filters.inStock ? 1 : 0;
    }
    if (filters.query) {
      conditions.push('(name LIKE @query OR brand LIKE @query OR raw_name LIKE @query)');
      params.query = `%${filters.query}%`;
    }

    const where = conditions.join(' AND ');

    const sortMap: Record<string, string> = {
      price_asc: 'price ASC',
      price_desc: 'price DESC',
      name: 'name ASC',
      updated: 'updated_at DESC',
    };
    const orderBy = sortMap[filters.sort ?? 'updated'] ?? 'updated_at DESC';

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const offset = (page - 1) * limit;

    const totalRow = this.db.prepare(
      `SELECT COUNT(*) as count FROM products WHERE ${where}`
    ).get(params) as CountRow;
    const total = totalRow.count;

    const rows = this.db.prepare(
      `SELECT * FROM products WHERE ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit, offset }) as ProductRow[];

    return {
      products: rows.map(rowToProduct),
      total,
    };
  }

  findById(id: string): Product | null {
    const row = this.db.prepare(
      'SELECT * FROM products WHERE id = ?'
    ).get(id) as ProductRow | undefined;
    return row ? rowToProduct(row) : null;
  }

  getPriceHistory(productId: string): PriceHistoryEntry[] {
    return this.db.prepare(
      'SELECT price, recorded_at as recordedAt FROM price_history WHERE product_id = ? ORDER BY recorded_at DESC LIMIT 100'
    ).all(productId) as PriceHistoryEntry[];
  }

  getCategories(): { category: string; count: number }[] {
    // 以「比價組數」計（與列表顯示的「共 N 組」一致），避免件數 vs 組數落差造成的困惑
    return this.db.prepare(
      'SELECT category, COUNT(*) as count FROM match_groups GROUP BY category ORDER BY count DESC'
    ).all() as { category: string; count: number }[];
  }

  getSourceStatus(): SourceStatus[] {
    const sources: Source[] = ['coolpc', 'sinya', 'autobuy'];
    return sources.map(source => this.buildSourceStatus(source));
  }

  logScrape(
    source: Source,
    status: 'success' | 'error',
    itemsCount: number,
    durationMs: number,
    errorMessage?: string,
  ): void {
    this.db.prepare(
      'INSERT INTO scrape_logs (source, status, items_count, duration_ms, error_message) VALUES (?, ?, ?, ?, ?)'
    ).run(source, status, itemsCount, durationMs, errorMessage ?? null);
  }

  deleteBySource(source: Source): number {
    const result = this.db.prepare(
      'DELETE FROM products WHERE source = ?'
    ).run(source);
    return result.changes;
  }

  /**
   * 刪除非 DIY 商品（OTHER、周邊雜訊、假 PACKAGE 如 VR/筆電搭購列）。
   * PACKAGE 保留真組合，以及被移出零件分類的條件價單品（搭板價 / 限組裝 / 加購價）。
   */
  deleteNonDiyProducts(): number {
    const placeholders = DIY_CATEGORIES.map(() => '?').join(', ');
    let removed = this.db.prepare(
      `DELETE FROM products WHERE category NOT IN (${placeholders})`,
    ).run(...DIY_CATEGORIES).changes;

    const packages = this.db.prepare(
      `SELECT id, raw_name, specs FROM products WHERE category = ?`,
    ).all(ProductCategory.PACKAGE) as { id: string; raw_name: string; specs: string }[];

    const deleteStmt = this.db.prepare('DELETE FROM products WHERE id = ?');
    for (const row of packages) {
      const hasCondition = Boolean(JSON.parse(row.specs || '{}').priceCondition);
      if (!isRealBundle(row.raw_name) && !hasCondition) {
        deleteStmt.run(row.id);
        removed++;
      }
    }
    return removed;
  }

  getSubcategories(category: string): { subcategory: string; count: number }[] {
    // 以比價組數計，與列表一致
    const rows = this.db.prepare(`
      SELECT subcategory, COUNT(*) as count
      FROM match_groups
      WHERE category = ? AND subcategory IS NOT NULL AND subcategory != ''
      GROUP BY subcategory
      ORDER BY subcategory ASC
    `).all(category) as { subcategory: string; count: number }[];
    return sortSubcategories(category, rows);
  }

  getBrands(category?: string, subcategory?: string): { brand: string; count: number }[] {
    const conditions: string[] = ['brand IS NOT NULL', "brand != ''"];
    const params: Record<string, unknown> = {};

    if (category) {
      conditions.push('category = @category');
      params.category = category;
    }
    if (subcategory) {
      conditions.push('subcategory = @subcategory');
      params.subcategory = subcategory;
    }

    const where = conditions.join(' AND ');

    // 以比價組數計，與列表一致
    return this.db.prepare(`
      SELECT brand, COUNT(*) as count
      FROM match_groups
      WHERE ${where}
      GROUP BY brand
      ORDER BY count DESC
    `).all(params) as { brand: string; count: number }[];
  }

  updateMatchGroups(similarityThreshold = 0.7): void {
    const allRows = this.db.prepare('SELECT * FROM products').all() as ProductRow[];
    const allProducts = allRows.map(rowToProduct);

    console.log(`[Matcher] Matching ${allProducts.length} products...`);
    const groups = matchProducts(allProducts, similarityThreshold);
    console.log(`[Matcher] Generated ${groups.length} match groups.`);

    const updateStmt = this.db.prepare('UPDATE products SET match_group_id = ? WHERE id = ?');
    
    const runUpdates = this.db.transaction(() => {
      this.db.prepare('UPDATE products SET match_group_id = NULL').run();

      const matchedIds = new Set<string>();

      for (const group of groups) {
        for (const product of group.products) {
          updateStmt.run(group.id, product.id);
          matchedIds.add(product.id);
        }
      }

      const unmatchedRows = this.db.prepare('SELECT id FROM products WHERE match_group_id IS NULL').all() as { id: string }[];
      for (const row of unmatchedRows) {
        updateStmt.run(`mg-${row.id}`, row.id);
      }

      // Rebuild match_groups table
      this.db.prepare('DELETE FROM match_groups').run();
      this.db.prepare(`
        WITH source_prices AS (
          SELECT match_group_id, source, MIN(price) as source_price
          FROM products
          GROUP BY match_group_id, source
        ),
        group_prices AS (
          SELECT
            match_group_id,
            MIN(source_price) as lowest_price,
            MAX(source_price) as highest_price,
            COUNT(*) as source_count
          FROM source_prices
          GROUP BY match_group_id
        )
        INSERT INTO match_groups (id, name, brand, model, category, subcategory, lowest_price, highest_price, has_multiple_sources, updated_at)
        SELECT
          p.match_group_id,
          -- 取組內最短（最乾淨）的名稱作為標題
          (SELECT p2.name FROM products p2 WHERE p2.match_group_id = p.match_group_id ORDER BY LENGTH(p2.name) ASC, p2.name ASC LIMIT 1) as name,
          MAX(p.brand) as brand,
          MAX(p.model) as model,
          MAX(p.category) as category,
          MAX(p.subcategory) as subcategory,
          gp.lowest_price,
          gp.highest_price,
          CASE WHEN gp.source_count > 1 THEN 1 ELSE 0 END as has_multiple_sources,
          MAX(p.updated_at) as updated_at
        FROM products p
        JOIN group_prices gp ON gp.match_group_id = p.match_group_id
        GROUP BY p.match_group_id
      `).run();
    });

    runUpdates();
    console.log(`[Matcher] Database updated with match group relations.`);
  }

  findAllGroups(filters: ProductFilters = {}): { groups: MatchGroup[]; total: number } {
    const conditions: string[] = ['1=1'];
    const params: Record<string, unknown> = {};

    if (filters.category) {
      conditions.push('category = @category');
      params.category = filters.category;
    }
    if (filters.subcategory) {
      conditions.push('subcategory = @subcategory');
      params.subcategory = filters.subcategory;
    }
    if (filters.brand) {
      conditions.push('brand = @brand');
      params.brand = filters.brand;
    }
    if (filters.priceMin !== undefined) {
      conditions.push('lowest_price >= @priceMin');
      params.priceMin = filters.priceMin;
    }
    if (filters.priceMax !== undefined) {
      conditions.push('lowest_price <= @priceMax');
      params.priceMax = filters.priceMax;
    }
    if (filters.query) {
      conditions.push('(name LIKE @query OR brand LIKE @query)');
      params.query = `%${filters.query}%`;
    }
    if (filters.source) {
      conditions.push('id IN (SELECT match_group_id FROM products WHERE source = @source)');
      params.source = filters.source;
    }
    if (filters.hasMultipleSources) {
      conditions.push('has_multiple_sources = 1');
    }

    const where = conditions.join(' AND ');

    const totalRow = this.db.prepare(
      `SELECT COUNT(*) as count FROM match_groups WHERE ${where}`
    ).get(params) as CountRow;
    const total = totalRow ? totalRow.count : 0;

    if (total === 0) {
      return { groups: [], total: 0 };
    }

    const sortMap: Record<string, string> = {
      price_asc: 'lowest_price ASC',
      price_desc: 'highest_price DESC',
      name: 'name ASC',
      // 預設「綜合排序」：跨店可比價的群組優先（避免最後爬取的 Autobuy 單店商品佔滿首頁），其次依最新更新
      updated: 'has_multiple_sources DESC, updated_at DESC',
    };
    const orderBy = sortMap[filters.sort ?? 'updated'] ?? 'has_multiple_sources DESC, updated_at DESC';

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const offset = (page - 1) * limit;

    const groupRows = this.db.prepare(`
      SELECT id, name, brand, model, lowest_price, highest_price
      FROM match_groups
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset }) as { id: string; name: string; brand: string | null; model: string | null; lowest_price: number; highest_price: number }[];

    const groupIds = groupRows.map(r => r.id);
    if (groupIds.length === 0) {
      return { groups: [], total };
    }

    const placeholders = groupIds.map((_, index) => `@id${index}`).join(', ');
    const queryParams: Record<string, unknown> = {};
    groupIds.forEach((id, index) => {
      queryParams[`id${index}`] = id;
    });

    const allGroupProducts = this.db.prepare(`
      SELECT * FROM products WHERE match_group_id IN (${placeholders})
    `).all(queryParams) as ProductRow[];

    const productsByGroup = new Map<string, Product[]>();
    for (const row of allGroupProducts) {
      const p = rowToProduct(row);
      const gid = row.match_group_id || `mg-${p.id}`;
      const list = productsByGroup.get(gid) ?? [];
      list.push(p);
      productsByGroup.set(gid, list);
    }

    const groups: MatchGroup[] = [];
    for (const row of groupRows) {
      const groupProducts = productsByGroup.get(row.id) ?? [];
      if (groupProducts.length === 0) continue;

      groups.push({
        id: row.id,
        name: row.name,
        brand: row.brand ?? undefined,
        model: row.model ?? undefined,
        products: groupProducts,
        lowestPrice: row.lowest_price,
        highestPrice: row.highest_price,
        priceDiff: row.highest_price - row.lowest_price,
      });
    }

    return { groups, total };
  }

  private buildSourceStatus(source: Source): SourceStatus {
    const countRow = this.db.prepare(
      'SELECT COUNT(*) as count FROM products WHERE source = ?'
    ).get(source) as CountRow;
    const productCount = countRow.count;

    const lastLog = this.db.prepare(
      'SELECT created_at, status, error_message FROM scrape_logs WHERE source = ? ORDER BY created_at DESC LIMIT 1'
    ).get(source) as ScrapeLogRow | undefined;

    const lastScrapedAt = lastLog?.created_at ?? null;
    const lastError = lastLog?.status === 'error' ? (lastLog.error_message ?? undefined) : undefined;

    // Stale if last scrape was more than 2 hours ago
    let status: 'healthy' | 'error' | 'stale' = 'healthy';
    if (!lastScrapedAt) {
      status = 'stale';
    } else if (lastLog?.status === 'error') {
      status = 'error';
    } else {
      // SQLite datetime('now') returns UTC without timezone suffix; append 'Z' to force UTC parsing
      const utcTimestamp = lastScrapedAt.includes('T') ? lastScrapedAt : lastScrapedAt.replace(' ', 'T') + 'Z';
      const age = Date.now() - new Date(utcTimestamp).getTime();
      if (age > 2 * 60 * 60 * 1000) status = 'stale';
    }

    return { source, lastScrapedAt, productCount, status, lastError };
  }
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    originalPrice: row.original_price ?? undefined,
    category: row.category as Product['category'],
    subcategory: row.subcategory ?? undefined,
    brand: row.brand ?? undefined,
    model: row.model ?? undefined,
    specs: JSON.parse(row.specs || '{}') as Record<string, string>,
    inStock: row.in_stock === 1,
    priceChange: (row.price_change as Product['priceChange']) ?? null,
    source: row.source as Product['source'],
    sourceUrl: row.source_url ?? '',
    rawName: row.raw_name,
    scrapedAt: row.scraped_at,
    matchGroupId: row.match_group_id ?? undefined,
  };
}
