import type { Product } from '../shared/types.js';
import { ProductCategory } from '../shared/types.js';
import { KNOWN_BRANDS, BRAND_ALIASES } from '../shared/constants.js';

/**
 * 將商品原始名稱清理成「乾淨、核心」的標題：移除行銷話術、保固、價格、HTML 與括號內的細部規格，
 * 保留品牌、型號與容量等核心識別資訊。
 */
export function normalizeName(rawName: string, category?: ProductCategory): string {
  let s = rawName;
  const variantTokens = extractVariantTokens(rawName, category);

  // 1) HTML 標籤
  s = s.replace(/<[^>]+>/g, ' ');

  // 2) 括號內的細部規格 / 促銷（《》【】〈〉（）()［］[]）
  s = s
    .replace(/《[^》]*》/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/〈[^〉]*〉/g, ' ')
    .replace(/（[^）]*）/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/［[^］]*］/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ');

  // 3) 價格（$1234 / NT$1234 / 1234元）
  s = s
    .replace(/NT\$\s*[\d,]+/gi, ' ')
    .replace(/\$\s*[\d,]+/g, ' ')
    .replace(/[\d,]+\s*元/g, ' ');

  // 4) 標記符號
  s = s.replace(/[↘↗↓↑★☆●◆◇■□▲△▽▼✦✧➤«»~]/g, ' ');

  // 4b) 搭購折扣註記（任搭/搭到 NNN/搭機價；購買條件已由 specs.priceCondition 記錄）
  s = s.replace(/任搭\s*\d*|搭到\s*\d+|搭\s*\d+\s*元?省|搭機價|限組裝|組裝價/g, ' ');

  // 5) 行銷話術 / 保固 / 通路詞（非核心識別）
  s = s.replace(
    /熱賣|限量|限時|促銷|特價|下殺|爆殺|破盤|清倉|現省[\d,]*|省下?[\d,]+元?|免運|預購|現貨|缺貨|到貨|超值|優惠|福利品|拆封品?|展示機?|客訂|洽門市|洽小編|代理公司貨|公司貨|代理盒裝|盒裝|彩盒|平輸|水貨|終身保固|終身|全球保固|原廠保固|保固|代理商?[\d一二三四五六七八九十]+年|[\d一二三四五六七八九十]+年保固?|註冊?[\d一二三四五六七八九十]+年|吊卡式?/g,
    ' ',
  );

  // 6) 全形數字轉半形
  s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

  // 7) 在第一個「規格區塊」標記處截斷，只留品牌＋型號＋容量等核心前綴
  //    （容量通常在規格標記之前，故可安全保留）
  const specMarker = /\d+\s*核|\d+(?:\.\d+)?\s*GHz|\bTurbo\b|讀\s*[:取]?\s*\d|寫\s*[:入]?\s*\d|std\s*:|[單雙三四五六]?\s*風扇|導管|液晶|\d+(?:\.\d+)?\s*cm|[長高厚寬]\s*[:：]?\s*\d|\//i;
  const mk = s.match(specMarker);
  if (mk && mk.index !== undefined && mk.index >= 4) {
    s = s.slice(0, mk.index);
  }

  // 8) 收尾：剩餘斜線轉空白、合併空白、去頭尾雜符
  s = s
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,\-、]+|[\s,\-、]+$/g, '')
    .trim();

  if (category && COLOR_SENSITIVE_CATEGORIES.has(category)) {
    s = stripColorVariantNoise(s, variantTokens);
  }
  if (category === ProductCategory.COOLER) {
    s = stripCoolerGenericNoise(s);
  }
  if (category === ProductCategory.MOTHERBOARD) {
    s = stripMotherboardSpecNoise(s);
  }
  if (category === ProductCategory.FAN) {
    s = stripFanVariantNoise(s);
  }

  s = appendVariantTokens(s, variantTokens);
  return s || rawName.trim();
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

const COLOR_PATTERNS: Array<readonly [RegExp, string]> = [
  [/星空藍/i, '星空藍'],
  [/奶咖色/i, '奶咖色'],
  [/焦糖色/i, '焦糖色'],
  [/夢幻粉/i, '夢幻粉'],
  [/電光藍/i, '電光藍'],
  [/桃紅|桃色|粉紅|粉色|PINK/i, '粉色'],
  [/石墨黑|BLACK|黑色/i, '黑色'],
  [/雪霧白|星光白|WHITE|白色/i, '白色'],
  [/海神藍|藍色|BLUE/i, '藍色'],
  [/紅色|RED/i, '紅色'],
  [/綠色|GREEN/i, '綠色'],
  [/黃色|YELLOW/i, '黃色'],
  [/紫色|PURPLE/i, '紫色'],
  [/灰色|GRAY|GREY/i, '灰色'],
  [/銀色|SILVER/i, '銀色'],
];

