import { ProductCategory } from './types.js';
import { CATEGORY_META } from './constants.js';

// 主機板側欄：CPU 腳位（第一層）→ 晶片組（第二層，裸名）→ 板廠（第三層）
const SOCKET_ORDER: readonly string[] = [
  'Intel LGA1851', 'Intel LGA1700', 'Intel LGA4677', 'AMD AM5', 'AMD AM4', 'AMD sTR5',
];
const CHIPSET_ORDER: readonly string[] = [
  'Z890', 'W890', 'B860', 'H810', 'Z790', 'B760', 'H610', 'W680', 'B660', 'W790',
  'X870E', 'X870', 'WRX90', 'TRX50', 'B850', 'B840', 'X670E', 'X670', 'B650E', 'B650', 'A620', 'B550', 'A520',
];
// 板卡/主機板品牌慣用順序（其餘品牌落 locale 排序）
const VENDOR_ORDER: readonly string[] = [
  'ASUS', 'MSI', 'GIGABYTE', 'ASRock', 'BIOSTAR',
  'Sapphire', 'PowerColor', 'XFX', 'ZOTAC', 'PNY', 'Leadtek', 'Inno3D', 'Palit', 'Gainward', 'GALAX', 'COLORFUL', 'Maxsun',
];

const GPU_SERIES_ORDER: readonly string[] = [
  'NVIDIA RTX 50系列', 'NVIDIA RTX 40系列', 'NVIDIA RTX 30系列', 'NVIDIA GT 10系列', 'NVIDIA GT 700系列',
  'AMD RX 9000系列', 'AMD RX 8000系列', 'AMD RX 7000系列', 'AMD RX 6000系列',
  'Intel Arc 系列', 'NVIDIA 專業繪圖卡', 'AMD 專業繪圖卡',
];

const HDD_TYPE_ORDER: readonly string[] = ['桌上型硬碟', 'NAS 專用碟', '監控碟', '企業級硬碟', '行動外接硬碟'];
const NETWORK_ORDER: readonly string[] = ['無線路由器', '網路卡 / 接收器', '交換器', 'NAS 網路儲存', '網路攝影機', '其他網通設備'];
const FAN_ORDER: readonly string[] = ['12cm 風扇', '14cm 風扇', '8/9cm 小風扇', '其他尺寸風扇'];
const CABLE_ORDER: readonly string[] = [
  '網路線', '影音線', 'USB / 傳輸線', '轉接頭 / 轉接線', '電源延長線 / 插座', '機內排線 / 延長線', '切換器 / 分配器', '其他線材',
];
// 作業系統 / 軟體：兩層（作業系統 > Windows 11…、應用軟體 > 防毒軟體…）
const OS_TOP_ORDER: readonly string[] = ['作業系統', '應用軟體'];
const OS_LEAF_ORDER: readonly string[] = [
  'Windows 11', 'Windows 10', 'Windows Server', '其他作業系統', '防毒軟體', '辦公軟體', '其他軟體',
];
// 整機/組合：完整系統在前，零件搭售次之，條件價單品（非零件淨價）殿後
const PACKAGE_ORDER: readonly string[] = [
  '整機電腦', '伺服器 / 工作站', '筆電', '準系統 / 迷你 PC', '掌機', '零件組合', '搭購價單品',
];
const COMBO_ORDER: readonly string[] = [
  '機殼 + 電源', '散熱器 + 電源', '散熱器 + 機殼', 'CPU + 主機板', '主機板 + 記憶體/儲存',
  '顯卡搭購組', '螢幕 + 周邊', '周邊套裝', '其他組合',
];
// 「搭購價單品 > {零件分類}」第二層依側欄主分類順序（CPU → 主機板 → 顯卡…）
const PACKAGE_BASE_ORDER: readonly string[] = Object.values(CATEGORY_META)
  .sort((a, b) => a.order - b.order)
  .map(meta => meta.label);

/** 供 Dashboard 前端腳本注入的排序表（單一真相；client 端 compareNodes 不可自帶清單）。 */
export const SIDEBAR_ORDERS = {
  socket: SOCKET_ORDER,
  chipset: CHIPSET_ORDER,
  vendor: VENDOR_ORDER,
  gpuSeries: GPU_SERIES_ORDER,
  hddType: HDD_TYPE_ORDER,
  network: NETWORK_ORDER,
  fan: FAN_ORDER,
  cable: CABLE_ORDER,
  osTop: OS_TOP_ORDER,
  osLeaf: OS_LEAF_ORDER,
  packageType: PACKAGE_ORDER,
  combo: COMBO_ORDER,
  packageBase: PACKAGE_BASE_ORDER,
} as const;

