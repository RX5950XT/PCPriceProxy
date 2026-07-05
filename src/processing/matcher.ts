import type { Product, MatchGroup } from '../shared/types.js';
import { ProductCategory } from '../shared/types.js';
import { BRAND_ALIASES } from '../shared/constants.js';
import { gpuMatchKey } from './categorizer.js';
import { createHash } from 'crypto';

/**
 * 產生「精確跨店比對鍵」——僅在能唯一識別同一 SKU 時回傳：
 * - CPU：品牌 + 型號（型號即唯一產品）。
 * - GPU：品牌 + 晶片/產品線/VRAM（避免同晶片不同 SKU 被誤併）。
 * - 其他非 PACKAGE 分類：分類 + 品牌 + 顯示名（normalizer 已保留顏色/軸體等 SKU 變體）。
 * 無法安全識別者回傳 undefined，交由模糊比對處理（寧可少併、不可誤併藏商品）。
 */
export function exactMatchKey(p: Product): string | undefined {
  if (p.category === ProductCategory.CPU && p.model) {
    if (!p.brand) return undefined;
    return `CPU-${p.brand}-${p.model}`.toUpperCase().replace(/\s+/g, '');
  }
  if (p.category === ProductCategory.GPU) {
    if (!p.brand) return undefined;
    const sku = gpuMatchKey(p.name);
    if (sku) return `GPU-${p.brand}-${sku}`.toUpperCase().replace(/\s+/g, '');
    return undefined;
  }
  if (p.category === ProductCategory.PACKAGE || !p.name || p.name.length < 8) return undefined;
  return `NAME-${p.category}-${p.brand ?? ''}-${exactNameIdentity(p.name, p.brand, p.category)}`.toUpperCase().replace(/\s+/g, '');
}

function exactNameIdentity(name: string, brand: string | undefined, category: ProductCategory): string {
  let out = name.toUpperCase();
  for (const needle of brandNeedles(brand)) {
    out = out.replace(new RegExp(escapeRegExp(needle), 'gi'), ' ');
  }
  if (canUseImplicitBlackVariant(category)) {
    out = out.replace(/黑色|BLACK/gi, ' ');
  }
  if (category === ProductCategory.NETWORK) {
    out = out.replace(/USB\s*藍牙\s*接收器/gi, 'USB 接收器');
  }
  if (category === ProductCategory.HEADSET) {
    out = out.replace(/藍牙/gi, ' ');
  }
  if ([ProductCategory.SSD, ProductCategory.HDD, ProductCategory.RAM].includes(category)) {
    out = out.replace(/(\d+(?:\.\d+)?)\s*GB\b/gi, '$1G');
  }
  return out.replace(/[^A-Z0-9\u4e00-\u9fff]+/g, '');
}

function canUseImplicitBlackVariant(category: ProductCategory): boolean {
  return [
    ProductCategory.KEYBOARD,
    ProductCategory.MOUSE,
    ProductCategory.COOLER,
    ProductCategory.FAN,
    ProductCategory.HEADSET,
    ProductCategory.SPEAKER,
    ProductCategory.CASE,
  ].includes(category);
}

