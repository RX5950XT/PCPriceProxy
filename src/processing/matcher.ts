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
  // HDD：三家顯示名格式差異過大（coolpc 截到只剩「品牌+容量」）。三家內接碟品名皆附原廠料號
  // （ST8000DM004 / WD20EZBX / HDWD320UZSVA），料號全球唯一、最優先；缺料號才退規格鍵
  // （品牌+系列+容量+轉速——注意規格鍵無法分 SATA/SAS 介面差異，料號可以）。
  if (p.category === ProductCategory.HDD) {
    const mpn = hddMpn(p.rawName);
    if (mpn) return `HDD-MPN-${mpn}`;
    const spec = hddSpecKey(p);
    if (spec) return spec;
  }
  if (p.category === ProductCategory.PACKAGE || !p.name || p.name.length < 8) return undefined;
  const extras = p.category === ProductCategory.RAM ? ramKeyExtras(p.rawName) : '';
  return `NAME-${p.category}-${p.brand ?? ''}-${exactNameIdentity(p.name, p.brand, p.category)}${extras}`.toUpperCase().replace(/\s+/g, '');
}

// RAM 產品線（同品牌同規格的不同線材價差大：ValueRAM vs FURY Beast）；中文別名正規化，長者排前
const RAM_LINES: ReadonlyArray<readonly [RegExp, string]> = [
  [/FURY\s*BEAST|獸獵者/i, 'FURYBEAST'],
  [/FURY\s*RENEGADE|RENEGADE|叛徒/i, 'RENEGADE'],
  [/FURY\s*IMPACT|IMPACT/i, 'IMPACT'],
  [/TRIDENT\s*Z5|幻鋒戟/i, 'TRIDENTZ5'],
  [/TRIDENT|三叉戟/i, 'TRIDENT'],
  [/RIPJAWS|焰刃/i, 'RIPJAWS'],
  [/VENGEANCE|復仇者/i, 'VENGEANCE'],
  [/DOMINATOR|統治者/i, 'DOMINATOR'],
  [/T-?CREATE\s*EXPERT/i, 'TCREATEEXPERT'],
  [/DELTA/i, 'DELTA'],
  [/VULCAN|火神/i, 'VULCAN'],
  [/LANCER\s*BLADE/i, 'LANCERBLADE'],
  [/LANCER/i, 'LANCER'],
  [/CLASSIC/i, 'CLASSIC'],
  [/CRUCIAL\s*PRO|美光PRO/i, 'CRUCIALPRO'],
];

/**
 * RAM 額外判別鍵：產品線 + 雙條套件。這些資訊常在括號內被 normalizeName 剝除
 * （KVR32N22D8 vs KF432C16BB、「雙通16GB*2」），導致不同 SKU 顯示名相同，須從 raw_name 補回。
 */
function ramKeyExtras(rawName: string): string {
  const line = RAM_LINES.find(([re]) => re.test(rawName))?.[1] ?? '';
  const kit = /(\d+)\s*GB?\s*[*X×]\s*2|雙通/i.test(rawName) ? 'KIT2' : '';
  return `-${line}-${kit}`;
}

// 原廠料號（MPN）樣式：Seagate ST8000DM004 / WD WD20EZBX / Toshiba HDWD320UZSVA
const HDD_MPN_RE = /\b(ST\d{4,5}[A-Z]{2}\d{3}[A-Z0-9]{0,3}|WD\d{2,4}[A-Z]{4,5}|HDW[A-Z]{1,2}\d{2,4}[A-Z]{2,6})\b/;

export function hddMpn(rawName: string): string | undefined {
  const m = rawName.toUpperCase().match(HDD_MPN_RE);
  return m ? m[1] : undefined;
}

