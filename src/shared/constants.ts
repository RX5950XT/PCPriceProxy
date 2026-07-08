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

/**
 * Canonical brand list for brand extraction.
 * 注意：不要放入子品牌（如 ROG / AORUS / TUF），以免同一母品牌被拆成多個。
 */
export const KNOWN_BRANDS = [
  // 平台
  'Intel', 'AMD', 'NVIDIA',
  // 主機板 / 顯卡 三大
  'ASUS', 'MSI', 'GIGABYTE', 'ASRock', 'BIOSTAR',
  // 記憶體
  'Corsair', 'G.SKILL', 'Kingston', 'Crucial', 'TEAMGROUP', 'ADATA', 'Apacer', 'Patriot', 'Klevv',
  // 儲存（Micron 為 Crucial 母公司，統一正規化為 Crucial 避免同 SKU 品牌碎裂）
  'Samsung', 'WD', 'Seagate', 'Toshiba', 'KIOXIA', 'SanDisk', 'Solidigm',
  // 顯卡 AIB
  'EVGA', 'ZOTAC', 'Sapphire', 'PowerColor', 'XFX', 'PNY', 'Leadtek', 'Inno3D', 'Palit', 'Gainward', 'GALAX', 'COLORFUL', 'Maxsun',
  // 電源 / 機殼 / 散熱（XPG 為 ADATA 電競線，機殼以 XPG 名義販售，獨立顯示較易辨識）
  'Seasonic', 'FSP', 'Cooler Master', 'NZXT', 'be quiet!', 'Thermaltake', 'Antec', 'SilverStone', 'Montech', 'In Win',
  'Lian Li', 'Fractal Design', 'Phanteks', 'JONSBO', 'TRYX', 'XPG', '視博通', 'Power Master', '幾何未來',
  'Cougar', 'HYTE', 'SAMA', 'Super Flower', '旋剛', 'SADES', 'XIGMATEK', 'YAMA',
  'Noctua', 'Arctic', 'DeepCool', 'ID-COOLING', 'Thermalright',
  // 螢幕（GIGABYTE 已列於主機板段，勿在此重複大小寫變體）
  'BenQ', 'ViewSonic', 'DELL', 'LG', 'Acer', 'AOC', 'Philips',
  // 周邊（鍵鼠）
  'Logitech', 'Razer', 'SteelSeries', 'HyperX', 'darkFlash',
  'i-Rocks', 'Cherry', 'Keychron', 'Rapoo', 'Havit', 'Turtle Beach', 'EndGame Gear', 'A4Tech', 'Ducky', 'AKKO', 'Pulsar', 'Lamzu', 'Fantech',
  // 音訊（耳機 / 喇叭 / 音響）
  'EPOS', 'Edifier', 'Pioneer', 'AIWA', 'ATake', 'Creative', 'Sony', 'JBL', 'Bose', 'Klipsch', 'Audio-Technica', 'Sennheiser', 'Yamaha', 'i.shock',
  // 網通（ASUS 已列於主機板段，不重複）
  'TP-Link', 'Netgear', 'Ubiquiti', 'D-Link', 'Synology', 'QNAP', 'Mercusys',
  'Zyxel', 'AverMedia', 'TOTOLINK', 'Tenda', 'Cudy', 'Edimax', 'TRENDnet',
  // 軟體 / 其他
  'Microsoft', 'Apple', 'ZhiTai',
] as const;

/**
 * 品牌別名 → 正規名稱對照。
 * 解決同一品牌在不同通路以不同寫法出現（中文名、全寫、空白差異），避免品牌碎裂。
 * key 以「大寫、去除多餘空白」後比對。
 */
export const BRAND_ALIASES: Record<string, string> = {
  'WESTERN DIGITAL': 'WD',
  'WD_BLACK': 'WD',
  '威剛': 'ADATA',
  '十銓': 'TEAMGROUP',
  'T-FORCE': 'TEAMGROUP',
  '宇瞻': 'Apacer',
  '美光': 'Crucial',
  'MICRON': 'Crucial',
  '東芝': 'Toshiba',
  '金士頓': 'Kingston',
  '影馳': 'GALAX',
  '撼訊': 'PowerColor',
  '藍寶': 'Sapphire',
  '藍寶石': 'Sapphire',
  '七彩虹': 'COLORFUL',
  '銘瑄': 'Maxsun',
  '麗臺 NVIDIA': 'Leadtek',
  'LEADTEK 麗臺': 'Leadtek',
  '麗臺': 'Leadtek',
  '微星': 'MSI',
  '華碩': 'ASUS',
  '技嘉': 'GIGABYTE',
  '華擎': 'ASRock',
  '映泰': 'BIOSTAR',
  '海盜船': 'Corsair',
  '酷碼': 'Cooler Master',
  '聯力': 'Lian Li',
  '喬思伯': 'JONSBO',
  '芝奇': 'G.SKILL',
  '希捷': 'Seagate',
  '三星': 'Samsung',
  '群暉': 'Synology',
  '威聯通': 'QNAP',
  '水星': 'Mercusys',
  '大飛': 'darkFlash',
  '羅技': 'Logitech',
  '雷蛇': 'Razer',
  '致態': 'ZhiTai',
  // 機殼 / 散熱 / 電源品牌中文別名
  '曜越': 'Thermaltake',
  '迎廣': 'In Win',
  '安鈦克': 'Antec',
  '亞碩': 'Power Master',
  '銀欣': 'SilverStone',
  '全漢': 'FSP',
  '振華': 'Super Flower',
  '富鈞': 'XIGMATEK',
  '美洲獅': 'Cougar',
  '先馬': 'SAMA',
  '賽德斯': 'SADES',
  '雅瑪': 'YAMA',
  // 鍵鼠品牌別名
  '櫻桃': 'Cherry',
  '雷柏': 'Rapoo',
  '海威特': 'Havit',
  '艾芮克': 'i-Rocks',
  'IROCKS': 'i-Rocks',
  '雙飛燕': 'A4Tech',
  // 音訊品牌別名
  '漫步者': 'Edifier',
  '先鋒': 'Pioneer',
  '愛華': 'AIWA',
  '森海塞爾': 'Sennheiser',
  '鐵三角': 'Audio-Technica',
  // 網通品牌別名
  '合勤': 'Zyxel',
  '圓剛': 'AverMedia',
  '訊舟': 'Edimax',
  'TOTO-LINK': 'TOTOLINK',
};

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
] as const;

