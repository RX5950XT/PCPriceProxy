import { ProductCategory } from '../shared/types.js';
import type { Product } from '../shared/types.js';
import { CATEGORY_META, isDiyCategory } from '../shared/constants.js';
import { enrichMonitorSpecFields } from '../enrichment/monitor-specs.js';
import { extractBrand, extractKeyboardSwitch } from './normalizer.js';

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

/**
 * 機殼本體簽章（非配件）。用於 CPU／主機板來源誤收機殼時強制重判。
 * 例：Montech X5「顯卡長/CPU高」、Evolv X2「全景玻璃機殼」、VECTOR「側透玻璃機殼」。
 */
export function looksLikeCase(name: string): boolean {
  if (isCaseContaminated(name)) return false;
  if (/機殼|機箱/i.test(name)) return true;
  if (/顯卡長|CPU高|U高|塔散\s*\d|全景玻璃|玻璃透側|玻璃側板|鷗翼式|側透玻璃/i.test(name)) return true;
  // 無「機殼」二字但同時有板型 + 顯卡支撐／內建風扇等裝箱語意
  if (/\b(?:E-?ATX|M-?ATX|MINI-?ITX|ITX|ATX)\b/i.test(name)
      && /顯卡支撐|內建風扇|支援背插主板|可調顯卡支撐|玻璃透側|全景/i.test(name)) {
    return true;
  }
  return false;
}

export function isCpuContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  if (isLaptopLike(name)) return true; // 含吋數/筆電者為整機，非 CPU 本體
  if (looksLikeMotherboard(name)) return true;
  if (looksLikeCase(name)) return true; // Montech X5 等機殼誤入 CPU 來源
  // 聯力 Strimer 等 CPU 8-PIN 發光線／燈效配件
  if (/發光線|STRIMER|燈效線|2\s*[×xX]\s*8-?PIN/i.test(name) && !/處理器|PROCESSOR|CORE\s*I|RYZEN|XEON/i.test(name)) {
    return true;
  }
  const excludes = [
    '筆電', '筆記型', 'LAPTOP', '掌機', 'CLAW', 'ALLY', 'DECK', 'Z1', 'Z2', 'RYZEN Z', 'NUC', 'MINI PC', '迷你電腦', '準系統',
    '工作站', '套裝電腦', 'AIO PC', '保護蓋', '扣具', '防彎', '散熱器', '水冷', '防彎扣具', '防壓框',
    '螺絲', '轉接卡', '保護套', '主機板', '主板',
    // 水冷（MasterLiquid「Core II」子字串誤中 CPU）與導熱介質配件（相變導熱貼「適用於CPU」誤中 CPU）
    'LIQUID', '冷頭', '冷排', '導熱貼', '導熱膏', '散熱膏', '相變'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isMbContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  // 主機板來源也會混入 24Pin 燈效延長線與 PCIe USB 擴充卡；這些品名雖寫「主機板」但不是板卡本體。
  if (/延長線|【PCI-?E[^】]*】|PCI-?E.{0,16}(?:USB\s*\d+G|TYPE-?C)|\bGALILEO\d*\b|\bEDISON\b.{0,20}\bARDUINO\b/i.test(name)) return true;
  if (looksLikeCase(name)) return true; // 聯力／Phanteks 等機殼誤入主機板來源
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

  // 部分來源把 RX120/RX140 風扇與 Toughpower 電源放在顯卡群組；用品項簽章覆核來源分類。
  if (looksLikeStandaloneFan(name) || looksLikePsu(name)) return true;

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
  // 導熱貼／扣具配件；不可裸列「機殼」——AIO 相容說明常寫「機殼上方需支援 360」
  if (/導熱貼|相變導熱|扣具|防彎/i.test(name) && !/散熱器|水冷|\bAIO\b|塔散|冷排|冷頭/i.test(name)) {
    return true;
  }
  if (/套裝PC|顯示卡|主機板/i.test(upper) && !/散熱器|水冷|\bAIO\b|塔散|冷排|冷頭/i.test(name)) {
    return true;
  }
  // 機殼本體誤中 cooler 關鍵字：有裝箱尺寸、無散熱本體簽章
  if (looksLikeCase(name) && !/水冷|一體式|\bAIO\b|冷頭|冷排|塔散|下吹式|導管|散熱器/i.test(name)) {
    return true;
  }
  // 筆電散熱墊／架、網通散熱架：非桌機 CPU 散熱
  if (/NotePal|散熱墊|筆電散熱|筆電支架|網通設備\s*散熱架|鋁合金.{0,12}筆電/i.test(name)) {
    return true;
  }
  return false;
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
  // 「主機板 24Pin ARGB 延長線」中的主機板是用途，不是本體；應保留為機內線材。
  if (/(?:主機板|主板).{0,20}(?:24\s*PIN|ARGB).{0,20}延長線/i.test(name)) return false;
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
  return /公\s*(?:-|對)\s*[公母]|母\s*(?:-|對)\s*[公母]/.test(name) ||
    /\b(?:HDMI|DP|DVI|VGA|USB|Type-?[AC]|SATA|IDE|RJ-?45|D-?SUB)\b[^,+＋]{0,14}\bto\b/i.test(name) ||
    /\bCAT\.?\s?[5-8][A-Z]?\b/i.test(name);
}

/**
 * 機殼**本體**強訊號（配件放行門檻）。
 * 不可用「顏色…機殼」寬鬆 pattern——`《白》(DY470機殼專用)` 會誤當本體。
 */
function hasCaseBodySignals(name: string): boolean {
  return /顯卡長|CPU高|U高|塔散\s*\d|全景玻璃|玻璃透側|側透玻璃|鷗翼|內建風扇|玻璃側板|工業機殼|電腦機殼|網狀版|透側版|全景玻璃機殼|玻璃透側機殼/i.test(name)
    || /\b(?:E-?ATX|M-?ATX|MINI-?ITX|\bITX\b|\bATX\b)\b/i.test(name);
}

export function isCaseContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  // 掌機包 / 收納包
  if (/TRAVEL\s*CASE|ALLY|掌機|收納|保護包|保護套|防潑水|攜行包|包$/.test(upper)) return true;
  // AIO／水冷本體：相容說明會寫「機殼上方需支援 360」，不可當機殼
  if (/水冷頭|冷排|預裝風扇|一體式水冷|\bAIO\b|RYUO|龍王|龍神|WATERFORCE|鷹魂|飛鷹/i.test(name)
      && /水冷|冷頭|冷排|\bAIO\b|散熱器|\d{3}\s*mm/i.test(name)
      && !/顯卡長|CPU高|U高|玻璃透側|全景玻璃|工業機殼|網狀版|透側版/i.test(name)) {
    return true;
  }
  // 獨立配件：需強本體訊號才放行（機殼常寫「內附顯卡支撐架」）
  if (/支撐架|直立套件|燈條套件|燈效套件|磁吸燈條|垂直顯卡支架|顯卡支架|擴充\s*USB\s*模組|USB\s*模組|USB\s*HUB|\bHUB\b|機殼專用/i.test(name)) {
    if (!hasCaseBodySignals(name)) return true;
  }
  if (/^↪/.test(name.trim())) return true;
  return false;
}

/** KEYBOARD 來源常混入電競椅/電競桌/升降桌等家具（非 DIY 零件，過濾後由 diy-filter 移除）。 */
export function isKeyboardContaminated(name: string): boolean {
  return /電競椅|電競桌|升降桌|電腦桌|辦公椅|工學椅|沙發|椅墊|腳托|桌墊超值組/i.test(name);
}

/** FAN 來源常混入水冷、GPU（三風扇規格）、PSU、集線器/燈條/延長線/控制器等配件。 */
export function isFanContaminated(name: string): boolean {
  if (/不含風扇|不附風扇|無風扇/.test(name)) return true;              // 盒裝 CPU 的「不含風扇」標示
  if (/水冷|一體式|\bAIO\b|下吹式|導管|塔散/i.test(name)) return true; // AIO 與 CPU 散熱器
  if (RE_GPU_MODEL.test(name)) return true; // 顯卡以「三風扇」規格誤中 FAN 關鍵字
  if (looksLikePsu(name)) return true;
  if (/集線器|延長線|串接線|排線|擴充線|燈條|燈效套件|支撐架|千斤頂|散熱膏|轉接/i.test(name)) return true;
  // 控制器／HUB／接頭／連接線：落在「其他尺寸風扇」的主因（非風扇本體）
  if (/控制器|無線控制器|燈光控制器|\bHUB\b|擴充USB|擴充模組|連接線|同步線|1轉3|訊號線|風扇專規接頭/i.test(name)) {
    const hasFanBody = /風扇|反向扇|反葉扇|\bFAN\b/i.test(name)
      && /(?<!\d)(?:80|92|120|140)(?!\d)|[89]\s*CM|1[24]\s*CM/i.test(name);
    if (!hasFanBody) return true;
  }
  if (/螢幕|LCD液晶/i.test(name) && !/風扇|\bFAN\b/i.test(name)) return true;
  if (/^↪/.test(name.trim())) return true;
  return false;
}

/** 單顆系統風扇簽章：尺寸/控制方式搭配轉速、軸承或明確風扇語意，排除 GPU、PSU 與 CPU 散熱器。 */
function looksLikeStandaloneFan(name: string): boolean {
  if (/水冷|一體式|\bAIO\b|下吹式|導管|塔散|散熱器/i.test(name)) return false;
  if (RE_GPU_MODEL.test(name) || looksLikePsu(name)) return false;
  const hasIdentity = /風扇|反向扇|反葉扇|\bFAN\b/i.test(name);
  const hasSize = /(?<!\d)(?:80|92|120|140)(?!\d)|[89]\s*CM|1[24]\s*CM/i.test(name);
  const hasControl = /\bPWM\b|[34]\s*PIN/i.test(name);
  const hasMechanicalSpec = /\bRPM\b|\d{3,4}\s*轉|軸承|反向扇|反葉扇/i.test(name);
  return (hasIdentity && hasMechanicalSpec) || (hasSize && hasControl && hasMechanicalSpec);
}