// HDD 系列名中英正規化（新梭魚=BarraCuda、藍標=WD Blue、P300…）；長/具體者排前
const HDD_SERIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/IRONWOLF\s*PRO|那嘶狼\s*PRO/i, 'IRONWOLFPRO'],
  [/IRONWOLF|那嘶狼/i, 'IRONWOLF'],
  [/FIRECUDA|金梭魚/i, 'FIRECUDA'],
  [/BARRACUDA|梭魚/i, 'BARRACUDA'],
  [/SKYHAWK\s*AI|監控鷹\s*AI/i, 'SKYHAWKAI'],
  [/SKYHAWK|監控鷹/i, 'SKYHAWK'],
  [/EXOS/i, 'EXOS'],
  [/紅標\s*PLUS|RED\s*PLUS/i, 'REDPLUS'],
  [/紅標\s*PRO|RED\s*PRO/i, 'REDPRO'],
  [/紅標|WD\s*RED/i, 'RED'],
  [/紫標\s*PRO|PURPLE\s*PRO/i, 'PURPLEPRO'],
  [/紫標|PURPLE/i, 'PURPLE'],
  [/金標|WD\s*GOLD/i, 'GOLD'],
  [/黑標|WD\s*BLACK/i, 'BLACK'],
  [/藍標|WD\s*BLUE/i, 'BLUE'],
  [/P300/i, 'P300'],
  [/X300/i, 'X300'],
  [/N300/i, 'N300'],
  [/S300/i, 'S300'],
  [/L200/i, 'L200'],
];

/**
 * HDD 規格鍵：品牌+系列+容量+轉速可唯一識別內接碟 SKU。
 * ponytail: 不含快取容量（64M/256M）——同系列同容量同轉速通常為單一現售 SKU，若誤併再加。
 */
export function hddSpecKey(p: Product): string | undefined {
  if (!p.brand) return undefined;
  const raw = p.rawName;
  const series = HDD_SERIES.find(([re]) => re.test(raw))?.[1];
  if (!series) return undefined;
  const cap = raw.match(/(?<!\d)(\d+(?:\.\d+)?)\s*TB?(?![A-Z0-9])/i);
  const rpm = raw.match(/(\d{4})\s*轉/);
  if (!cap || !rpm) return undefined;
  return `HDD-SPEC-${p.brand.toUpperCase()}-${series}-${cap[1]}T-${rpm[1]}`.replace(/\s+/g, '');
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
  if (category === ProductCategory.RAM) {
    out = out
      .replace(/\bD([45])[-\s]?(\d{4})\b/gi, 'DDR$1-$2')        // \u901a\u8def\u7e2e\u5beb D5-5600 \u2192 DDR5-5600
      .replace(/(\d+)\s*G\s*[*X\u00d7]\s*(\d)/gi, '$1GX$2')          // \u96d9\u689d\u5957\u4ef6 16G*2 \u2192 \u55ae\u4e00 token
      .replace(/SO-?DIMM|\u7b46\u8a18\u578b|\u7b46\u96fb\u7528?/gi, 'NB')                 // \u7b46\u96fb\u8a18\u61b6\u9ad4\u5beb\u6cd5\u7d71\u4e00
      .replace(/\u684c\u4e0a\u578b|\u8a18\u61b6\u9ad4|UDIMM|\bDIMM\b|\u8d85\u983b|\u96fb\u7af6|\u6563\u71b1\u7247|TRAY|\u55ae\u689d\u88dd?|\u96d9\u901a\u9053|\bCL\d{2}\b/gi, ' ');
  }
  // token \u96c6\u5408\uff08\u53bb\u91cd\uff0b\u6392\u5e8f\uff09\u5f8c\u62fc\u63a5\uff1a\u4e09\u5bb6\u901a\u8def\u5c0d\u540c\u4e00 SKU \u7684\u8a5e\u5e8f\u3001\u91cd\u8907\u8a5e\u8207\u4e2d\u82f1\u9ecf\u63a5\u4e0d\u540c
  // \uff08\u300c16G DDR5 NB\u300dvs\u300cNB DDR5 16G \u7b46\u8a18\u578b\u300d\u3001\u300cUSB\u85cd\u7259\u63a5\u6536\u5668\u300dvs\u300cUSB \u63a5\u6536\u5668\u300d\uff09\u3002
  // \u82f1\u6578\u9023\u7e8c\u6bb5\u70ba\u4e00\u500b token\u3001\u4e2d\u6587\u9010\u5b57\uff0c\u96c6\u5408\u8a9e\u610f\u8b93 exact key \u5c0d\u8a9e\u5e8f\u8207\u65b7\u8a5e\u4e0d\u654f\u611f\u3002
  const tokens = out.match(/[A-Za-z0-9]+|[\u4e00-\u9fff]/g) ?? [];
  return [...new Set(tokens)].sort().join('');
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