function extractVariantTokens(rawName: string, category?: ProductCategory): string[] {
  const tokens: string[] = [];
  if (category && COLOR_SENSITIVE_CATEGORIES.has(category)) {
    const color = extractColorVariant(rawName, category);
    if (color) tokens.push(color);
  }
  if (category === ProductCategory.FAN) {
    const packSize = extractFanPackSize(rawName);
    if (packSize) tokens.push(packSize);
    const direction = extractFanDirection(rawName);
    if (direction) tokens.push(direction);
  }
  if (category === ProductCategory.COOLER) {
    const weight = extractThermalPasteWeight(rawName);
    if (weight) tokens.push(weight);
  }
  if (category === ProductCategory.KEYBOARD) {
    const switchType = extractKeyboardSwitch(rawName);
    if (switchType) tokens.push(switchType);
  }
  return tokens;
}

function extractColorVariant(rawName: string, category?: ProductCategory): string | null {
  if (category === ProductCategory.GPU && /\b(?:ICE|AERO)\b/i.test(rawName)) return '白色';
  if (category === ProductCategory.COOLER && /白龍[王神]|\bWHT\b/i.test(rawName)) return '白色';
  if (/[《〈【\[]\s*黑\s*[》〉】\]]/.test(rawName)) return '黑色';
  if (/[《〈【\[]\s*白\s*[》〉】\]]/.test(rawName)) return '白色';
  for (const [pattern, label] of COLOR_PATTERNS) {
    if (pattern.test(rawName)) return label;
  }
  const shortColor = rawName.match(/(?:^|[\s(/（])([黑白])(?:色|[\s)/），,、/]|$)/);
  if (!shortColor) return null;
  return shortColor[1] === '黑' ? '黑色' : '白色';
}

function extractFanPackSize(rawName: string): string | null {
  if (/3\s*IN\s*1|三入|三顆|三件|三合一|三顆裝|三入組/i.test(rawName)) return '3IN1';
  if (/2\s*IN\s*1|二入|兩入|二顆|兩顆|二合一/i.test(rawName)) return '2IN1';
  if (/單入|單顆|單個|單包|單顆裝/i.test(rawName)) return '單顆';
  return null;
}

function extractFanDirection(rawName: string): string | null {
  return /\bREVERSE\b|反向/i.test(rawName) ? '反向' : null;
}

function stripColorVariantNoise(name: string, tokens: readonly string[]): string {
  const colors = new Set(tokens.filter(t => COLOR_PATTERNS.some(([, label]) => label === t)));
  let out = name;
  if (colors.has('黑色')) {
    out = stripStandaloneCjkColor(out, '黑')
      .replace(/黑色?版/g, ' ')
      .replace(/\bBLACK\b/gi, ' ');
  }
  if (colors.has('白色')) {
    out = stripStandaloneCjkColor(out, '白')
      .replace(/白色?版/g, ' ')
      .replace(/\b(?:WHITE|WHT)\b/gi, ' ')
      .replace(/白(?=龍[王神])/g, ' ');
  }
  for (const color of colors) {
    if (color === '黑色' || color === '白色') continue;
    out = out.replace(new RegExp(escapeRegExp(color), 'gi'), ' ');
  }
  return compactName(out);
}

function stripStandaloneCjkColor(name: string, color: '黑' | '白'): string {
  const re = new RegExp(`(^|[^A-Z0-9\\u4e00-\\u9fff])${color}(?:色)?(?=$|[^A-Z0-9\\u4e00-\\u9fff])`, 'g');
  return name.replace(re, '$1');
}

function stripCoolerGenericNoise(name: string): string {
  return compactName(name
    .replace(/(飛龍|白龍|龍神|白龍神)三代/g, '$1')
    .replace(/一體式水冷|水冷散熱器?|水冷|CPU\s*散熱器?|散熱器/g, ' '));
}

function stripMotherboardSpecNoise(name: string): string {
  return compactName(name
    .replace(/\d+\s*\+\s*\d+(?:\s*\+\s*\d+){0,4}\s*相(?:供電)?/g, ' ')
    .replace(/\*\s*\d+(?:\s*\/\s*\d+\s*止)?/g, ' ')
    .replace(/\b(?:AM[45]|LGA\s*\d{3,5})\b/gi, ' ')
    .replace(/背插式/g, '背插')
    .replace(/白色板|白色|主機板/g, ' '));
}

function stripFanVariantNoise(name: string): string {
  return compactName(name
    .replace(/\bREVERSE\b/gi, ' ')
    .replace(/反向\s*風扇|反向扇|反向/g, ' ')
    .replace(/\b(?:WHITE|BLACK)\b/gi, ' ')
    .replace(/[黑白]色/g, ' ')
    .replace(/3\s*IN\s*1|3IN1|三入組?|三顆裝?|三件|三合一|三顆/g, ' ')
    .replace(/2\s*IN\s*1|2IN1|二入|兩入|二顆|兩顆|二合一/g, ' ')
    .replace(/單入|單顆裝?|單個|單包/g, ' '));
}

function extractThermalPasteWeight(rawName: string): string | null {
  if (!/散熱膏|導熱膏|熱膏|TF8|TF7|TFX/i.test(rawName)) return null;
  const match = rawName.match(/(\d+(?:\.\d+)?)\s*(?:公克|克|g)(?!b)/i);
  return match ? `${match[1]}g` : null;
}