/** NETWORK 來源常混入印表機、無線充電座、無線耳麥、無線鍵鼠組、掌機、HDMI 線等「無線/Wi-Fi」誤中品。 */
export function isNetworkContaminated(name: string): boolean {
  if (/^↪/.test(name.trim())) return true;
  // 軌跡球／滑鼠／鍵鼠不是網通（Logitech M575 等曾落「其他網通」）
  if (/軌跡球|TRACKBALL|滑鼠|遊戲鼠|鍵鼠|鍵盤(?!托)/i.test(name)
      && !/路由器|網卡|交換器|NAS|MESH|分享器/i.test(name)) {
    return true;
  }
  // 純 IoT 紅外線閘道（無路由／交換／網卡簽章）不進 DIY 網通
  if (/智慧紅外線|IoT\s*網關|紅外線.*閘道|閘道.*紅外線/i.test(name)
      && !/路由|交換|網卡|MESH|分享器|NAS|EAP|Wi-?Fi\s*[56]/i.test(name)) {
    return true;
  }
  return /印表機|複合機|事務機|連續供墨|充電座|充電盤|充電器|行動電源|耳機|耳麥|掌機|ALLY|CLAW\s*A\d|HDMI|傳輸線|喇叭|聲霸|SOUNDBAR|擴音機|工作站|網路線|\bCAT\.?\s?[5-8]|SCREENBAR|螢幕.{0,4}掛燈/i.test(name);
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
const RE_GPU_MODEL = /\b(?:RTX|GTX)\s?\d{3,4}(?!\d)|\bGT\s?(?:1030|730|710|210)(?!\d)|\bRX\s?(?:[4-9]\d{3}|[456]\d{2})(?!\d)|\bArc\s?[AB]\d{3}(?!\d)/i;

const INTEL_CHIPSETS = [
  'Z890', 'W890', 'W880', 'Z790', 'W790', 'B860', 'B760', 'H810', 'H610', 'W680', 'B660',
  'H510', 'H310', 'H110', 'H81',
] as const;
const AMD_CHIPSETS = [
  'X870E', 'X870', 'WRX90', 'TRX50', 'WRX80', 'B850', 'B840', 'X670E', 'X670', 'B650E', 'B650', 'A620', 'B550', 'A520',
] as const;
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
  // 先剝「內含/內附 …」本體規格，避免「內含 SFX 850W+120mm 水冷」被當 A+B
  const withoutBuiltin = cleaned.replace(/[（(]內[附含][^）)]*[）)]/g, ' ');

  // 4. 機殼 + 電源 搭售：同時具備機殼與瓦數/電源訊號且有加號
  //    通路促銷常寫「機殼 + 海韻 Focus GX-850」——瓦數藏型號、不寫 W，故補 looksLikePsuModel
  if (!isBuiltInPsu(name) &&
      /[+＋]/.test(withoutBuiltin) && /機殼|透側|玻璃側|全景玻璃|網狀版|透側版/i.test(withoutBuiltin)
      && (/電源|電供|\d{3,4}\s?W\b/i.test(withoutBuiltin) || looksLikePsuModel(withoutBuiltin))) {
    return 'case-plus-psu';
  }
  // 4b. 機殼 + 散熱：機殼在前、+ 後為水冷／塔散（「機殼+MONTECH NX400」「機殼+Prime LC 360」）
  if (!isBuiltInPsu(name) &&
      /[+＋]/.test(withoutBuiltin) && /機殼|透側|玻璃側|全景玻璃|網狀版|透側版/i.test(withoutBuiltin)
      && /散熱器|水冷|\bAIO\b|冷排|冷頭|塔散|\bLC\s*\d{3}\b|\bNX\d{3}\b|WATERFORCE|龍王|RYUO|飛鷹|鷹魂/i.test(withoutBuiltin)) {
    return 'case-plus-cooler';
  }
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
  if (/SCREENBAR|螢幕.{0,4}掛燈|非對稱照明|ERGO\s*ARM|洞洞板|收納架|滿\s*[\d,]+.*贈/i.test(name)) return true;
  if (/AA級均勻照明|超廣燈體|滿[^：:]{0,15}[：:]?\s*贈|顏色可混.{0,8}活動|LCD磁吸數位螢幕/i.test(name)) return true;
  // 磁吸小 LCD／水冷頭外接螢幕模組（Trofeo Vision LCD 6.86" 等），非桌面顯示器
  if (/Trofeo\s*Vision\s*LCD/i.test(name) && !/(?<!\d)(240|280|360|420)(?!\d)/.test(name)) return true;
  if (/磁吸/.test(name) && /(?:數位顯示|數位螢幕|LCD)/i.test(name)
      && /(?:6\.\d+\s*吋|1280\s*[x×*]\s*480|USB\s*(?:介面|9-?Pin))/i.test(name)) {
    return true;
  }
  // 螢幕支架／氣壓臂（Raymii / 銀欣 ARM…）：常寫「17-43吋／承載 KG」，不是顯示器本體
  if (/\bSST-?ARM|螢幕臂|氣壓彈簧|氣壓式|穿夾兩用|單螢幕\s*[\/／]|雙螢幕\s*[\/／]|最大支援\s*\d+\s*吋/i.test(name)) return true;
  if (/RAYMII|HALO-?MAX/i.test(name) && /承載|氣壓|穿夾|單螢幕|雙螢幕/i.test(name)) return true;
  // 筆電架／增高支架（常寫「適用 17 吋以下筆電」）
  if (/筆電架|筆電支架|增高支架|折疊支架|鋁合金.*支架|支架.*筆電|通用於\s*\d+.*筆電|適用\d+(?:\.\d)?吋以下筆電/i.test(name)) return true;
  // 筆電／筆電式工作站誤入螢幕來源（不可用裸 isLaptopLike：桌面螢幕也有「吋」）
  if (/(?:筆電|筆記型|LAPTOP|OMNIBOOK|THINKPAD|ZENBOOK|VIVOBOOK|IDEAPAD|YOGA\s*\d|PAVILION|ENVY\s*\d|ZBOOK|INSPIRON|LATITUDE)/i.test(name)
      && (RE_STORAGE.test(name) || RE_CPU_MODEL.test(name) || /\b\d{1,2}G\b.*(?:SSD|HDD|硬碟)|LPDDR/i.test(name))) {
    return true;
  }
  // 3.9/6/8.8 吋 LCD 是機殼擴充顯示模組，不是桌面螢幕。
  if (/\b\d(?:\.\d)?\s*吋.{0,20}(?:LCD|萬用螢幕|擴充螢幕)|(?:LCD|萬用螢幕|擴充螢幕).{0,20}\b\d(?:\.\d)?\s*吋/i.test(name)) return true;
  // 直播控制器（圓剛 NEXUS 等）上的小觸控屏不是桌面顯示器
  if (/直播控制器|NEXUS/i.test(name) && /觸控|旋鈕|直播|AX\d/i.test(name)) return true;
  // 鍵盤／鍵帽上的小彩屏（AULA F108pro 1.14 吋）
  if (/(?:鍵盤|鍵軸|光鍵|三模|收割者軸)/i.test(name) && /(?:吋|LCD|LED).{0,12}(?:螢幕|彩屏)|(?:螢幕|彩屏).{0,12}(?:吋|LCD)/i.test(name)) {
    return true;
  }
  // 促銷附贈列、訊號線
  if (/^↪/.test(name.trim())) return true;
  if (/螢幕訊號線|訊號線|公對公|公對母/.test(name) && /\b(?:VGA|HDMI|DP|DVI)\b/i.test(name)) return true;
  if (looksLikeCable(name)) return true;
  const excludes = ['螢幕架', '螢幕支架', '螢幕掛燈', '增高架', '壁掛架', '機殼'];
  return excludes.some(ex => upper.includes(ex));
}

// 常見螢幕尺寸（吋）白名單，用於從型號數字推斷尺寸
const MONITOR_SIZES = new Set([14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32, 34, 35, 37, 38, 39, 40, 42, 43, 45, 48, 49, 50, 55, 57, 65, 70, 75, 77, 85, 86]);
/** DIY 主流桌面尺寸：第一層直接露出；其餘併入可攜／其他桶再展開。 */
const MONITOR_MAINSTREAM_SIZES = new Set([22, 24, 25, 27, 32, 34, 49]);
/**
 * 型號世代後綴不可當吋數。
 * - E14/E21：MSI 世代號
 * - X14–X25：多為世代後綴（如 MAG 275… X24）；X27/X32 則是 Predator 等型號吋數
 * - 其他單字母+1–2 位且非常見桌面吋：當雜訊
 */