const DDR_ORDER: readonly string[] = ['DDR5', 'DDR4', 'D5', 'D4'];
const DEVICE_ORDER: readonly string[] = ['桌上型 UDIMM', '桌上型', '筆電用 SO-DIMM', '筆電用'];
const SIZE_ORDER: readonly string[] = ['E-ATX', 'ATX', 'Micro-ATX', 'Mini-ITX'];

export function compareSubcategoryNode(category: string, a: string, b: string): number {
  const exact = exactRank(category, a) - exactRank(category, b);
  if (exact !== 0) return exact;

  const semantic = semanticRank(category, a) - semanticRank(category, b);
  if (semantic !== 0) return semantic;

  if (category === ProductCategory.GPU) {
    const gpu = gpuModelRank(a) - gpuModelRank(b);
    if (gpu !== 0) return gpu;
  }

  if (shouldSortByCapacity(category)) {
    const cap = capacityValue(b) - capacityValue(a);
    if (cap !== 0) return cap;
  }

  const kit = kitRank(a) - kitRank(b);
  if (kit !== 0) return kit;

  const num = largestNumber(b) - largestNumber(a);
  if (num !== 0) return num;

  return a.localeCompare(b, 'zh-TW');
}

export function sortSubcategories<T extends { subcategory: string | null }>(
  category: string,
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => compareSubcategoryNode(category, a.subcategory ?? '', b.subcategory ?? ''));
}

function exactRank(category: string, value: string): number {
  const v = value.trim();
  if (!v) return Number.MAX_SAFE_INTEGER;
  if (category === ProductCategory.CPU) {
    if (v === 'Intel') return 0;
    if (v === 'AMD') return 1;
  }
  return 1000;
}

function semanticRank(category: string, value: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  if (category === ProductCategory.CPU) return cpuRank(value);
  if (category === ProductCategory.MOTHERBOARD) {
    // 加權組合：同時支援「單一節點名」與「完整 A > B > C 字串」（API flat 清單）排序
    const s = orderedRank(value, SOCKET_ORDER);
    const c = orderedRank(value, CHIPSET_ORDER);
    const v = vendorRank(value);
    if (s === Number.MAX_SAFE_INTEGER && c === Number.MAX_SAFE_INTEGER && v === Number.MAX_SAFE_INTEGER) {
      return Number.MAX_SAFE_INTEGER;
    }
    const sr = s === Number.MAX_SAFE_INTEGER ? 99 : s;
    const cr = c === Number.MAX_SAFE_INTEGER ? 999 : c;
    const vr = v === Number.MAX_SAFE_INTEGER ? 99 : v;
    return sr * 100000 + cr * 100 + vr;
  }
  if (category === ProductCategory.GPU) {
    const series = orderedRank(value, GPU_SERIES_ORDER);
    if (series !== Number.MAX_SAFE_INTEGER) return series;
    const vendor = vendorRank(value);
    if (vendor !== Number.MAX_SAFE_INTEGER) return 100 + vendor;
    return Number.MAX_SAFE_INTEGER;
  }
  if (category === ProductCategory.HDD) return orderedRank(value, HDD_TYPE_ORDER);
  if (category === ProductCategory.NETWORK) return orderedRank(value, NETWORK_ORDER);
  if (category === ProductCategory.FAN) return orderedRank(value, FAN_ORDER);
  if (category === ProductCategory.CABLE) return orderedRank(value, CABLE_ORDER);
  if (category === ProductCategory.OS) return twoLevelRank(value, OS_TOP_ORDER, OS_LEAF_ORDER);
  if (category === ProductCategory.PACKAGE) return packageRank(value);

  const ddrRank = orderedRank(value, DDR_ORDER);
  if (ddrRank !== Number.MAX_SAFE_INTEGER) return ddrRank;

  const deviceRank = orderedRank(value, DEVICE_ORDER);
  if (deviceRank !== Number.MAX_SAFE_INTEGER) return deviceRank;

  const sizeRank = orderedRank(value, SIZE_ORDER);
  if (sizeRank !== Number.MAX_SAFE_INTEGER) return sizeRank;

  return Number.MAX_SAFE_INTEGER;
}

const THREADRIPPER_ORDER: readonly string[] = [
  'Threadripper 9000', 'Threadripper 7000', 'Threadripper 5000', 'Threadripper 3000', 'Threadripper TR4', 'Threadripper',
];