/** 鍵盤軸體標籤（子分類與 normalize 顯示名共用）。長寫在前，避免「紅軸」先吃掉「靜音紅軸」。 */
export function extractKeyboardSwitch(rawName: string): string | null {
  const match = rawName.match(/靜音紅軸|靜音茶軸|矮紅軸|矮茶軸|紅軸|茶軸|青軸|銀軸|黑軸|白軸|黃軸|綠軸|紫軸/i);
  if (!match) return null;
  // 正規化大小寫顯示（品名可能寫「紅軸」或混寫）
  return match[0];
}

function appendVariantTokens(name: string, tokens: readonly string[]): string {
  let out = name;
  for (const token of tokens) {
    if (!token) continue;
    if (new RegExp(escapeRegExp(token), 'i').test(out)) continue;
    out = `${out} ${token}`.trim();
  }
  return out;
}

function compactName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract brand from product name, normalizing aliases to a canonical name.
 *
 * - 同時比對正規品牌名與別名（中文名 / 全寫 / 變體）。
 * - 依比對字串長度由長到短排序，避免短字串先命中（如 "Cooler Master" 先於 "Cooler"）。
 * - 命中別名時回傳對應的正規品牌名，避免同一品牌被拆成多個（如 WD / Western Digital）。
 */
export function extractBrand(name: string): string | undefined {
  const upperName = name.toUpperCase();

  // 建立 [比對字串(大寫), 正規名稱] 配對：正規品牌名指向自身，別名指向其正規名稱。
  const candidates: Array<readonly [string, string]> = [
    ...KNOWN_BRANDS.map(b => [b.toUpperCase(), b] as const),
    ...Object.entries(BRAND_ALIASES).map(([alias, canonical]) => [alias.toUpperCase(), canonical] as const),
  ];
  candidates.sort((a, b) => b[0].length - a[0].length);

  for (const [needle, canonical] of candidates) {
    if (brandMatches(upperName, needle)) {
      return canonical;
    }
  }
  return undefined;
}

/**
 * 短的純英數品牌（如 LG/WD/AOC/FSP）改用「詞邊界」比對，避免被他牌型號子字串誤命中
 * （例如 FLG→LG、AWD-IT→WD）。較長或含非英數字元的品牌維持子字串比對。
 */
function brandMatches(haystack: string, needle: string): boolean {
  if (needle.length <= 3 && /^[A-Z0-9]+$/.test(needle)) {
    const re = new RegExp('(?:^|[^A-Z0-9])' + needle + '(?:[^A-Z0-9]|$)');
    return re.test(haystack);
  }
  return haystack.includes(needle);
}

/**
 * 抽取「唯一識別 CPU 的正規化型號」（i5-14400 / 9800X3D / Ultra 9 285K）。
 *
 * 只處理 CPU——因為 CPU 型號即唯一產品，跨店同型號合併安全。
 * GPU/RAM 等同型號有多個 SKU（不同產品線/容量），不可用晶片型號合併，
 * 改由 matcher 依分類用更精細的鍵或模糊比對處理。
 */
export function extractModel(name: string): string | undefined {
  let m: RegExpMatchArray | null;

  // Intel Core i 系列：i5-14400 / i5 14400 / Core i7-14700K
  if ((m = name.match(/\b(?:Core\s*)?i([3579])[\s-]?(\d{4,5})([A-Z]{0,2})\b/i))) {
    return `I${m[1]}-${m[2]}${m[3]}`.toUpperCase();
  }
  // Intel Core Ultra：Core Ultra 9 285K
  if ((m = name.match(/\bUltra\s*([3579])\s*(\d{3})([A-Z]{0,2})\b/i))) {
    return `ULTRA${m[1]}-${m[2]}${m[3]}`.toUpperCase();
  }
  // AMD Ryzen：Ryzen 7 9800X3D / R7 9800X3D / Ryzen5 5600GT
  if ((m = name.match(/\b(?:Ryzen|R)\s*([3579])\s*[-\s]?(\d{4})([A-Z0-9]{0,3})\b/i))) {
    return `RYZEN${m[1]}-${m[2]}${m[3]}`.toUpperCase();
  }
  return undefined;
}

/**
 * Normalize a product: clean name, extract brand/model as fallback
 */
export function normalizeProduct(product: Product): Product {
  const cleanName = normalizeName(product.rawName, product.category);
  const extractedBrand = extractBrand(cleanName);
  return {
    ...product,
    name: cleanName || product.name,
    brand: chooseBrand(product.brand, extractedBrand, product.category),
    model: product.model ?? extractModel(cleanName),
  };
}

function chooseBrand(
  current: string | undefined,
  extracted: string | undefined,
  category: ProductCategory,
): string | undefined {
  if (!current) return extracted;
  // 既有品牌若為別名（如 Micron），正規化為 canonical（Crucial），避免同 SKU 跨店品牌碎裂
  current = BRAND_ALIASES[current.toUpperCase().trim()] ?? current;
  if (
    extracted
    && extracted !== current
    && /^(NVIDIA|AMD|Intel)$/i.test(current)
    && [ProductCategory.GPU, ProductCategory.MOTHERBOARD].includes(category)
  ) {
    return extracted;
  }
  return current;
}
