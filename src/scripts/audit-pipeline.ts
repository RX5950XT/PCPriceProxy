import { getDatabase, closeDatabase } from '../storage/database.js';
import { isRealBundle } from '../processing/categorizer.js';
import { exactMatchKey } from '../processing/matcher.js';
import { ProductCategory } from '../shared/types.js';
import type { Product } from '../shared/types.js';

const db = getDatabase();

console.log('=== PCPriceProxy Pipeline Audit ===\n');

console.log('--- Source counts ---');
console.table(db.prepare('SELECT source, COUNT(*) as cnt FROM products GROUP BY source ORDER BY cnt DESC').all());

console.log('\n--- Category distribution (products) ---');
const categories = db.prepare(`
  SELECT category, COUNT(*) as cnt
  FROM products
  GROUP BY category
  ORDER BY cnt DESC
`).all() as { category: string; cnt: number }[];
console.table(categories);

const otherCnt = categories.find(r => r.category === ProductCategory.OTHER)?.cnt ?? 0;
console.log(`OTHER count: ${otherCnt} (target: 0)`);

console.log('\n--- Match group stats ---');
const mgStats = db.prepare(`
  SELECT
    COUNT(*) as total_groups,
    SUM(has_multiple_sources) as cross_store_groups,
    (SELECT COUNT(*) FROM products) as total_products
  FROM match_groups
`).get() as { total_groups: number; cross_store_groups: number; total_products: number };
console.log(mgStats);

console.log('\n--- Cross-store rate by category ---');
console.table(db.prepare(`
  SELECT category,
    SUM(has_multiple_sources) as cross_cnt,
    COUNT(*) as total,
    ROUND(100.0 * SUM(has_multiple_sources) / COUNT(*), 1) as cross_pct
  FROM match_groups
  GROUP BY category
  HAVING cross_cnt > 0
  ORDER BY cross_cnt DESC
  LIMIT 15
`).all());

console.log('\n--- Contamination checks ---');
const gpuBracket = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'gpu' AND (name LIKE '%支撐架%' OR name LIKE '%延長線%' OR name LIKE '%橋接%')
`).get() as { cnt: number };
const cpuCase = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'cpu' AND (name LIKE '%機殼%' OR name LIKE '%case%')
`).get() as { cnt: number };
const cpuMotherboard = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'cpu' AND (
    raw_name LIKE '%Z890%' OR raw_name LIKE '%W890%' OR raw_name LIKE '%Z790%' OR raw_name LIKE '%W790%' OR
    raw_name LIKE '%B860%' OR raw_name LIKE '%B760%' OR raw_name LIKE '%H810%' OR raw_name LIKE '%H610%' OR
    raw_name LIKE '%X870%' OR raw_name LIKE '%WRX90%' OR raw_name LIKE '%TRX50%' OR raw_name LIKE '%B850%' OR
    raw_name LIKE '%B840%' OR raw_name LIKE '%B650%' OR raw_name LIKE '%A620%' OR raw_name LIKE '%B550%' OR
    raw_name LIKE '%A520%'
  )
`).get() as { cnt: number };
const monitorPollution = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'monitor' AND (
    raw_name LIKE '%投影機%' OR raw_name LIKE '%螢幕掛燈%' OR raw_name LIKE '%螢幕架%' OR
    raw_name LIKE '%升降桌%' OR raw_name LIKE '%水冷%' OR raw_name LIKE '%電源供應%' OR
    raw_name LIKE '%鍵盤%'
  )
`).get() as { cnt: number };
const gpuBundleResidue = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'gpu' AND (
    raw_name LIKE '%【AI TOP%/%RTX%' OR raw_name LIKE '%【AI TOP%/%RX%' OR
    raw_name LIKE '%】+%RTX%' OR raw_name LIKE '%】+%RX%'
  )
`).get() as { cnt: number };
const gpuSystemResidue = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'gpu' AND (
    raw_name LIKE '%欣亞PC%' OR raw_name LIKE '%品牌電腦%' OR raw_name LIKE '%電競電腦%' OR
    raw_name LIKE '%套裝電腦%' OR raw_name LIKE '%Windows 11 Home%' OR raw_name LIKE '%/Win11/%' OR
    raw_name LIKE '%ZEUS 15G%/%RTX%'
  )
`).get() as { cnt: number };
const gpuModelCollision = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'gpu' AND (
    ((raw_name LIKE '%RX9070%' OR raw_name LIKE '%RX 9070%') AND subcategory NOT LIKE 'AMD RX 9000系列%') OR
    (raw_name LIKE '%RTX PRO 6000%' AND subcategory NOT LIKE 'NVIDIA 專業繪圖卡%')
  )
