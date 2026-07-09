import { ProductCategory } from '../shared/types.js';
import type { Product } from '../shared/types.js';
import { CATEGORY_META, isDiyCategory } from '../shared/constants.js';
import { extractBrand } from './normalizer.js';

/**
 * Category keyword mapping for fallback detection.
 * Used when the scraper's category mapping is insufficient.
 */
const CATEGORY_KEYWORDS: Record<ProductCategory, readonly string[]> = {
  // 'Core i' 不可用：會被水冷「Core II」子字串誤中；改列具體型號 token
  [ProductCategory.CPU]: ['處理器', 'CPU', 'Processor', 'Core i3', 'Core i5', 'Core i7', 'Core i9', 'Core Ultra', 'Ryzen'],
  [ProductCategory.MOTHERBOARD]: ['主機板', '主板', 'Motherboard'],
  [ProductCategory.GPU]: ['顯示卡', '顯卡', '繪圖卡', 'Graphics', 'GeForce', 'Radeon'],
  [ProductCategory.RAM]: ['記憶體', 'Memory', 'DDR'],
  [ProductCategory.SSD]: ['固態硬碟', 'SSD', 'NVMe', 'M.2'],
  [ProductCategory.HDD]: ['傳統硬碟', '硬碟', 'HDD', 'Hard Drive'],
  [ProductCategory.PSU]: ['電源供應器', '電源', 'Power Supply', 'PSU'],
  [ProductCategory.CASE]: ['機殼', 'Case', 'Chassis'],
  [ProductCategory.COOLER]: ['散熱器', 'CPU散熱', 'Cooler', 'AIO', '水冷', '空冷', '塔散', '下吹式', '導管', '一體式', 'Liquid', '冷排', '冷頭'],
  [ProductCategory.MONITOR]: ['螢幕', '顯示器', 'Monitor', '電競螢幕'],
  [ProductCategory.KEYBOARD]: ['鍵盤', '鍵鼠組', 'Keyboard'],
  [ProductCategory.MOUSE]: ['滑鼠', 'Mouse'],
  [ProductCategory.HEADSET]: ['耳機', '耳麥', 'Headset', 'Headphone'],
  [ProductCategory.SPEAKER]: ['喇叭', 'Speaker'],
  [ProductCategory.FAN]: ['風扇', 'Fan', 'PWM'],
  // 不可列入 'KVM'：內建 KVM 的電競螢幕會被整批吸走（子分類判定才用 KVM）
  [ProductCategory.CABLE]: [
    '線材', '傳輸線', '轉接線', '延長線', '充電線', '網路線', '排線', '電源線', '音源線', '光纖線', '編織線',
    '轉接頭', '轉接器', '切換器', '分配器', 'Cable',
  ],
  [ProductCategory.NETWORK]: ['網路', '無線', 'Router', 'Wi-Fi', 'NAS'],
  // 不可列入裸 'OS'：會被「支援 Mac OS / NON-OS」子字串誤中
  [ProductCategory.OS]: ['作業系統', 'Windows', '軟體', 'Software', '防毒', 'Office', 'Microsoft 365'],
  [ProductCategory.PACKAGE]: [
    // 僅保留「真正多件組合」字樣作為 isRealBundle 的補漏；單品條件價（套裝搭購/搭板/組裝）由 detectPriceCondition 處理
    // 移除過寬的 '套裝/高興價/戰鬥版電競筆電'（真品由 isLaptop / isRealBundle 判定，避免誤把單一週邊歸組合）
    '組合', '欣巴組', '優惠組', '捷元品牌電腦', '欣亞PC', '電競電腦',
    '限量組合', '套餐', '超值組', '超值搭配', '組合包', '大全配', '合購'
  ],
  [ProductCategory.OTHER]: [],
};

/**
 * 將多個層級組成 `A > B > C` 子分類字串。
 * 從第一個未知（null/空）層級起截斷，只保留「有把握」的前綴，
 * 徹底避免「其他系列 > 其他型號 > 其他容量」這類佔位噪音污染側欄樹。
 * 第一層即未知時回傳 null（該商品不顯示子分類，落在平列清單）。
 */
function hierarchy(...levels: (string | null | undefined)[]): string | null {
  const out: string[] = [];
  for (const level of levels) {
    const value = level && level.trim();
    if (!value) break;
    out.push(value);
  }
  return out.length > 0 ? out.join(' > ') : null;
}

// ─── 否定過濾器（Negative Filters）偵測函數 ───

/** 筆電 / 一體機特徵：含螢幕吋數或筆電字樣（CPU、顯卡本體都不會有吋數）。 */
export function isLaptopLike(name: string): boolean {
  return /\d{1,2}(?:\.\d)?\s*吋|筆電|筆記型|LAPTOP|電競筆|手提電腦/i.test(name);
}

export function isCpuContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  if (isLaptopLike(name)) return true; // 含吋數/筆電者為整機，非 CPU 本體
  if (looksLikeMotherboard(name)) return true;
  const excludes = [
    '筆電', '筆記型', 'LAPTOP', '掌機', 'CLAW', 'ALLY', 'DECK', 'Z1', 'Z2', 'RYZEN Z', 'NUC', 'MINI PC', '迷你電腦', '準系統',
    '工作站', '套裝電腦', 'AIO PC', '保護蓋', '扣具', '防彎', '散熱器', '水冷', '防彎扣具', '防壓框',
    '螺絲', '轉接卡', '保護套',
    // 水冷（MasterLiquid「Core II」子字串誤中 CPU）與導熱介質配件（相變導熱貼「適用於CPU」誤中 CPU）
    'LIQUID', '冷頭', '冷排', '導熱貼', '導熱膏', '散熱膏', '相變'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isMbContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  const excludes = [
    '轉接', '擴充', 'PCI-E to', 'E-key', 'M.2 to', '托盤', '支架', '相容', '僅支援', '燈效',
    '套件', '組合', '大全配', '螺絲', '天線', '擋板'
  ];
  // 注意：主機板常宣傳「超大散熱片」，'散熱片' 不可當污染詞（M.2 散熱片配件無晶片組規格，由隱式偵測把關）
  return excludes.some(ex => upper.includes(ex));
}