function cpuRank(value: string): number {
  const upper = value.toUpperCase();
  if (upper.includes('CORE ULTRA 200S')) return 10;
  const intelGen = value.match(/第\s*(\d{1,2})\s*代/);
  if (intelGen) return 100 - Number(intelGen[1]);
  const ryzenGen = upper.match(/RYZEN\s*(\d{4})/);
  if (ryzenGen) return 300 - Number(ryzenGen[1]) / 100;
  const threadripper = orderedRank(value, THREADRIPPER_ORDER);
  if (threadripper !== Number.MAX_SAFE_INTEGER) return 400 + threadripper;
  if (/CORE I9|ULTRA 9|RYZEN 9/.test(upper)) return 500;
  if (/CORE I7|ULTRA 7|RYZEN 7/.test(upper)) return 510;
  if (/CORE I5|ULTRA 5|RYZEN 5/.test(upper)) return 520;
  if (/CORE I3|ULTRA 3|RYZEN 3/.test(upper)) return 530;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * 整機/組合排序。同時支援樹的「裸節點名」與 flat API 的完整 `A > B > C` 字串：
 * 完整字串以頂層加權（`p*10000`），裸的第二層節點各自落回自己的序列。
 */
function packageRank(value: string): number {
  const top = orderedRank(value, PACKAGE_ORDER);
  const combo = orderedRank(value, COMBO_ORDER);
  const base = orderedRank(value, PACKAGE_BASE_ORDER);
  if (top !== Number.MAX_SAFE_INTEGER) {
    return top * 10000 + (combo === Number.MAX_SAFE_INTEGER ? 0 : combo) * 100 +
      (base === Number.MAX_SAFE_INTEGER ? 0 : base);
  }
  if (combo !== Number.MAX_SAFE_INTEGER) return combo * 100;
  if (base !== Number.MAX_SAFE_INTEGER) return base;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * 兩層樹排序。同時支援樹的「裸節點名」與 flat API 的完整 `A > B` 字串：
 * 命中頂層時以 `top*100 + leaf` 加權，只命中葉層時落回葉層序。
 */
function twoLevelRank(value: string, topOrder: readonly string[], leafOrder: readonly string[]): number {
  const top = orderedRank(value, topOrder);
  const leaf = orderedRank(value, leafOrder);
  if (top !== Number.MAX_SAFE_INTEGER) {
    return top * 100 + (leaf === Number.MAX_SAFE_INTEGER ? 0 : leaf);
  }
  return leaf;
}

function vendorRank(value: string): number {
  // 取最後一段葉節點（flat API 傳「A > B > 品牌」整串，樹則傳裸品牌名）
  const leaf = value.includes('>') ? value.slice(value.lastIndexOf('>') + 1) : value;
  const upper = leaf.trim().toUpperCase();
  const idx = VENDOR_ORDER.findIndex(v => v.toUpperCase() === upper);
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
}

function orderedRank(value: string, order: readonly string[]): number {
  const upper = value.toUpperCase();
  for (let i = 0; i < order.length; i++) {
    const item = order[i].toUpperCase();
    if (upper === item || upper.includes(item)) return i;
  }
  return Number.MAX_SAFE_INTEGER;
}

function capacityValue(value: string): number {
  const match = value.match(/(?:^|>\s*|\s)(\d+)\s*(TB|GB|T|G|MB)(?=\s|$|\(|>)/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (unit.startsWith('T')) return amount * 1024 * 1024;
  if (unit.startsWith('G')) return amount * 1024;
  return amount;
}

function shouldSortByCapacity(category: string): boolean {
  return category === ProductCategory.RAM || category === ProductCategory.SSD || category === ProductCategory.HDD;
}

function gpuModelRank(value: string): number {
  const upper = value.toUpperCase();
  const match = upper.match(/\b(RTX|GTX|GT|RX)\s*(\d{3,4})(?:\s*(TI|SUPER|XTX|XT|GRE))?/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const base = Number(match[2]);
  const suffix = match[3] ?? '';
  const suffixBonus: Record<string, number> = {
    XTX: 4,
    TI: 3,
    SUPER: 2,
    XT: 2,
    GRE: 1,
  };
  return -(base * 10 + (suffixBonus[suffix] ?? 0));
}

function kitRank(value: string): number {
  return /[*xX]\s*\d|\(\d+G[*xX]\d+\)/.test(value) ? 0 : 1;
}

function largestNumber(value: string): number {
  const matches = [...value.matchAll(/(\d+)/g)].map(match => Number(match[1]));
  return matches.length > 0 ? Math.max(...matches) : 0;
}
