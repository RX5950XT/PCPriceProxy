import { ProductCategory } from '../shared/types.js';
import type { Product } from '../shared/types.js';

/**
 * Category keyword mapping for fallback detection.
 * Used when the scraper's category mapping is insufficient.
 */
const CATEGORY_KEYWORDS: Record<ProductCategory, readonly string[]> = {
  [ProductCategory.CPU]: ['處理器', 'CPU', 'Processor', 'Core i', 'Ryzen'],
  [ProductCategory.MOTHERBOARD]: ['主機板', '主板', 'Motherboard'],
  [ProductCategory.GPU]: ['顯示卡', '顯卡', 'Graphics', 'GeForce', 'Radeon'],
  [ProductCategory.RAM]: ['記憶體', 'Memory', 'DDR'],
  [ProductCategory.SSD]: ['固態硬碟', 'SSD', 'NVMe', 'M.2'],
  [ProductCategory.HDD]: ['傳統硬碟', '硬碟', 'HDD', 'Hard Drive'],
  [ProductCategory.PSU]: ['電源供應器', '電源', 'Power Supply', 'PSU'],
  [ProductCategory.CASE]: ['機殼', 'Case', 'Chassis'],
  [ProductCategory.COOLER]: ['散熱器', 'CPU散熱', 'Cooler', 'AIO', '水冷'],
  [ProductCategory.MONITOR]: ['螢幕', '顯示器', 'Monitor', 'LCD'],
  [ProductCategory.KEYBOARD]: ['鍵盤', 'Keyboard'],
  [ProductCategory.MOUSE]: ['滑鼠', 'Mouse'],
  [ProductCategory.HEADSET]: ['耳機', 'Headset', 'Headphone'],
  [ProductCategory.SPEAKER]: ['喇叭', 'Speaker'],
  [ProductCategory.FAN]: ['風扇', 'Fan'],
  [ProductCategory.OPTICAL_DRIVE]: ['光碟機', '燒錄機', 'Optical', 'DVD', 'Blu-ray'],
  [ProductCategory.NETWORK]: ['網路', '無線', 'Router', 'Wi-Fi', 'NAS'],
  [ProductCategory.OS]: ['作業系統', 'Windows', 'OS'],
  [ProductCategory.SOFTWARE]: ['軟體', 'Software', '防毒'],
  [ProductCategory.PACKAGE]: [
    '組合', '套裝', '搭購', '欣巴組', '優惠組', '租賃方案', '捷元品牌電腦', 
    '戰鬥版電競筆電', '高興價', '限量組合', '套餐', '超值組', '組合包', '搭板優惠',
    '【+】', '【搭】', '【加購】', '搭機價', '搭機', '合購', '超值搭配', '加購價'
  ],
  [ProductCategory.OTHER]: [],
};

// ─── 否定過濾器（Negative Filters）偵測函數 ───