export const DEFAULT_SCRAPE_INTERVAL_MINUTES = 30;
export const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

/**
 * 有效商品的最低價（TWD）。低於此價多為「$1 登錄送贈品 / 竊盜險 / 抽獎」等促銷假項，
 * 並非真正可購買的零件，於處理管線過濾掉。
 */
export const MIN_VALID_PRICE = 10;

/** 比價站保留的 DIY 相關分類；OTHER 與周邊雜項不寫入 DB。 */
export const DIY_CATEGORIES: readonly ProductCategory[] = [
  ProductCategory.CPU,
  ProductCategory.GPU,
  ProductCategory.MOTHERBOARD,
  ProductCategory.RAM,
  ProductCategory.SSD,
  ProductCategory.HDD,
  ProductCategory.PSU,
  ProductCategory.CASE,
  ProductCategory.COOLER,
  ProductCategory.MONITOR,
  ProductCategory.FAN,
  ProductCategory.NETWORK,
  ProductCategory.KEYBOARD,
  ProductCategory.MOUSE,
  ProductCategory.HEADSET,
  ProductCategory.SPEAKER,
  ProductCategory.PACKAGE,
  ProductCategory.OS,
  ProductCategory.SOFTWARE,
  ProductCategory.OPTICAL_DRIVE,
];

const DIY_CATEGORY_SET = new Set<string>(DIY_CATEGORIES);

export function isDiyCategory(category: ProductCategory): boolean {
  return DIY_CATEGORY_SET.has(category);
}

/**
 * 分類顯示中繼資料（單一真相）。
 * label：中文顯示名；icon：側欄與標籤用的圖示；order：側欄排序（小→大，核心零件在前）。
 * 前端側欄與卡片標籤皆由此驅動，避免硬編碼分類清單與英文 enum 直出。
 */
export interface CategoryMeta {
  readonly label: string;
  readonly icon: string;
  readonly order: number;
}

export const CATEGORY_META: Record<ProductCategory, CategoryMeta> = {
  [ProductCategory.CPU]: { label: 'CPU 處理器', icon: '🧠', order: 1 },
  [ProductCategory.MOTHERBOARD]: { label: '主機板', icon: '🧩', order: 2 },
  [ProductCategory.GPU]: { label: '顯示卡', icon: '🎮', order: 3 },
  [ProductCategory.RAM]: { label: '記憶體', icon: '🧮', order: 4 },
  [ProductCategory.SSD]: { label: '固態硬碟 SSD', icon: '⚡', order: 5 },
  [ProductCategory.HDD]: { label: '傳統硬碟 HDD', icon: '💽', order: 6 },
  [ProductCategory.PSU]: { label: '電源供應器', icon: '🔌', order: 7 },
  [ProductCategory.CASE]: { label: '機殼', icon: '🗄️', order: 8 },
  [ProductCategory.COOLER]: { label: '散熱器', icon: '❄️', order: 9 },
  [ProductCategory.MONITOR]: { label: '螢幕', icon: '🖥️', order: 10 },
  [ProductCategory.FAN]: { label: '系統風扇', icon: '🌀', order: 11 },
  [ProductCategory.KEYBOARD]: { label: '鍵盤', icon: '⌨️', order: 12 },
  [ProductCategory.MOUSE]: { label: '滑鼠', icon: '🖱️', order: 13 },
  [ProductCategory.HEADSET]: { label: '耳機 / 麥克風', icon: '🎧', order: 14 },
  [ProductCategory.SPEAKER]: { label: '喇叭 / 音響', icon: '🔊', order: 15 },
  [ProductCategory.NETWORK]: { label: '網通設備', icon: '📡', order: 16 },
  [ProductCategory.OPTICAL_DRIVE]: { label: '光碟機', icon: '📀', order: 17 },
  [ProductCategory.OS]: { label: '作業系統', icon: '🪟', order: 18 },
  [ProductCategory.SOFTWARE]: { label: '應用軟體', icon: '🛡️', order: 19 },
  [ProductCategory.PACKAGE]: { label: '整機 / 組合', icon: '🎁', order: 20 },
  [ProductCategory.OTHER]: { label: '其他', icon: '📦', order: 99 },
};
