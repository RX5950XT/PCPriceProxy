import type { Product, MatchGroup } from '../shared/types.js';
import { createHash } from 'crypto';

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
  similarityThreshold: number = 0.6,
): MatchGroup[] {
  const assigned = new Set<string>();
  const groups: MatchGroup[] = [];

  // Partition: products with brand+model vs. without
  const matchable = products.filter(p => p.brand && p.model);
  const remaining = products.filter(p => !p.brand || !p.model);

  // First pass: exact brand+model grouping
  const exactGroups = groupByBrandModel(matchable, assigned);
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

/** Group products by exact brand+model key, only when multiple sources exist */
function groupByBrandModel(
  products: readonly Product[],
  assigned: Set<string>,
): MatchGroup[] {
  const groups: MatchGroup[] = [];
  const byKey = new Map<string, Product[]>();

  for (const product of products) {
    const key = `${product.brand!.toUpperCase()}-${product.model!.toUpperCase()}`;
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

  for (let i = 0; i < tokenized.length; i++) {
    if (assigned.has(tokenized[i].product.id)) continue;

    const group: Product[] = [tokenized[i].product];
    assigned.add(tokenized[i].product.id);

    for (let j = i + 1; j < tokenized.length; j++) {
      if (assigned.has(tokenized[j].product.id)) continue;
      // Don't match products from the same source
      if (tokenized[i].product.source === tokenized[j].product.source) continue;
      // Must be same category
      if (tokenized[i].product.category !== tokenized[j].product.category) continue;

      const similarity = jaccardSimilarity(tokenized[i].tokens, tokenized[j].tokens);
      if (similarity >= threshold) {
        group.push(tokenized[j].product);
        assigned.add(tokenized[j].product.id);
      }
    }

    if (group.length > 1) {
      const key = group.map(p => p.id).join('-');
      groups.push(createMatchGroup(key, group));
    }
  }

  return groups;
}

/** Create a MatchGroup from a list of products */
function createMatchGroup(key: string, products: Product[]): MatchGroup {
  const prices = products.map(p => p.price);
  const id = createHash('md5').update(key).digest('hex').substring(0, 12);

  return {
    id: `match-${id}`,
    name: products[0].name,
    brand: products[0].brand,
    model: products[0].model,
    products,
    lowestPrice: Math.min(...prices),
    highestPrice: Math.max(...prices),
    priceDiff: Math.max(...prices) - Math.min(...prices),
  };
}
