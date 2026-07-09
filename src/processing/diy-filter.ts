import type { Product } from '../shared/types.js';
import { ProductCategory } from '../shared/types.js';
import { DIY_CATEGORIES } from '../shared/constants.js';
import { isRealBundle } from './categorizer.js';

/**
 * 是否為比價站應保留的 DIY 商品。
 * PACKAGE 須為真組合/整機，或是被移出零件分類的條件價單品（搭板價 / 限組裝 / 加購價）。
 */
export function isDiyProduct(product: Product): boolean {
  if (!DIY_CATEGORIES.includes(product.category)) return false;
  if (product.category === ProductCategory.PACKAGE) {
    return isRealBundle(product.rawName) || Boolean(product.specs?.priceCondition);
  }
  return true;
}
