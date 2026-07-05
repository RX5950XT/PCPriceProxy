import { getDatabase, closeDatabase } from '../storage/database.js';
import { ProductRepository } from '../storage/product-repository.js';
import { categorizeProduct } from '../processing/categorizer.js';
import { normalizeProduct } from '../processing/normalizer.js';
import { MIN_VALID_PRICE } from '../shared/constants.js';
import type { Product } from '../shared/types.js';

async function main() {
  console.log('[Clean] Starting database clean and rebuild...');
  const db = getDatabase();
  const repo = new ProductRepository(db);

  // 0. 清除 $1 促銷假項等低於最低有效價的商品
  const junk = db.prepare('DELETE FROM products WHERE price < ?').run(MIN_VALID_PRICE);
  if (junk.changes > 0) console.log(`[Clean] Removed ${junk.changes} sub-$${MIN_VALID_PRICE} junk entries.`);

  // 1. 讀取所有商品
  const rows = db.prepare('SELECT id, name, price, original_price, category, subcategory, brand, model, specs, in_stock, price_change, source, source_url, raw_name, scraped_at FROM products').all() as any[];

  console.log(`[Clean] Found ${rows.length} products to clean.`);

  let updatedCount = 0;
  const updateStmt = db.prepare(`
    UPDATE products
    SET name = ?, category = ?, subcategory = ?, brand = ?, model = ?, specs = ?
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

      // 完整重跑管線：normalize（清理名稱、抽 brand/model）→ categorize（分類/子分類）
      const cleaned = categorizeProduct(normalizeProduct(product));

      const cleanedSpecs = JSON.stringify(cleaned.specs);
      const changed =
        cleaned.name !== product.name ||
        cleaned.brand !== product.brand ||
        cleaned.model !== product.model ||
        cleaned.category !== product.category ||
        cleaned.subcategory !== product.subcategory ||
        cleanedSpecs !== (row.specs || '{}');

      if (changed) {
        updateStmt.run(
          cleaned.name,
          cleaned.category,
          cleaned.subcategory ?? null,
          cleaned.brand ?? null,
          cleaned.model ?? null,
          cleanedSpecs,
          product.id,
        );
        updatedCount++;
      }
    }
  });

  transaction(rows);
  console.log(`[Clean] Categorization updated for ${updatedCount} products.`);

  // 2b. 刪除非 DIY 雜訊（categorizeProduct 已對 OTHER 嘗試回流，其餘直接清除）
  const nonDiy = repo.deleteNonDiyProducts();
  if (nonDiy > 0) console.log(`[Clean] Removed ${nonDiy} non-DIY products.`);

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
