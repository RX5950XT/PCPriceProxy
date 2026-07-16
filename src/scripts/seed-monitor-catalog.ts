/**
 * 列出 resolution=未標示 的螢幕 modelKey 頻率，方便擴充 monitor-catalog.json。
 * 用法：npx tsx src/scripts/seed-monitor-catalog.ts
 */
import Database from 'better-sqlite3';
import { extractMonitorModelKey } from '../enrichment/monitor-model-key.js';
import { loadMonitorCatalog } from '../enrichment/monitor-specs.js';

const db = new Database('data/pcprice.db', { readonly: true });
const rows = db
  .prepare(
    `SELECT raw_name, brand, json_extract(specs, '$.resolution') AS res
     FROM products WHERE category = 'monitor'
       AND json_extract(specs, '$.resolution') = '未標示'`,
  )
  .all() as Array<{ raw_name: string; brand: string | null; res: string }>;

const catalog = loadMonitorCatalog();
const counts = new Map<string, { n: number; sample: string; brand: string | null; inCatalog: boolean }>();

for (const r of rows) {
  const key = extractMonitorModelKey(r.raw_name) ?? '(no-key)';
  const cur = counts.get(key);
  if (cur) cur.n += 1;
  else {
    counts.set(key, {
      n: 1,
      sample: (r.raw_name ?? '').slice(0, 90),
      brand: r.brand,
      inCatalog: key !== '(no-key)' && key in catalog,
    });
  }
}

const sorted = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`resolution 未標示: ${rows.length} 筆, distinct keys: ${sorted.length}`);
console.log('key\tcount\tinCatalog\tbrand\tsample');
for (const [key, v] of sorted.slice(0, 80)) {
  console.log(`${key}\t${v.n}\t${v.inCatalog}\t${v.brand ?? ''}\t${v.sample}`);
}

const wouldHit = sorted.filter(([k, v]) => k !== '(no-key)' && k in catalog).reduce((s, [, v]) => s + v.n, 0);
console.log(`\n若 catalog 套用後可回收（依 key 估）: ${wouldHit} 筆（注意 L0 可能已先填）`);
