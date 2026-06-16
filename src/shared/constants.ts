import { ProductCategory } from './types.js';

export const COOLPC_CATEGORY_MAP: Record<string, ProductCategory> = {
  'n1': ProductCategory.PACKAGE, // 品牌主機/套裝
  'n2': ProductCategory.OTHER, // 平板/掌機/筆電
  'n3': ProductCategory.PACKAGE, // 套裝必搭優惠
  'n4': ProductCategory.CPU,
  'n5': ProductCategory.MOTHERBOARD,
  'n6': ProductCategory.RAM,
  'n7': ProductCategory.SSD,
  'n8': ProductCategory.HDD,
  'n9': ProductCategory.OTHER, // 隨身碟/記憶卡
  'n10': ProductCategory.COOLER, // SSD散熱器/一般散熱器
  'n11': ProductCategory.COOLER, // 水冷/散熱器
  'n12': ProductCategory.GPU, // 顯卡周邊/顯示卡本體
  'n13': ProductCategory.MONITOR,
  'n14': ProductCategory.CASE,
  'n15': ProductCategory.PSU,
  'n16': ProductCategory.FAN,
  'n17': ProductCategory.KEYBOARD,
  'n18': ProductCategory.MOUSE,
  'n19': ProductCategory.NETWORK, // 網通
  'n20': ProductCategory.NETWORK, // NAS/監控
  'n21': ProductCategory.OTHER, // 擷取卡/音效卡
  'n22': ProductCategory.HEADSET, // 耳機喇叭麥克風
  'n23': ProductCategory.OPTICAL_DRIVE, // 光碟機
  'n24': ProductCategory.OTHER, // 外接盒
  'n25': ProductCategory.OTHER, // 視訊鏡頭
  'n26': ProductCategory.OTHER, // UPS/印表機
  'n27': ProductCategory.OTHER, // 擴充卡
  'n28': ProductCategory.OTHER, // 線材
  'n29': ProductCategory.OS, // 作業系統/軟體
  'n30': ProductCategory.OTHER, // 福利品
};

// Autobuy groupId → unified category mapping
export const AUTOBUY_CATEGORY_MAP: Record<string, ProductCategory> = {
  '1': ProductCategory.CPU,
  '34': ProductCategory.COOLER,
  '2': ProductCategory.MOTHERBOARD,
  '45': ProductCategory.MOTHERBOARD,
  '3': ProductCategory.RAM,
  '36': ProductCategory.RAM,
  '17': ProductCategory.SSD,
  '4': ProductCategory.HDD,
  '5': ProductCategory.GPU,
  '86': ProductCategory.GPU,
  '6': ProductCategory.OPTICAL_DRIVE,
  '8': ProductCategory.PSU,
  '7': ProductCategory.CASE,
  '41': ProductCategory.FAN,
  '9': ProductCategory.MONITOR,
  '26': ProductCategory.SSD,
  '10': ProductCategory.MOUSE,
  '18': ProductCategory.KEYBOARD,
  '12': ProductCategory.HEADSET,
  '25': ProductCategory.NETWORK,
  '15': ProductCategory.OS,
  '16': ProductCategory.SOFTWARE,
  '24': ProductCategory.NETWORK,
  '28': ProductCategory.PSU,
};

// Known brand list for brand extraction
export const KNOWN_BRANDS = [
  'Intel', 'AMD', 'NVIDIA',
  'ASUS', 'MSI', 'GIGABYTE', 'ASRock',
  'Corsair', 'G.SKILL', 'Kingston', 'Crucial', 'TEAMGROUP',
  'Samsung', 'WD', 'Western Digital', 'Seagate', 'Micron', 'KIOXIA',
  'EVGA', 'ZOTAC', 'Sapphire', 'PowerColor', 'XFX', 'PNY', 'Inno3D', 'Palit', 'Gainward',
  'Seasonic', 'FSP', 'Cooler Master', 'NZXT', 'be quiet!', 'Thermaltake',
  'Lian Li', 'Fractal Design', 'Phanteks',
  'Noctua', 'Arctic', 'DeepCool', 'ID-COOLING', 'Thermalright',
  'BenQ', 'ViewSonic', 'DELL', 'LG', 'Acer', 'AOC', 'ASUS ROG',
  'Logitech', 'Razer', 'SteelSeries', 'HyperX',
  'TP-Link', 'ASUS', 'Netgear', 'Ubiquiti',
  'Microsoft', 'Apple',
] as const;

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
] as const;

export const DEFAULT_SCRAPE_INTERVAL_MINUTES = 30;
export const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;