`).get() as { cnt: number };
const legacyCpuGeneration = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'cpu' AND (
    subcategory LIKE '%第 1 代%' OR subcategory LIKE '%第 2 代%' OR
    subcategory LIKE '%第 3 代%' OR subcategory LIKE '%第 4 代%' OR
    subcategory LIKE '%第 5 代%' OR subcategory LIKE '%第 6 代%' OR
    subcategory LIKE '%第 7 代%' OR subcategory LIKE '%第 8 代%' OR
    subcategory LIKE '%第 9 代%'
  )
`).get() as { cnt: number };
const psuPortablePollution = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'psu' AND (
    raw_name LIKE '%行動電源%' OR raw_name LIKE '%mAh%' OR raw_name LIKE '%快充%' OR
    raw_name LIKE '%GaN%' OR raw_name LIKE '%音響%' OR raw_name LIKE '%喇叭%'
  )
`).get() as { cnt: number };
const caseAccessoryPollution = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'case' AND (
    raw_name LIKE '%TRAVEL CASE%' OR raw_name LIKE '%ALLY%' OR raw_name LIKE '%掌機%' OR
    raw_name LIKE '%收納%' OR raw_name LIKE '%保護包%' OR raw_name LIKE '%保護套%'
  )
`).get() as { cnt: number };
const ssdHddPollution = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'ssd' AND (
    raw_name LIKE '%外接硬碟%' OR raw_name LIKE '%行動硬碟%' OR raw_name LIKE '%My Book%' OR
    raw_name LIKE '%Expansion Desktop%' OR raw_name LIKE '%新黑鑽%' OR raw_name LIKE '%雙硬碟%'
  )
`).get() as { cnt: number };
const systemResidue = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category IN ('ssd', 'cooler') AND (
    raw_name LIKE '%ASUS Ascent GX10%' OR raw_name LIKE '%GB10%' OR raw_name LIKE '%DGX Spark%' OR
    raw_name LIKE '%GM700TZ%' OR raw_name LIKE '%AI TOP ATOM%'
  )
`).get() as { cnt: number };
const speakerMonitorPollution = db.prepare(`
  SELECT COUNT(*) as cnt FROM products
  WHERE category = 'speaker' AND (
    raw_name LIKE '%螢幕%' OR raw_name LIKE '%顯示器%' OR raw_name LIKE '%含喇叭%HDR%' OR
    raw_name LIKE '%含喇叭%HDMI%' OR raw_name LIKE '%含喇叭%VA%' OR raw_name LIKE '%Smart M7%'
  )
`).get() as { cnt: number };
const cpuExactSingletons = db.prepare(`
  SELECT COUNT(*) as cnt
  FROM products p
  WHERE p.category = 'cpu'
    AND p.model IS NOT NULL
    AND p.model != ''
    AND p.match_group_id LIKE 'mg-%'
    AND json_extract(p.specs, '$.priceCondition') IS NULL
    AND EXISTS (
      SELECT 1
      FROM products q
      WHERE q.category = p.category
        AND COALESCE(q.brand, '') = COALESCE(p.brand, '')
        AND q.model = p.model
        AND q.source != p.source
        AND json_extract(q.specs, '$.priceCondition') IS NULL
    )
`).get() as { cnt: number };
const exactDuplicateSplits = countExactDuplicateSplits();
console.log(`GPU brackets/cables in gpu: ${gpuBracket.cnt} (target: 0)`);
console.log(`Cases in cpu: ${cpuCase.cnt} (target: 0)`);
console.log(`Motherboards in cpu: ${cpuMotherboard.cnt} (target: 0)`);
console.log(`Monitor non-monitor pollution: ${monitorPollution.cnt} (target: 0)`);
console.log(`GPU bundle residue: ${gpuBundleResidue.cnt} (target: 0)`);
console.log(`GPU system residue: ${gpuSystemResidue.cnt} (target: 0)`);
console.log(`GPU model collision: ${gpuModelCollision.cnt} (target: 0)`);
console.log(`Legacy CPU generation nodes: ${legacyCpuGeneration.cnt} (target: 0)`);
console.log(`Portable power/audio in psu: ${psuPortablePollution.cnt} (target: 0)`);
console.log(`Accessories in case: ${caseAccessoryPollution.cnt} (target: 0)`);
console.log(`External HDD in ssd: ${ssdHddPollution.cnt} (target: 0)`);
console.log(`Complete systems in ssd/cooler: ${systemResidue.cnt} (target: 0)`);
console.log(`Monitors in speaker: ${speakerMonitorPollution.cnt} (target: 0)`);
console.log(`CPU exact duplicate singletons: ${cpuExactSingletons.cnt} (target: 0)`);
console.log(`Exact duplicate split keys: ${exactDuplicateSplits} (target: 0)`);

