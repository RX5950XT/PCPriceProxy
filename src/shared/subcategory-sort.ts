import { ProductCategory } from './types.js';
import { CATEGORY_META } from './constants.js';

// 主機板側欄：CPU 腳位（第一層）→ 晶片組（第二層，裸名）→ 板廠（第三層）
const SOCKET_ORDER: readonly string[] = [
  'Intel LGA1851', 'Intel LGA1700', 'Intel LGA1200', 'Intel LGA1151', 'Intel LGA1150', 'Intel LGA4677',
  'AMD AM5', 'AMD AM4', 'AMD sTR5', 'AMD sWRX8',
];
const CHIPSET_ORDER: readonly string[] = [
  'Z890', 'W890', 'W880', 'B860', 'H810', 'Z790', 'B760', 'H610', 'W680', 'B660', 'H510', 'H310', 'H110', 'H81', 'W790',
  'X870E', 'X870', 'WRX90', 'TRX50', 'WRX80', 'B850', 'B840', 'X670E', 'X670', 'B650E', 'B650', 'A620', 'B550', 'A520',
];
// 板卡/主機板品牌慣用順序（其餘品牌落 locale 排序）
const VENDOR_ORDER: readonly string[] = [
  'ASUS', 'MSI', 'GIGABYTE', 'ASRock', 'BIOSTAR',
  'Sapphire', 'PowerColor', 'XFX', 'ZOTAC', 'PNY', 'Leadtek', 'Inno3D', 'Palit', 'Gainward', 'GALAX', 'COLORFUL', 'Maxsun',
];

const GPU_SERIES_ORDER: readonly string[] = [
  'NVIDIA RTX 50系列', 'NVIDIA RTX 40系列', 'NVIDIA RTX 30系列', 'NVIDIA GT 10系列', 'NVIDIA GT 700系列', 'NVIDIA GT 200系列',
  'AMD RX 9000系列', 'AMD RX 8000系列', 'AMD RX 7000系列', 'AMD RX 6000系列', 'AMD Radeon R7 系列',
  'Intel Arc 系列', 'NVIDIA 專業繪圖卡', 'AMD 專業繪圖卡',
];

