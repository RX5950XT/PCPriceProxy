import { describe, expect, it } from 'vitest';
import { compareSubcategoryNode } from './subcategory-sort.js';
import { ProductCategory } from './types.js';

function sorted(category: ProductCategory, values: string[]): string[] {
  return [...values].sort((a, b) => compareSubcategoryNode(category, a, b));
}

describe('compareSubcategoryNode', () => {
  it('CPU 世代依新到舊排序，不被 Ryzen 7/5 系列字串干擾', () => {
    expect(sorted(ProductCategory.CPU, [
      'Ryzen 7000 (Zen4)',
      'Ryzen 5000 (Zen3)',
      'Ryzen 8000 (Zen4)',
      'Threadripper 7000',
      'Threadripper 9000',
      'Threadripper',
      'Ryzen 9000 (Zen5)',
      'Ryzen 3000 (Zen2)',
    ])).toEqual([
      'Ryzen 9000 (Zen5)',
      'Ryzen 8000 (Zen4)',
      'Ryzen 7000 (Zen4)',
      'Ryzen 5000 (Zen3)',
      'Ryzen 3000 (Zen2)',
      'Threadripper 9000',
      'Threadripper 7000',
      'Threadripper',
    ]);
  });

  it('主機板先依晶片組語義排序，不被 Intel/AMD 字串壓過', () => {
    expect(sorted(ProductCategory.MOTHERBOARD, [
      'Intel B760',
      'AMD B850',
      'Intel H610',
      'AMD X870E',
      'Intel Z790',
      'AMD B650',
      'Intel Z890',
      'AMD B650E',
      'AMD A620',
    ])).toEqual([
      'Intel Z890',
      'Intel Z790',
      'Intel B760',
      'Intel H610',
      'AMD X870E',
      'AMD B850',
      'AMD B650E',
      'AMD B650',
      'AMD A620',
    ]);
  });

  it('GPU 系列依顯卡世代排序，不被 Intel/AMD 品牌字串壓過', () => {
    expect(sorted(ProductCategory.GPU, [
      'Intel Arc 系列',
      'AMD RX 9000系列',
      'NVIDIA RTX 40系列',
      'NVIDIA 專業繪圖卡',
      'NVIDIA RTX 50系列',
      'AMD 專業繪圖卡',
    ])).toEqual([
      'NVIDIA RTX 50系列',
      'NVIDIA RTX 40系列',
      'AMD RX 9000系列',
      'Intel Arc 系列',
      'NVIDIA 專業繪圖卡',
      'AMD 專業繪圖卡',
    ]);
  });

  it('GPU 完整子分類路徑先依型號排序，不被 VRAM 容量壓過', () => {
    expect(sorted(ProductCategory.GPU, [
      'NVIDIA RTX 50系列 > RTX 5060 > 16G',
      'NVIDIA RTX 50系列 > RTX 5090 > 32G',
      'NVIDIA RTX 50系列 > RTX 5070 > 12G',
      'NVIDIA RTX 50系列 > RTX 5070 Ti > 16G',
      'NVIDIA RTX 50系列 > RTX 5080 > 16G',
    ])).toEqual([
      'NVIDIA RTX 50系列 > RTX 5090 > 32G',
      'NVIDIA RTX 50系列 > RTX 5080 > 16G',
      'NVIDIA RTX 50系列 > RTX 5070 Ti > 16G',
      'NVIDIA RTX 50系列 > RTX 5070 > 12G',
      'NVIDIA RTX 50系列 > RTX 5060 > 16G',
    ]);
  });

  it('記憶體容量依總容量大到小，組套在同容量前面', () => {
    expect(sorted(ProductCategory.RAM, [
      '32G',
      '128G',
      '64G (32G*2)',
      '128G (64G*2)',
      '16G',
      '256G',
    ])).toEqual([
      '256G',
      '128G (64G*2)',
      '128G',
      '64G (32G*2)',
      '32G',
      '16G',
    ]);
  });

  it('RAM 完整子分類路徑仍依容量大到小排序', () => {
    expect(sorted(ProductCategory.RAM, [
      '桌上型 UDIMM > DDR5 > 32G (16G*2) > 6000MHz',
      '桌上型 UDIMM > DDR5 > 128G (64G*2) > 6000MHz',
      '桌上型 UDIMM > DDR5 > 64G (32G*2) > 6000MHz',
    ])).toEqual([
      '桌上型 UDIMM > DDR5 > 128G (64G*2) > 6000MHz',
      '桌上型 UDIMM > DDR5 > 64G (32G*2) > 6000MHz',
      '桌上型 UDIMM > DDR5 > 32G (16G*2) > 6000MHz',
    ]);
  });

  it('散熱器節點依類型、冷排與高度區間的裝機語意排序', () => {
    expect(sorted(ProductCategory.COOLER, [
      '散熱膏/配件',
      '下吹式空冷',
      '單塔空冷',
      '雙塔空冷',
      '一體式水冷 (AIO)',
    ])).toEqual([
      '一體式水冷 (AIO)',
      '雙塔空冷',
      '單塔空冷',
      '下吹式空冷',
      '散熱膏/配件',
    ]);

    expect(sorted(ProductCategory.COOLER, [
      '151–160mm',
      '240mm',
      '100mm 以下（低矮型）',
      '420mm',
      '161mm 以上',
      '101–150mm',
    ])).toEqual([
      '420mm',
      '240mm',
      '100mm 以下（低矮型）',
      '101–150mm',
      '151–160mm',
      '161mm 以上',
    ]);
  });

  it('其餘側欄規格也使用集中排序表而非字典順序', () => {
    expect(sorted(ProductCategory.SSD, ['行動外接式', 'SATA 2.5吋', 'M.2 NVMe SSD'])).toEqual([
      'M.2 NVMe SSD', 'SATA 2.5吋', '行動外接式',
    ]);
    expect(sorted(ProductCategory.PSU, ['Flex 電源', 'SFX-L 電源', 'ATX 電源', 'TFX 電源', 'SFX 電源'])).toEqual([
      'ATX 電源', 'SFX 電源', 'SFX-L 電源', 'TFX 電源', 'Flex 電源',
    ]);
    expect(sorted(ProductCategory.HDD, ['企業級硬碟', '桌上型硬碟', 'NAS 專用碟', '監控碟'])).toEqual([
      '桌上型硬碟', 'NAS 專用碟', '監控碟', '企業級硬碟',
    ]);
    expect(sorted(ProductCategory.NETWORK, ['交換器', '無線路由器', '網路卡 / 接收器'])).toEqual([
      '無線路由器', '網路卡 / 接收器', '交換器',
    ]);
    expect(sorted(ProductCategory.KEYBOARD, [
      '薄膜鍵盤 > 無線 > Logitech',
      '機械式鍵盤 > 茶軸 > 有線 > Keychron',
      '機械式鍵盤 > 紅軸 > 無線 > ASUS',
    ])).toEqual([
      '機械式鍵盤 > 紅軸 > 無線 > ASUS',
      '機械式鍵盤 > 茶軸 > 有線 > Keychron',
      '薄膜鍵盤 > 無線 > Logitech',
    ]);
    expect(sorted(ProductCategory.HEADSET, ['麥克風 > Rode', '無線耳機 > Logitech', '有線耳機 > HyperX', 'USB 麥克風 > AverMedia'])).toEqual([
      '有線耳機 > HyperX', '無線耳機 > Logitech', 'USB 麥克風 > AverMedia', '麥克風 > Rode',
    ]);
    expect(sorted(ProductCategory.FAN, ['其他尺寸風扇', '14cm 風扇', '12cm 風扇'])).toEqual([
      '12cm 風扇', '14cm 風扇', '其他尺寸風扇',
    ]);
    expect(sorted(ProductCategory.CABLE, ['其他線材', '影音線 > HDMI', '網路線 > CAT.6'])).toEqual([
      '網路線 > CAT.6', '影音線 > HDMI', '其他線材',
    ]);
    expect(sorted(ProductCategory.MOUSE, [
      '一般滑鼠 > 無線 > Logitech',
      '電競滑鼠 > 有線 > Razer',
      '電競滑鼠 > 無線 > ASUS',
      '垂直滑鼠 > 無線 > Logitech',
    ])).toEqual([
      '電競滑鼠 > 有線 > Razer',
      '電競滑鼠 > 無線 > ASUS',
      '垂直滑鼠 > 無線 > Logitech',
      '一般滑鼠 > 無線 > Logitech',
    ]);
    expect(sorted(ProductCategory.CASE, [
      'E-ATX > Lian Li > O11',
      'Mini-ITX > Cooler Master',
      'ATX > Thermaltake > View',
      'M-ATX > ASUS > Prime',
      '未標板型 > ASUS',
    ])).toEqual([
      'Mini-ITX > Cooler Master',
      'M-ATX > ASUS > Prime',
      'ATX > Thermaltake > View',
      'E-ATX > Lian Li > O11',
      '未標板型 > ASUS',
    ]);
    expect(sorted(ProductCategory.OS, ['應用軟體 > 防毒軟體', '作業系統 > Windows 11'])).toEqual([
      '作業系統 > Windows 11', '應用軟體 > 防毒軟體',
    ]);
    expect(sorted(ProductCategory.PACKAGE, ['搭購價單品 > CPU 處理器', '整機電腦 > ASUS', '零件組合 > CPU + 主機板'])).toEqual([
      '整機電腦 > ASUS', '零件組合 > CPU + 主機板', '搭購價單品 > CPU 處理器',
    ]);
    expect(sorted(ProductCategory.MONITOR, ['FHD 1080p', '5K', '2K QHD', '4K UHD'])).toEqual([
      '5K', '4K UHD', '2K QHD', 'FHD 1080p',
    ]);
  });
});
