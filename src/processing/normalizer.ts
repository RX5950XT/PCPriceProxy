import type { Product } from '../shared/types.js';
import { KNOWN_BRANDS } from '../shared/constants.js';

/**
 * Normalize product name: clean up promotional text, unify characters
 */
export function normalizeName(rawName: string): string {
  return rawName
    // Remove price patterns
    .replace(/\$[\d,]+/g, '')
    // Remove price change markers
    .replace(/[↘↗★☆●◆◇■□▲△▼▽]/g, '')
    // Remove promotional text
    .replace(/[【】\[\]（）()]/g, ' ')
    .replace(/熱賣|限量|促銷|特價|送.+?(?=\s|$)/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Full-width to half-width numbers
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .trim();
}

/**
 * Extract brand from product name.
 * Sorts by length desc so longer names match first (e.g. "Cooler Master" before "Cooler").
 */
export function extractBrand(name: string): string | undefined {
  const upperName = name.toUpperCase();
  const sortedBrands = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
  for (const brand of sortedBrands) {
    if (upperName.includes(brand.toUpperCase())) {
      return brand;
    }
  }
  return undefined;
}

/**
 * Extract model number from product name.
 * Covers Intel, AMD, NVIDIA, DDR, chipset patterns.
 */
export function extractModel(name: string): string | undefined {
  const patterns = [
    /\b(Core\s+i[3579]-\d{4,5}[A-Z]*)/i,
    /\b(Ryzen\s+[3579]\s+\d{4}X?3?D?)/i,
    /\b(RTX\s+\d{4}(?:\s+(?:Ti|SUPER))?)/i,
    /\b(RX\s+\d{4}(?:\s+XT)?)/i,
    /\b(Arc\s+[AB]\d{3,4})/i,
    /\b(DDR[45]-\d{4,5})/i,
    /\b([A-Z]\d{3}[A-Z]?\s+(?:AORUS|GAMING|TOMAHAWK|STRIX|TUF))/i,
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) return match[1].trim();
  }
  return undefined;
}

/**
 * Normalize a product: clean name, extract brand/model as fallback
 */
export function normalizeProduct(product: Product): Product {
  const cleanName = normalizeName(product.rawName);
  return {
    ...product,
    name: cleanName || product.name,
    brand: product.brand ?? extractBrand(cleanName),
    model: product.model ?? extractModel(cleanName),
  };
}