const HDD_TYPE_ORDER: readonly string[] = ['桌上型硬碟', 'NAS 專用碟', '監控碟', '企業級硬碟', '行動外接硬碟'];
// 機殼最大板型：小→大（DIY 由緊湊往標準擴），工業／機架與未標殿後
const CASE_FORM_ORDER: readonly string[] = ['Mini-ITX', 'M-ATX', 'ATX', 'E-ATX', '機架式 / 工業', '未標板型'];
const NETWORK_ORDER: readonly string[] = [
  '無線路由器', 'Wi-Fi 延伸器', '無線基地台 / AP', '網路卡 / 接收器', '交換器',
  'NAS 網路儲存', '網路攝影機', '其他網通設備',
];
// 鍵盤：機制 > 軸體 > 有線/無線 > 品牌（軸體長寫在前，避免 includes 被短寫先命中）
const KEYBOARD_TYPE_ORDER: readonly string[] = ['機械式鍵盤', '薄膜鍵盤'];
const KEYBOARD_SWITCH_ORDER: readonly string[] = [
  '靜音紅軸', '靜音茶軸', '矮紅軸', '矮茶軸',
  '紅軸', '茶軸', '青軸', '銀軸', '黑軸', '白軸', '黃軸', '綠軸', '紫軸', '未標軸',
];
const KEYBOARD_CONN_ORDER: readonly string[] = ['有線', '無線'];
// 耳機 / 麥克風：連線或產品大類 > 品牌
const HEADSET_TYPE_ORDER: readonly string[] = [
  '有線耳機', '無線耳機', 'USB 麥克風', '專業麥克風', '無線麥克風', '麥克風',
];
// 滑鼠：用途 > 有線/無線 > 品牌
const MOUSE_TYPE_ORDER: readonly string[] = ['電競滑鼠', '垂直滑鼠', '一般滑鼠'];
// 喇叭：型態 > 品牌（有線／藍牙不當主軸）
const SPEAKER_TYPE_ORDER: readonly string[] = [
  '2.0 桌面／書架', '2.1／多件式', '聲霸', '重低音（單顆）', '便攜藍牙', '其他喇叭',
];
const FAN_ORDER: readonly string[] = ['12cm 風扇', '14cm 風扇', '8/9cm 小風扇', '其他尺寸風扇'];
// 線材：大類 > 細類
const CABLE_ORDER: readonly string[] = [
  '網路線', '影音線', 'USB / 傳輸線', '轉接頭 / 轉接線', '電源延長線 / 插座', '機內排線 / 延長線', '切換器 / 分配器', '其他線材',
];
const CABLE_LEAF_ORDER: readonly string[] = [
  // 網路線
  'CAT.8', 'CAT.7', 'CAT.6A', 'CAT.6', 'CAT.5E', '其他網路線',
  // 影音
  'HDMI', 'DisplayPort', 'DVI', 'VGA', '音源 / 光纖', '其他影音',
  // USB
  'Thunderbolt', 'Type-C to C', 'Type-A to C', '多接頭充電線', 'Lightning', '充電線', '其他 USB',
  // 轉接
  'HDMI 轉接', 'DP 轉接', 'USB 轉接', '網路口轉接', '其他轉接',
  // 電源座
  '延長線插座', '電源線',
  // 機內
  '12VHPWR 電源延長', '24Pin 電源延長', '8Pin 電源延長', 'ARGB 延長線', 'PCIe 延長線', 'SATA 排線', '其他機內線',
  // 切換器
  'KVM 切換器', '訊號切換器', '訊號分配器',
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

const RAM_DEVICE_ORDER: readonly string[] = ['桌上型 UDIMM', '筆電用 SO-DIMM', '伺服器記憶體'];
const DDR_ORDER: readonly string[] = ['DDR5', 'DDR4', 'D5', 'D4'];
const SSD_TYPE_ORDER: readonly string[] = ['M.2 NVMe SSD', 'SATA 2.5吋', '行動外接式'];
const PCIE_ORDER: readonly string[] = ['PCIe 5.0', 'PCIe 4.0', 'PCIe 3.0'];
const PSU_FORM_ORDER: readonly string[] = ['ATX 電源', 'SFX 電源', 'SFX-L 電源', 'TFX 電源', 'Flex 電源'];
const PSU_WATT_ORDER: readonly string[] = ['1000W 以上', '750W~1000W', '600W~750W', '600W 以下', '未標瓦數'];
const PSU_RATING_ORDER: readonly string[] = ['80+ 鈦金牌', '80+ 白金牌', '80+ 金牌', '80+ 銀牌', '80+ 銅牌', '80+ 白牌'];
const PSU_MODULAR_ORDER: readonly string[] = ['全模組', '半模組', '直出非模組'];
const COOLER_TYPE_ORDER: readonly string[] = ['一體式水冷 (AIO)', '雙塔空冷', '單塔空冷', '下吹式空冷', '散熱膏/配件'];
const COOLER_SIZE_ORDER: readonly string[] = [
  '420mm', '360mm', '280mm', '240mm', '120mm',
  '100mm 以下（低矮型）', '101–150mm', '151–160mm', '161mm 以上',
  'M.2 散熱', '未標尺寸',
];
const LIGHTING_ORDER: readonly string[] = ['ARGB', 'RGB', '無光'];
// 螢幕側欄樹：尺寸桶 > 實際吋／未標吋數 > 品牌；面板／Hz 走工具列篩選
const MONITOR_SIZE_ORDER: readonly string[] = [
  '可攜 / 小尺寸',
  '22吋', '24吋', '25吋', '27吋', '32吋',
  '34吋超寬', '49吋帶魚', '57吋帶魚',
  '大型顯示器', '其他尺寸',
  // 其他尺寸／可攜／大型 的 L2：實際吋靠數字排序；未標殿後
  '未標吋數',
];
const MONITOR_PANEL_ORDER: readonly string[] = [
  'QD-OLED', 'OLED', 'Mini-LED', '量子點', 'IPS', 'VA', 'TN', '未標示',
];
const MONITOR_REFRESH_ORDER: readonly string[] = [
  '240Hz 以上', '170–240Hz', '120–165Hz', '100Hz 以下', '未標示',
];
/** 螢幕解析度 facet（不進側欄樹）；未標示殿後，覆蓋品名省略 2K/4K 的多數列 */
const MONITOR_RESOLUTION_ORDER: readonly string[] = [
  '8K', '5K', '4K / UHD', '帶魚 (DQHD)', '超寬 (UWQHD)', '超寬 (UWFHD)', '2K / QHD', 'FHD', '未標示',
];

/** 供 Dashboard 前端腳本注入的排序表（單一真相；client 端 compareNodes 不可自帶清單）。 */
export const SIDEBAR_ORDERS = {
  socket: SOCKET_ORDER,
  chipset: CHIPSET_ORDER,
  vendor: VENDOR_ORDER,
  gpuSeries: GPU_SERIES_ORDER,
  hddType: HDD_TYPE_ORDER,
  caseForm: CASE_FORM_ORDER,
  network: NETWORK_ORDER,
  keyboardType: KEYBOARD_TYPE_ORDER,
  keyboardSwitch: KEYBOARD_SWITCH_ORDER,
  keyboardConn: KEYBOARD_CONN_ORDER,
  headsetType: HEADSET_TYPE_ORDER,
  mouseType: MOUSE_TYPE_ORDER,
  speakerType: SPEAKER_TYPE_ORDER,
  fan: FAN_ORDER,
  cable: CABLE_ORDER,
  cableLeaf: CABLE_LEAF_ORDER,
  osTop: OS_TOP_ORDER,
  osLeaf: OS_LEAF_ORDER,
  packageType: PACKAGE_ORDER,
  combo: COMBO_ORDER,
  packageBase: PACKAGE_BASE_ORDER,
  ramDevice: RAM_DEVICE_ORDER,
  ddr: DDR_ORDER,
  ssdType: SSD_TYPE_ORDER,
  pcie: PCIE_ORDER,
  psuForm: PSU_FORM_ORDER,
  psuWatt: PSU_WATT_ORDER,
  psuRating: PSU_RATING_ORDER,
  psuModular: PSU_MODULAR_ORDER,
  coolerType: COOLER_TYPE_ORDER,
  coolerSize: COOLER_SIZE_ORDER,
  lighting: LIGHTING_ORDER,
  monitorSize: MONITOR_SIZE_ORDER,
  monitorPanel: MONITOR_PANEL_ORDER,
  monitorRefresh: MONITOR_REFRESH_ORDER,
  monitorResolution: MONITOR_RESOLUTION_ORDER,
} as const;

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
  // 機殼板型用「第一層精確比對」：裸 ATX 不可因 includes 誤中 E-ATX / M-ATX
  if (category === ProductCategory.CASE) return exactTopRank(value, CASE_FORM_ORDER);
  if (category === ProductCategory.NETWORK) return orderedRank(value, NETWORK_ORDER);
  if (category === ProductCategory.KEYBOARD) {
    return layeredRank(value, [KEYBOARD_TYPE_ORDER, KEYBOARD_SWITCH_ORDER, KEYBOARD_CONN_ORDER]);
  }
  if (category === ProductCategory.MOUSE) {
    return layeredRank(value, [MOUSE_TYPE_ORDER, KEYBOARD_CONN_ORDER]);
  }
  if (category === ProductCategory.HEADSET) return orderedRank(value, HEADSET_TYPE_ORDER);
  if (category === ProductCategory.SPEAKER) return orderedRank(value, SPEAKER_TYPE_ORDER);
  if (category === ProductCategory.FAN) return orderedRank(value, FAN_ORDER);
  if (category === ProductCategory.CABLE) return twoLevelRank(value, CABLE_ORDER, CABLE_LEAF_ORDER);
  if (category === ProductCategory.OS) return twoLevelRank(value, OS_TOP_ORDER, OS_LEAF_ORDER);
  if (category === ProductCategory.PACKAGE) return packageRank(value);
  if (category === ProductCategory.RAM) return layeredRank(value, [RAM_DEVICE_ORDER, DDR_ORDER]);
  if (category === ProductCategory.SSD) return layeredRank(value, [SSD_TYPE_ORDER, PCIE_ORDER]);
  if (category === ProductCategory.PSU) {
    return layeredRank(value, [PSU_FORM_ORDER, PSU_WATT_ORDER, PSU_RATING_ORDER, PSU_MODULAR_ORDER]);
  }
  if (category === ProductCategory.COOLER) {
    return layeredRank(value, [COOLER_TYPE_ORDER, COOLER_SIZE_ORDER, LIGHTING_ORDER]);
  }
  if (category === ProductCategory.MONITOR) {
    // 樹只有尺寸 > 品牌；panel/refresh 不進 path（仍 export 給 dashboard chip 順序）
    return layeredRank(value, [MONITOR_SIZE_ORDER]);
  }

  return Number.MAX_SAFE_INTEGER;
}

/** 依各層規格表產生加權順位；同時支援完整路徑與樹中的裸節點。 */
function layeredRank(value: string, layers: readonly (readonly string[])[]): number {
  const matches = layers.map(order => orderedRank(value, order));
  const first = matches.findIndex(rank => rank !== Number.MAX_SAFE_INTEGER);
  if (first < 0) return Number.MAX_SAFE_INTEGER;

  let rank = 0;
  for (let layer = first; layer < matches.length; layer++) {
    const current = matches[layer] === Number.MAX_SAFE_INTEGER ? 0 : matches[layer];
    rank = rank * 1000 + current;
  }
  // 樹中的裸節點可能從第二/三層開始；加上首層位置可避免不同語意層誤相比。
  return first * 1_000_000_000_000 + rank;
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

/** 只比對路徑第一層（`A > B > C` 的 A），避免短 label 被子字串誤中。 */
function exactTopRank(value: string, order: readonly string[]): number {
  const top = (value.includes('>') ? value.slice(0, value.indexOf('>')) : value).trim();
  if (!top) return Number.MAX_SAFE_INTEGER;
  const idx = order.findIndex(item => item === top);
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
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