console.log('\n--- Package single-item residue ---');
const packageRows = db.prepare(`
  SELECT raw_name FROM products WHERE category = 'package'
`).all() as { raw_name: string }[];
const packageFalsePos = packageRows.filter(r => !isRealBundle(r.raw_name)).length;
console.log(`Non-bundle in PACKAGE: ${packageFalsePos} (target: 0)`);

console.log('\n--- Cross-store price anomalies (>1.8x) ---');
const priceAnomaly = db.prepare(`
  SELECT COUNT(*) as cnt FROM match_groups
  WHERE has_multiple_sources = 1 AND lowest_price > 0 AND highest_price > lowest_price * 1.8
`).get() as { cnt: number };
console.log(`Anomalous groups: ${priceAnomaly.cnt} (target: 0)`);

if (priceAnomaly.cnt > 0) {
  console.table(db.prepare(`
    SELECT name, category, lowest_price, highest_price
    FROM match_groups
    WHERE has_multiple_sources = 1 AND lowest_price > 0 AND highest_price > lowest_price * 1.8
    LIMIT 5
  `).all());
}

console.log('\n--- Latest scrape logs ---');
console.table(db.prepare(`
  SELECT source, status, items_count, duration_ms, created_at
  FROM scrape_logs
  ORDER BY created_at DESC
  LIMIT 6
`).all());

console.log('\n--- Pass / Fail summary ---');
const checks = [
  { name: 'OTHER = 0', pass: otherCnt === 0 },
  { name: 'GPU contamination = 0', pass: gpuBracket.cnt === 0 },
  { name: 'CPU contamination = 0', pass: cpuCase.cnt === 0 },
  { name: 'CPU motherboard leakage = 0', pass: cpuMotherboard.cnt === 0 },
  { name: 'Monitor pollution = 0', pass: monitorPollution.cnt === 0 },
  { name: 'GPU bundle residue = 0', pass: gpuBundleResidue.cnt === 0 },
  { name: 'GPU system residue = 0', pass: gpuSystemResidue.cnt === 0 },
  { name: 'GPU model collision = 0', pass: gpuModelCollision.cnt === 0 },
  { name: 'Legacy CPU generation nodes = 0', pass: legacyCpuGeneration.cnt === 0 },
  { name: 'PSU portable/audio pollution = 0', pass: psuPortablePollution.cnt === 0 },
  { name: 'CASE accessory pollution = 0', pass: caseAccessoryPollution.cnt === 0 },
  { name: 'SSD external-HDD pollution = 0', pass: ssdHddPollution.cnt === 0 },
  { name: 'System residue in SSD/COOLER = 0', pass: systemResidue.cnt === 0 },
  { name: 'Speaker monitor pollution = 0', pass: speakerMonitorPollution.cnt === 0 },
  { name: 'CPU exact duplicate singletons = 0', pass: cpuExactSingletons.cnt === 0 },
  { name: 'Exact duplicate split keys = 0', pass: exactDuplicateSplits === 0 },
  { name: 'Package false positive = 0', pass: packageFalsePos === 0 },
  { name: 'Price anomalies = 0', pass: priceAnomaly.cnt === 0 },
];
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}: ${c.name}`);
}

const allPass = checks.every(c => c.pass);
closeDatabase();
process.exit(allPass ? 0 : 1);

function countExactDuplicateSplits(): number {
  const rows = db.prepare(`
    SELECT id, name, price, category, subcategory, brand, model, specs, in_stock, price_change, source, source_url, raw_name, scraped_at, match_group_id
    FROM products
  `).all() as Array<Record<string, unknown>>;
  const byKey = new Map<string, Product[]>();

  for (const row of rows) {
    const product = rowToProduct(row);
    if (product.specs.priceCondition) continue;
    const key = exactMatchKey(product);
    if (!key) continue;
    const group = byKey.get(key) ?? [];
    group.push(product);
    byKey.set(key, group);
  }

  let splitCount = 0;
  for (const products of byKey.values()) {
    const sources = new Set(products.map(p => p.source));
    if (sources.size <= 1) continue;
    const groups = new Set(products.map(p => p.matchGroupId ?? `mg-${p.id}`));
    if (groups.size > 1) splitCount++;
  }
  return splitCount;
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    price: Number(row.price),
    category: row.category as ProductCategory,
    subcategory: row.subcategory ? String(row.subcategory) : undefined,
    brand: row.brand ? String(row.brand) : undefined,
    model: row.model ? String(row.model) : undefined,
    specs: parseSpecs(String(row.specs ?? '{}')),
    inStock: Boolean(row.in_stock),
    priceChange: row.price_change as Product['priceChange'],
    source: row.source as Product['source'],
    sourceUrl: String(row.source_url),
    rawName: String(row.raw_name),
    scrapedAt: String(row.scraped_at),
    matchGroupId: row.match_group_id ? String(row.match_group_id) : undefined,
  };
}

function parseSpecs(value: string): Readonly<Record<string, string>> {
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