export function isCpuContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  const excludes = [
    '筆電', '筆記型', 'LAPTOP', '掌機', 'CLAW', 'ALLY', 'DECK', 'Z1', 'Z2', 'RYZEN Z', 'NUC', 'MINI PC', '迷你電腦', '準系統', 
    '工作站', '套裝電腦', 'AIO PC', '保護蓋', '扣具', '防彎', '散熱器', '水冷', '防彎扣具', '防壓框',
    '螺絲', '轉接卡', '保護套'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isMbContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  const excludes = [
    '轉接', '擴充', 'PCI-E to', 'E-key', 'M.2 to', '托盤', '支架', '相容', '僅支援', '燈效', 
    '套件', '組合', '大全配', '螺絲', '天線', '擋板', '散熱片'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isGpuContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  
  // 掌機與播放器特徵排除
  if (/ALLY|CLAW|DECK|RYZEN\s*Z[12]|播放器|電視盒|SHIELD\s*TV/i.test(name)) return true;
  
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
  const excludes = [
    '筆電', '工作站', '工作主機', '外接盒', '散熱片', '散熱貼', '導熱', '主機板', '準系統',
    '外接座', '轉接卡', '轉接線', '螺絲'
  ];
  return excludes.some(ex => upper.includes(ex));
}

export function isHddContaminated(name: string): boolean {
  const upper = name.toUpperCase();
  const excludes = [
    '外接盒', '轉接', '托架', '排線', '連接器', '防震包', '收納', 'SSD', '固態硬碟', '防震盒'
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

/**
 * Detect category from product name using keyword matching
 */
export function detectCategory(name: string): ProductCategory {
  const upperName = name.toUpperCase();

  // 隱式機殼偵測（即使品名無"機殼"二字，但含有典型的機殼規格參數，優先歸入機殼）
  if ((upperName.includes('顯卡長') || upperName.includes('顯卡支援')) && 
      (upperName.includes('CPU高') || upperName.includes('U高') || upperName.includes('玻璃') || upperName.includes('透側'))) {
    return ProductCategory.CASE;
  }

  const priorityOrder: ProductCategory[] = [
    ProductCategory.PACKAGE,
    ProductCategory.MONITOR,
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
    ProductCategory.NETWORK,
    ProductCategory.OS,
    ProductCategory.SOFTWARE,
    ProductCategory.OPTICAL_DRIVE,
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
        
        return category;
      }
    }
  }
  return ProductCategory.OTHER;
}

/**
 * Detect multi-level subcategory from product name
 */
export function detectSubcategory(category: ProductCategory, name: string): string | null {
  const upperName = name.toUpperCase();

  // 1. CPU
  if (category === ProductCategory.CPU) {
    let brand = '其他品牌';
    if (upperName.includes('INTEL')) brand = 'Intel';
    else if (upperName.includes('AMD')) brand = 'AMD';

    let socket = '其他腳位';
    if (/LGA\s*1851|Ultra\s*(2\d{2}|200S)/i.test(name)) socket = 'LGA1851';
    else if (/LGA\s*1700|1[234]代|i\d-1[234]\d{2}/i.test(name)) socket = 'LGA1700';
    else if (/LGA\s*1200|1[01]代/i.test(name)) socket = 'LGA1200';
    else if (/AM5|9\d{3}[XF]?|8\d{3}[G]?|7\d{3}[F]?/i.test(name) || upperName.includes('AM5')) socket = 'AM5';
    else if (/AM4|5\d{3}[XG]?|3\d{3}[G]?/i.test(name) || upperName.includes('AM4')) socket = 'AM4';

    let series = '其他系列';
    if (/i9|Ultra\s*9/i.test(name)) series = 'Core i9 / Ultra 9';
    else if (/i7|Ultra\s*7/i.test(name)) series = 'Core i7 / Ultra 7';
    else if (/i5|Ultra\s*5/i.test(name)) series = 'Core i5 / Ultra 5';
    else if (/i3/i.test(name)) series = 'Core i3';
    else if (/Ryzen\s*9|R9/i.test(name)) series = 'Ryzen 9';
    else if (/Ryzen\s*7|R7/i.test(name)) series = 'Ryzen 7';
    else if (/Ryzen\s*5|R5/i.test(name)) series = 'Ryzen 5';
    else if (/Ryzen\s*3|R3/i.test(name)) series = 'Ryzen 3';

    return `${brand} > ${socket} > ${series}`;
  }

  // 2. Motherboard
  if (category === ProductCategory.MOTHERBOARD) {
    let chipset = '其他晶片組';
    const chipsets = [
      'Z890', 'Z790', 'B760', 'H610', 'B660', 'X870E', 'X870', 'X670E', 'X670', 'B650E', 'B650', 'A620', 'B550', 'A520', 'B850', 'B840'
    ];
    for (const c of chipsets) {
      if (upperName.includes(c)) {
        const brandPrefix = ['Z890', 'Z790', 'B760', 'H610', 'B660', 'B850', 'B840'].includes(c) ? 'Intel ' : 'AMD ';
        chipset = `${brandPrefix}${c}`;
        break;
      }
    }

    let size = 'ATX';
    if (upperName.includes('ITX') || upperName.includes('I-TX') || upperName.includes('MINI-ITX')) size = 'Mini-ITX';
    else if (upperName.includes('M-ATX') || upperName.includes('MICRO-ATX') || upperName.includes('MATX') || upperName.includes('M.ATX')) size = 'Micro-ATX';
    else if (upperName.includes('E-ATX') || upperName.includes('EATX')) size = 'E-ATX';
    else if (upperName.includes('ATX')) size = 'ATX';

    let ddr = 'DDR5';
    if (upperName.includes('D4') || upperName.includes('DDR4')) ddr = 'DDR4';
    else if (upperName.includes('D5') || upperName.includes('DDR5')) ddr = 'DDR5';
    else {
      if (['B550', 'A520'].some(c => upperName.includes(c))) ddr = 'DDR4';
    }

    return `${chipset} > ${size} > ${ddr}`;
  }

  // 3. GPU
  if (category === ProductCategory.GPU) {
    let series = '其他系列';
    let isWorkstation = false;

    if (upperName.includes('RADEON PRO') || /RADEON\s*PRO/i.test(name) || /W\d{4}/i.test(name) && upperName.includes('PRO') || upperName.includes('R9700')) {
      series = 'AMD 專業繪圖卡';
      isWorkstation = true;
    } else if (
      upperName.includes('工作站') || upperName.includes('專業卡') || upperName.includes('繪圖卡') ||
      /RTX\s*A\d{3,4}/i.test(name) || /RTX\s*PRO/i.test(name) || /RTX\s*\d{4}\s*ADA/i.test(name) ||
      /\bT400\b/i.test(name) || /\bT1000\b/i.test(name)
    ) {
      series = 'NVIDIA 專業繪圖卡';
      isWorkstation = true;
    }

    if (!isWorkstation) {
      if (/RTX\s*50/i.test(name)) series = 'NVIDIA RTX 50系列';
      else if (/RTX\s*40/i.test(name)) series = 'NVIDIA RTX 40系列';
      else if (/RTX\s*30/i.test(name)) series = 'NVIDIA RTX 30系列';
      else if (/RX\s*9\d{3}/i.test(name)) series = 'AMD RX 9000系列';
      else if (/RX\s*8\d{3}/i.test(name)) series = 'AMD RX 8000系列';
      else if (/RX\s*7\d{3}/i.test(name)) series = 'AMD RX 7000系列';
      else if (/RX\s*6\d{3}/i.test(name)) series = 'AMD RX 6000系列';
      else if (upperName.includes('ARC')) series = 'Intel Arc 系列';
    }

    let model = '其他型號';
    const models = [
      '5090', '5080', '5070 TI', '5070TI', '5070', '5060 TI', '5060TI', '5060',
      '4090', '4080 SUPER', '4080SUPER', '4080', '4070 TI SUPER', '4070TISUPER', '4070 TI', '4070TI', '4070 SUPER', '4070SUPER', '4070', '4060 TI', '4060TI', '4060',
      '3060 TI', '3060TI', '3060', '3050',
      '9070 XT', '9070XT', '9070', '9060 XT', '9060XT', '9060',
      '7900 XTX', '7900XTX', '7900 XT', '7900XT', '7800 XT', '7800XT', '7700 XT', '7700XT', '7650 GRE', '7650GRE', '7650', '7600 XT', '7600XT', '7600',
      // NVIDIA 專業卡
      'RTX A6000', 'RTX A5500', 'RTX A5000', 'RTX A4500', 'RTX A4000', 'RTX A2000', 'RTX A1000', 'RTX A400',
      'A6000', 'A5500', 'A5000', 'A4500', 'A4000', 'A2000', 'A1000', 'A400',
      'RTX 6000 ADA', 'RTX 5000 ADA', 'RTX 4500 ADA', 'RTX 4000 ADA', '6000 ADA', '5000 ADA', '4500 ADA', '4000 ADA',
      'RTX PRO 6000', 'RTX PRO 5000', 'RTX PRO 4000', 'RTX PRO 2000',
      'T1000', 'T400',
      // AMD 專業卡
      'W7900', 'W7800', 'W7600', 'W7500', 'W6800', 'W6600', 'W5700', 'W5500',
      'R9700',
      'B580', 'B70', 'A770', 'A750', 'A380'
    ];

    for (const m of models) {
      const cleanM = m.replace(/\s+/g, '');
      const cleanName = upperName.replace(/\s+/g, '');
      if (cleanName.includes(cleanM)) {
        let formatted = m
          .replace('SUPER', ' Super')
          .replace('TI', ' Ti')
          .replace('XTX', ' XTX')
          .replace('XT', ' XT')
          .replace('ADA', ' Ada');
        
        if (formatted.startsWith('50') || formatted.startsWith('40') || formatted.startsWith('30')) {
          model = 'RTX ' + formatted;
        } else if (formatted.startsWith('7') || formatted.startsWith('8') || formatted.startsWith('9')) {
          model = 'RX ' + formatted;
        } else if (formatted.startsWith('A') && !formatted.startsWith('Arc')) {
          model = 'RTX ' + formatted;
        } else if (formatted.startsWith('W')) {
          model = 'Radeon Pro ' + formatted;
        } else if (formatted.startsWith('R') && !formatted.startsWith('RX') && !formatted.startsWith('RTX')) {
          model = 'Radeon ' + formatted;
        } else if (formatted.startsWith('6000') || formatted.startsWith('5000') || formatted.startsWith('4500') || formatted.startsWith('4000')) {
          model = 'RTX ' + formatted;
        } else {
          model = formatted;
        }
        break;
      }
    }

    let vram = '其他容量';
    const vramMatch = name.match(/(\d+)\s*(GB|G)(?=\s|$|\/|\b)/i);
    if (vramMatch) {
      vram = `${vramMatch[1]}G`;
    } else {
      const altVramMatch = name.match(/\b(\d+)G\b/i);
      if (altVramMatch) vram = `${altVramMatch[1]}G`;
    }

    return `${series} > ${model} > ${vram}`;
  }

  // 4. RAM
  if (category === ProductCategory.RAM) {
    let device = '桌上型 UDIMM';
    if (/\b(NB|Laptop|筆電|SO-DIMM|SODIMM)\b/i.test(name) || upperName.includes('筆電用') || upperName.includes('SO-DIMM')) {
      device = '筆電用 SO-DIMM';
    }

    let ddr = 'DDR5';
    if (upperName.includes('DDR4') || upperName.includes('D4')) ddr = 'DDR4';
    else if (upperName.includes('DDR5') || upperName.includes('D5')) ddr = 'DDR5';

    let cap = '其他容量';
    const dualMatch = name.match(/(\d+)\s*(GB|G)\s*[*xX]\s*2/i);
    if (dualMatch) {
      const single = parseInt(dualMatch[1], 10);
      cap = `${single * 2}G (${single}G*2)`;
    } else {
      const singleMatch = name.match(/\b(\d+)\s*(GB|G)\b/i);
      if (singleMatch) {
        cap = `${singleMatch[1]}G`;
      }
    }

    let freq = '其他頻率';
    const freqMatch = name.match(/\b(3200|3600|4800|5200|5600|6000|6400|7200|8000)\b/);
    if (freqMatch) {
      freq = `${freqMatch[1]}MHz`;
    }

    return `${device} > ${ddr} > ${cap} > ${freq}`;
  }

  // 5. SSD
  if (category === ProductCategory.SSD) {
    let type = 'M.2 NVMe SSD';
    if (/\b(外接|行動|Portable|External)\b/i.test(name) || upperName.includes('行動硬碟') || upperName.includes('外接式')) {
      type = '行動外接式';
    } else if (/\b(SATA|SATA3|2\.5吋|2\.5")\b/i.test(name) || upperName.includes('2.5吋') || upperName.includes('SATA')) {
      type = 'SATA 2.5吋';
    }

    let cap = '其他容量';
    const capMatch = name.match(/(\d+)\s*(GB|TB|G|T)(?=\s|$|\/|\b)/i);
    if (capMatch) {
      cap = `${capMatch[1]}${capMatch[2].toUpperCase().startsWith('T') ? 'TB' : 'GB'}`;
    }

    if (type === 'M.2 NVMe SSD') {
      let pcie = 'PCIe 4.0';
      if (upperName.includes('GEN5') || upperName.includes('5.0') || upperName.includes('PCIE5')) pcie = 'PCIe 5.0';
      else if (upperName.includes('GEN3') || upperName.includes('3.0') || upperName.includes('PCIE3')) pcie = 'PCIe 3.0';
      else if (upperName.includes('GEN4') || upperName.includes('4.0') || upperName.includes('PCIE4')) pcie = 'PCIe 4.0';

      let size = '2280';
      if (upperName.includes('2230')) size = '2230';
      else if (upperName.includes('2242')) size = '2242';

      return `${type} > ${pcie} > ${cap} > ${size}`;
    }

    return `${type} > ${cap}`;
  }

  // 6. HDD
  if (category === ProductCategory.HDD) {
    let type = '一般監控/桌上型';
    if (/\b(外接|行動|Expansion|One Touch|Backup)\b/i.test(name) || upperName.includes('外接硬碟') || upperName.includes('行動硬碟')) {
      type = '行動外接硬碟';
    } else if (/\b(NAS|紅標|Red|那嘶狼|IronWolf)\b/i.test(name) || upperName.includes('NAS') || upperName.includes('那嘶狼')) {
      type = 'NAS 專用碟';
    } else if (/\b(企業|Enterprise|EXOS|銀標)\b/i.test(name) || upperName.includes('企業級') || upperName.includes('EXOS')) {
      type = '企業級硬碟';
    }

    let size = '3.5 吋';
    if (/2\.5\s*吋|2\.5"/i.test(name) || upperName.includes('2.5吋')) {
      size = '2.5 吋';
    }

    let cap = '其他容量';
    const capMatch = name.match(/(\d+)\s*(GB|TB|G|T)(?=\s|$|\/|\b)/i);
    if (capMatch) {
      cap = `${capMatch[1]}${capMatch[2].toUpperCase().startsWith('T') ? 'TB' : 'GB'}`;
    }

    let rpm = '其他轉速';
    const rpmMatch = name.match(/(\d+)\s*(轉|RPM)/i);
    if (rpmMatch) {
      rpm = `${rpmMatch[1]}轉`;
    } else {
      if (type === '企業級硬碟') rpm = '7200轉';
    }

    return `${type} > ${size} > ${cap} > ${rpm}`;
  }

  // 7. Cooler
  if (category === ProductCategory.COOLER) {
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

    if (type === '一體式水冷 (AIO)') {
      let size = '360mm';
      const sizeMatch = name.match(/\b(120|240|280|360|420)\b/);
      if (sizeMatch) {
        size = `${sizeMatch[1]}mm`;
      }
      
      let led = '無光';
      if (upperName.includes('ARGB')) led = 'ARGB';
      else if (upperName.includes('RGB')) led = 'RGB';

      return `${type} > ${size} > ${led}`;
    } else if (type === '散熱膏/配件') {
      return type;
    } else {
      let height = '其他高度';
      const heightMatch = name.match(/高\s*(\d+(\.\d+)?)\s*(cm|mm)?/i);
      if (heightMatch) {
        const val = parseFloat(heightMatch[1]);
        const mm = heightMatch[3]?.toLowerCase() === 'cm' ? val * 10 : val;
        height = `${mm}mm`;
      } else {
        const altHeightMatch = name.match(/\b(15\d|16\d)\s*mm\b/i);
        if (altHeightMatch) height = `${altHeightMatch[1]}mm`;
      }

      let led = '無光';
      if (upperName.includes('ARGB')) led = 'ARGB';
      else if (upperName.includes('RGB')) led = 'RGB';

      return `${type} > ${height} > ${led}`;
    }
  }

  // 8. 周邊配件等
  if (category === ProductCategory.KEYBOARD) {
    if (upperName.includes('無線') || upperName.includes('WIRELESS')) return '無線鍵盤';
    if (upperName.includes('機械')) return '機械式鍵盤';
    return '一般鍵盤';
  }

  if (category === ProductCategory.MOUSE) {
    if (upperName.includes('無線') || upperName.includes('WIRELESS')) return '無線滑鼠';
    if (upperName.includes('電競') || upperName.includes('GAMING')) return '電競滑鼠';
    return '一般滑鼠';
  }

  if (category === ProductCategory.HEADSET) {
    if (upperName.includes('無線') || upperName.includes('WIRELESS') || upperName.includes('藍牙') || upperName.includes('BLUETOOTH')) return '無線耳機';
    if (upperName.includes('電競') || upperName.includes('GAMING')) return '電競耳機';
    return '一般耳機 / 麥克風';
  }

  if (category === ProductCategory.SPEAKER) {
    if (upperName.includes('藍牙') || upperName.includes('BLUETOOTH') || upperName.includes('無線') || upperName.includes('WIRELESS')) return '藍牙 / 無線喇叭';
    return '電腦喇叭';
  }

  if (category === ProductCategory.FAN) {
    if (upperName.includes('12CM') || upperName.includes('120MM') || upperName.includes('120 ARGB')) return '12cm 風扇';
    if (upperName.includes('14CM') || upperName.includes('140MM') || upperName.includes('140 ARGB')) return '14cm 風扇';
    return '其他尺寸風扇';
  }

  if (category === ProductCategory.NETWORK) {
    if (upperName.includes('分享器') || upperName.includes('ROUTER') || upperName.includes('無線分享器')) return '無線路由器';
    if (upperName.includes('網路卡') || upperName.includes('網卡') || upperName.includes('LAN CARD')) return '網路卡';
    if (upperName.includes('交換器') || upperName.includes('SWITCH') || upperName.includes('HUB')) return '交換器';
    return '其他網通設備';
  }

  if (category === ProductCategory.OS) {
    if (upperName.includes('WIN 11') || upperName.includes('WINDOWS 11') || upperName.includes('WIN11')) return 'Windows 11';
    if (upperName.includes('WIN 10') || upperName.includes('WINDOWS 10') || upperName.includes('WIN10')) return 'Windows 10';
    return '其他作業系統';
  }

  if (category === ProductCategory.SOFTWARE) {
    if (upperName.includes('防毒') || upperName.includes('防護') || upperName.includes('OFFICE') || upperName.includes('MICROSOFT 365')) return '防毒與辦公軟體';
    return '應用軟體';
  }

  return null;
}

/**
 * Ensure product has correct category, using keyword detection as fallback.
 */
export function categorizeProduct(product: Product): Product {
  let cat = product.category;
  
  // 檢查當前分類是否被污染，或者是否為 OTHER
  let needsRecategorize = cat === ProductCategory.OTHER;
  
  if (cat === ProductCategory.CPU && isCpuContaminated(product.rawName)) needsRecategorize = true;
  else if (cat === ProductCategory.MOTHERBOARD && isMbContaminated(product.rawName)) needsRecategorize = true;
  else if (cat === ProductCategory.GPU && isGpuContaminated(product.rawName)) needsRecategorize = true;
  else if (cat === ProductCategory.RAM && isRamContaminated(product.rawName)) needsRecategorize = true;
  else if (cat === ProductCategory.SSD && isSsdContaminated(product.rawName)) needsRecategorize = true;
  else if (cat === ProductCategory.HDD && isHddContaminated(product.rawName)) needsRecategorize = true;
  else if (cat === ProductCategory.COOLER && isCoolerContaminated(product.rawName)) needsRecategorize = true;

  if (needsRecategorize) {
    cat = detectCategory(product.rawName);
  }

  let subcat = product.subcategory;
  const newSubcat = detectSubcategory(cat, product.rawName);
  if (newSubcat) {
    subcat = newSubcat;
  } else {
    subcat = undefined; // 若無匹配的子分類則清空
  }

  return {
    ...product,
    category: cat,
    subcategory: subcat || undefined,
  };
}