export function isGpuContaminated(name: string): boolean {
  const upper = name.toUpperCase();

  // 筆電/整機特徵排除：含螢幕吋數或筆電字樣（顯卡本體不會有吋數；避開 Sapphire NITRO+ 等顯卡品牌字樣）
  if (isLaptopLike(name)) return true;

  // 掌機與播放器特徵排除
  if (/ALLY|CLAW|DECK|RYZEN\s*Z[12]|播放器|電視盒|SHIELD\s*TV/i.test(name)) return true;

  // 整機/工作站主機排除（但保留「工作站繪圖卡 / 專業繪圖卡」這類真正的顯卡）
  if (/商用工作站|商用主機|準系統|迷你主機|套裝主機|套裝電腦|桌上型主機|MINI\s*PC/i.test(name) &&
      !/繪圖卡|顯示卡/.test(name)) {
    return true;
  }

  // 機殼特徵排除
  if (/顯卡長|CPU高|U高|硬碟位|玻璃透側|全景玻璃|支援背插|防塵網|機箱|手提包/i.test(name)) return true;

  const excludes = [
    '支撐架', '千斤頂', '直立式', '延長線', '鍍金線', '套件', '掌機', '筆電', '內顯',
    '機殼', '長度限高', '電源倉', '水冷頭', '水冷板', '顯卡線', '轉接頭', '支架',
    '排線', '轉接線', '顯卡排線', '橋接器', 'SLI橋接'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isRamContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  const excludes = [
    '顯示卡', 'VRAM', 'SSD', 'M.2', 'GDDR', '顯存', '套裝主機', '電供', '散熱片', '外殼', '散熱膏'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isSsdContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  // M.2 外接盒（Arion/Cobble 等）：有 USB10G/雙模訊號但無任何真實容量 → 非 SSD 本體
  if (/USB\s*10G|雙模/i.test(name) && !/\d+(?:\.\d+)?\s*TB|(?<!USB\s?)\b\d{3,4}\s*G+B?\b/i.test(name)) return true;
  // 「1TB 含散熱片/讀14700/TLC」是 SSD 本體規格；只有無讀寫/顆粒簽章時才是散熱片配件
  if (/散熱片|散熱貼|導熱/.test(name) && !/讀\s*[:取]?\s*\d{3,5}|寫\s*\d{3,5}|\bTLC\b|\bQLC\b/i.test(name)) return true;
  const excludes = [
    '筆電', '工作站', '工作主機', '外接盒', '主機板', '準系統',
    '外接座', '轉接卡', '轉接線', '螺絲', '外接硬碟', '行動硬碟', '硬碟儲存',
    'MY BOOK', 'EXPANSION DESKTOP', '新黑鑽', '雙硬碟', '3.5吋外接'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isHddContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  const excludes = [
    '外接盒', '轉接', '托架', '排線', '連接器', '防震包', '收納', 'SSD', '固態硬碟', '防震盒',
    // Razer Barracuda（梭魚）耳機、HDMI 線（型號含 HDD 字樣）、風扇（RPM / PWM / 3Pin / 燈效 / N入組）不可落入 HDD
    '耳機', '耳麥', 'RAZER', '雷蛇', 'HDMI', '傳輸線', '風扇', '鍵盤', '滑鼠', 'PWM', 'ARGB', '入組', '3PIN', '燈效'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isCoolerContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  const excludes = [
    '套裝PC', '主機', '顯示卡', '導熱貼', '機殼', '主機板', '扣具'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isPsuContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  // 電源「線材 / 配件 / 測試器」排除，避免被 "電源" 關鍵字誤收。
  // 不可列入裸「線材」：電源本體規格會寫「黑色線材 / 雙色線材」，會把整顆電源踢出 PSU。
  const excludes = [
    '延長線', '分接', '電源線', '排插', '測試器', '轉接', '不斷電', 'UPS', '保護蓋',
    '行動電源', '快充', '充電', '磁吸', 'MAH', 'GAN', '音響', '喇叭', '藍牙', '藍芽',
    // 「電源」誤收的配件：電源擴充線、免電源轉換線、硬碟外接盒（獨立電源開關/抽換/多 Bay）
    '擴充線', '轉換', '外接盒', '抽換', '硬碟外接', '獨立電源開關', 'BAY'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isSpeakerContaminated(name: string): boolean {
  if (/含喇叭|內建喇叭/i.test(name) && /HDR|HDMI|2H1C|\bVA\b|\bIPS\b|SMART\s*M\d|S\d{2}[A-Z]/i.test(name)) return true;
  return /螢幕|顯示器|MONITOR|電競螢幕|\bFHD\b|\bQHD\b|\bUHD\b|4K|2K|1080P|1440P/i.test(name);
}

/**
 * 燒錄機的「支援 Windows、macOS」會誤中 OS 關鍵字。
 * 不可用 `DVD` / `M-DISC` 當排除詞：Windows 隨機版標示「《含DVD》」，會被一起排掉。
 * 另擋「附加密備份軟體」的外接硬碟、「支援監控軟體」的 UPS、「軟體最高1500萬畫素」的視訊鏡頭。
 */
export function isOsContaminated(name: string): boolean {
  return /燒錄機|燒錄器|光碟機|BLU-?RAY|藍光/i.test(name) ||
    /鏡頭|WEBCAM|不斷電|\bUPS\b|硬碟|\bSSD\b|畫素|對焦|備份軟體|監控軟體/i.test(name);
}

/**
 * 顯卡立架 / 集線器 / 外接盒等「附一條線」的配件不是線材本體。
 * 螢幕規格常列 KVM、Type-C、切換等字樣，需以品名格式（【27型】/ 電競螢幕）擋下；
 * 電源供應器規格會寫「黑色線材 / 雙色線材」，需以認證＋模組化簽章擋下。
 */
export function isCableContaminated(name: string): boolean {
  return /立架|豎立|直立套件|支撐架|顯卡套件|集線器|\bHUB\b|外接盒|硬碟座|讀卡機|機殼|主機板/i.test(name) ||
    /【\d{2}型】|電競螢幕|液晶螢幕/.test(name) ||
    (/80\s?\+|金牌|白金|銅牌|鈦金/.test(name) && /全模組|半模組|ATX\s?3/i.test(name));
}

/**
 * 隱式線材偵測：品名可能完全沒有「線」字（`HDMI 2.0 公-公 / 1米`、`CAT.6A 1米`）。
 * 簽章＝接頭配對 / `A to B` 轉接 / 網路線規 ＋ 線長，缺一不可，避免誤收帶接頭規格的零件。
 */
function looksLikeCable(name: string): boolean {
  if (isCableContaminated(name)) return false;
  if (!/\d+(?:\.\d+)?\s*(?:米|M\b|CM\b|公分)/i.test(name)) return false;
  return /公\s*-\s*[公母]|母\s*-\s*[公母]/.test(name) ||
    /\b(?:HDMI|DP|DVI|VGA|USB|Type-?[AC]|SATA|IDE|RJ-?45|D-?SUB)\b[^,+＋]{0,14}\bto\b/i.test(name) ||
    /\bCAT\.?\s?[5-8][A-Z]?\b/i.test(name);
}

export function isCaseContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  return /TRAVEL\s*CASE|ALLY|掌機|收納|保護包|保護套|防潑水|攜行包|包$/.test(upper);
}

/** KEYBOARD 來源常混入電競椅/電競桌/升降桌等家具（非 DIY 零件，過濾後由 diy-filter 移除）。 */
export function isKeyboardContaminated(name: string): boolean {
  return /電競椅|電競桌|升降桌|電腦桌|辦公椅|工學椅|沙發|椅墊|腳托|桌墊超值組/i.test(name);
}

/** FAN 來源常混入水冷、GPU（三風扇規格）、PSU、集線器/燈條/延長線等配件。 */
export function isFanContaminated(name: string): boolean {
  if (/不含風扇|不附風扇|無風扇/.test(name)) return true;              // 盒裝 CPU 的「不含風扇」標示
  if (/水冷|一體式|\bAIO\b|下吹式|導管|塔散/i.test(name)) return true; // AIO 與 CPU 散熱器
  if (RE_GPU_MODEL.test(name)) return true; // 顯卡以「三風扇」規格誤中 FAN 關鍵字
  if (looksLikePsu(name)) return true;
  if (/集線器|延長線|串接線|排線|擴充線|燈條|燈效套件|支撐架|千斤頂|散熱膏|轉接/i.test(name)) return true;
  if (/螢幕|LCD液晶/i.test(name) && !/風扇|\bFAN\b/i.test(name)) return true;
  return false;
}

/** NETWORK 來源常混入印表機、無線充電座、無線耳麥、無線鍵鼠組、掌機、HDMI 線等「無線/Wi-Fi」誤中品。 */
export function isNetworkContaminated(name: string): boolean {
  return /印表機|複合機|事務機|連續供墨|充電座|充電盤|充電器|行動電源|耳機|耳麥|鍵鼠|鍵盤|滑鼠|遊戲鼠|掌機|ALLY|CLAW\s*A\d|HDMI|傳輸線|喇叭|聲霸|SOUNDBAR|擴音機|工作站|網路線|\bCAT\.?\s?[5-8]/i.test(name);
}

/**
 * 偵測「搭板 / 組裝 / 限組裝」等條件式定價標記。
 * 注意：這是「單品的購買條件」而非「多件商品組合」——單品（如限組裝硬碟、搭板價主機板）
 * 仍應歸入其真實零件分類，只在 specs.priceCondition 記註記，避免污染跨店比價（搭購價通常偏低）。
 */
export function detectPriceCondition(name: string): string | null {
  if (/限組裝|限整機/.test(name)) return '限組裝';
  if (/組裝價/.test(name)) return '組裝價';
  if (/搭板|搭版|任搭主機板|任搭板|任搭CPU|板U價|搭機價/.test(name)) return '搭板價';
  if (/搭購價|搭購優惠|套裝搭購|U版專案/.test(name)) return '搭購價';
  if (/加購優惠|限加購|加購價/.test(name)) return '加購價';
  return null;
}

// CPU 型號正則（含尾碼如 9800X3D / 9500F / Core 5 210H），供整機 / 筆電 簽章判定
const RE_CPU_MODEL = /Ryzen\s*(AI\s*)?[3579]|Core\s*(Ultra\s*)?[3579]|Core\s*[3579]\s*\d{2,3}H|Core\s*Ultra|\bC[3579][\s-]?\d{3}H\b|\b[ui][3579][\s-]?\d{3,5}[A-Z0-9]{0,3}|\bR[3579][\s-]?\d{3,4}[A-Z0-9]{0,4}|Ultra\s*[3579][\s-]?\d|Threadripper|\bN[12]\d{2}\b|\bG\d{4}\b/i;
const RE_STORAGE = /\b\d{3}\s?G(?:B)?\b|\b\d\s?T(?:B)?\b|\bSSD\b|512G|PCIe|M\.2/i;
// 型號數字後不可用 \b：「RTX 5070Ti / RX9070XT」的 Ti/XT 直接黏尾會使 \b 失效而漏判
const RE_GPU_MODEL = /\b(RTX|GTX|GT)\s?\d{3,4}(?!\d)|\bRX\s?\d{3,4}(?!\d)|\bArc\s?[AB]\d{3}(?!\d)/i;

const INTEL_CHIPSETS = ['Z890', 'W890', 'Z790', 'W790', 'B860', 'B760', 'H810', 'H610', 'W680', 'B660'] as const;
const AMD_CHIPSETS = ['X870E', 'X870', 'WRX90', 'TRX50', 'B850', 'B840', 'X670E', 'X670', 'B650E', 'B650', 'A620', 'B550', 'A520'] as const;
const MOTHERBOARD_CHIPSETS = [...INTEL_CHIPSETS, ...AMD_CHIPSETS] as const;
const MOTHERBOARD_CHIPSET_RE = new RegExp(`\\b(?:${MOTHERBOARD_CHIPSETS.join('|')})[A-Z-]*\\b`, 'i');
const MOTHERBOARD_SIGNAL_RE = /相\s*(電源|供電)|供電|\bDIMM\b|\bM-?ATX\b|MATX|MICRO-ATX|Mini-ITX|\bE?-?ATX\b|\bEEB\b|LGA\d|\bAM[45]\b|晶片組|主機板|\bLAN\b/i;

/**
 * 真筆電 = 筆電字樣 + 螢幕吋數 + 儲存（排除「筆電記憶體/散熱器/支架」等配件——配件不會同時有吋數與儲存）。
 * 不要求 CPU 型號：Snapdragon X 等非 x86 筆電的型號不在 `RE_CPU_MODEL` 內。
 */
function isLaptop(name: string): boolean {
  if (!/筆電|筆記型|LAPTOP|電競筆/i.test(name)) return false;
  return /\d{1,2}(?:\.\d)?\s*吋/.test(name) && RE_STORAGE.test(name);
}

/** 預建成品機 / 迷你 PC（含作業系統或 NON-OS）：CPU 型號 + Windows + 儲存。 */
/**
 * 伺服器 / 商用工作站整機。Xeon 料號（W5-3423、E-2436）不在 `RE_CPU_MODEL` 內，
 * 改以「整機字樣 + 斜線規格清單 + 記憶體 + (儲存或瓦數)」判定，否則會被品名裡的 `DVD-RW` 拖進光碟機。
 */
function isServerWorkstation(name: string): boolean {
  if (!/伺服器|工作站|\bSERVER\b/i.test(name)) return false;
  // 「行動工作站」（HP ZBOOK）帶螢幕吋數，是筆電不是機架/直立工作站
  if (isLaptopLike(name)) return false;
  if (/主機板|機殼|電源供應器|記憶體|散熱器|網路卡|顯示卡|繪圖卡|鍵盤|滑鼠|螢幕/.test(name)) return false;
  return /\/.*\//.test(name) &&
    /\b\d{2,3}\s*G\b|DDR[45]|\bD[45]\b/i.test(name) &&
    (RE_STORAGE.test(name) || /\d{3,4}\s?W\b/i.test(name));
}

function isPrebuiltSystem(name: string): boolean {
  const hasOs = /WIN(DOWS)?\s*1[01]|\bW1[01]\b|NON-?OS/i.test(name);
  return RE_CPU_MODEL.test(name) && hasOs && RE_STORAGE.test(name);
}

/** 自組整機（斜線規格清單）：CPU 型號 + 電源 + (機殼 / 晶片組 / 顯卡)。 */
function isSlashBuild(name: string): boolean {
  const hasPsu = /電供|電源|\d{3,4}\s?W\s*電|\d{3,4}\s?W\b.*(金牌|銅牌|白金)/i.test(name);
  const hasMore = /機殼|水冷|空冷|散熱|\b[125]\s?T\b|\b\d{3}G\b|\b\d{2,3}G\s*\/|SSD/i.test(name) ||
    MOTHERBOARD_CHIPSET_RE.test(name) ||
    /RTX\s?\d{4}|\bRX\s?\d{4}\b/i.test(name);
  return RE_CPU_MODEL.test(name) && hasPsu && hasMore;
}

function isAiWorkstationSystem(name: string): boolean {
  const hasSystemSku = /ASUS\s+ASCENT\s+GX10|DGX\s*SPARK|GB10|AI\s*TOP\s*ATOM|BRAINS?PHERE/i.test(name);
  return hasSystemSku && /\/.*\/|SSD|GEN4|1\s?TB|\b128G\b/i.test(name);
}

function isCompleteSpecSystem(name: string): boolean {
  const hasRam = /\b\d{2,3}\s*G\b|DDR[45]/i.test(name);
  // 內顯整機（華碩【I5管理者】I5-12400 / H610 / 8G DDR4 / 512G SSD）沒有獨顯，晶片組也算完整主機訊號
  const hasGpuOrChipset = RE_GPU_MODEL.test(name) || MOTHERBOARD_CHIPSET_RE.test(name);
  return /\/.*\//.test(name) && RE_CPU_MODEL.test(name) && hasGpuOrChipset && hasRam && RE_STORAGE.test(name);
}

/**
 * 是否為「真正的組合 / 整機」——多件不同零件搭售、或完整成品系統（整機/準系統/筆電）。
 * 僅這類歸入 PACKAGE；單純帶條件價的單品（80+金牌電源、限組裝硬碟）不算組合。
 */
export function isRealBundle(name: string): boolean {
  return bundleReason(name) !== null;
}

/**
 * 回傳命中的組合判定規則名（未命中為 null）。
 * 拆出規則名讓 audit / 診斷腳本能定位「哪一條規則造成誤判」，避免只能黑箱猜測。
 */
export function bundleReason(name: string): string | null {
  // 加購優惠是單品搭售條件，不是組合本體
  if (/【加購優惠】|^加購優惠/.test(name)) return null;
  // NAS 是單品；型號結尾常帶加號（Synology DS225+）會被 A+B 誤判
  if (isNasAppliance(name)) return null;

  // 1. 完整成品系統 / 筆電 / 準系統 / 迷你 PC / 掌機
  if (isServerWorkstation(name)) return 'server-workstation';
  if (isLaptop(name)) return 'laptop';
  if (/掌機|ROG\s*(?:XBOX\s*)?ALLY|CLAW\s*A\d|STEAM\s*DECK|LEGION\s*GO/i.test(name) && RE_STORAGE.test(name)) return 'handheld';
  const barebone = barebonePcReason(name);
  if (barebone) return barebone;
  if (isPrebuiltSystem(name)) return 'prebuilt-os';
  if (isAiWorkstationSystem(name)) return 'ai-workstation';
  if (isCompleteSpecSystem(name)) return 'complete-spec';
  if (/CPU\.RAM\.DISK選購|PRO\s*DP21/i.test(name) && MOTHERBOARD_CHIPSET_RE.test(name)) return 'select-build';
  // 品牌電競桌機（Infinite / AORUS PRIME 等型號 + CPU + WIN + 儲存）
  if (/Infinite\s*S\d|Infinite\s*Z\d|AORUS\s*PRIME|商用工作站|Z2G?\d/i.test(name) &&
      RE_CPU_MODEL.test(name) && /WIN|NON-?OS/i.test(name) && RE_STORAGE.test(name)) {
    return 'branded-desktop';
  }
  if (/【AI\s*TOP[^】]+】/i.test(name) && RE_GPU_MODEL.test(name) && /\/.*\//.test(name)) return 'ai-top';
  if (isSlashBuild(name)) return 'slash-build';
  // 2. 明確組合關鍵字（線材「延長線組合包」不是零件組合）
  if (/大全配|全配|超值組|組合包|套餐|欣巴組|捷元品牌電腦|合購|限量組合|優惠組合|組合優惠|螢幕支架組/i.test(name) && !isCableAccessory(name)) return 'bundle-keyword';

  // 3. A+B 核心零件搭售。先中和假加號，再要求「加號後接另一件商品的品牌」——
  //    通路寫真組合一律是「商品A + 品牌 商品B」；假加號後面接的是規格詞（WIFI / BT 5.3 / 不閃屏 / -B）。
  const cleaned = neutralizeFakePlus(name);
  const bundledWithBrand = plusFollowedByBrand(cleaned);
  if (bundledWithBrand &&
      /[+＋][^+＋]{0,45}(電源|電供|POWER\b|主機板|記憶體|RAM\b|DDR[45]|SSD|硬碟|固態|螢幕|MONITOR|OFFICE|WIN1|顯卡|顯示卡|繪圖卡|機殼|鍵盤|滑鼠|喇叭|耳機|電競桌)/i.test(cleaned)) return 'plus-part';
  if (/(螢幕|顯示器|MONITOR).{0,90}[+＋]\)?[^+＋]{0,90}(鍵盤|滑鼠|狼蛛|AULA|電競桌)/i.test(cleaned)) return 'plus-monitor-peripheral';
  if (/(?:^|[^A-Z0-9])[+＋]\s*[^+＋]{0,60}(?:\b(?:RTX|GTX)\s?\d{3,4}\b|\bRX\s?\d{3,4}\b|\bArc\s?[AB]\d{3}\b)/i.test(cleaned)) return 'plus-gpu';
  if (RE_CPU_MODEL.test(name) && /[+＋]\s*[^+＋]{0,80}\b(?:Z890|W890|Z790|W790|B860|B760|H810|H610|W680|X870E|X870|WRX90|TRX50|B850|B840|X670E|X670|B650E|B650|A620|B550|A520)[A-Z-]*\b/i.test(cleaned)) return 'plus-cpu-chipset';
  // 3b. A+B：+ 後接「瓦數 + 80+牌」的電源（如 顯卡/主機板 + 海韻 750W 金牌）；cooler 的 230W 無牌不會中
  if (!isBuiltInPsu(name) &&
      /[+＋][^+＋]{0,30}\d{3,4}\s?W\b[^+＋]{0,12}(金牌|銅牌|白金|鈦金|銀牌|白牌)/i.test(cleaned)) return 'plus-psu-rated';
  // 4. 機殼 + 電源 搭售：同時具備機殼與瓦數/電源訊號且有加號（須用中和後字串，否則「80+金牌 … 雙倉機殼專用 850W」電源單品會誤判）
  if (!isBuiltInPsu(name) &&
      /[+＋]/.test(cleaned) && /機殼|透側|玻璃側|全景玻璃/i.test(cleaned) && /電源|電供|\d{3,4}\s?W\b/i.test(cleaned)) return 'case-plus-psu';
  return null;
}

/**
 * 真組合的加號後緊接「另一件商品」，通路慣例先寫品牌（`+ 威剛 NB 16G`、`+【24型】AOC 24B36X`）。
 * 假加號後面接的是規格或型號片段（`M.2+ WIFI`、`NITRO+ 氮動`、`低藍光+不閃屏`、`FK1+-B`）。
 */
function plusFollowedByBrand(cleaned: string): boolean {
  for (const m of cleaned.matchAll(/[+＋]\s*(?:【[^】]*】\s*)?([^+＋]{2,28})/g)) {
    if (extractBrand(m[1])) return true;
  }
  return false;
}

/**
 * 機殼「內附/內含 200W 電源」是本體規格，不是搭售另一顆電源，也不代表商品是電源。
 * 須緊接瓦數/電源詞才算，否則「內附顯卡支撐架」的機殼 + 電源真組合會被誤殺。
 */
export function isBuiltInPsu(name: string): boolean {
  return /內[附含][^\/,、]{0,8}(\d{2,4}\s?W\b|電源|PSU)/i.test(name);
}

/** 線材類「延長線組合包 / 理線組」不是零件組合。 */
function isCableAccessory(name: string): boolean {
  return /編織線|延長線|理線|線材|轉接線|線規/.test(name);
}

/** NAS 機（Synology DS225+ / QNAP TS-464 / 華芸 AS5402T【2Bay】）是單品，非組合。 */
function isNasAppliance(name: string): boolean {
  return /\d+\s*Bay/i.test(name) &&
    /NAS|SYNOLOGY|群暉|QNAP|威聯通|華芸|ASUSTOR|\bDS\d{3}|\bTS-?\d{3}/i.test(name);
}

/** 準系統 / 迷你 PC / 通路整機的關鍵字判定。 */
function barebonePcReason(name: string): string | null {
  // 準系統關鍵字易被配件誤中：`mini PCIE 無線模組`、`DeskMini 專用 WiFi 模組`、`Wooden NUC DIY 木製機殼`
  if (/準系統|迷你主機|迷你電腦|MINI\s*PC(?!IE)|\bNUC\b|\bCUBI\b|\bBRIX\b|DeskMini|DeskMeet/i.test(name) &&
      !/模組|機殼/.test(name)) {
    return 'barebone';
  }
  // 「整機」二字單獨用會誤中條件價 `~限整機~`（三星 SSD）；改用具體詞
  if (/品牌電腦|品牌機|套裝電腦|套裝主機|桌上型主機|桌上型電腦|電競電腦|欣亞PC|整機電腦|整機主機/i.test(name)) return 'retail-system';
  return null;
}

/** 中和「不是組合語意」的加號：VRM 相數、機殼 clearance、PSU 效率認證、容量與數量加號。 */
function neutralizeFakePlus(name: string): string {
  return name
    .replace(/\d[\d+＋\s]*(相\s*(電源|供電)|電源相位)/gi, ' 相供電 ')     // 主機板 N+N+N 相電源 VRM（欣亞寫「18+3+3 電源相位」）
    .replace(/顯[示]?卡\s*(長|支援|支撐架?|\d{2,3}\s*(mm|cm|公分))/gi, ' ') // 機殼 clearance：顯卡408mm/顯示卡支撐架（保留「+顯卡 RTX」真組合）
    .replace(/塔散\s*\d{2,3}/gi, ' ')                                     // 機殼 clearance：塔散172mm
    .replace(/\b(8\d|9[0-2])\s*[+＋]/gi, '$1 ')                           // PSU 效率認證 80+/85+/90+/92+（晶片組為字母前綴、瓦數無此型，皆安全）
    .replace(/(\d+)\s*G\b\s*[+＋]\s*(\d+)\s*G\b/gi, '$1G $2G')            // 容量加號 8G+8G
    .replace(/\d+(?:\s*[+＋]\s*\d+)+/g, m => m.replace(/[+＋]/g, ' '));    // 連鎖數量加號 2+2、18+3+3（單次 replace 無法吃連鎖）
}

/** 隱式電源偵測：品名無「電源」字但具 PSU 簽章（瓦數 + 80+認證/牌/模組化/ATX3/SFX）。 */
export function looksLikePsu(name: string): boolean {
  if (isPsuContaminated(name)) return false;
  // 「ITX 電腦機殼(內含 SFX 850W)」的瓦數屬機殼規格，本體不是電源
  if (isBuiltInPsu(name)) return false;
  const hasWatt = /\b\d{3,4}\s?W\b/i.test(name);
  const hasSig = /\b(8\d|9[0-2])\s*[+＋]|金牌|銅牌|白金牌|鈦金|銀牌|白牌|PLATINUM|GOLD|BRONZE|TITANIUM|全模組|半模組|直出|ATX\s*3\.|\bSFX\b|12VHPWR/i.test(name);
  if (hasWatt && hasSig) return true;
  // 瓦數藏在型號（UD750GM）而無獨立「750W」token 時，以「認證 + 模組化/ATX3」雙訊號判定
  const hasRating = /金牌|銅牌|白金|鈦金|銀牌|白牌|PLATINUM|GOLD|BRONZE|TITANIUM/i.test(name);
  const hasPsuForm = /全模組|半模組|直出|ATX\s*3\.|12VHPWR/i.test(name);
  return hasRating && hasPsuForm;
}

/** 隱式固態硬碟偵測：品名無「SSD」字但具 SSD 簽章（讀寫速度 + TLC/QLC 或 Gen PCIe + M.2/2.5吋，且非機械碟）。 */
export function looksLikeSsd(name: string): boolean {
  const hasRw = /讀\s*[:取]?\s*\d{3,5}|寫\s*\d{3,5}|\bTLC\b|\bQLC\b/i.test(name);
  const hasForm = /M\.2|2\.5吋|Gen\d\s*PCIe|PCIe\s*[345]\.0|NVMe/i.test(name);
  const isHdd = /7200|5400|5640|\d+轉|那嘶狼|紅標|金標|藍標|EXOS|監控/i.test(name);
  return hasRw && hasForm && !isHdd;
}

export function looksLikeHdd(name: string): boolean {
  if (isHddContaminated(name)) return false;
  // 不可用 \bRPM\b：機殼風扇「1600 RPM」會誤中；HDD 台灣通路一律寫「N轉」
  return /(7200|5400|5640|5900)\s*轉|IRONWOLF|那嘶狼|紅標|EXOS|BARRACUDA|SKYHAWK|WD\s*(RED|PURPLE|GOLD)|外接硬碟|行動硬碟|MY\s*BOOK|EXPANSION\s*DESKTOP|新黑鑽|雙硬碟儲存/i.test(name);
}

export function looksLikeMotherboard(name: string): boolean {
  return MOTHERBOARD_CHIPSET_RE.test(name) && MOTHERBOARD_SIGNAL_RE.test(name) && !isMbContaminated(name);
}

function detectMotherboardChipset(name: string): string | null {
  const match = name.toUpperCase().match(MOTHERBOARD_CHIPSET_RE);
  if (!match) return null;
  const token = match[0];
  return MOTHERBOARD_CHIPSETS.find(chipset => token.startsWith(chipset)) ?? null;
}

export function isMonitorContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  // 排除「內含顯示螢幕／LCD 但本體非螢幕」的商品：AIO 水冷頭、PSU OLED 螢幕、可觸控鍵盤、螢幕架/掛燈、升降桌等
  if (/水冷|AIO|水冷頭|RYUJIN|龍神|GAMING\s*LC/i.test(name)) return true;
  if (/可觸控|觸控顯示|鍵盤|滑鼠/i.test(name)) return true;
  if (/電源供應|POWER\s*SUPPLY|OLED\s*顯示|THOR/i.test(name)) return true;
  if (/投影機|升降桌|電腦桌|電競桌|工作桌/i.test(name)) return true;
  const excludes = ['螢幕架', '螢幕支架', '螢幕掛燈', '增高架', '壁掛架', '機殼'];
  return excludes.some(ex => upper.includes(ex));
}

// 常見螢幕尺寸（吋）白名單，用於從型號數字推斷尺寸
const MONITOR_SIZES = new Set([22, 23, 24, 25, 27, 28, 29, 30, 31, 32, 34, 37, 38, 40, 42, 43, 45, 48, 49, 55, 57, 65]);

/**
 * Detect category from product name using keyword matching
 */
export function detectCategory(name: string): ProductCategory {
  const upperName = name.toUpperCase();

  // 隱式機殼偵測（即使品名無"機殼"二字，但含有典型的機殼規格參數，優先歸入機殼）
  if (!isCaseContaminated(name) && (upperName.includes('顯卡長') || upperName.includes('顯卡支援')) &&
      (upperName.includes('CPU高') || upperName.includes('U高') || upperName.includes('玻璃') || upperName.includes('透側'))) {
    return ProductCategory.CASE;
  }

  // 隱式硬碟偵測：含轉速 / NAS 碟暱稱等 HDD 專屬訊號（SSD 永遠沒有轉速）
  if (looksLikeHdd(name)) {
    return ProductCategory.HDD;
  }

  // 隱式風扇偵測：品名無「風扇」字但具 3/4Pin 接頭 + RPM 轉速簽章（Noctua FLX 等）
  if (!isFanContaminated(name) && /[34]\s*PIN/i.test(name) && /\bRPM\b/i.test(name)) {
    return ProductCategory.FAN;
  }

  // 隱式顯卡偵測：型號帶 RTX/GTX/RX/Arc 但品名無「顯示卡」字樣
  if (RE_GPU_MODEL.test(name) &&
      !isGpuContaminated(name)) {
    return ProductCategory.GPU;
  }

  // 隱式主機板偵測：僅以晶片組命名（B760/Z890/H610…）+ 主機板規格訊號，無「主機板」字，避免落到 NETWORK(無線)
  if (looksLikeMotherboard(name)) {
    return ProductCategory.MOTHERBOARD;
  }

  // 隱式電源偵測：品名常只有「850W + 80+金牌 + 全模組」而無「電源」字，避免落到 FAN/OTHER
  if (looksLikePsu(name)) {
    return ProductCategory.PSU;
  }

  // 隱式固態硬碟偵測：品名無「SSD」字但具讀寫速度 + TLC/Gen PCIe 簽章
  if (looksLikeSsd(name) && !isSsdContaminated(name)) {
    return ProductCategory.SSD;
  }

  // 隱式螢幕偵測：來源被標成 speaker，但品名是智慧螢幕/面板規格且含喇叭。
  if (isSpeakerContaminated(name) && /含喇叭|內建喇叭|SMART\s*M\d|S\d{2}[A-Z]/i.test(name)) {
    return ProductCategory.MONITOR;
  }

  // 隱式線材偵測：放在所有零件隱式偵測之後，只撿沒有「線」字的漏網線材
  if (looksLikeCable(name)) {
    return ProductCategory.CABLE;
  }

  const priorityOrder: ProductCategory[] = [
    ProductCategory.PACKAGE,
    ProductCategory.KEYBOARD,
    ProductCategory.MOUSE,
    ProductCategory.HEADSET,
    ProductCategory.SPEAKER,
    ProductCategory.CASE,
    ProductCategory.COOLER,
    ProductCategory.MOTHERBOARD,
    ProductCategory.GPU,
    ProductCategory.RAM,
    ProductCategory.SSD,
    ProductCategory.HDD,
    ProductCategory.PSU,
    ProductCategory.FAN,
    // CABLE 早於 NETWORK：網路線是線材，不是網通設備
    ProductCategory.CABLE,
    ProductCategory.NETWORK,
    ProductCategory.OS,
    // MONITOR 排在較後面：避免「LCD 水冷頭 / OLED 顯示螢幕電源 / 可觸控鍵盤」等含螢幕字樣的非螢幕商品被誤收
    ProductCategory.MONITOR,
    ProductCategory.CPU, // CPU is evaluated last because "CPU" keyword is often present in other components
  ];

  for (const category of priorityOrder) {
    if (category === ProductCategory.OTHER) continue;
    const keywords = CATEGORY_KEYWORDS[category];
    for (const keyword of keywords) {
      if (upperName.includes(keyword.toUpperCase())) {
        // 否定過濾器檢查
        if (category === ProductCategory.CPU && isCpuContaminated(name)) continue;
        if (category === ProductCategory.MOTHERBOARD && isMbContaminated(name)) continue;
        if (category === ProductCategory.GPU && isGpuContaminated(name)) continue;
        if (category === ProductCategory.RAM && isRamContaminated(name)) continue;
        if (category === ProductCategory.SSD && isSsdContaminated(name)) continue;
        if (category === ProductCategory.HDD && isHddContaminated(name)) continue;
        if (category === ProductCategory.COOLER && isCoolerContaminated(name)) continue;
        if (category === ProductCategory.PSU && isPsuContaminated(name)) continue;
        if (category === ProductCategory.CASE && isCaseContaminated(name)) continue;
        if (category === ProductCategory.SPEAKER && isSpeakerContaminated(name)) continue;
        if (category === ProductCategory.OS && isOsContaminated(name)) continue;
        if (category === ProductCategory.CABLE && isCableContaminated(name)) continue;
        if (category === ProductCategory.MONITOR && isMonitorContaminated(name)) continue;
        if (category === ProductCategory.FAN && isFanContaminated(name)) continue;
        if (category === ProductCategory.NETWORK && isNetworkContaminated(name)) continue;
        if ([ProductCategory.KEYBOARD, ProductCategory.MOUSE, ProductCategory.SPEAKER, ProductCategory.COOLER].includes(category) && isKeyboardContaminated(name)) continue;

        return category;
      }
    }
  }
  return ProductCategory.OTHER;
}

// ─── GPU 結構化型號表 ───
// 以「去空白後的大寫品名」比對；同世代需把較長／較具體的型號排前面，避免短字串先命中。
interface GpuModelDef {
  readonly needle: string; // 去空白大寫
  readonly display: string;
}

const GPU_MODELS: readonly GpuModelDef[] = [
  // NVIDIA 消費級 RTX 50
  { needle: '5090', display: 'RTX 5090' },
  { needle: '5080', display: 'RTX 5080' },
  { needle: '5070TI', display: 'RTX 5070 Ti' },
  { needle: '5070', display: 'RTX 5070' },
  { needle: '5060TI', display: 'RTX 5060 Ti' },
  { needle: '5060', display: 'RTX 5060' },
  { needle: '5050', display: 'RTX 5050' },
  // NVIDIA 消費級 RTX 40
  { needle: '4090', display: 'RTX 4090' },
  { needle: '4080SUPER', display: 'RTX 4080 Super' },
  { needle: '4080', display: 'RTX 4080' },
  { needle: '4070TISUPER', display: 'RTX 4070 Ti Super' },
  { needle: '4070TI', display: 'RTX 4070 Ti' },
  { needle: '4070SUPER', display: 'RTX 4070 Super' },
  { needle: '4070', display: 'RTX 4070' },
  { needle: '4060TI', display: 'RTX 4060 Ti' },
  { needle: '4060', display: 'RTX 4060' },
  // NVIDIA 消費級 RTX 30
  { needle: '3060TI', display: 'RTX 3060 Ti' },
  { needle: '3060', display: 'RTX 3060' },
  { needle: '3050', display: 'RTX 3050' },
  // NVIDIA 舊款 GT
  { needle: 'GT1030', display: 'GT 1030' },
  { needle: 'GT730', display: 'GT 730' },
  { needle: 'GT710', display: 'GT 710' },
  // AMD RX 9000 / 8000
  { needle: '9070XT', display: 'RX 9070 XT' },
  { needle: '9070GRE', display: 'RX 9070 GRE' },
  { needle: '9070', display: 'RX 9070' },
  { needle: '9060XT', display: 'RX 9060 XT' },
  { needle: '9060', display: 'RX 9060' },
  // AMD RX 7000
  { needle: '7900XTX', display: 'RX 7900 XTX' },
  { needle: '7900XT', display: 'RX 7900 XT' },
  { needle: '7900GRE', display: 'RX 7900 GRE' },
  { needle: '7800XT', display: 'RX 7800 XT' },
  { needle: '7700XT', display: 'RX 7700 XT' },
  { needle: '7650GRE', display: 'RX 7650 GRE' },
  { needle: '7600XT', display: 'RX 7600 XT' },
  { needle: '7600', display: 'RX 7600' },
  // Intel Arc
  { needle: 'B580', display: 'Arc B580' },
  { needle: 'B570', display: 'Arc B570' },
  { needle: 'A770', display: 'Arc A770' },
  { needle: 'A750', display: 'Arc A750' },
  { needle: 'A580', display: 'Arc A580' },
  { needle: 'A380', display: 'Arc A380' },
  // NVIDIA 專業卡
  { needle: 'RTXPRO6000', display: 'RTX PRO 6000' },
  { needle: 'RTXPRO5000', display: 'RTX PRO 5000' },
  { needle: 'RTXPRO4500', display: 'RTX PRO 4500' },
  { needle: 'RTXPRO4000', display: 'RTX PRO 4000' },
  { needle: 'RTXPRO2000', display: 'RTX PRO 2000' },
  { needle: 'RTX6000ADA', display: 'RTX 6000 Ada' },
  { needle: 'RTX5000ADA', display: 'RTX 5000 Ada' },
  { needle: 'RTX4500ADA', display: 'RTX 4500 Ada' },
  { needle: 'RTX4000ADA', display: 'RTX 4000 Ada' },
  { needle: 'RTXA6000', display: 'RTX A6000' },
  { needle: 'RTXA5500', display: 'RTX A5500' },
  { needle: 'RTXA5000', display: 'RTX A5000' },
  { needle: 'RTXA4500', display: 'RTX A4500' },
  { needle: 'RTXA4000', display: 'RTX A4000' },
  { needle: 'RTXA2000', display: 'RTX A2000' },
  { needle: 'RTXA1000', display: 'RTX A1000' },
  { needle: 'RTXA400', display: 'RTX A400' },
  { needle: 'T1000', display: 'T1000' },
  { needle: 'T400', display: 'T400' },
  // AMD 專業卡
  { needle: 'W7900', display: 'Radeon Pro W7900' },
  { needle: 'W7800', display: 'Radeon Pro W7800' },
  { needle: 'W7600', display: 'Radeon Pro W7600' },
  { needle: 'W7500', display: 'Radeon Pro W7500' },
  { needle: 'R9700', display: 'Radeon AI Pro R9700' },
];

/** 由型號顯示名推導所屬系列。 */
function gpuSeriesFromModel(display: string): string {
  const upper = display.toUpperCase();
  if (upper.startsWith('ARC')) return 'Intel Arc 系列';
  if (upper.startsWith('RADEON')) return 'AMD 專業繪圖卡';
  if (upper.startsWith('RTX PRO') || upper.startsWith('RTX A') || upper.includes('ADA') ||
      upper.startsWith('T1000') || upper.startsWith('T400')) {
    return 'NVIDIA 專業繪圖卡';
  }
  if (upper.startsWith('RTX 50')) return 'NVIDIA RTX 50系列';
  if (upper.startsWith('RTX 40')) return 'NVIDIA RTX 40系列';
  if (upper.startsWith('RTX 30')) return 'NVIDIA RTX 30系列';
  if (upper.startsWith('GT 10')) return 'NVIDIA GT 10系列';
  if (upper.startsWith('GT 7')) return 'NVIDIA GT 700系列';
  if (upper.startsWith('RX 90')) return 'AMD RX 9000系列';
  if (upper.startsWith('RX 80')) return 'AMD RX 8000系列';
  if (upper.startsWith('RX 70') || upper.startsWith('RX 76')) return 'AMD RX 7000系列';
  return '其他系列';
}

/** 未匹配到具體型號時，僅靠系列關鍵字推導（回傳 null 表未知）。 */
function gpuSeriesFallback(name: string): string | null {
  const upper = name.toUpperCase();
  if (/工作站|專業卡|繪圖卡|RTX\s*A\d{3,4}|RTX\s*PRO|RTX\s*\d{4}\s*ADA|\bT400\b|\bT1000\b/i.test(name)) {
    return 'NVIDIA 專業繪圖卡';
  }
  if (/RADEON\s*PRO|\bW\d{4}\b|R9700/i.test(name)) return 'AMD 專業繪圖卡';
  if (/RTX\s*50/i.test(name)) return 'NVIDIA RTX 50系列';
  if (/RTX\s*40/i.test(name)) return 'NVIDIA RTX 40系列';
  if (/RTX\s*30/i.test(name)) return 'NVIDIA RTX 30系列';
  if (/GT\s*10\d{2}/i.test(name)) return 'NVIDIA GT 10系列';
  if (/GT\s*7\d{2}/i.test(name)) return 'NVIDIA GT 700系列';
  if (/RX\s*9\d{3}/i.test(name)) return 'AMD RX 9000系列';
  if (/RX\s*8\d{3}/i.test(name)) return 'AMD RX 8000系列';
  if (/RX\s*7\d{3}/i.test(name)) return 'AMD RX 7000系列';
  if (/RX\s*6\d{3}/i.test(name)) return 'AMD RX 6000系列';
  if (upper.includes('ARC')) return 'Intel Arc 系列';
  return null;
}

/**
 * 抽取顯示記憶體容量（VRAM），避免抓到 4 位數型號。回傳如 "12G"，未知為 null。
 * 允許 OC 等前綴黏接（如 O24G、OC16G）與 GDDR 後綴（如 12G GDDR6）。
 */
function detectVram(name: string): string | null {
  const m = name.match(/(?:^|[\s(/[-])(?:O|OC)?(\d{1,2})\s?G(?:B|DDR\d)?(?=\b|$|[\s/)\]])/i);
  return m ? `${m[1]}G` : null;
}

// GPU 產品線關鍵字（用於區分同晶片的不同 SKU）。較長/具體者排前。
const GPU_LINES: readonly string[] = [
  // ASUS
  'ROG ASTRAL', 'ROG STRIX', 'STRIX', 'TUF', 'PRIME', 'PROART', 'DUAL', 'TURBO',
  // GIGABYTE
  'AORUS MASTER', 'AORUS ELITE', 'AORUS XTREME', 'AORUS', 'WINDFORCE MAX', 'WINDFORCE', 'EAGLE MAX', 'EAGLE', 'GAMING OC', 'AERO', 'XTREME WATERFORCE', 'GAMING',
  // MSI
  'SUPRIM X', 'SUPRIM', 'GAMING TRIO', 'GAMING X', 'VENTUS 3X', 'VENTUS 2X', 'VENTUS', 'INSPIRE', 'SHADOW', 'EXPERT',
  // ASRock
  'TAICHI', 'STEEL LEGEND', 'PHANTOM GAMING', 'CHALLENGER', 'CREATOR', 'AQUA', 'RIPTIDE',
  // Sapphire / PowerColor / XFX (AMD)
  'NITRO+', 'NITRO', 'PULSE', 'PURE', 'TOXIC', 'HELLHOUND', 'RED DEVIL', 'LIQUID DEVIL', 'REAPER', 'FIGHTER',
  'QUICKSILVER', 'SWIFT', 'MERC', 'SPEEDSTER',
  // ZOTAC
  'SOLID', 'AMP EXTREME', 'AMP', 'TRINITY', 'TWIN EDGE', 'TWIN',
  // PNY / Gainward / Palit / Inno3D / Galax / Colorful
  'VERTO', 'XLR8', 'EPIC-X', 'PHANTOM', 'PHOENIX', 'GHOST', 'GAMINGPRO', 'GAMING PRO', 'JETSTREAM', 'STORMX', 'INFINITY',
  'ICHILL', 'IGAME', 'VULCAN', 'NEPTUNE', 'BATTLE-AX', 'METALTOP', '1-CLICK',
  'UPRISING', 'ELITE', 'MASTER', 'CASTLE', 'MECH',
  // Low-profile board variants are sold as a stable SKU line by multiple vendors.
  'LOW PROFILE',
];

/**
 * 產生 GPU 的跨店比對鍵：晶片型號 + 產品線 + VRAM。
 * 例如「技嘉 RTX 5060 Ti WINDFORCE OC 8G」與「Gigabyte RTX5060Ti WINDFORCE 8G」→ 同鍵；
 * 但 EAGLE 版、16G 版 → 不同鍵，避免不同 SKU 被誤併。回傳 undefined 表無法辨識晶片。
 */
export function gpuMatchKey(name: string): string | undefined {
  const spaceless = gpuModelSearchText(name).toUpperCase().replace(/\s+/g, '');
  let chip: string | null = null;
  for (const def of GPU_MODELS) {
    if (spaceless.includes(def.needle)) { chip = def.display.replace(/\s+/g, '').toUpperCase(); break; }
  }
  if (!chip) return undefined;

  const upper = name.toUpperCase();
  let line: string | null = null;
  for (const l of GPU_LINES) {
    if (upper.includes(l)) { line = l.replace(/\s+/g, ''); break; }
  }
  if (!line && isProfessionalGpuChip(chip)) line = 'PRO';
  // 認不出產品線就不給精確鍵（交模糊比對），寧可分開顯示也不要把不同 SKU 誤併
  if (!line) return undefined;

  const vram = detectVram(name) ?? '';
  const variant = gpuVariantKey(upper);
  return [chip, line, vram, variant].filter(Boolean).join('-');
}

function isProfessionalGpuChip(chip: string): boolean {
  return /^RTX(PRO|A)|^RTX\d{4}ADA|^T\d{3,4}$/.test(chip);
}

function gpuVariantKey(upperName: string): string | null {
  const parts: string[] = [];
  if (/WHITE|白色|\bICE\b|\bAERO\b/.test(upperName)) parts.push('WHITE');
  if (/(?:^|[-\s])O\d{1,2}G(?:\b|[-\s])|\bOC\b/.test(upperName)) parts.push('OC');
  if (/\bEVO\b|(?:^|[-\s])V2(?:\b|[-\s])|\bSFF\b|LOW\s*PROFILE|\bLP\b/.test(upperName)) parts.push('REV');
  return parts.length > 0 ? parts.join('-') : null;
}

// 同一晶片有多種顯存容量的型號才顯示 VRAM 層（依實際在售資料維護；新變體上市時擴充）
const MULTI_VRAM_MODELS = new Set(['GT 730', 'RTX 3050', 'RTX 5060 Ti', 'RTX PRO 5000', 'RX 9060 XT', 'RTX 3060', 'RTX 4060 Ti']);

function detectGpuSubcategory(name: string): string | null {
  const spaceless = gpuModelSearchText(name).toUpperCase().replace(/\s+/g, '');

  let model: string | null = null;
  let series: string | null = null;

  for (const def of GPU_MODELS) {
    if (spaceless.includes(def.needle)) {
      model = def.display;
      series = gpuSeriesFromModel(def.display);
      break;
    }
  }

  if (!series) series = gpuSeriesFallback(name);

  // 型號 > (多顯存型號才有的容量層) > 板卡品牌
  const brand = extractBrand(name) ?? null;
  if (model && MULTI_VRAM_MODELS.has(model)) {
    return hierarchy(series, model, detectVram(name), brand);
  }
  return hierarchy(series, model, brand);
}

function gpuModelSearchText(name: string): string {
  return name
    .replace(/<[^>]+>/g, ' ')
    .replace(/NT\$\s*[\d,]+|\$\s*[\d,]+|[\d,]+\s*元/g, ' ')
    .replace(/\b\d{3,4}\s*MHz\b/gi, ' ')
    .replace(/\b\d{2,3}(?:\.\d+)?\s*cm\b/gi, ' ')
    .replace(/\b\d{3,4}\s*W\b/gi, ' ');
}

const AMD_GEN_MAP: Record<string, string> = {
  '9': 'Ryzen 9000 (Zen5)',
  '8': 'Ryzen 8000 (Zen4)',
  '7': 'Ryzen 7000 (Zen4)',
  '5': 'Ryzen 5000 (Zen3)',
  '4': 'Ryzen 4000',
  '3': 'Ryzen 3000 (Zen2)',
};

/** 由 CPU 品名推斷世代（Intel 第N代 / Core Ultra 200S；AMD Ryzen 世代 / Threadripper）。 */
function detectCpuGeneration(name: string, brand: string | null): string | null {
  if (brand === 'Intel') {
    // 品名直接標示「第N代」（常見於 Celeron / Pentium / 部分 Core）
    const genTag = name.match(/第\s*(\d{1,2})\s*代/);
    if (genTag) return intelGenerationLabel(genTag[1]);
    // Core Ultra 200S（如 285K / 245KF / 250KF Plus）
    if (/ULTRA/i.test(name) && /2\d{2}[A-Z]{0,3}/.test(name)) return 'Core Ultra 200S';
    const m = name.match(/I[3579][- ]?(\d{4,5})/i);
    if (m) {
      const d = m[1];
      const gen = d.length === 5 ? d.slice(0, 2) : d.slice(0, 1);
      return intelGenerationLabel(gen);
    }
    return null;
  }
  if (brand === 'AMD') {
    if (/THREADRIPPER|RYZEN\s*TR\b|TR\s*-?\s*PRO/i.test(name)) return detectThreadripperGeneration(name);
    const m = name.match(/(?:RYZEN[\sAI\d]*?|R[3579]\s*)([3-9])\d{3}/i);
    if (m) return AMD_GEN_MAP[m[1]] ?? null;
  }
  return null;
}

function intelGenerationLabel(rawGeneration: string): string | null {
  const generation = parseInt(rawGeneration, 10);
  return generation >= 10 ? `第 ${generation} 代` : null;
}

function detectThreadripperGeneration(name: string): string {
  const m = name.match(/(?:THREADRIPPER|RYZEN\s*TR|TR\s*-?\s*PRO|PRO)\s*(\d{4})/i);
  if (!m) return 'Threadripper';
  const first = m[1][0];
  if (first === '9') return 'Threadripper 9000';
  if (first === '7') return 'Threadripper 7000';
  if (first === '5') return 'Threadripper 5000';
  if (first === '3') return 'Threadripper 3000';
  if (first === '2' || first === '1') return 'Threadripper TR4';
  return 'Threadripper';
}

function detectCpuSubcategory(name: string): string | null {
  const upperName = name.toUpperCase();

  let brand: string | null = null;
  if (upperName.includes('INTEL') || /CORE\s*(I[3579]|ULTRA)|PENTIUM|CELERON/i.test(name)) brand = 'Intel';
  else if (upperName.includes('AMD') || /RYZEN|THREADRIPPER|\bR[3579]\s*\d{4}/i.test(name)) brand = 'AMD';

  const generation = detectCpuGeneration(name, brand);

  let series: string | null = null;
  if (/Ultra\s*9/i.test(name)) series = 'Ultra 9';
  else if (/Ultra\s*7/i.test(name)) series = 'Ultra 7';
  else if (/Ultra\s*5/i.test(name)) series = 'Ultra 5';
  else if (/Ultra\s*3/i.test(name)) series = 'Ultra 3';
  else if (/i9/i.test(name)) series = 'Core i9';
  else if (/i7/i.test(name)) series = 'Core i7';
  else if (/i5/i.test(name)) series = 'Core i5';
  else if (/i3/i.test(name)) series = 'Core i3';
  else if (/Ryzen\s*9|R9\b/i.test(name)) series = 'Ryzen 9';
  else if (/Ryzen\s*7|R7\b/i.test(name)) series = 'Ryzen 7';
  else if (/Ryzen\s*5|R5\b/i.test(name)) series = 'Ryzen 5';
  else if (/Ryzen\s*3|R3\b/i.test(name)) series = 'Ryzen 3';

  return hierarchy(brand, generation, series);
}

/** 偵測主機板品牌（板廠），支援中文別名。 */
function detectMbBrand(name: string): string | null {
  const u = name.toUpperCase();
  if (u.includes('ASUS') || name.includes('華碩') || /\bROG\b|TUF|PRIME|PROART/i.test(name)) return 'ASUS';
  if (u.includes('MSI') || name.includes('微星')) return 'MSI';
  if (u.includes('GIGABYTE') || name.includes('技嘉') || /AORUS/i.test(name)) return 'GIGABYTE';
  if (u.includes('ASROCK') || name.includes('華擎')) return 'ASRock';
  if (u.includes('BIOSTAR') || name.includes('映泰')) return 'BIOSTAR';
  return null;
}

// 晶片組 → CPU 腳位（裝機第一個要對的規格；側欄最上層）
const CHIPSET_SOCKET: Record<string, string> = {
  Z890: 'Intel LGA1851', W890: 'Intel LGA1851', B860: 'Intel LGA1851', H810: 'Intel LGA1851',
  Z790: 'Intel LGA1700', B760: 'Intel LGA1700', H610: 'Intel LGA1700', W680: 'Intel LGA1700', B660: 'Intel LGA1700',
  W790: 'Intel LGA4677',
  X870E: 'AMD AM5', X870: 'AMD AM5', B850: 'AMD AM5', B840: 'AMD AM5',
  X670E: 'AMD AM5', X670: 'AMD AM5', B650E: 'AMD AM5', B650: 'AMD AM5', A620: 'AMD AM5',
  B550: 'AMD AM4', A520: 'AMD AM4',
  TRX50: 'AMD sTR5', WRX90: 'AMD sTR5',
};

function detectMotherboardSubcategory(name: string): string | null {
  const upperName = name.toUpperCase();

  const chipset = detectMotherboardChipset(upperName);
  const brand = detectMbBrand(name);

  if (chipset) {
    // CPU 腳位 > 晶片組 > 品牌（腳位已含 Intel/AMD，晶片組不再重複前綴；尺寸/DDR 屬規格細節不入側欄）
    return hierarchy(CHIPSET_SOCKET[chipset] ?? null, chipset, brand);
  }

  // 無晶片組時退而求其次：品名直接標示腳位
  const socketToken = upperName.match(/\bAM[45]\b|\bLGA\s?(1851|1700|4677)\b|\bsTR5\b/i);
  if (socketToken) {
    const token = socketToken[0].toUpperCase().replace(/\s+/g, '');
    const label = token.startsWith('AM') || token === 'STR5' ? `AMD ${token === 'STR5' ? 'sTR5' : token}` : `Intel ${token}`;
    return hierarchy(label, null);
  }
  return null;
}

function detectRamSubcategory(name: string): string | null {
  const upperName = name.toUpperCase();

  // 伺服器/工作站記憶體（ECC / Registered / R-DIMM）不可混入桌上型 UDIMM（$1.5萬~16萬，會污染消費級比價）
  let device = '桌上型 UDIMM';
  if (/\bECC\b|R-?DIMM|LRDIMM|REGISTERED|伺服器/i.test(name)) {
    device = '伺服器記憶體';
  } else if (/\b(NB|Laptop|筆電|SO-DIMM|SODIMM)\b/i.test(name) || upperName.includes('筆電用') || upperName.includes('SO-DIMM')) {
    device = '筆電用 SO-DIMM';
  }

  // D4/D5 要用詞邊界：伺服器料號（KSM64R52BD4）內的「BD4」子字串會誤判世代
  let ddr = 'DDR5';
  if (/DDR4|\bD4\b/i.test(name)) ddr = 'DDR4';
  else if (/DDR5|\bD5\b/i.test(name)) ddr = 'DDR5';

  let cap: string | null = null;
  const dualMatch = name.match(/(\d+)\s*(GB|G)\s*[*xX]\s*2/i);
  if (dualMatch) {
    const single = parseInt(dualMatch[1], 10);
    cap = `${single * 2}G (${single}G*2)`;
  } else {
    const singleMatch = name.match(/\b(\d+)\s*(GB|G)\b/i);
    if (singleMatch) cap = `${singleMatch[1]}G`;
  }

  let freq: string | null = null;
  // 用數字前後界（而非 \b）以正確匹配「6000MHz」等緊接單位的寫法
  const freqMatch = name.match(/(?<!\d)(3200|3600|4800|5200|5600|6000|6400|7200|8000)(?!\d)/);
  if (freqMatch) freq = `${freqMatch[1]}MHz`;

  return hierarchy(device, ddr, cap, freq);
}

function detectSsdSubcategory(name: string): string | null {
  const upperName = name.toUpperCase();

  let type = 'M.2 NVMe SSD';
  if (/\b(外接|行動|Portable|External)\b/i.test(name) || upperName.includes('行動硬碟') || upperName.includes('外接式')) {
    type = '行動外接式';
  } else if (/\b(SATA|SATA3|2\.5吋|2\.5")\b/i.test(name) || upperName.includes('2.5吋') || upperName.includes('SATA')) {
    type = 'SATA 2.5吋';
  }

  let cap: string | null = null;
  // 先剝 USB 頻寬（USB10G / USB3.2）再抽容量，避免外接介面數字被誤判為容量
  const capSource = name.replace(/USB\s*\d+(?:\.\d+)?\s*G?/gi, ' ');
  const capMatch = capSource.match(/(\d+)\s*(GB|TB|G|T)(?=\s|$|\/|\b)/i);
  if (capMatch) {
    cap = `${capMatch[1]}${capMatch[2].toUpperCase().startsWith('T') ? 'TB' : 'GB'}`;
  }

  if (type === 'M.2 NVMe SSD') {
    let pcie = 'PCIe 4.0';
    if (upperName.includes('GEN5') || upperName.includes('5.0') || upperName.includes('PCIE5')) pcie = 'PCIe 5.0';
    else if (upperName.includes('GEN3') || upperName.includes('3.0') || upperName.includes('PCIE3')) pcie = 'PCIe 3.0';
    else if (upperName.includes('GEN4') || upperName.includes('4.0') || upperName.includes('PCIE4')) pcie = 'PCIe 4.0';

    let size: string | null = null;
    if (upperName.includes('2230')) size = '2230';
    else if (upperName.includes('2242')) size = '2242';
    else if (upperName.includes('2280')) size = '2280';

    return hierarchy(type, pcie, cap, size);
  }

  return hierarchy(type, cap);
}

function detectHddSubcategory(name: string): string | null {
  const upperName = name.toUpperCase();

  let type = '桌上型硬碟';
  if (/\b(外接|行動|Expansion|One Touch|Backup)\b/i.test(name) || upperName.includes('外接硬碟') || upperName.includes('行動硬碟')) {
    type = '行動外接硬碟';
  } else if (/\b(NAS|紅標|Red|那嘶狼|IronWolf)\b/i.test(name) || upperName.includes('NAS') || upperName.includes('那嘶狼')) {
    type = 'NAS 專用碟';
  } else if (/監控|SKYHAWK|紫標|PURPLE/i.test(name)) {
    type = '監控碟';
  } else if (/\b(企業|Enterprise|EXOS|銀標)\b/i.test(name) || upperName.includes('企業級') || upperName.includes('EXOS')) {
    type = '企業級硬碟';
  }

  let size = '3.5 吋';
  if (/2\.5\s*吋|2\.5"/i.test(name) || upperName.includes('2.5吋')) size = '2.5 吋';

  let cap: string | null = null;
  const capMatch = name.match(/(\d+)\s*(GB|TB|G|T)(?=\s|$|\/|\b)/i);
  if (capMatch) {
    cap = `${capMatch[1]}${capMatch[2].toUpperCase().startsWith('T') ? 'TB' : 'GB'}`;
  }

  let rpm: string | null = null;
  const rpmMatch = name.match(/(\d+)\s*(轉|RPM)/i);
  if (rpmMatch) rpm = `${rpmMatch[1]}轉`;
  else if (type === '企業級硬碟') rpm = '7200轉';

  return hierarchy(type, size, cap, rpm);
}

function detectCoolerSubcategory(name: string): string | null {
  const upperName = name.toUpperCase();

  let type = '單塔空冷';
  if (/\b(散熱膏|導熱膏|涼膏|熱膏|針筒|導熱貼)\b/i.test(name) || upperName.includes('散熱膏') || upperName.includes('導熱膏')) {
    type = '散熱膏/配件';
  } else if (/\b(水冷|AIO|Liquid|GM700TZ|Flow|飛龍|白龍|龍王)\b/i.test(name) || upperName.includes('水冷') || upperName.includes('一體式水冷')) {
    type = '一體式水冷 (AIO)';
  } else if (upperName.includes('下吹')) {
    type = '下吹式空冷';
  } else if (upperName.includes('雙塔')) {
    type = '雙塔空冷';
  }

  const led = upperName.includes('ARGB') ? 'ARGB' : upperName.includes('RGB') ? 'RGB' : '無光';

  if (type === '一體式水冷 (AIO)') {
    let size: string | null = null;
    // 用數字前後界以正確匹配「360mm」等緊接單位的寫法
    const sizeMatch = name.match(/(?<!\d)(120|240|280|360|420)(?!\d)/);
    if (sizeMatch) size = `${sizeMatch[1]}mm`;
    return hierarchy(type, size, led);
  }

  if (type === '散熱膏/配件') return type;

  let height: string | null = null;
  const heightMatch = name.match(/高\s*(\d+(\.\d+)?)\s*(cm|mm)?/i);
  if (heightMatch) {
    const val = parseFloat(heightMatch[1]);
    const mm = heightMatch[3]?.toLowerCase() === 'cm' ? val * 10 : val;
    height = `${mm}mm`;
  } else {
    const altHeightMatch = name.match(/\b(15\d|16\d)\s*mm\b/i);
    if (altHeightMatch) height = `${altHeightMatch[1]}mm`;
  }

  return hierarchy(type, height, led);
}

/** 瓦數藏在型號（UD750GM / Ai1600T / SF750）時，取黏在字母旁、且為 50 倍數的合理瓦數（450~2000W）。 */
function psuWattFromModel(name: string): number | null {
  for (const m of name.matchAll(/(\d{3,4})/g)) {
    const w = parseInt(m[1], 10);
    if (w >= 450 && w <= 2000 && w % 50 === 0) return w;
  }
  return null;
}

/** PSU 尺寸規格（裝機先看機殼相容；側欄最上層）。SFX-L 要在 SFX 前判，且早於 ATX（SFX 電源常標 ATX3.0 規格）。 */
function detectPsuForm(name: string): string {
  if (/SFX-?L\b|SFX-L規格|SFXL/i.test(name)) return 'SFX-L 電源';
  if (/\bSFX\b|SFX規格/i.test(name)) return 'SFX 電源';
  if (/\bTFX\b/i.test(name)) return 'TFX 電源';
  if (/\bFLEX\b|FLEX\s*ATX|\b1U\b/i.test(name)) return 'Flex 電源';
  return 'ATX 電源';
}

function detectPsuSubcategory(name: string): string | null {
  const upperName = name.toUpperCase();

  const form = detectPsuForm(name);

  let wattTier: string | null = null;
  const wattMatch = name.match(/\b(\d{3,4})\s*W\b/i);
  const watt = wattMatch ? parseInt(wattMatch[1], 10) : psuWattFromModel(name);
  if (watt !== null) {
    if (watt < 600) wattTier = '600W 以下';
    else if (watt < 750) wattTier = '600W~750W';
    else if (watt < 1000) wattTier = '750W~1000W';
    else wattTier = '1000W 以上';
  }

  let rating: string | null = null;
  if (/鈦金|TITANIUM/i.test(name)) rating = '80+ 鈦金牌';
  else if (/白金|PLATINUM/i.test(name)) rating = '80+ 白金牌';
  else if (/金牌|GOLD/i.test(name)) rating = '80+ 金牌';
  else if (/銀牌|SILVER/i.test(name)) rating = '80+ 銀牌';
  else if (/銅牌|BRONZE/i.test(name)) rating = '80+ 銅牌';
  else if (/白牌|STANDARD|80\+?\s*WHITE/i.test(name)) rating = '80+ 白牌';

  let modular: string | null = null;
  if (/全模組|FULL\s*MODULAR|全模/i.test(name)) modular = '全模組';
  else if (/半模組|SEMI\s*MODULAR|半模/i.test(name)) modular = '半模組';
  else if (/直出|非模組|NON\s*MODULAR/i.test(name)) modular = '直出非模組';

  return hierarchy(form, wattTier, rating, modular);
}

// 機殼系列（品牌下的產品線）。以品牌為範圍避免跨廠系列名碰撞；未知系列僅顯示到品牌層。
const CASE_SERIES: Record<string, ReadonlyArray<readonly [RegExp, string]>> = {
  Thermaltake: [[/The Tower|\bTower\s?\d/i, 'The Tower'], [/\bView\b/i, 'View'], [/\bCeres\b/i, 'Ceres'], [/\bDivider\b/i, 'Divider'], [/\bVersa\b/i, 'Versa'], [/\bS\d{3}\b/i, 'S 系列'], [/\bH\d{3}\b/i, 'H 系列'], [/\bCore\b/i, 'Core']],
  'Lian Li': [[/O11/i, 'O11'], [/Lancool/i, 'Lancool'], [/\bA3\b/i, 'A3'], [/\bA4\b/i, 'A4'], [/\bV\d{3}\b/i, 'V 系列'], [/\bDAN\b/i, 'DAN']],
  'Fractal Design': [[/\bNorth\b/i, 'North'], [/Meshify/i, 'Meshify'], [/Define/i, 'Define'], [/\bPop\b/i, 'Pop'], [/Torrent/i, 'Torrent'], [/\bRidge\b/i, 'Ridge'], [/\bTerra\b/i, 'Terra'], [/\bFocus\b/i, 'Focus'], [/\bNode\b/i, 'Node']],
  Corsair: [[/\biCUE\b/i, 'iCUE'], [/\bFrame\b/i, 'Frame'], [/\b\d{4}[DX]\b/i, 'xxxxD 系列'], [/Crystal/i, 'Crystal'], [/Obsidian/i, 'Obsidian'], [/Carbide/i, 'Carbide']],
  'Cooler Master': [[/MasterBox/i, 'MasterBox'], [/MasterFrame/i, 'MasterFrame'], [/\bHAF\b/i, 'HAF'], [/\bNR\d{3}\b/i, 'NR 系列'], [/Cosmos/i, 'Cosmos'], [/\bQube\b/i, 'Qube'], [/\bTD\d{3}\b/i, 'TD 系列'], [/\bElite\b/i, 'Elite']],
  NZXT: [[/\bH\d{1,3}\b/i, 'H 系列'], [/\bFlow\b/i, 'Flow']],
  'be quiet!': [[/Pure Base/i, 'Pure Base'], [/Silent Base/i, 'Silent Base'], [/Dark Base/i, 'Dark Base'], [/Shadow Base/i, 'Shadow Base'], [/Light Base/i, 'Light Base']],
  Phanteks: [[/Eclipse/i, 'Eclipse'], [/Enthoo/i, 'Enthoo'], [/\bNV\d{1,3}\b/i, 'NV 系列'], [/\bG\d{3}\b/i, 'G 系列'], [/\bD30\b/i, 'D30'], [/\bXT\b/i, 'XT']],
  MSI: [[/\bMEG\b/i, 'MEG'], [/\bMPG\b/i, 'MPG'], [/\bMAG\b/i, 'MAG'], [/\bPANO\b/i, 'PANO'], [/\bFORGE\b/i, 'FORGE'], [/\bVELOX\b/i, 'VELOX'], [/\bGUNGNIR\b/i, 'GUNGNIR']],
  ASUS: [[/\bROG\b/i, 'ROG'], [/\bTUF\b/i, 'TUF'], [/\bPrime\b|\bAP\d{3}\b/i, 'Prime']],
  Montech: [[/\bKING\b/i, 'KING'], [/\bSKY\b/i, 'SKY'], [/\bTITAN\b/i, 'TITAN'], [/\bAIR\b/i, 'AIR'], [/\bXR\b/i, 'XR'], [/\bHS\b/i, 'HS']],
  'In Win': [[/Chopin/i, 'Chopin'], [/Dubili/i, 'Dubili'], [/ModFree/i, 'ModFree'], [/\bA1\b/i, 'A1'], [/\bF\d\b/i, 'F 系列']],
  SilverStone: [[/\bFARA\b/i, 'FARA'], [/\bSETA\b/i, 'SETA'], [/\bSUGO\b/i, 'SUGO'], [/Precision/i, 'Precision'], [/Grandia/i, 'Grandia'], [/\bAlta\b/i, 'Alta'], [/Fujin/i, 'Fujin'], [/Raven/i, 'Raven']],
  DeepCool: [[/\bCH\d{3}\b/i, 'CH 系列'], [/\bCK\d{3}\b/i, 'CK 系列'], [/\bCG\d{3}\b/i, 'CG 系列'], [/Macube/i, 'Macube'], [/Morpheus/i, 'Morpheus'], [/MATREXX/i, 'MATREXX'], [/\bCC\d{3}\b/i, 'CC 系列']],
  Antec: [[/\bDF\d{3}\b/i, 'DF 系列'], [/\bDP\d{3}\b/i, 'DP 系列'], [/\bNX\d{3}\b/i, 'NX 系列'], [/\bP\d{2,3}\b/i, 'P 系列'], [/\bFlux\b/i, 'Flux'], [/Constellation/i, 'Constellation'], [/Performance/i, 'Performance']],
  JONSBO: [[/\bD\d{2}\b/i, 'D 系列'], [/\bTK-?\d/i, 'TK 系列'], [/\bZ\d{2}\b/i, 'Z 系列'], [/\bVR\d/i, 'VR 系列'], [/\bN\d\b/i, 'N 系列 (NAS)'], [/\bU\d\b/i, 'U 系列'], [/\bC\d\b/i, 'C 系列']],
  darkFlash: [[/\bDLX\b/i, 'DLX'], [/\bDLM\b/i, 'DLM'], [/\bDRX\b/i, 'DRX'], [/Blitz/i, 'Blitz'], [/\bDK\b/i, 'DK']],
  XPG: [[/Valor/i, 'Valor'], [/Invader/i, 'Invader'], [/Starker/i, 'Starker'], [/Battlecruiser/i, 'Battlecruiser'], [/Cruiser/i, 'Cruiser'], [/Defender/i, 'Defender']],
  '幾何未來': [[/Model/i, 'Model'], [/Hako/i, 'Hako']],
};

function detectCaseSeries(name: string, brand: string | null): string | null {
  if (!brand) return null;
  const table = CASE_SERIES[brand];
  if (!table) return null;
  for (const [re, label] of table) {
    if (re.test(name)) return label;
  }
  return null;
}

// 機殼側欄：品牌 > 系列（依實際資料以品牌分組，品牌下再依產品線排序）。
function detectCaseSubcategory(name: string): string | null {
  const brand = extractBrand(name) ?? null;
  return hierarchy(brand, detectCaseSeries(name, brand));
}

// 通路自組整機的「品牌」不是零件品牌，須另表辨識（extractBrand 抓不到）
const PACKAGE_VENDORS: ReadonlyArray<readonly [RegExp, string]> = [
  [/酷\s*[!！]\s*PC/i, '原價屋 酷!PC'],
  [/欣亞PC/i, '欣亞PC'],
  [/精選遊戲主機|精選主機|JOHN選|限定主機/i, '欣亞精選主機'],
  [/捷元|Genuine/i, '捷元'],
  // 專有產品線，品名常不寫品牌
  [/DeskMini|DeskMeet/i, 'ASRock'],
  [/PRO\s*DP21|\bCUBI\b/i, 'MSI'],
];

/**
 * 整機/筆電的品牌在品名**開頭**；`extractBrand` 掃全名會抓到規格裡的零件品牌
 * （`筆電 > HyperX`、`準系統 > Kingston`），且長品牌優先會讓 `ASUS … Intel N100` 抓成 Intel。
 * 故逐一檢查開頭前幾個 token，取最早出現的品牌。
 */
function systemBrand(name: string): string | null {
  const head = name.replace(/【[^】]*】|\([^)]*\)|\[[^\]]*\]/g, ' ').trim();
  for (const token of head.slice(0, 32).split(/[\s/,|]+/).filter(Boolean).slice(0, 4)) {
    const brand = extractBrand(token);
    if (brand) return brand;
  }
  // 中文品牌常與型號黏接（酷碼SNEAKER X），token 切不開；僅在最前段補掃
  return extractBrand(head.slice(0, 12)) ?? null;
}

function packageVendor(name: string): string | null {
  const vendor = PACKAGE_VENDORS.find(([re]) => re.test(name))?.[1];
  return vendor ?? systemBrand(name);
}

// coolpc 機殼品名多不寫「機殼」二字，只列板型與 clearance（`/方形進氣孔/M-ATX`、`顯卡長33.6/ITX`）
const CASE_SIGNAL_RE = /機殼|透側|玻璃側|全景玻璃|進氣孔|網狀|MESH|CPU高|顯卡長|\bM-?ATX\b|\bE?-?ATX\b|\bITX\b/i;

/**
 * 電源型號常把瓦數藏在字母後綴裡而不寫「W」（`SX850P`、`NE850GM`、`A1000GS`）。
 * 要求數字為 450~2000 的 50 倍數且**緊接**字母後綴，機殼型號（`DS900 黑`、`AIR 903`、`V100R`）不會誤中。
 */
function looksLikePsuModel(name: string): boolean {
  for (const m of name.matchAll(/(\d{3,4})(?:GM|GS|GX|GH|PT|P|W)\b/gi)) {
    const watt = parseInt(m[1], 10);
    if (watt >= 450 && watt <= 2000 && watt % 50 === 0) return true;
  }
  return false;
}

/** 零件組合的搭配類型（依實際在售組合：機殼+電源最多，其次 CPU+主機板、螢幕+周邊）。 */
function comboType(name: string): string {
  const hasPsu = /電源|電供|\d{3,4}\s?W\b|全模組|半模組/i.test(neutralizeFakePlus(name)) || looksLikePsuModel(name);
  const hasCooler = /水冷|散熱器|塔散|\bAIO\b|龍王|龍神|WATERFORCE|飛鷹|鷹魂/i.test(name);
  if (hasPsu && hasCooler) return '散熱器 + 電源';
  if (hasPsu && CASE_SIGNAL_RE.test(name)) return '機殼 + 電源';
  if (hasCooler && CASE_SIGNAL_RE.test(name)) return '散熱器 + 機殼';
  if (RE_CPU_MODEL.test(name) && (MOTHERBOARD_CHIPSET_RE.test(name) || /主機板/.test(name))) return 'CPU + 主機板';
  if (MOTHERBOARD_CHIPSET_RE.test(name) && /DDR[45]|記憶體|SSD|NVMe|\d+\s?TB/i.test(name)) return '主機板 + 記憶體/儲存';
  if (/螢幕|顯示器|MONITOR/i.test(name)) return '螢幕 + 周邊';
  if (/鍵盤|滑鼠|耳機|鼠墊|鍵鼠|光鍵|靈刃/i.test(name)) return '周邊套裝';
  if (RE_GPU_MODEL.test(name)) return '顯卡搭購組';
  return '其他組合';
}

/**
 * 整機 / 組合的子分類樹。
 * `baseCategory` 有值代表這是「帶條件價的零件單品」（搭板價 / 限組裝 / 加購價）——
 * 它不是可單買的零件淨價，故不留在零件分類，改列於此並保留原零件分類作為第二層。
 */
function detectPackageSubcategory(name: string, baseCategory?: ProductCategory): string | null {
  if (baseCategory) {
    return hierarchy('搭購價單品', CATEGORY_META[baseCategory].label, detectPriceCondition(name));
  }
  if (isServerWorkstation(name)) return hierarchy('伺服器 / 工作站', systemBrand(name));
  if (/掌機|ROG\s*(?:XBOX\s*)?ALLY|CLAW\s*A\d|STEAM\s*DECK|LEGION\s*GO/i.test(name)) return hierarchy('掌機', systemBrand(name));
  if (isLaptopLike(name) && RE_STORAGE.test(name)) return hierarchy('筆電', systemBrand(name));
  if (/準系統|迷你主機|迷你電腦|MINI\s*PC(?!IE)|\bNUC\b|\bCUBI\b|\bBRIX\b|DeskMini|DeskMeet|PRO\s*DP21|CPU\.RAM\.DISK選購/i.test(name)) {
    return hierarchy('準系統 / 迷你 PC', packageVendor(name));
  }
  if (isPrebuiltSystem(name) || isSlashBuild(name) || isCompleteSpecSystem(name) || isAiWorkstationSystem(name) ||
      /品牌電腦|品牌機|套裝電腦|套裝主機|桌上型主機|桌上型電腦|電競電腦|欣亞PC|整機電腦|整機主機/i.test(name)) {
    return hierarchy('整機電腦', packageVendor(name));
  }
  return hierarchy('零件組合', comboType(name));
}

function detectMonitorSubcategory(name: string): string | null {
  // 1) 明確標示「吋/型/inch」優先
  let size: string | null = null;
  const sizeMatch = name.match(/(\d{2}(?:\.\d)?)\s*(?:吋|型|inch|"|″)/i);
  if (sizeMatch) {
    const n = Math.round(parseFloat(sizeMatch[1]));
    if (n >= 10 && n <= 120) size = `${n}吋`;
  }
  // 2) 退而求其次：台灣螢幕慣例把尺寸藏在型號數字（XV272→27、VA249→24、PG32→32）
  if (!size) {
    const re = /[A-Za-z](\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(name))) {
      const n = parseInt(m[1], 10);
      if (MONITOR_SIZES.has(n)) { size = `${n}吋`; break; }
    }
  }

  let resolution: string | null = null;
  if (/4K|UHD|3840/i.test(name)) resolution = '4K UHD';
  else if (/5K|5120/i.test(name)) resolution = '5K';
  else if (/2K|QHD|2560|1440P/i.test(name)) resolution = '2K QHD';
  else if (/FHD|1920|1080P|FULL\s*HD/i.test(name)) resolution = 'FHD 1080p';

  let refresh: string | null = null;
  const hzMatch = name.match(/\b(\d{2,3})\s*HZ\b/i);
  if (hzMatch) refresh = `${hzMatch[1]}Hz`;

  return hierarchy(size, resolution, refresh);
}

/**
 * Detect multi-level subcategory from product name.
 * 回傳 `A > B > C` 階層字串；無法判定時回傳 null。
 * `baseCategory` 僅用於 PACKAGE：標示該筆其實是「帶條件價的零件單品」的原分類。
 */
export function detectSubcategory(category: ProductCategory, name: string, baseCategory?: ProductCategory): string | null {
  switch (category) {
    case ProductCategory.PACKAGE: return detectPackageSubcategory(name, baseCategory);
    case ProductCategory.CPU: return detectCpuSubcategory(name);
    case ProductCategory.MOTHERBOARD: return detectMotherboardSubcategory(name);
    case ProductCategory.GPU: return detectGpuSubcategory(name);
    case ProductCategory.RAM: return detectRamSubcategory(name);
    case ProductCategory.SSD: return detectSsdSubcategory(name);
    case ProductCategory.HDD: return detectHddSubcategory(name);
    case ProductCategory.COOLER: return detectCoolerSubcategory(name);
    case ProductCategory.PSU: return detectPsuSubcategory(name);
    case ProductCategory.CASE: return detectCaseSubcategory(name);
    case ProductCategory.MONITOR: return detectMonitorSubcategory(name);
    default: break;
  }

  const upperName = name.toUpperCase();

  // 周邊（鍵鼠/耳機/喇叭/網通）：品牌 > 類型；抓不到品牌時退回只有類型層。
  const brand = extractBrand(name) ?? null;
  const withBrand = (type: string | null): string | null => (brand ? hierarchy(brand, type) : type);

  if (category === ProductCategory.KEYBOARD) {
    let type = '一般鍵盤';
    if (upperName.includes('無線') || upperName.includes('WIRELESS')) type = '無線鍵盤';
    else if (upperName.includes('機械')) type = '機械式鍵盤';
    return withBrand(type);
  }

  if (category === ProductCategory.MOUSE) {
    let type = '一般滑鼠';
    if (upperName.includes('無線') || upperName.includes('WIRELESS')) type = '無線滑鼠';
    else if (upperName.includes('電競') || upperName.includes('GAMING')) type = '電競滑鼠';
    return withBrand(type);
  }

  if (category === ProductCategory.HEADSET) {
    let type = '一般耳機 / 麥克風';
    if (upperName.includes('無線') || upperName.includes('WIRELESS') || upperName.includes('藍牙') || upperName.includes('BLUETOOTH')) type = '無線耳機';
    else if (upperName.includes('電競') || upperName.includes('GAMING')) type = '電競耳機';
    return withBrand(type);
  }

  if (category === ProductCategory.SPEAKER) {
    let type = '電腦喇叭';
    if (upperName.includes('藍牙') || upperName.includes('BLUETOOTH') || upperName.includes('無線') || upperName.includes('WIRELESS')) type = '藍牙 / 無線喇叭';
    return withBrand(type);
  }

  if (category === ProductCategory.FAN) {
    // 台灣通路慣把尺寸藏在型號（TF120 / MR120 / TL140 / TR120）；用「非數字前後界」抓 120/140
    if (/12\s*CM|120(?!\d)/i.test(name)) return '12cm 風扇';
    if (/14\s*CM|140(?!\d)/i.test(name)) return '14cm 風扇';
    if (/(?<!\d)[89]\s*CM\b|(?<!\d)(?:80|92)\s*MM\b/i.test(name)) return '8/9cm 小風扇';
    return '其他尺寸風扇';
  }

  if (category === ProductCategory.NETWORK) {
    // 網通：品牌 > 設備類型（品牌抓不到時退回只有設備類型層）
    let type = '其他網通設備';
    if (/攝影機|WEBCAM|視訊鏡頭/i.test(name)) type = '網路攝影機';
    else if (/MESH|ZENWIFI|VELOP|\bDECO\b/i.test(name)) type = '無線路由器 > Mesh 網狀';
    else if (/路由器|分享器|ROUTER/i.test(name)) type = '無線路由器';
    else if (/PCE-|PCI-?E|網路卡|網卡|LAN\s*CARD|藍牙接收|藍芽接收|USB.{0,8}(藍牙|藍芽|WI-?FI)/i.test(name)) type = '網路卡 / 接收器';
    else if (/交換器|SWITCH|\bHUB\b/i.test(name)) type = '交換器';
    else if (/NAS|SYNOLOGY|群暉|QNAP|威聯通|華芸|ASUSTOR|DISKSTATION/i.test(name)) type = 'NAS 網路儲存';
    return withBrand(type);
  }

  if (category === ProductCategory.CABLE) return detectCableSubcategory(upperName);

  // 作業系統與應用軟體同一分類，靠第一層區隔
  if (category === ProductCategory.OS) {
    if (/WIN\s?11|WINDOWS\s?11/.test(upperName)) return '作業系統 > Windows 11';
    if (/WIN\s?10|WINDOWS\s?10/.test(upperName)) return '作業系統 > Windows 10';
    if (/WINDOWS\s*SERVER|SERVER\s*20\d\d/.test(upperName)) return '作業系統 > Windows Server';
    if (/作業系統|WINDOWS|LINUX|CHROME\s*OS/.test(upperName)) return '作業系統 > 其他作業系統';
    if (/防毒|防護|資安|ANTIVIRUS|NORTON|MCAFEE|KASPERSKY|卡巴斯基|諾頓|趨勢|PC-?CILLIN/.test(upperName)) return '應用軟體 > 防毒軟體';
    if (/OFFICE|MICROSOFT 365|文書/.test(upperName)) return '應用軟體 > 辦公軟體';
    return '應用軟體 > 其他軟體';
  }

  return null;
}

/** 線材類型（單層）。順序即判定優先序：切換器 → 網路 → 機內 → AC 電源 → 轉接 → 影音 → 傳輸。 */
function detectCableSubcategory(upperName: string): string {
  if (/切換器|分配器|KVM|[一二三四]進[一二三四]出/.test(upperName)) return '切換器 / 分配器';
  if (/網路線|\bCAT\.?\s?[5-8]/.test(upperName)) return '網路線';
  // 機內：SATA 排線、PCI-E 顯卡延長線、ARGB / 24Pin / 12VHPWR 電源延長線
  // 料號黏字（SFF8643 / 4SAS）使 \b 失效，故不加詞邊界
  if (/排線|SFF\d*|SAS|\bIDE\b/.test(upperName)) return '機內排線 / 延長線';
  if (/(PCI-?E|\d+\s?-?\s?PIN|12VHPWR|ARGB|EPS12V).{0,20}延長線/.test(upperName)) return '機內排線 / 延長線';
  if (/插座|排插|防雷|過載|延長座|\d+插|電源.{0,4}延長線|延長.{0,3}電源線/.test(upperName)) return '電源延長線 / 插座';
  if (/轉接頭|轉接器|轉接線/.test(upperName)) return '轉接頭 / 轉接線';
  if (/HDMI|DISPLAY\s*PORT|\bDP\b|\bDVI|\bVGA\b|D-?SUB|音源|光纖|TOSLINK/.test(upperName)) return '影音線';
  // USB5G / USB10G 黏尾，不可用 \bUSB\b
  if (/TYPE-?[AC]|USB|THUNDERBOLT|\bTB[34]\b|充電線|傳輸線/.test(upperName)) return 'USB / 傳輸線';
  return '其他線材';
}

/**
 * Ensure product has correct category, using keyword detection as fallback.
 */
export function categorizeProduct(product: Product): Product {
  const raw = product.rawName;
  const condition = detectPriceCondition(raw);

  // 1. 真正的組合 / 整機 / 筆電 → PACKAGE
  if (isRealBundle(raw)) {
    return withCondition({
      ...product,
      category: ProductCategory.PACKAGE,
      subcategory: detectSubcategory(ProductCategory.PACKAGE, raw) || undefined,
    }, condition);
  }

  // 2. 其餘（含僅帶條件價的單品）→ 偵測真實零件分類
  let cat = product.category;

  // 當前分類非 DIY（OTHER、或已被移除的舊分類如 optical_drive / software）、
  // 是 PACKAGE（舊資料誤歸組合）、或被污染時，重新分類。
  // 加購優惠列在 PACKAGE 但非真組合，強制重判為單品
  let needsRecategorize = !isDiyCategory(cat) || cat === ProductCategory.PACKAGE;
  if (cat === ProductCategory.PACKAGE && /【加購優惠】|^加購優惠/.test(raw)) needsRecategorize = true;

  if (cat === ProductCategory.CPU && (isCpuContaminated(raw) || looksLikeMotherboard(raw))) needsRecategorize = true;
  else if (cat === ProductCategory.MOTHERBOARD && isMbContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.GPU && isGpuContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.RAM && isRamContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.SSD && isSsdContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.HDD && isHddContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.COOLER && isCoolerContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.PSU && isPsuContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.CASE && isCaseContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.SPEAKER && isSpeakerContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.OS && isOsContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.MONITOR && isMonitorContaminated(raw)) needsRecategorize = true;
  else if (cat === ProductCategory.FAN && isFanContaminated(raw)) needsRecategorize = true;
  // 鍵盤/滑鼠/喇叭/散熱來源的電競椅、電競桌、升降桌等家具強制重判（重判後落 OTHER 由 diy-filter 移除）
  else if ([ProductCategory.KEYBOARD, ProductCategory.MOUSE, ProductCategory.SPEAKER, ProductCategory.COOLER].includes(cat) && isKeyboardContaminated(raw)) needsRecategorize = true;
  // NETWORK：晶片組主機板（無線/Wi-Fi 誤中）與印表機/充電座/耳麥/鍵鼠/掌機等非網通品強制重判
  else if (cat === ProductCategory.NETWORK && (looksLikeMotherboard(raw) || isNetworkContaminated(raw))) needsRecategorize = true;

  if (needsRecategorize) {
    cat = detectCategory(raw);
  }

  // 條件價單品（搭板價 / 限組裝 / 加購價）不是「可單買的零件淨價」——留在零件分類會讓
  // 同一顆 CPU 出現多張價格不一的卡。移到 PACKAGE，並以原零件分類作為第二層。
  // OTHER 例外：本就不入庫，不必為了條件價把雜項救回來。
  if (condition && cat !== ProductCategory.OTHER) {
    return withCondition({
      ...product,
      category: ProductCategory.PACKAGE,
      subcategory: detectSubcategory(ProductCategory.PACKAGE, raw, cat) || undefined,
    }, condition);
  }

  const newSubcat = detectSubcategory(cat, raw);

  return withCondition({
    ...product,
    category: cat,
    subcategory: newSubcat || undefined,
  }, condition);
}

/** 把條件式定價標記寫進 specs.priceCondition（供前端徽章與比價排除）。 */
function withCondition(product: Product, condition: string | null): Product {
  if (!condition) return product;
  return { ...product, specs: { ...product.specs, priceCondition: condition } };
}