function isMonitorGenSuffixToken(token: string): boolean {
  if (/^E\d{1,2}$/i.test(token)) return true;
  const x = token.match(/^X(\d{1,2})$/i);
  if (x) {
    const n = parseInt(x[1], 10);
    return n >= 10 && n <= 25;
  }
  // 純「單字母 + 1–2 位」且數字不在螢幕吋白名單 → 雜訊（G2、V1…）
  const one = token.match(/^([A-Z])(\d{1,2})$/i);
  if (one) {
    const n = parseInt(one[2], 10);
    return !MONITOR_SIZES.has(n);
  }
  return false;
}

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
  if (looksLikeStandaloneFan(name) || (!isFanContaminated(name) && /[34]\s*PIN/i.test(name) && /\bRPM\b/i.test(name))) {
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
  if (!isMonitorContaminated(name) && isSpeakerContaminated(name) && /含喇叭|內建喇叭|SMART\s*M\d|S\d{2}[A-Z]/i.test(name)) {
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
  { needle: 'N730', display: 'GT 730' },
  { needle: 'N710', display: 'GT 710' },
  { needle: 'N210', display: 'GT 210' },
  { needle: 'GT1030', display: 'GT 1030' },
  { needle: 'GT730', display: 'GT 730' },
  { needle: 'GT710', display: 'GT 710' },
  // AMD 舊款 Radeon（通路料號常寫成 AXR7 240）
  { needle: 'R7240', display: 'Radeon R7 240' },
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
  if (upper.startsWith('RADEON R7')) return 'AMD Radeon R7 系列';
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
  if (upper.startsWith('GT 2')) return 'NVIDIA GT 200系列';
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
  if (upperName.includes('INTEL') || /CORE\s*(I[3579]|ULTRA)|PENTIUM|CELERON|XEON|至強/i.test(name)) brand = 'Intel';
  else if (upperName.includes('AMD') || /RYZEN|THREADRIPPER|\bR[3579]\s*\d{4}/i.test(name)) brand = 'AMD';

  // Xeon 工作站（W5/W7/W9…）不在 Core i 世代樹
  if (brand === 'Intel' && /XEON|至強/i.test(name)) {
    let series: string | null = null;
    if (/\bW9\b|W9-/i.test(name)) series = 'W9';
    else if (/\bW7\b|W7-/i.test(name)) series = 'W7';
    else if (/\bW5\b|W5-/i.test(name)) series = 'W5';
    else if (/\bW3\b|W3-/i.test(name)) series = 'W3';
    else if (/\bE-\d/i.test(name)) series = 'E 系列';
    return hierarchy('Intel', 'Xeon 工作站', series);
  }

  let generation = detectCpuGeneration(name, brand);

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

  // 舊款／無法分代：避免裸「Intel」無子節點
  if (brand === 'Intel' && !generation) generation = '其他／舊款';
  if (brand === 'AMD' && !generation) generation = '其他／舊款';

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
  Z890: 'Intel LGA1851', W890: 'Intel LGA1851', W880: 'Intel LGA1851', B860: 'Intel LGA1851', H810: 'Intel LGA1851',
  Z790: 'Intel LGA1700', B760: 'Intel LGA1700', H610: 'Intel LGA1700', W680: 'Intel LGA1700', B660: 'Intel LGA1700',
  H510: 'Intel LGA1200', H310: 'Intel LGA1151', H110: 'Intel LGA1151', H81: 'Intel LGA1150',
  W790: 'Intel LGA4677',
  X870E: 'AMD AM5', X870: 'AMD AM5', B850: 'AMD AM5', B840: 'AMD AM5',
  X670E: 'AMD AM5', X670: 'AMD AM5', B650E: 'AMD AM5', B650: 'AMD AM5', A620: 'AMD AM5',
  B550: 'AMD AM4', A520: 'AMD AM4',
  TRX50: 'AMD sTR5', WRX90: 'AMD sTR5', WRX80: 'AMD sWRX8',
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

/**
 * 主機板板型（工具列 facet，不進側欄樹）。
 * 優先品名明示 ATX/M-ATX/ITX；否則用晶片組後綴 M/I 推斷（B860M→M-ATX、Z890I→Mini-ITX）。
 */
export function detectMotherboardForm(name: string): string {
  const upper = name.toUpperCase();
  if (/\bE-?ATX\b|\bEEB\b|\bEATX\b/.test(upper)) return 'E-ATX';
  if (/\bM-?ATX\b|\bMATX\b|MICRO-?ATX|µATX/.test(upper)) return 'M-ATX';
  if (/\bMINI-?ITX\b|MINI\s*ITX|\bITX\b/.test(upper)) return 'Mini-ITX';
  if (/\bATX\b/.test(upper)) return 'ATX';
  // 型號後綴：B860M / H610M → mATX；Z890I / B650I / X870-I → ITX（不可把 B650E 的 E 當板型）
  if (/\b(?:Z|B|H|X|A|W)\d{3}E?M\b/i.test(name)) return 'M-ATX';
  if (/\b(?:Z|B|H|X|A|W)\d{3}E?I\b/i.test(name) || /-(?:I)\s+(?:GAMING|WIFI)/i.test(name)) return 'Mini-ITX';
  return '未標示';
}

/** 記憶體插槽數。Mini-ITX 消費級一律 2 槽；其餘需品名明示（2xDIMM / 4DIMM / 8DIMM）。 */
export function detectMotherboardDimm(name: string, form?: string): string {
  if (/8\s*[xX×*]?\s*DIMM|8DIMM|八槽/i.test(name)) return '8 槽';
  if (/4\s*[xX×*]?\s*DIMM|4DIMM|4\s*槽|四槽/i.test(name)) return '4 槽';
  if (/2\s*[xX×*]?\s*DIMM|2DIMM|2\s*槽|兩槽|雙槽/i.test(name)) return '2 槽';
  const resolvedForm = form ?? detectMotherboardForm(name);
  if (resolvedForm === 'Mini-ITX') return '2 槽';
  return '未標示';
}

/**
 * Wi-Fi：有世代就標世代；僅 WIFI/無線 →「有 Wi-Fi」。
 * 詳列 LAN＋相供電卻無無線字樣 →「無 Wi-Fi」；短品名缺訊 →「未標示」（不猜）。
 */
export function detectMotherboardWifi(name: string): string {
  if (/WI-?FI\s*7|WIFI\s*7|WIFI7/i.test(name)) return 'Wi-Fi 7';
  if (/WI-?FI\s*6E|WIFI\s*6E|WIFI6E/i.test(name)) return 'Wi-Fi 6E';
  if (/WI-?FI\s*6(?!E)|WIFI\s*6(?!E)|WIFI6(?!E)/i.test(name)) return 'Wi-Fi 6';
  // Gigabyte 等以 AX 後綴標 Wi-Fi 6（B860M MAX GAMING AX）
  if (/\bAX\b/i.test(name) && !/ARGB/i.test(name)) return 'Wi-Fi 6';
  if (/\bWIFI\b|\bWI-?FI\b|無線/i.test(name)) return '有 Wi-Fi';
  // coolpc 詳列常有 Realtek/Intel Gb + 相供電；無無線＝無模組
  if (/(?:Realtek|Intel)\s*[\d.]+\s*Gb|LAN\s*[\d.]+G|[\d.]+\s*Gb(?:E)?\b/i.test(name) && /相/.test(name)) {
    return '無 Wi-Fi';
  }
  return '未標示';
}

/**
 * LGA1700（12–14 代）才有 DDR4/DDR5 雙軌。台系通路慣例：
 * - DDR4 SKU **幾乎必標** `D4` / `DDR4`（當促銷／區隔用）
 * - 未標 D4 的中高階 B760/Z790／工作站 W680 → 當代預設 **DDR5**
 * - 少數入門型號只出 DDR4、品名也不寫 D4 → 下列白名單
 */
const LGA1700_SILENT_DDR4: readonly RegExp[] = [
  // Gigabyte 入門：B760M H / H V2 官方為 DDR4（不可用 \bH\b 以免吃到 HDV/HAX）
  /\bB760M\s*H(?:\s*V2)?(?![A-Z0-9])/i,
  // ASRock H610 入門：H610M-H2/M.2 無 D5 後綴者為 DDR4（D5 版會寫 D5）
  /\bH610M-H2\b/i,
  // ASRock 早期 H610 無 D5 標記者
  /\bH610M-(?:HDV|HVS)(?:\/M\.2)?\b/i,
];

/**
 * DDR 世代：品名明示 > 雙支援 COMBO > 平台推斷。
 * 單一平台晶片組可定死；僅 LGA1700 需 D4 標示／型號白名單／預設 DDR5。
 */
export function detectMotherboardDdr(name: string): string {
  // 雙支援（須先於單邊 D4/D5：避免「支援D4&D5」被 D4 先吃掉）
  if (/D4\s*[&＆+/／]\s*D5|D5\s*[&＆+/／]\s*D4|支援\s*D4\s*[&＆].*D5|DDR4\s*[/／]\s*DDR5|COMBO\s*II/i.test(name)
    && /D4|D5|DDR/i.test(name)) {
    return 'DDR4/DDR5';
  }
  // 華擎 H610M COMBO II 文案「支援D4&D5記憶體」
  if (/COMBO\s*II/i.test(name) && /H610/i.test(name)) return 'DDR4/DDR5';

  if (/DDR4|\bD4\b/i.test(name)) return 'DDR4';
  if (/DDR5|\bD5\b/i.test(name)) return 'DDR5';

  const chipset = detectMotherboardChipset(name);
  const socket = chipset ? CHIPSET_SOCKET[chipset] : null;

  // 單一記憶體世代的平台：直接定案
  if (socket === 'AMD AM5' || socket === 'Intel LGA1851' || socket === 'AMD sTR5'
    || socket === 'AMD sWRX8' || socket === 'Intel LGA4677') {
    return 'DDR5';
  }
  if (socket === 'AMD AM4' || socket === 'Intel LGA1200' || socket === 'Intel LGA1151'
    || socket === 'Intel LGA1150') {
    return 'DDR4';
  }
  if (/\bAM5\b/i.test(name) || /LGA\s?1851/i.test(name)) return 'DDR5';
  if (/\bAM4\b/i.test(name) || /LGA\s?12\d{2}/i.test(name)) return 'DDR4';

  // LGA1700（含 B760/Z790/H610/W680/B660/Z690 等）：雙軌
  const isLga1700 = socket === 'Intel LGA1700'
    || /LGA\s?1700/i.test(name)
    || /\b(?:Z790|B760|H610|W680|B660|Z690|H670|B760M|Z790M)\b/i.test(name);
  if (isLga1700) {
    if (LGA1700_SILENT_DDR4.some(re => re.test(name))) return 'DDR4';
    // 台系未標 D4 → 當代預設 DDR5（W680 工作站、B760/Z790 中高階皆然）
    return 'DDR5';
  }

  return '未標示';
}

/** 有線網路最高速：10 > 2.5 > 5 > 1；2.5 必須先於 5（避免 2.5Gb 內「5Gb」子字串誤中）。 */
export function detectMotherboardLan(name: string): string {
  if (/10\s*G(?:b|be)?|10Gb|10G\s*LAN|LAN\s*10|2\*Intel\s*10G|Intel\s*10G/i.test(name)) return '10GbE';
  if (/2\.5\s*G|2\.5Gb/i.test(name)) return '2.5GbE';
  // 5Gb LAN（排除 BT 5.x；2.5 已先處理）
  if (/LAN\s*5G|5G\s*LAN|LAN5G|(?<![.\d])5\s*Gb|Realtek\s*5Gb|5G\+Wi/i.test(name)) return '5GbE';
  if (/\b1\s*G(?:b)?\s*(?:LAN)?|LAN\s*1G|Realtek\s*1Gb|\b1Gb(?:E)?\b/i.test(name)) return '1GbE';
  return '未標示';
}

/**
 * 主機板規格寫入 specs 供工具列篩選（不進 subcategory path）。
 * 五欄必填：偵測不到寫「未標示」／「無 Wi-Fi」，保證 facet 可覆蓋。
 */
export function motherboardSpecFields(rawName: string): Record<string, string> {
  const mbForm = detectMotherboardForm(rawName);
  return {
    mbForm,
    mbDimm: detectMotherboardDimm(rawName, mbForm),
    mbWifi: detectMotherboardWifi(rawName),
    mbDdr: detectMotherboardDdr(rawName),
    mbLan: detectMotherboardLan(rawName),
  };
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
  const capMatch = capSource.match(/(\d+)\s*(GB|TB|G|T)(?=\s|$|\/|\b|【)/i)
    // 緊接斜線規格：480GB/2.5吋、1TB/Gen4
    ?? capSource.match(/(\d+)\s*(GB|TB|G|T)\s*[\/／]/i);
  if (capMatch) {
    cap = `${capMatch[1]}${capMatch[2].toUpperCase().startsWith('T') ? 'TB' : 'GB'}`;
  } else {
    cap = '未標容量';
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

/** 散熱膏／導熱片／液金等配件（非 CPU 塔／AIO 本體）。 */
function isThermalPasteOrPad(name: string): boolean {
  if (/\b(散熱膏|導熱膏|涼膏|熱膏|針筒|導熱貼)\b/i.test(name)) return true;
  if (/散熱膏|導熱膏/i.test(name)) return true;
  // 液態金屬／導熱片：無塔散／AIO 本體簽章才算配件
  if (/液態金屬|Thermal\s*Pad|導熱片|導熱係數/i.test(name)
      && !/散熱器|水冷|\bAIO\b|塔散|雙塔|空冷|冷頭|冷排|導管/i.test(name)) {
    return true;
  }
  return false;
}

/**
 * 分體水冷零件／水冷周邊（不是 AIO 整組）：接頭、水冷液、水箱、單顆冷頭、冷排扇等。
 * 必須在 isAioCooler 之前判定（品名含「水冷」會被 AIO 規則吸走）。
 */
function isCustomLoopAccessory(name: string): boolean {
  // 完整 AIO 整組：有冷排尺寸 + 整機語意 → 不是配件
  const hasRad = /(?<!\d)(120|240|280|360|420)(?!\d)/.test(name);
  if (hasRad && /MasterLiquid|CoreLiquid|一體式|預裝風扇|HydroShift|Panorama|\bAIO\b|LC\s|Frozen|HyperFlow|LIQMAX|TH[-\s]?\d{3}/i.test(name)) {
    return false;
  }
  if (/水冷液|\bT1000\b.*水冷|\bP1000\b.*水冷/i.test(name)) return true;
  if (/G1\/4|延伸管|硬管\s*水冷|水冷管接頭|洩壓閥|止水環|水道板|水箱\s*幫浦|幫浦組|水溫\s*水流/i.test(name)) return true;
  if (/水冷管發光|發光套件A1|電競水冷管/i.test(name)) return true;
  if (/水冷排風扇|SWAFAN|水冷頭風扇|IMF70/i.test(name)) return true;
  // 單賣 CPU 水冷頭／Pacific 分體件（無 240/360 冷排尺寸）
  if (!hasRad && /Pacific\s+(?:MX|SW|SF|TF|DP|PR)|CPU\s*水冷頭|水冷頭\s*[\(（]/i.test(name)) return true;
  if (!hasRad && /水冷頭/i.test(name) && !/MasterLiquid|CoreLiquid|\bAIO\b|一體式|預裝|LC\s|RYUO|龍王/i.test(name)) {
    return true;
  }
  return false;
}

/**
 * 一體式水冷判定（集中一處）。
 * 不可用 `\bLiquid\b`：MasterLiquid／CoreLiquid 黏字吃不到。
 * 不可只靠「一體式風扇」：COUGAR Unity 等是系統風扇組。
 */
function isAioCooler(name: string): boolean {
  if (isCustomLoopAccessory(name)) return false;
  // 明確空冷本體：雙塔／導管塔，且無水冷簽章
  if (/雙塔|導管|塔散|下吹式|Peerless\s*Assassin|NH-[UD]\d/i.test(name)
      && !/水冷|冷頭|冷排|MasterLiquid|CoreLiquid|\bAIO\b|\bLC\b|HydroShift|Panorama/i.test(name)) {
    return false;
  }
  if (/一體式水冷|\bAIO\b/i.test(name)) return true;
  // 裸「水冷」但排除已由 isCustomLoopAccessory 處理的分體件
  if (/水冷/i.test(name) && !isCustomLoopAccessory(name)) return true;
  // 產品線（黏字／系列名）
  if (/MasterLiquid|CoreLiquid|LIQMAX|HyperFlow|NANCOOL|HydroShift|Panorama/i.test(name)) return true;
  if (/Frozen\s*Warframe|Trofeo\s*Vision|Wonder\s*Vision|Grand\s*Vision/i.test(name)) return true;
  if (/\b(?:RYUO|RYUJIN|Atmos|Asetek)\b/i.test(name)) return true;
  if (/(?:飛龍|白龍|龍王|龍神|WATERFORCE|鷹魂)/i.test(name)
      && (/(?<!\d)(120|240|280|360|420)(?!\d)/.test(name) || /冷頭|冷排|水冷/i.test(name))) {
    return true;
  }
  // 華碩／微星 LC 水冷線
  if (/(?:Prime|TUF|ROG|GAMING|AYW)\s+(?:Gaming\s+)?LC\b/i.test(name)) return true;
  if (/\bLC\s*(?:III|II|I)\b/i.test(name)) return true;
  // 冷頭 + 冷排尺寸
  if (/冷頭/i.test(name) && /(?<!\d)(120|240|280|360|420)(?!\d)/.test(name)) return true;
  // 冷排／裸排（機殼「支援冷排」在 cooler 分類外）
  if (/(?:冷排|裸排)/i.test(name) && !/顯卡長|CPU高|U高|全景玻璃/i.test(name)) return true;
  // 預裝風扇 + 240/360… 且非塔散
  if (/(?:預裝|預先安裝|預安裝).{0,8}風扇/i.test(name)
      && /(?<!\d)(240|280|360|420)(?!\d)/.test(name)
      && !/雙塔|導管|塔散/i.test(name)) {
    return true;
  }
  // 喬思伯等 TH-240／TH-360
  if (/\bTH[-\s]?(120|240|280|360|420)\b/i.test(name)) return true;
  return false;
}

/** AIO 冷排尺寸：型號／品名內 240／360 等（前後非數字；360N／360P 型號尾綴可接受）。 */
function detectAioRadiatorSize(name: string): string | null {
  const m = name.match(/(?<!\d)(120|240|280|360|420)(?!\d)/);
  return m ? `${m[1]}mm` : null;
}

function detectCoolerSubcategory(name: string): string | null {
  const upperName = name.toUpperCase();

  // M.2／SSD 散熱片不是 CPU 塔扇（曾整批落「單塔空冷」）
  if (/M\.2|2280|SSD\s*固態|固態硬碟散熱|硬碟散熱片|SSD\s*散熱/i.test(name)
      && !/水冷|\bAIO\b|塔散|下吹|雙塔|空冷/i.test(name)) {
    return hierarchy('散熱膏/配件', 'M.2 散熱') ?? '散熱膏/配件 > M.2 散熱';
  }

  // 分體水冷零件（優先於 AIO：品名含「水冷」）
  if (isCustomLoopAccessory(name)) {
    return hierarchy('散熱膏/配件', '分體水冷配件') ?? '散熱膏/配件 > 分體水冷配件';
  }

  let type = '單塔空冷';
  if (isThermalPasteOrPad(name)) {
    type = '散熱膏/配件';
  } else if (isAioCooler(name)) {
    type = '一體式水冷 (AIO)';
  } else if (upperName.includes('下吹')) {
    type = '下吹式空冷';
  } else if (upperName.includes('雙塔') || /導管/i.test(name)) {
    // 導管＋高度但未寫雙塔：多數中高塔；雙塔關鍵字優先，其餘導管視為單塔本體仍可
    type = upperName.includes('雙塔') ? '雙塔空冷' : '單塔空冷';
  }

  const led = upperName.includes('ARGB') ? 'ARGB' : upperName.includes('RGB') ? 'RGB' : '無光';

  if (type === '一體式水冷 (AIO)') {
    // 缺冷排尺寸 → 未標尺寸（避免只有「一體式水冷」單層）
    return hierarchy(type, detectAioRadiatorSize(name) ?? '未標尺寸', led);
  }

  if (type === '散熱膏/配件') return type;

  // 空冷缺高度 → 未標尺寸，與有高度的路徑語意一致
  return hierarchy(type, detectCoolerHeightTier(name) ?? '未標尺寸', led);
}

/**
 * 空冷高度以裝機相容性區間顯示，避免每個 0.1mm 都形成側欄葉節點。
 * **只信「高／高度 N」**（通路「高15.7」「高度15.6」慣用公分）；禁止裸 `360mm` 當塔高。
 */
function detectCoolerHeightTier(name: string): string | null {
  const explicit = name.match(/高\s*(\d+(?:\.\d+)?)\s*(cm|mm)?/i)
    ?? name.match(/(?:高度|Height)\s*[：:]?\s*(\d+(?:\.\d+)?)\s*(cm|mm)?/i);
  if (!explicit) return null;

  const value = parseFloat(explicit[1]);
  const unit = explicit[2]?.toLowerCase();
  const millimeters = unit === 'cm' || (!unit && value < 30) ? value * 10 : value;
  if (millimeters <= 100) return '100mm 以下（低矮型）';
  if (millimeters <= 150) return '101–150mm';
  if (millimeters <= 160) return '151–160mm';
  return '161mm 以上';
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
  const wattMatch = name.match(/\b(\d{3,4})\s*W\b/i)
    // 中文「1100W」「超實在 1100W」或型號尾 500W
    ?? name.match(/(\d{3,4})\s*瓦/);
  const watt = wattMatch ? parseInt(wattMatch[1], 10) : psuWattFromModel(name);
  if (watt !== null) {
    if (watt < 600) wattTier = '600W 以下';
    else if (watt < 750) wattTier = '600W~750W';
    else if (watt < 1000) wattTier = '750W~1000W';
    else wattTier = '1000W 以上';
  } else {
    wattTier = '未標瓦數';
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

/**
 * 品名未寫板型時，以高信心系列／型號回填（僅 fallback，不可覆寫品名明確 token）。
 * 維護成本可控：只收庫內反覆出現、公開規格穩定的型號。
 */
const CASE_FORM_BY_SERIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bAP20[123]\b|\bAP303\b/i, 'M-ATX'],
  [/PRO\s*FORGE\s*M051/i, 'M-ATX'],
  [/MOTI\s*Mini/i, 'Mini-ITX'],
  [/\bC5\s*Curve\b/i, 'ATX'],
  [/\bGT502\b/i, 'ATX'],
];

/**
 * 機殼最大支援主機板板型（DIY 裝機第一相容條件）。
 * 判定順序：機架／工業 → E-ATX → M-ATX → Mini-ITX → ATX → 系列回填 → 未標板型。
 * E-/M- 必須早於裸 ATX，避免子字串誤中。
 */
function detectCaseFormFactor(name: string): string {
  const upper = name.toUpperCase();
  // 工業／機架：2U~5U、銀欣 RM 系列、工業機殼（不硬塞 ATX）
  if (/\b[2-5]U\b|工業機殼|機架式|機架式伺服器|\bSST-?RM\b|\bRM\d{2}/i.test(name)
      || /\bTI-U\d{3}/i.test(name)) {
    return '機架式 / 工業';
  }
  if (/\bE-?ATX\b|\bEEB\b|EATX/.test(upper)) return 'E-ATX';
  if (/\bM-?ATX\b|MATX|MICRO-?ATX|µATX/.test(upper)) return 'M-ATX';
  if (/\bMINI-?ITX\b|MINI\s*ITX|\bITX\b/.test(upper)) return 'Mini-ITX';
  if (/\bATX\b/.test(upper)) return 'ATX';
  for (const [re, form] of CASE_FORM_BY_SERIES) {
    if (re.test(name)) return form;
  }
  return '未標板型';
}

/** 機殼側欄：最大板型 > 品牌 > 系列（先相容性，再品牌／產品線）。 */
function detectCaseSubcategory(name: string): string | null {
  const form = detectCaseFormFactor(name);
  const brand = extractBrand(name) ?? null;
  return hierarchy(form, brand, detectCaseSeries(name, brand));
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
 * 亦支援前綴型（`Focus GX-850`、`CORE GX-750`）。
 * 要求數字為 450~2000 的 50 倍數；機殼型號（`DS900 黑`、`AIR 903`、`V100R`）不會誤中。
 */
function looksLikePsuModel(name: string): boolean {
  for (const m of name.matchAll(/(\d{3,4})(?:GM|GS|GX|GH|PT|P|W)\b/gi)) {
    const watt = parseInt(m[1], 10);
    if (watt >= 450 && watt <= 2000 && watt % 50 === 0) return true;
  }
  // 前綴：GX-850 / GM850 / CORE GX 1000（海韻／全漢促銷常不寫 W）
  for (const m of name.matchAll(/\b(?:GX|GM|GS|GH|PX)[-\s]?(\d{3,4})\b/gi)) {
    const watt = parseInt(m[1], 10);
    if (watt >= 450 && watt <= 2000 && watt % 50 === 0) return true;
  }
  return false;
}

/** 零件組合的搭配類型（依實際在售組合：機殼+電源最多，其次 CPU+主機板、螢幕+周邊）。 */
function comboType(name: string): string {
  const cleaned = neutralizeFakePlus(name);
  const hasPsu = /電源|電供|\d{3,4}\s?W\b|全模組|半模組/i.test(cleaned) || looksLikePsuModel(cleaned);
  const hasCooler = /水冷|散熱器|塔散|\bAIO\b|龍王|龍神|WATERFORCE|飛鷹|鷹魂|\bLC\s*\d{3}\b|\bNX\d{3}\b/i.test(name);
  const hasCase = CASE_SIGNAL_RE.test(name) || /網狀版|透側版|全景玻璃機殼|玻璃透側機殼/i.test(name);
  if (hasPsu && hasCooler) return '散熱器 + 電源';
  if (hasPsu && hasCase) return '機殼 + 電源';
  if (hasCooler && hasCase) return '散熱器 + 機殼';
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

/**
 * 清除規格噪音後，從「型號 token」抽吋數。
 * 例：M27UP→27、CS272→27、X32→32、EK220Q→22、MA270S→27、
 * MA320UP→32、PV3200U→32、P2426→24、271PHW→27、PD34→34、VS207DF→20
 * 跳過純世代後綴 E14/X24；純數字 token（價位）不取。
 */
function inchFromModelToken(token: string): number | null {
  if (!token || isMonitorGenSuffixToken(token)) return null;
  if (!/[A-Z]/i.test(token)) return null;
  const digits = token.match(/(\d{2,4})/);
  if (!digits) return null;
  const d = digits[1];
  // 2 位直接當吋；3–4 位取前兩位（272→27、220→22、3200→32、2426→24）
  const n = d.length === 2 ? parseInt(d, 10) : parseInt(d.slice(0, 2), 10);
  return MONITOR_SIZES.has(n) ? n : null;
}

/** 去掉 Hz／HDR／曲率／價位等，避免被誤當型號吋數。 */
function scrubMonitorNameForModelScan(name: string): string {
  return name
    .replace(/\$[\d,]+/g, ' ')
    .replace(/[〈<][^〉>]*[〉>]/g, ' ')
    .replace(/\b\d{2,4}\s*Hz\b/gi, ' ')
    .replace(/\bHDR\s*\d+\b/gi, ' ')
    .replace(/\bHDMI\s*[\d.]+\b/gi, ' ')
    .replace(/\b\d{3,4}\s*R\b/gi, ' ')
    .replace(/\bUSB\s*[\d.]+/gi, ' ')
    .replace(/\b(?:PD|TYPE-?C)\s*\d+\s*W\b/gi, ' ')
    .replace(/\bThunderbolt\s*\d+\b/gi, ' ')
    .replace(/\b\d+\s*ms\b/gi, ' ')
    .replace(/\b\d+K\b/gi, ' ')
    .replace(/\b(?:FHD|QHD|UHD|WQHD|UWQHD|DQHD)\b/gi, ' ');
}

/**
 * 從品名抽出螢幕吋數。
 * 1) 明確「吋/型/【N型】」最優先
 * 2) 型號內嵌數字（M27UP / CS272 / Predator X32 / EK271 / MAG 275…）
 * 3) 禁止把 E14/X24 等世代後綴當吋數
 */
function detectMonitorInch(name: string): number | null {
  const bracket = name.match(/【\s*(\d{2}(?:\.\d)?)\s*型\s*】/);
  if (bracket) {
    const n = Math.round(parseFloat(bracket[1]));
    if (n >= 10 && n <= 120) return n;
  }
  const explicit = name.match(/(\d{2}(?:\.\d)?)\s*(?:吋|型|inch|"|″)/i);
  if (explicit) {
    const n = Math.round(parseFloat(explicit[1]));
    if (n >= 10 && n <= 120) return n;
  }

  const candidates: number[] = [];
  const add = (n: number | null): void => {
    if (n != null && MONITOR_SIZES.has(n)) candidates.push(n);
  };

  // MAG 275 / MPG 341 空白分隔：token 掃描也吃得到 275CQDF，這裡再保險一次
  for (const m of name.matchAll(/\b(?:MAG|MPG)\s+(\d{2,3})/gi)) {
    const d = m[1];
    add(d.length >= 3 ? parseInt(d.slice(0, 2), 10) : parseInt(d, 10));
  }

  // 泛用型號 token：含字母+2–4 位數字的料號（使用者要求：未標吋靠型號回填）
  const scrubbed = scrubMonitorNameForModelScan(name);
  for (const token of scrubbed.match(/\b[A-Z]*\d{2,4}[A-Z0-9]*\b/gi) ?? []) {
    add(inchFromModelToken(token));
  }

  if (candidates.length === 0) return null;
  // 主流桌面尺寸優先（同品名多候選時：MAG 275 + 誤抓 X24 → 27）
  return candidates.find(n => MONITOR_MAINSTREAM_SIZES.has(n)) ?? candidates[0] ?? null;
}

/**
 * 尺寸路徑：主流吋第一層直接露出；34/49/57 標超寬／帶魚語意；
 * ≤21 併可攜桶、≥43 併大型；其餘併其他尺寸。
 * 缺吋 → `其他尺寸 > 未標吋數`（**必須**先有吋數層，再掛品牌，避免側欄把 Acer/MSI 與 28吋 排成同層）。
 */
function monitorSizePath(inch: number | null): string[] {
  if (inch == null) return ['其他尺寸', '未標吋數'];
  if (inch === 34) return ['34吋超寬'];
  if (inch === 49) return ['49吋帶魚'];
  if (inch === 57) return ['57吋帶魚'];
  if (MONITOR_MAINSTREAM_SIZES.has(inch)) return [`${inch}吋`];
  if (inch <= 21) return ['可攜 / 小尺寸', `${inch}吋`];
  if (inch >= 43) return ['大型顯示器', `${inch}吋`];
  return ['其他尺寸', `${inch}吋`];
}

function detectMonitorPanel(name: string): string | null {
  if (/QD-?OLED/i.test(name)) return 'QD-OLED';
  // WOLED 併入 OLED，減少側欄碎片
  if (/\bOLED\b|WOLED/i.test(name)) return 'OLED';
  if (/MINI-?\s*LED|MiniLED/i.test(name)) return 'Mini-LED';
  if (/\bIPS\b|FAST\s*IPS|NANO\s*IPS|AHVA/i.test(name)) return 'IPS';
  if (/\bVA\b|FAST\s*VA/i.test(name)) return 'VA';
  if (/\bTN\b/.test(name.toUpperCase())) return 'TN';
  // 量子點／QLED（非 OLED）：獨立選項，避免落未標
  if (/量子點|\bQLED\b/i.test(name)) return '量子點';
  return null;
}

/** 更新率階；缺值回 null（不寫未標）。 */
function detectMonitorRefreshTier(name: string): string | null {
  const dualPrimary = name.match(/4K\s*[-–]?\s*(\d{2,3})\s*Hz/i)
    ?? name.match(/UHD\s*[-–]?\s*(\d{2,3})\s*Hz/i)
    ?? name.match(/QHD\s*[-–]?\s*(\d{2,3})\s*Hz/i)
    ?? name.match(/2K\s*[-–]?\s*(\d{2,3})\s*Hz/i);
  const plain = name.match(/(\d{2,3})\s*Hz/i);
  const hz = Number((dualPrimary ?? plain)?.[1] ?? 0);
  if (!hz || hz < 30 || hz > 1000) return null;
  if (hz <= 100) return '100Hz 以下';
  if (hz <= 165) return '120–165Hz';
  if (hz <= 240) return '170–240Hz';
  return '240Hz 以上';
}

/** 品名／型號是否暗示 2K/4K 以上（避免低吋 FHD 預設誤殺）。 */
function monitorNameSuggestsHighRes(name: string): boolean {
  if (/\b(?:4K|UHD|2K|QHD|WQHD|UWQHD|DQHD|5K|8K|6K)\b/i.test(name)) return true;
  if (/3840|2160|2560\s*[x×]\s*1440|3440|5120/i.test(name)) return true;
  // 型號 …U / …Q / …AQ / …CQ / AOC Q27 / Alienware
  if (/\b(?:MAG|MPG|XG|PG|VG|XV|PA|SW|CS|MP|M|G|X)\s*\d{2,3}U[A-Z0-9]*/i.test(name)) return true;
  if (/\b(?:MAG|MPG|XG|PG|VG|XV|PA|SW|CS|MP|M|G)\s*\d{2,3}Q[A-Z0-9]*/i.test(name)) return true;
  // AQ 中綴（含 VA27AQ，勿只認 VG/XG/PG）
  if (/\b(?:VG|XG|PG|VA|PA|XV)\s*\d{2}AQ/i.test(name)
      || /\b(?:VG|XG|PG|VA|PA|XV)\d{2}AQ/i.test(name)
      || /\bMAG\s*\d{0,3}CQ/i.test(name)) {
    return true;
  }
  if (/\bQ2[47]\d|\bAW\d{4}|\bMP\d{3}[QU]/i.test(name) || /\bM\d{2}[QU]\b/i.test(name)) return true;
  return false;
}

/**
 * 27 吋辦公／PRO 主流仍是 FHD；有 Q/U 或電競高解析型號前綴則不預設。
 */
function isLikelyOffice27Fhd(name: string): boolean {
  if (monitorNameSuggestsHighRes(name)) return false;
  if (/\b(?:ROG|Swift|Strix|Odyssey|Predator\s*X|QD-?OLED|WOLED)\b/i.test(name)) return false;
  // PRO MP / Modern MD / 辦公 VA·VP·VY·VZ·GW·BL·EK·KA·SA·SB·P/SE 系列
  if (/\b(?:PRO\s*)?MP\d{3}(?![QU])/i.test(name)) return true;
  if (/\b(?:MD|GW|BL|EK|KA|SA|SB|VY|VZ|VP|VS)\s*\d{3}/i.test(name)) return true;
  // VA27 辦公 FHD；VA27AQ / VA27AQSE 有 AQ = 2K，不可進此分支
  if (/\bVA\d{3}(?![A-Z]*Q)/i.test(name)
      && !/\bVA\d{2}AQ/i.test(name)
      && !/\b(?:TUF|Gaming|ROG)\b/i.test(name)) {
    return true;
  }
  // 商用 DELL P/SE、Philips 無高解析標記
  if (/\b(?:DELL\s*)?(?:P|SE)\d{4}/i.test(name)) return true;
  // 有 IPS/VA/TN 且非明確電競高階型號字樣
  if (/\b(?:IPS|VA|TN)\b/i.test(name)
      && !/\b(?:MAG|MPG|XG|PG|TUF|ROG|Nitro|Odyssey|AGON|Predator)\b/i.test(name)) {
    return true;
  }
  return false;
}

/**
 * 解析度（僅寫 specs 供工具列篩選，不進側欄樹）。
 * 優先：像素尺寸 → 關鍵字 → 吋數語意 → 型號 U/Q → 15–25 吋 FHD 預設 → 27 吋辦公 FHD。
 * 缺值回 null；不做「全庫沒寫就 FHD」。
 */
function detectMonitorResolution(name: string): string | null {
  // 帶魚 / 超寬像素（優先於泛用 2K/4K 關鍵字）
  if (/5120\s*[x×]\s*1440|DQHD|5K2K|5120X1440/i.test(name)) return '帶魚 (DQHD)';
  if (/3440\s*[x×]\s*1440|UWQHD|3440X1440|21\s*:\s*9.{0,20}3440|3440.{0,12}21\s*:\s*9/i.test(name)) {
    return '超寬 (UWQHD)';
  }
  if (/2560\s*[x×]\s*1080|UWFHD|2560X1080/i.test(name)) return '超寬 (UWFHD)';
  // 8K / 5K 少見
  if (/7680\s*[x×]\s*4320|\b8K\b/i.test(name)) return '8K';
  if (/5120\s*[x×]\s*2880|\b5K\b/i.test(name)) return '5K';
  // 4K / UHD
  if (/3840\s*[x×]\s*2160|3840X2160|\bUHD\b|\b4K\b|2160P/i.test(name)) return '4K / UHD';
  // 2K / QHD（含 QHD+；避免把型號 Q 單獨當 2K）
  if (/2560\s*[x×]\s*1440|2560X1440|\bQHD\+?\b|\bWQHD\b|\b2K\b|1440P/i.test(name)) return '2K / QHD';
  // FHD
  if (/1920\s*[x×]\s*1080|1920X1080|\bFHD\b|FULL\s*HD|1080P/i.test(name)) return 'FHD';

  // 吋數語意（無像素時）：49/57 帶魚、34 超寬（當前 DIY 幾乎皆 UWQHD）
  const inch = detectMonitorInch(name);
  if (inch === 49 || inch === 57) return '帶魚 (DQHD)';
  if (inch === 34) return '超寬 (UWQHD)';

  // 型號慣例：…U 常 4K、…Q／…AQ／…CQ 常 2K
  if (/\bPD\s*49\b|\bPD49\b/i.test(name)) return '帶魚 (DQHD)';
  // LG 27U511 / 32U731：U 在吋後 = 4K；PRO …UP / BenQ RD…U / Predator X32
  if (/\b\d{2}U\d{3}[A-Z0-9-]*/i.test(name)) return '4K / UHD';
  if (/\b\d{3}UP[A-Z0-9]*/i.test(name) || /\bRD\d{3}U\b/i.test(name)) return '4K / UHD';
  if (/\bPE\d{3}QK/i.test(name) || /\bX32\b/i.test(name) && /\bOLED\b/i.test(name)) return '4K / UHD';
  // 39/45 吋超寬 OLED 電競多為帶魚 DQHD
  if (inch != null && (inch === 39 || inch === 45) && /\bOLED\b/i.test(name)) return '帶魚 (DQHD)';
  // 可攜 14–16 吋無高解析標記 → FHD（已在 15–25 覆蓋；14 另補）
  if (inch === 14 && !monitorNameSuggestsHighRes(name)) return 'FHD';
  // Alienware：…Q = 4K，其餘 AW27xx 電競 OLED 多為 2K
  if (/\bAW\d{4}Q\b/i.test(name)) return '4K / UHD';
  if (/\bAW\d{4}[A-Z]*/i.test(name) || /\bAlienware\b/i.test(name)) return '2K / QHD';
  // MAG …CUP = 4K 曲面；…CQ / CQF / CQPF = 2K 曲面
  if (/\bMAG\s*\d{0,3}CUP[A-Z0-9]*/i.test(name) || /\b\d{3}CUP[A-Z0-9]*/i.test(name)) {
    return '4K / UHD';
  }
  if (/\bMAG\s*\d{0,3}CQ[A-Z0-9]*/i.test(name)
      || /\bMAG\s*32\s*CQ[A-Z0-9]*/i.test(name)
      || /\b\d{2,3}CQ[FP]/i.test(name)) {
    return '2K / QHD';
  }
  // ASUS：VG/XG/PG/VA*AQ*（AQ 中綴 = WQHD；含 VA27AQ，勿漏給 27 吋辦公 FHD）
  if (/\b(?:VG|XG|PG|VA|PA|XV)\s*\d{2}AQ[A-Z0-9]*/i.test(name)
      || /\b(?:VG|XG|PG|VA|PA|XV)\d{2}AQ[A-Z0-9]*/i.test(name)) {
    return '2K / QHD';
  }
  // AOC Q27* / Q32* 前綴 Q = QHD
  if (/\bQ2[47]\d[A-Z0-9]*/i.test(name) || /\bQ32[A-Z0-9]*/i.test(name)) return '2K / QHD';
  // ROG XG27AC*（ACS/ACSW/ACMG…）主流 2K
  if (/\bXG\s*\d{2}AC[A-Z0-9]*/i.test(name) || /\bXG\d{2}AC[A-Z0-9]*/i.test(name)) {
    return '2K / QHD';
  }
  // XG32WC* 曲面 2K；XG27WC* 曲面 2K
  if (/\bXG\s*\d{2}WC[A-Z0-9]*/i.test(name) || /\bXG\d{2}WC[A-Z0-9]*/i.test(name)) {
    return '2K / QHD';
  }

  if (/\bPA\d{2}U[A-Z0-9]*/i.test(name) || /\bSW\d{3}U[A-Z0-9]*/i.test(name)) return '4K / UHD';
  if (/\b(?:MAG|MPG|XG|PG|VG|XV|PA|SW|CS|PD|FO|MO|GO|EV|VG)\s*\d{2,3}U[A-Z0-9]*\b/i.test(name)
      || /\bM\d{2}U[A-Z0-9]*\b/i.test(name)
      || /\bG\d{2,3}U[A-Z0-9]*\b/i.test(name)
      || /\bX\d{2}U[A-Z0-9]*\b/i.test(name)
      || /\bMP\d{3}U/i.test(name)) {
    return '4K / UHD';
  }
  // MAG/G …F：24–27 吋 F 後綴常見 FHD（排除 CQ/Q）
  if (/\bMAG\s*2[457]\d(?![A-Z]*Q)[A-Z]*F\b/i.test(name) || /\bG24\d[A-Z]*\b/i.test(name)) {
    return 'FHD';
  }
  if (/\b(?:MAG|MPG|XG|PG|VG|XV|PA|SW|CS|FO|MO|GO|EV|MP)\s*\d{2,3}Q[A-Z0-9]*\b/i.test(name)
      || /\bM\d{2}Q[A-Z0-9]*\b/i.test(name)
      || /\bG\d{2,3}Q[A-Z0-9]*\b/i.test(name)
      || /\bMP\d{3}Q/i.test(name)) {
    return '2K / QHD';
  }

  // Acer／電競：…U 在 27 吋常為 WQHD（非 4K）；…Q 亦 2K
  if (/\b(?:KG|XB|XV|VG|ED|GA|SG)\d{3}U[A-Z0-9]*/i.test(name)
      || /\bEX\d{3}Q[A-Z0-9]*/i.test(name)
      || /\bEX\d{3}U[A-Z0-9]*/i.test(name)
      || /\bED27\dU/i.test(name)) {
    return '2K / QHD';
  }
  // Nitro ED27 無 U/Q 後綴 → 曲面 FHD 為主
  if (/\bED27\d(?![QU])/i.test(name)) return 'FHD';
  // Odyssey G5 曲面 CG 系列多 FHD；DG/FG8 OLED 多 2K
  if (/\bS\d{2}CG\d/i.test(name)) return 'FHD';
  if (/\bS\d{2}(?:DG|FG8|HG8|FG6)\d/i.test(name)) return '2K / QHD';

  // 15–25 吋：無高解析標記 → FHD（台灣 DIY 通路此吋段幾乎全 FHD）
  if (inch != null && inch >= 15 && inch <= 25 && !monitorNameSuggestsHighRes(name)) {
    return 'FHD';
  }
  // 27 吋辦公／PRO：無 Q/U 高解析標記 → FHD
  if (inch === 27 && isLikelyOffice27Fhd(name)) return 'FHD';
  // 29 吋超寬常見 UWFHD（無像素時）
  if (inch === 29 && !monitorNameSuggestsHighRes(name)) return '超寬 (UWFHD)';
  // 32 吋辦公／智慧（無 U/Q/4K 標記）多數 FHD 或已由 4K 關鍵字吃掉
  if (inch === 32 && !monitorNameSuggestsHighRes(name)
      && /\b(?:IPS|VA|TN)\b/i.test(name)
      && !/\b(?:MAG|MPG|XG|PG|ROG|Odyssey|Predator|OLED)\b/i.test(name)) {
    return 'FHD';
  }

  return null;
}

/** 層級 join：跳過 null/空字串，不中斷後續層（與 hierarchy 的 break 行為不同）。 */
function monitorHierarchy(...levels: (string | null | undefined)[]): string | null {
  const out = levels.map(l => (l && l.trim()) || '').filter(Boolean);
  return out.length > 0 ? out.join(' > ') : null;
}

/**
 * 螢幕子分類樹：尺寸桶 [> 實際吋／未標吋數] > 品牌。
 * 層級固定：尺寸語意永遠在品牌之上，同層不會混「28吋」與「Acer」。
 * 面板／更新率／解析度寫入 specs 供工具列篩選，不進 path。
 */
function detectMonitorSubcategory(name: string): string | null {
  const inch = detectMonitorInch(name);
  const sizeLevels = monitorSizePath(inch);
  const brand = extractBrand(name) ?? null;
  return monitorHierarchy(...sizeLevels, brand);
}

/**
 * 從品名抽出螢幕面板／更新率／解析度，寫入 specs 供 API filter。
 * **三欄必填**：偵測不到時寫「未標示」，保證 facet 選項可覆蓋全庫、無漏網值。
 * L0 品名規則後，L1 本地 catalog 只填仍為「未標示」的欄（見 enrichment/monitor-specs）。
 */
function monitorSpecFields(rawName: string): Record<string, string> {
  const fromName = {
    panel: detectMonitorPanel(rawName) ?? '未標示',
    refreshTier: detectMonitorRefreshTier(rawName) ?? '未標示',
    resolution: detectMonitorResolution(rawName) ?? '未標示',
  };
  return enrichMonitorSpecFields(rawName, fromName);
}

/**
 * 依分類寫入／清掉 facet specs，避免重分類後殘留錯誤維度。
 * 螢幕：panel / refreshTier / resolution；主機板：mbForm / mbDimm / mbWifi / mbDdr / mbLan。
 */
function finalizeProductSpecs(
  product: Product,
  cat: ProductCategory,
  rawName: string,
): Record<string, string> {
  const {
    panel: _p,
    refreshTier: _r,
    resolution: _res,
    mbForm: _mf,
    mbDimm: _md,
    mbWifi: _mw,
    mbDdr: _mddr,
    mbLan: _ml,
    ...base
  } = product.specs as Record<string, string>;
  if (cat === ProductCategory.MONITOR) return { ...base, ...monitorSpecFields(rawName) };
  if (cat === ProductCategory.MOTHERBOARD) return { ...base, ...motherboardSpecFields(rawName) };
  return base;
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

  // 鍵盤 / 滑鼠 / 耳機 / 喇叭 / 網通：類型優先，品牌殿後（見各自 detect*）
  const brand = extractBrand(name) ?? null;
  /** 類型路徑在前、品牌在後；type 可含 `A > B` 多層。 */
  const typeThenBrand = (type: string): string => (brand ? `${type} > ${brand}` : type);

  if (category === ProductCategory.KEYBOARD) return detectKeyboardSubcategory(name, brand);

  if (category === ProductCategory.MOUSE) return detectMouseSubcategory(name, brand);

  if (category === ProductCategory.HEADSET) return detectHeadsetSubcategory(name, brand);

  if (category === ProductCategory.SPEAKER) return detectSpeakerSubcategory(name, brand);

  if (category === ProductCategory.FAN) {
    // 台灣通路慣把尺寸藏在型號（TF120 / MR120 / TL140 / TR120）；用「非數字前後界」抓 120/140
    if (/12\s*CM|120(?!\d)/i.test(name)) return '12cm 風扇';
    if (/14\s*CM|140(?!\d)/i.test(name)) return '14cm 風扇';
    if (/(?<!\d)[89]\s*CM\b|(?<!\d)(?:80|92)\s*MM\b/i.test(name)) return '8/9cm 小風扇';
    return '其他尺寸風扇';
  }

  if (category === ProductCategory.NETWORK) {
    // 網通：設備類型 > 品牌（先類型後品牌；可回收「其他網通」的交換器／延伸器／網卡／AP）
    let type = '其他網通設備';
    if (/攝影機|WEBCAM|視訊鏡頭/i.test(name)) type = '網路攝影機';
    else if (/MESH|ZENWIFI|VELOP|\bDECO\b/i.test(name)) type = '無線路由器 > Mesh 網狀';
    // USB／PCIe 網卡與藍牙接收（Archer TX/TBE/TXE 是網卡不是路由）
    else if (/PCE-|PCI-?E\s*網|網路卡|網卡|LAN\s*CARD|藍牙接收|藍芽接收|USB.{0,10}(藍牙|藍芽|WI-?FI|無線)|Archer\s*T[XBE]{1,2}|MW\d+US|\bUB\d{3}\b|微型\s*USB\s*接收|\bBE\d{4}E\b/i.test(name)
      || (/\bPCI-?E\b|\bPCIe\b/i.test(name) && /WI-?FI|無線|AX\d|BE\d/i.test(name))) {
      type = '網路卡 / 接收器';
    }
    // 交換器：N 埠、SFP、XGS、TL-SX…（不必品名寫「交換器」）
    else if (/交換器|SWITCH|\bHUB\b|\d+\s*埠|【\d+埠】|SFP\+|XGS\d|TL-S[XG]|SG\d{3,4}|MS\d{3,4}/i.test(name)) {
      type = '交換器';
    }
    // Wi-Fi 延伸器
    else if (/延伸器|訊號延伸|Range\s*Extender|Wi-?Fi\s*擴充|\bRE\d{3}\b|AC1200.*延伸|AX\d+.*延伸/i.test(name)) {
      type = 'Wi-Fi 延伸器';
    }
    // 企業／吸頂 AP
    else if (/\bEAP\d|吸頂式|吸頂|Omada|無線基地台|Access\s*Point|企業級.*AP/i.test(name)) {
      type = '無線基地台 / AP';
    }
    else if (/路由器|分享器|ROUTER|\bARCHER\b(?!\s*TX)/i.test(name)) type = '無線路由器';
    else if (/NAS|SYNOLOGY|群暉|QNAP|威聯通|華芸|ASUSTOR|DISKSTATION/i.test(name)) type = 'NAS 網路儲存';
    return typeThenBrand(type);
  }

  if (category === ProductCategory.CABLE) return detectCableSubcategory(upperName);

  // 作業系統與應用軟體同一分類，靠第一層區隔。
  // 先判應用軟體：Office 常寫「WIN10、MAC 共用」會被 WIN10 誤吸進「作業系統 > Windows 10」。
  if (category === ProductCategory.OS) {
    if (/防毒|防護|資安|ANTIVIRUS|NORTON|MCAFEE|KASPERSKY|卡巴斯基|諾頓|趨勢|PC-?CILLIN/.test(upperName)) {
      return '應用軟體 > 防毒軟體';
    }
    if (/OFFICE|MICROSOFT\s*365|文書|WORD|EXCEL|POWERPOINT|OUTLOOK/.test(upperName)
        && !/WINDOWS\s*11|WIN\s*11|WINDOWS\s*10\s*(?:家用|專業|Pro|Home)|WIN\s*10\s*(?:家用|專業)/.test(upperName)) {
      return '應用軟體 > 辦公軟體';
    }
    // 真 Windows 本體（家用／專業／隨機版／彩盒），不是「相容 WIN10」的 Office
    if (/WIN\s?11|WINDOWS\s?11/.test(upperName)) return '作業系統 > Windows 11';
    if (/WIN\s?10|WINDOWS\s?10/.test(upperName)) return '作業系統 > Windows 10';
    if (/WINDOWS\s*SERVER|SERVER\s*20\d\d/.test(upperName)) return '作業系統 > Windows Server';
    if (/作業系統|WINDOWS|LINUX|CHROME\s*OS/.test(upperName)) return '作業系統 > 其他作業系統';
    return '應用軟體 > 其他軟體';
  }

  return null;
}

/**
 * 鍵盤：機制（機械/薄膜）> [軸體] > 有線/無線 > 品牌。
 * 側欄先看「要什麼鍵盤／什麼軸／有線還無線」，品牌最後才展開。
 */
function detectKeyboardSubcategory(name: string, brand: string | null): string {
  const mech = isMechanicalKeyboard(name);
  const conn = isWirelessPeripheral(name) ? '無線' : '有線';
  if (mech) {
    const sw = extractKeyboardSwitch(name);
    return hierarchy('機械式鍵盤', sw ?? '未標軸', conn, brand) ?? '機械式鍵盤';
  }
  return hierarchy('薄膜鍵盤', conn, brand) ?? '薄膜鍵盤';
}

function isMechanicalKeyboard(name: string): boolean {
  if (/薄膜/i.test(name)) return false;
  // 機械本體或軸體/熱插拔/常見軸廠都算機械式
  return /機械|熱插拔|紅軸|茶軸|青軸|銀軸|黑軸|白軸|黃軸|綠軸|紫軸|Gateron|Cherry\s*MX|Kaihl|Kailh|Outemu|TTC\b|Akko|Jwick|G\s*Pro\s*軸/i.test(name);
}

function isWirelessPeripheral(name: string): boolean {
  // 三模/雙模/2.4G/藍牙皆視為可無線；純「有線」標示且無無線訊號才走有線
  if (/三模|雙模|2\.4\s*G|LIGHTSPEED|UNIFYING/i.test(name)) return true;
  if (/無線|WIRELESS|藍牙|藍芽|BLUETOOTH/i.test(name)) return true;
  return false;
}

/**
 * 滑鼠：用途類型 > 有線/無線 > 品牌（不再先攤一整排品牌）。
 * 垂直鼠獨立一類；電競優先於一般（品名常同時寫「無線電競」）。
 */
function detectMouseSubcategory(name: string, brand: string | null): string {
  let type = '一般滑鼠';
  if (/垂直/i.test(name)) type = '垂直滑鼠';
  else if (/電競|GAMING|\bDPI\b|LIGHTSPEED|AIMPOINT|SUPERLIGHT|VIPER|DEATHADDER|GLADIUS|HARPE|PULSEFIRE|BASILISK/i.test(name)) {
    type = '電競滑鼠';
  }
  const conn = isWirelessPeripheral(name) ? '無線' : '有線';
  return hierarchy(type, conn, brand) ?? type;
}

/**
 * 喇叭 / 音響：型態 > 品牌（有線／藍牙不當主軸，雙模很常見）。
 * 型態：聲霸 → 重低音單顆 → 2.1／多件式 → 2.0 桌面／書架 → 便攜藍牙 → 其他。
 */
function detectSpeakerSubcategory(name: string, brand: string | null): string {
  const type = detectSpeakerForm(name);
  return brand ? `${type} > ${brand}` : type;
}

function detectSpeakerForm(name: string): string {
  // 聲霸（含 bar + 重低音兩件式；利維坦等系列名）
  if (/聲霸|SOUNDBAR|SOUND\s*BAR|利維坦|LEVIATHAN|\bX-?BAR\b/i.test(name)) {
    return '聲霸';
  }

  // 單顆主動重低音（排除已標 2.0/2.1／多件／聲霸、以及電競全頻喇叭用「重低音」行銷）
  const multiPiece = /2\s*\.\s*[01]|5\s*\.\s*1|7\s*\.\s*1|三件式|二件式|兩件式|多件式/i.test(name);
  if (
    !multiPiece
    && /主動式\s*(超)?重低音|(超)?重低音\s*喇叭|SUB\s*WOOFER|超低音\s*喇叭|\bSW\d{1,2}\b/i.test(name)
    && !/NOMM|天狼星|聲霸|SOUNDBAR|電競\s*喇叭/i.test(name)
  ) {
    return '重低音（單顆）';
  }

  // 2.1／多件式（含 5.1）
  if (/2\s*\.\s*1|5\s*\.\s*1|7\s*\.\s*1|三件式|多件式/i.test(name)) {
    return '2.1／多件式';
  }

  // 2.0 桌面／書架（含電競桌面、USB 多媒體、多音路書架、Nommo 等系列；雙模藍牙靠 2.0／三音路先吃）
  if (
    /2\s*\.\s*0|二件式|兩件式|書架|BOOKSHELF|主動式\s*喇叭|電競\s*喇叭|多媒體喇叭|電腦喇叭|三音路|二音路|NOMM|天狼星/i.test(name)
    || (/\bUSB\b/i.test(name) && /喇叭|SPEAKER/i.test(name))
  ) {
    return '2.0 桌面／書架';
  }

  // 便攜／串流藍牙（含 藍芽 異體字）
  if (/便攜|隨身|串流喇叭|手提|BST-|藍牙串流|藍芽串流/i.test(name)) {
    return '便攜藍牙';
  }
  // 純藍牙／無線且無桌面喇叭訊號 → 便攜；光纖／RCA／聲道等屬桌面
  if (
    /(藍牙|藍芽|BLUETOOTH|\bBT\b|WIRELESS|無線)/i.test(name)
    && !/2\s*\.\s*[01]|主動式|二件|三件|聲霸|電競|光纖|RCA|聲道|木質|木紋|Hi-?Res|高音|中低音/i.test(name)
  ) {
    return '便攜藍牙';
  }

  // 有聲道字樣但未寫 2.0/2.1（少數品名）→ 仍當桌面
  if (/聲道/i.test(name)) return '2.0 桌面／書架';

  return '其他喇叭';
}

/**
 * 耳機 / 麥克風：連線或產品大類 > 品牌。
 * - 耳機／耳麥：有線耳機 / 無線耳機
 * - 純麥克風：USB 麥克風 / 專業麥克風 / 無線麥克風 / 麥克風
 */
function detectHeadsetSubcategory(name: string, brand: string | null): string {
  const isMicOnly = /麥克風|MIC(?:ROPHONE)?/i.test(name) && !/耳機|耳麥|HEADSET|HEADPHONE|EARBUD|EARPHONE|入耳|耳罩/i.test(name);
  if (isMicOnly) {
    let micType = '麥克風';
    if (isWirelessPeripheral(name)) micType = '無線麥克風';
    else if (/\bUSB\b|TYPE-?C/i.test(name)) micType = 'USB 麥克風';
    else if (/電容|動圈|XLR|直播|錄音|PODCAST|指向/i.test(name)) micType = '專業麥克風';
    return brand ? `${micType} > ${brand}` : micType;
  }
  const type = isWirelessPeripheral(name) ? '無線耳機' : '有線耳機';
  return brand ? `${type} > ${brand}` : type;
}

/**
 * 線材：大類 > 細類（兩層）。判定優先序：
 * 切換器 → 網路線 → 機內延長 → 排插電源 → 轉接 → 影音（排除 Type-C 充電線）→ USB。
 */
function detectCableSubcategory(upperName: string): string {
  if (/切換器|分配器|KVM|[一二三四]進[一二三四]出/.test(upperName)) {
    if (/\bKVM\b/i.test(upperName)) return '切換器 / 分配器 > KVM 切換器';
    if (/分配|一分|一進[二三四五]出|1\s*進/i.test(upperName)) return '切換器 / 分配器 > 訊號分配器';
    return '切換器 / 分配器 > 訊號切換器';
  }

  if (/網路線|\bCAT\.?\s?[5-8]/.test(upperName)) {
    if (/CAT\.?\s*8/i.test(upperName)) return '網路線 > CAT.8';
    if (/CAT\.?\s*7/i.test(upperName)) return '網路線 > CAT.7';
    if (/CAT\.?\s*6A/i.test(upperName)) return '網路線 > CAT.6A';
    if (/CAT\.?\s*6/i.test(upperName)) return '網路線 > CAT.6';
    if (/CAT\.?\s*5/i.test(upperName)) return '網路線 > CAT.5E';
    return '網路線 > 其他網路線';
  }

  // 機內：SATA / PCIe / ARGB / 24Pin / 12VHPWR 延長（料號黏字不可用 \b）
  const isInternal =
    /排線|SFF\d*|SAS|\bIDE\b/.test(upperName) ||
    /(PCI-?E|\d+\s?-?\s?PIN|12VHPWR|12V-2X6|ARGB|EPS12V|STRIMER).{0,24}延長/.test(upperName) ||
    /12VHPWR|12V-2X6|12\+4/.test(upperName) && /電源線|延長|Equalizer/i.test(upperName);
  if (isInternal) {
    if (/12VHPWR|12V-2X6|12\+4|PW16/i.test(upperName)) return '機內排線 / 延長線 > 12VHPWR 電源延長';
    if (/24\s*-?\s*PIN|PW24/i.test(upperName)) return '機內排線 / 延長線 > 24Pin 電源延長';
    if (/(?:2\s*[xX*×]\s*8|2\*8|8\s*-?\s*PIN|PW8)/i.test(upperName) && /延長|電源|STRIMER|ARGB/i.test(upperName)) {
      return '機內排線 / 延長線 > 8Pin 電源延長';
    }
    if (/ARGB|STRIMER|發光/i.test(upperName)) return '機內排線 / 延長線 > ARGB 延長線';
    if (/PCI-?E|顯卡延長/i.test(upperName)) return '機內排線 / 延長線 > PCIe 延長線';
    if (/SATA/i.test(upperName)) return '機內排線 / 延長線 > SATA 排線';
    return '機內排線 / 延長線 > 其他機內線';
  }

  if (/插座|排插|防雷|過載|延長座|\d+插|電源.{0,4}延長線|延長.{0,3}電源線/.test(upperName)) {
    if (/插座|排插|防雷|過載|延長座|\d+\s*切|\d+\s*座/i.test(upperName)) {
      return '電源延長線 / 插座 > 延長線插座';
    }
    return '電源延長線 / 插座 > 電源線';
  }

  if (/轉接頭|轉接器|轉接線/.test(upperName)) {
    if (/HDMI/i.test(upperName)) return '轉接頭 / 轉接線 > HDMI 轉接';
    if (/DISPLAY\s*PORT|\bDP\b/i.test(upperName)) return '轉接頭 / 轉接線 > DP 轉接';
    if (/RJ-?45|\bLAN\b|乙太|網路/i.test(upperName)) return '轉接頭 / 轉接線 > 網路口轉接';
    if (/TYPE-?[AC]|USB/i.test(upperName)) return '轉接頭 / 轉接線 > USB 轉接';
    return '轉接頭 / 轉接線 > 其他轉接';
  }

  // Type-C 充電/傳輸線即使帶 DP Alt Mode 也歸 USB，不要被影音線吸走
  const isUsbForm =
    /TYPE-?[AC]|USB|THUNDERBOLT|\bTB[34]\b|充電線|傳輸線/.test(upperName);
  if (!isUsbForm && /HDMI|DISPLAY\s*PORT|\bDP\b|\bDVI|\bVGA\b|D-?SUB|音源|光纖|TOSLINK/.test(upperName)) {
    if (/HDMI/i.test(upperName)) return '影音線 > HDMI';
    if (/DISPLAY\s*PORT|\bDP\b/i.test(upperName)) return '影音線 > DisplayPort';
    if (/\bDVI/i.test(upperName)) return '影音線 > DVI';
    if (/\bVGA\b|D-?SUB/i.test(upperName)) return '影音線 > VGA';
    if (/音源|光纖|TOSLINK|3\.5\s*MM/i.test(upperName)) return '影音線 > 音源 / 光纖';
    return '影音線 > 其他影音';
  }

  if (isUsbForm) {
    if (/THUNDERBOLT|\bTB[34]\b/i.test(upperName)) return 'USB / 傳輸線 > Thunderbolt';
    if (/LIGHTNING/i.test(upperName) && /TYPE-?\s*C|四合一|多合一/i.test(upperName)) {
      return 'USB / 傳輸線 > 多接頭充電線';
    }
    if (/TYPE-?\s*C.{0,16}(?:TO|轉|對).{0,12}(?:TYPE-?\s*)?C|C\s*(?:TO|轉|對)\s*(?:TYPE-?\s*)?C/i.test(upperName)) {
      return 'USB / 傳輸線 > Type-C to C';
    }
    if (/TYPE-?\s*A.{0,16}(?:TO|轉|對).{0,12}(?:TYPE-?\s*)?C|A\s*(?:TO|轉|對)\s*(?:TYPE-?\s*)?C/i.test(upperName)) {
      return 'USB / 傳輸線 > Type-A to C';
    }
    if (/LIGHTNING/i.test(upperName)) return 'USB / 傳輸線 > Lightning';
    if (/充電線/i.test(upperName)) return 'USB / 傳輸線 > 充電線';
    return 'USB / 傳輸線 > 其他 USB';
  }

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

  if (cat === ProductCategory.CPU && (isCpuContaminated(raw) || looksLikeMotherboard(raw) || looksLikeCase(raw))) needsRecategorize = true;
  else if (cat === ProductCategory.MOTHERBOARD && (isMbContaminated(raw) || looksLikeCase(raw))) needsRecategorize = true;
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
    specs: finalizeProductSpecs(product, cat, raw),
  }, condition);
}

/** 把條件式定價標記寫進 specs.priceCondition（供前端徽章與比價排除）。 */
function withCondition(product: Product, condition: string | null): Product {
  if (!condition) return product;
  return { ...product, specs: { ...product.specs, priceCondition: condition } };
}
