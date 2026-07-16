/**
 * 螢幕 specs 分層：L0 品名規則結果 + L1 本地 catalog 合併。
 * 品名已抽出的欄位（非「未標示」）不可被 catalog 覆寫。
 */

import { createRequire } from 'node:module';
import { extractMonitorModelKey } from './monitor-model-key.js';

const require = createRequire(import.meta.url);

export type MonitorFacetField = 'panel' | 'refreshTier' | 'resolution';

export interface MonitorCatalogEntry {
  readonly panel?: string;
  readonly refreshTier?: string;
  readonly resolution?: string;
  readonly inch?: number;
  readonly confidence?: number;
  readonly note?: string;
}

export type MonitorCatalog = Readonly<Record<string, MonitorCatalogEntry>>;

const UNTAGGED = '未標示';
const MIN_CONFIDENCE = 0.8;

let catalogCache: MonitorCatalog | null = null;

export function loadMonitorCatalog(): MonitorCatalog {
  if (catalogCache) return catalogCache;
  try {
    catalogCache = require('./monitor-catalog.json') as MonitorCatalog;
  } catch {
    catalogCache = {};
  }
  return catalogCache;
}

/** 測試用：注入 catalog */
export function setMonitorCatalogForTest(catalog: MonitorCatalog | null): void {
  catalogCache = catalog;
}

/**
 * 查找 catalog：exact → 去尾綴色碼 W → 最長前綴（≥6）命中。
 * 例：vg27aql5aw → vg27aql5a；xg27acsw → xg27acs。
 */
export function lookupMonitorCatalog(modelKey: string | null): MonitorCatalogEntry | null {
  if (!modelKey) return null;
  const cat = loadMonitorCatalog();

  const pick = (key: string): MonitorCatalogEntry | null => {
    const entry = cat[key];
    if (!entry) return null;
    if (entry.confidence != null && entry.confidence < MIN_CONFIDENCE) return null;
    return entry;
  };

  const exact = pick(modelKey);
  if (exact) return exact;

  // 去尾綴白/W（品名白色版）
  const stripped = modelKey
    .replace(/-?w(hite)?$/i, '')
    .replace(/w$/, '');
  if (stripped !== modelKey) {
    const s = pick(stripped);
    if (s) return s;
  }

  // 最長 catalog key 為 modelKey 前綴（SKU 後綴變體）
  let bestKey: string | null = null;
  for (const k of Object.keys(cat)) {
    if (k.length < 6) continue;
    if (!modelKey.startsWith(k)) continue;
    if (!bestKey || k.length > bestKey.length) bestKey = k;
  }
  if (bestKey) return pick(bestKey);

  // modelKey 為 catalog key 前綴（catalog 較長、抽取較短）
  bestKey = null;
  for (const k of Object.keys(cat)) {
    if (modelKey.length < 6 || !k.startsWith(modelKey)) continue;
    if (!bestKey || k.length < bestKey.length) bestKey = k; // 最短延伸，較保守
  }
  return bestKey ? pick(bestKey) : null;
}

/**
 * 合併：fromName 優先；catalog 只填「未標示」或缺省。
 */
export function mergeMonitorSpecs(
  fromName: Record<string, string>,
  fromCatalog: MonitorCatalogEntry | null,
): Record<string, string> {
  if (!fromCatalog) return { ...fromName };

  const out = { ...fromName };
  const fields: MonitorFacetField[] = ['panel', 'refreshTier', 'resolution'];
  for (const field of fields) {
    const catVal = fromCatalog[field];
    if (!catVal || catVal === UNTAGGED) continue;
    const cur = out[field];
    if (!cur || cur === UNTAGGED) out[field] = catVal;
  }
  return out;
}

/** L0 結果 + model key catalog → 最終 facet 三欄 */
export function enrichMonitorSpecFields(rawName: string, fromName: Record<string, string>): Record<string, string> {
  const key = extractMonitorModelKey(rawName);
  return mergeMonitorSpecs(fromName, lookupMonitorCatalog(key));
}
