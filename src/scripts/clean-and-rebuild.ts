import { getDatabase, closeDatabase } from '../storage/database.js';
import { ProductRepository } from '../storage/product-repository.js';
import { categorizeProduct } from '../processing/categorizer.js';
import type { Product } from '../shared/types.js';

async function main() {
  console.log('[Clean] Starting database clean and rebuild...');
  const db = getDatabase();
  const repo = new ProductRepository(db);

  // 1. 讀取所有商品
  const rows = db.prepare('SELECT id, name, price, original_price, category, subcategory, brand, model, specs, in_stock, price_change, source, source_url, raw_name, scraped_at FROM products').all() as any[];
  
  console.log(`[Clean] Found ${rows.length} products to clean.`);

  let updatedCount = 0;
  const updateStmt = db.prepare(`
    UPDATE products 
    SET category = ?, subcategory = ?, brand = ?
    WHERE id = ?
  `);

  // 2. 進行清洗
  const transaction = db.transaction((products: any[]) => {
    for (const row of products) {
      const product: Product = {
        id: row.id,
        name: row.name,
        price: row.price,
        originalPrice: row.original_price ?? undefined,
        category: row.category,
        subcategory: row.subcategory ?? undefined,
        brand: row.brand ?? undefined,
        model: row.model ?? undefined,
        specs: JSON.parse(row.specs || '{}'),
        inStock: row.in_stock === 1,
        priceChange: row.price_change ?? null,
        source: row.source,
        sourceUrl: row.source_url ?? '',
        rawName: row.raw_name,
        scrapedAt: row.scraped_at,
      };

      const cleaned = categorizeProduct(product);
      
      const brandChanged = cleaned.brand !== product.brand;
      const catChanged = cleaned.category !== product.category;
      const subcatChanged = cleaned.subcategory !== product.subcategory;

      if (catChanged || subcatChanged || brandChanged) {
        updateStmt.run(cleaned.category, cleaned.subcategory ?? null, cleaned.brand ?? null, product.id);
        updatedCount++;
      }
    }
  });

  transaction(rows);
  console.log(`[Clean] Categorization updated for ${updatedCount} products.`);

  // 3. 重建 MatchGroups
  console.log('[Clean] Rebuilding match groups...');
  repo.updateMatchGroups();

  console.log('[Clean] Rebuild completed successfully.');
  closeDatabase();
}

main().catch(err => {
  console.error('[Clean] Error cleaning database:', err);
  process.exit(1);
});