function brandNeedles(brand: string | undefined): string[] {
  if (!brand) return [];
  const upperBrand = brand.toUpperCase();
  const needles = new Set<string>([upperBrand]);
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
    if (canonical.toUpperCase() === upperBrand) needles.add(alias.toUpperCase());
  }
  return [...needles].sort((a, b) => b.length - a.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tokenize a product name for comparison.
 * Keeps alphanumeric and CJK characters, removes everything else.
 */
function tokenize(name: string): string[] {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\u4e00-\u9fff\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Calculate Jaccard similarity between two token arrays.
 * Returns 0-1 where 1 means identical token sets.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Match products across sources into groups.
 * Uses exact brand+model matching first, then fuzzy token matching as fallback.
 * Returns groups sorted by price difference (highest first).
 */
export function matchProducts(
  products: readonly Product[],
  similarityThreshold: number = 0.7,
): MatchGroup[] {
  const assigned = new Set<string>();
  const groups: MatchGroup[] = [];

  // 帶條件價的單品（搭板/限組裝…）價格偏低，排除在跨店比價外（留作單例），避免污染最低價卡片
  const comparable = products.filter(p => !p.specs?.priceCondition);

  // Partition: 有精確比對鍵者走精確合併，其餘走模糊比對
  const matchable = comparable.filter(p => exactMatchKey(p) !== undefined);
  const remaining = comparable.filter(p => exactMatchKey(p) === undefined);

  // First pass: 以精確 SKU 鍵合併（跨店同一 SKU）
  const exactGroups = groupByKey(matchable, assigned);
  groups.push(...exactGroups);

  // Second pass: fuzzy matching for unmatched products
  const unmatched = [
    ...matchable.filter(p => !assigned.has(p.id)),
    ...remaining,
  ];
  const fuzzyGroups = fuzzyMatch(unmatched, assigned, similarityThreshold);
  groups.push(...fuzzyGroups);

  return groups.sort((a, b) => b.priceDiff - a.priceDiff);
}

/** 以精確比對鍵分組，僅在跨越多個通路時才成組 */
function groupByKey(
  products: readonly Product[],
  assigned: Set<string>,
): MatchGroup[] {
  const groups: MatchGroup[] = [];
  const byKey = new Map<string, Product[]>();

  for (const product of products) {
    const key = exactMatchKey(product)!;
    const group = byKey.get(key) ?? [];
    group.push(product);
    byKey.set(key, group);
  }

  for (const [key, groupProducts] of byKey) {
    const sources = new Set(groupProducts.map(p => p.source));
    if (sources.size <= 1) continue;

    groups.push(createMatchGroup(key, groupProducts));
    groupProducts.forEach(p => assigned.add(p.id));
  }

  return groups;
}

/** Fuzzy match unmatched products using Jaccard token similarity */
function fuzzyMatch(
  products: readonly Product[],
  assigned: Set<string>,
  threshold: number,
): MatchGroup[] {
  const groups: MatchGroup[] = [];
  const tokenized = products.map(p => ({
    product: p,
    tokens: tokenize(p.name),
  }));

  // 跨店同一商品的價格很少差超過此倍率；超過視為不同 SKU（如單顆 vs 三入、16G vs 32G），不合併
  const MAX_PRICE_RATIO = 1.6;

  for (let i = 0; i < tokenized.length; i++) {
    if (assigned.has(tokenized[i].product.id)) continue;

    const group: Product[] = [tokenized[i].product];
    assigned.add(tokenized[i].product.id);
    // 一組＝同一商品的跨店比價，每個通路最多收 1 件，避免同店不同 SKU 被誤併（造成商品被藏起來）
    const groupSources = new Set<string>([tokenized[i].product.source]);
    let groupMin = tokenized[i].product.price;
    let groupMax = tokenized[i].product.price;

    for (let j = i + 1; j < tokenized.length; j++) {
      if (assigned.has(tokenized[j].product.id)) continue;
      // Must be same category
      if (tokenized[i].product.category !== tokenized[j].product.category) continue;
      // 該通路已在組內就跳過（含同來源；確保一組每店至多一件）
      if (groupSources.has(tokenized[j].product.source)) continue;
      // 顏色 / 鍵盤軸體不同就是不同 SKU，即使其他 token 高度相似也不可合併
      if (variantConflict(tokenized[i].product, tokenized[j].product)) continue;
      // 價格合理性護欄：價差過大者視為不同商品，不併
      const price = tokenized[j].product.price;
      const newMin = Math.min(groupMin, price);
      const newMax = Math.max(groupMax, price);
      if (newMin > 0 && newMax / newMin > MAX_PRICE_RATIO) continue;

      const similarity = jaccardSimilarity(tokenized[i].tokens, tokenized[j].tokens);
      if (similarity >= threshold) {
        group.push(tokenized[j].product);
        assigned.add(tokenized[j].product.id);
        groupSources.add(tokenized[j].product.source);
        groupMin = newMin;
        groupMax = newMax;
      }
    }

    if (group.length > 1) {
      const key = group.map(p => p.id).join('-');
      groups.push(createMatchGroup(key, group));
    }
  }

  return groups;
}

const COLOR_SENSITIVE_CATEGORIES = new Set<ProductCategory>([
  ProductCategory.GPU,
  ProductCategory.KEYBOARD,
  ProductCategory.MOUSE,
  ProductCategory.COOLER,
  ProductCategory.CASE,
  ProductCategory.FAN,
  ProductCategory.HEADSET,
  ProductCategory.SPEAKER,
  ProductCategory.MONITOR,
]);

function variantConflict(a: Product, b: Product): boolean {
  if (a.category !== b.category) return false;
  if (COLOR_SENSITIVE_CATEGORIES.has(a.category)) {
    const ca = colorVariant(a.name);
    const cb = colorVariant(b.name);
    if (ca && cb && ca !== cb) return true;
  }
  if (a.category === ProductCategory.KEYBOARD) {
    const sa = keyboardSwitch(a.name);
    const sb = keyboardSwitch(b.name);
    if (sa && sb && sa !== sb) return true;
  }
  return false;
}

function colorVariant(name: string): string | null {
  if (/電光藍/i.test(name)) return 'blue-electric';
  if (/桃紅|桃色|粉紅|粉色|PINK/i.test(name)) return 'pink';
  if (/石墨黑|黑色|BLACK/i.test(name)) return 'black';
  if (/雪霧白|星光白|白色|WHITE/i.test(name)) return 'white';
  if (/藍色|BLUE/i.test(name)) return 'blue';
  if (/紅色|RED/i.test(name)) return 'red';
  if (/綠色|GREEN/i.test(name)) return 'green';
  if (/黃色|YELLOW/i.test(name)) return 'yellow';
  if (/紫色|PURPLE/i.test(name)) return 'purple';
  if (/灰色|GRAY|GREY/i.test(name)) return 'gray';
  if (/銀色|SILVER/i.test(name)) return 'silver';
  return null;
}

function keyboardSwitch(name: string): string | null {
  const match = name.match(/靜音紅軸|靜音茶軸|矮紅軸|矮茶軸|紅軸|茶軸|青軸|銀軸|黑軸|白軸|黃軸|綠軸|紫軸/i);
  return match?.[0]?.toUpperCase() ?? null;
}

/** Create a MatchGroup from a list of products */
function createMatchGroup(key: string, products: Product[]): MatchGroup {
  const prices = products.map(p => p.price);
  const id = createHash('md5').update(key).digest('hex').substring(0, 12);
  // 取最短（最乾淨）的名稱作為群組標題
  const rep = products.reduce((a, b) => (b.name.length < a.name.length ? b : a), products[0]);

  return {
    id: `match-${id}`,
    name: rep.name,
    brand: rep.brand,
    model: rep.model,
    products,
    lowestPrice: Math.min(...prices),
    highestPrice: Math.max(...prices),
    priceDiff: Math.max(...prices) - Math.min(...prices),
  };
}
