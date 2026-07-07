import { describe, expect, it } from 'vitest';
import { exactMatchKey, matchProducts } from './matcher.js';
import { normalizeName } from './normalizer.js';
import { ProductCategory } from '../shared/types.js';
import type { Product, Source } from '../shared/types.js';

function product(id: string, source: Source, price: number, specs: Record<string, string> = {}): Product {
  return {
    id,
    name: 'Intel Core i5-14400 處理器',
    price,
    category: ProductCategory.CPU,
    brand: 'Intel',
    model: 'I5-14400',
    specs,
    inStock: true,
    priceChange: null,
    source,
    sourceUrl: 'https://example.test',
    rawName: 'Intel Core i5-14400 處理器',
    scrapedAt: '2026-07-04T00:00:00.000Z',
  };
}

function namedProduct(
  id: string,
  source: Source,
  name: string,
  category: ProductCategory,
  price: number,
  brand = 'Logitech',
): Product {
  return {
    ...product(id, source, price),
    name,
    rawName: name,
    category,
    brand,
    model: undefined,
  };
}

describe('matchProducts 比價分組', () => {
  it('exact match 會把同 key 的所有跨來源列收進同一組，避免非代表列變單例卡', () => {
    const groups = matchProducts([
      product('coolpc-low', 'coolpc', 5200),
      product('coolpc-high', 'coolpc', 5600),
      product('sinya-low', 'sinya', 5300),
      product('sinya-high', 'sinya', 5700),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].products).toHaveLength(4);
    expect([...new Set(groups[0].products.map(p => p.source))].sort()).toEqual(['coolpc', 'sinya']);
    expect(groups[0].products.map(p => p.id).sort()).toEqual([
      'coolpc-high',
      'coolpc-low',
      'sinya-high',
      'sinya-low',
    ]);
    expect(groups[0].lowestPrice).toBe(5200);
  });

  it('條件價商品不進跨店比價組', () => {
    const groups = matchProducts([
      product('coolpc-condition', 'coolpc', 4800, { priceCondition: '搭板價' }),
      product('sinya-normal', 'sinya', 5300),
    ]);

    expect(groups).toHaveLength(0);
  });

  it('非 CPU/GPU 的同顯示名 exact key 會全員回寫同一組，避免單例重複卡', () => {
    const name = '羅技 G Pro X Superlight 2 無線電競滑鼠 黑色';
    const groups = matchProducts([
      namedProduct('coolpc-low', 'coolpc', name, ProductCategory.MOUSE, 3390),
      namedProduct('coolpc-high', 'coolpc', name, ProductCategory.MOUSE, 3690),
      namedProduct('sinya-low', 'sinya', name, ProductCategory.MOUSE, 3390),
      namedProduct('sinya-high', 'sinya', name, ProductCategory.MOUSE, 5490),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].products.map(p => p.id).sort()).toEqual([
      'coolpc-high',
      'coolpc-low',
      'sinya-high',
      'sinya-low',
    ]);
  });

  it('exact key 會忽略顯示名中的中英文品牌前綴差異', () => {
    const autobuy = namedProduct(
      'autobuy-g213',
      'autobuy',
      'Logitech 羅技 G213 PRODIGY RGB 遊戲鍵盤',
      ProductCategory.KEYBOARD,
      1190,
    );
    const coolpc = namedProduct(
      'coolpc-g213',
      'coolpc',
      '羅技 G213 Prodigy Rgb 遊戲鍵盤',
      ProductCategory.KEYBOARD,
      1190,
    );

    expect(exactMatchKey(autobuy)).toBe(exactMatchKey(coolpc));
    expect(matchProducts([autobuy, coolpc])).toHaveLength(1);
  });

  it('exact key 會將未標色 default 款視為黑色款，但不併白色款', () => {
    const defaultBlack = namedProduct(
      'coolpc-default',
      'coolpc',
      'Razer DeathAdder Essential 煉獄奎蛇電競滑鼠',
      ProductCategory.MOUSE,
      518,
      'Razer',
    );
    const sinyaBlack = namedProduct(
      'sinya-black',
      'sinya',
      '雷蛇Razer DeathAdder Essential 煉獄奎蛇電競滑鼠 黑色',
      ProductCategory.MOUSE,
      518,
      'Razer',
    );
    const sinyaWhite = namedProduct(
      'sinya-white',
      'sinya',
      '雷蛇Razer DeathAdder Essential 煉獄奎蛇電競滑鼠 白色',
      ProductCategory.MOUSE,
      518,
      'Razer',
    );

    expect(exactMatchKey(defaultBlack)).toBe(exactMatchKey(sinyaBlack));
    expect(exactMatchKey(defaultBlack)).not.toBe(exactMatchKey(sinyaWhite));
    expect(matchProducts([defaultBlack, sinyaBlack, sinyaWhite])).toHaveLength(1);
  });

  it('exact key 會將未標色 AIO 視為黑色款，但不併白色款', () => {
    const defaultBlack = namedProduct(
      'autobuy-default',
      'autobuy',
      'ID-COOLING SL360 XE',
      ProductCategory.COOLER,
      3490,
      'ID-COOLING',
    );
    const coolpcBlack = namedProduct(
      'coolpc-black',
      'coolpc',
      'ID-COOLING SL360 XE 黑色',
      ProductCategory.COOLER,
      3490,
      'ID-COOLING',
    );
    const coolpcWhite = namedProduct(
      'coolpc-white',
      'coolpc',
      'ID-COOLING SL360 XE 白色',
      ProductCategory.COOLER,
      3490,
      'ID-COOLING',
    );

    expect(exactMatchKey(defaultBlack)).toBe(exactMatchKey(coolpcBlack));
    expect(exactMatchKey(defaultBlack)).not.toBe(exactMatchKey(coolpcWhite));
    expect(matchProducts([defaultBlack, coolpcBlack, coolpcWhite])).toHaveLength(1);
  });

  it('exact key 會統一風扇 REVERSE/反向扇與套裝文字', () => {
    const autobuy = namedProduct(
      'autobuy-reverse',
      'autobuy',
      normalizeName(
        'ASUS 華碩 TUF GAMING TR120 ARGB REVERSE 3IN1反向風扇(三入組) 《黑》☆1690元',
        ProductCategory.FAN,
      ),
      ProductCategory.FAN,
      1690,
      'ASUS',
    );
    const coolpc = namedProduct(
      'coolpc-reverse',
      'coolpc',
      normalizeName(
        '華碩 TUF Gaming TR120 ARGB(黑) 反向扇/三顆裝/厚28mm/側邊雙模式/PWM/二年保, $1690 ◆ ★',
        ProductCategory.FAN,
      ),
      ProductCategory.FAN,
      1690,
      'ASUS',
    );

    expect(exactMatchKey(autobuy)).toBe(exactMatchKey(coolpc));
    expect(matchProducts([autobuy, coolpc])).toHaveLength(1);
  });

  it('exact key 會忽略網通與耳機的通用描述差異', () => {
    const mercusysA = namedProduct(
      'coolpc-ma530',
      'coolpc',
      'MERCUSYS水星 MA530 藍牙 5.3 微型 USB 接收器',
      ProductCategory.NETWORK,
      299,
      'Mercusys',
    );
    const mercusysB = namedProduct(
      'autobuy-ma530',
      'autobuy',
      'Mercusys 水星 MA530 藍牙5.3微型 USB藍牙接收器',
      ProductCategory.NETWORK,
      299,
      'Mercusys',
    );
    const cetraA = namedProduct(
      'coolpc-cetra',
      'coolpc',
      '華碩 ROG Cetra True Wireless SpeedNova 真無線耳機 白色',
      ProductCategory.HEADSET,
      4990,
      'ASUS',
    );
    const cetraB = namedProduct(
      'sinya-cetra',
      'sinya',
      '華碩ROG Cetra True Wireless SpeedNova 真無線藍牙耳機 白色',
      ProductCategory.HEADSET,
      4990,
      'ASUS',
    );

    expect(exactMatchKey(mercusysA)).toBe(exactMatchKey(mercusysB));
    expect(exactMatchKey(cetraA)).toBe(exactMatchKey(cetraB));
  });

  it('exact key 會統一儲存容量 G/GB 寫法', () => {
    const coolpc = namedProduct(
      'coolpc-ssd',
      'coolpc',
      '致態 ZhiTai Ti600 500G',
      ProductCategory.SSD,
      2999,
      'ZhiTai',
    );
    const sinya = namedProduct(
      'sinya-ssd',
      'sinya',
      '致態 ZhiTai Ti600 500GB',
      ProductCategory.SSD,
      2999,
      'ZhiTai',
    );

    expect(exactMatchKey(coolpc)).toBe(exactMatchKey(sinya));
  });

  it('fuzzy match 不合併顏色或鍵盤軸體不同的 SKU', () => {
    const groups = matchProducts([
      namedProduct(
        'coolpc-blue',
        'coolpc',
        '羅技 G Pro X Superlight 2 無線電競滑鼠 電光藍',
        ProductCategory.MOUSE,
        3390,
      ),
      namedProduct(
        'sinya-black',
        'sinya',
        '羅技 G Pro X Superlight 2 無線電競滑鼠 黑色',
        ProductCategory.MOUSE,
        3390,
      ),
      namedProduct(
        'coolpc-red',
        'coolpc',
        'irocks K71M-Gateron 機械式鍵盤 白色 紅軸',
        ProductCategory.KEYBOARD,
        2390,
        'iRocks',
      ),
      namedProduct(
        'sinya-tea',
        'sinya',
        'irocks K71M-Gateron 機械式鍵盤 白色 茶軸',
        ProductCategory.KEYBOARD,
        2390,
        'iRocks',
      ),
    ]);

    expect(groups).toHaveLength(0);
  });
});

describe('第十三輪：HDD 規格鍵 / 料號鍵 / token 集合 exact key', () => {
  function hdd(id: string, source: Source, rawName: string, name: string, price: number, brand = 'Seagate'): Product {
    return { ...product(id, source, price), category: ProductCategory.HDD, rawName, name, brand, model: undefined };
  }

  it('三家不同寫法的同一顆內接碟以原廠料號合併（料號優先，可分 SATA/SAS）', () => {
    const coolpc = hdd('c1', 'coolpc', 'Seagate 8TB【新梭魚】(256M/5400轉/3年保) (ST8000DM004)', 'Seagate 8TB', 9390);
    const sinya = hdd('s1', 'sinya', '【新梭魚】Seagate 8TB 5400轉/256MB/3.5吋/三年保固 (ST8000DM004)', 'Seagate 8TB 5400轉', 9450);
    const autobuy = hdd('a1', 'autobuy', 'Seagate 希捷 新梭魚 BarraCuda 8TB 5400轉 256MB SATA3 硬碟(ST8000DM004)☆9990元', 'Seagate 新梭魚 BarraCuda 8TB 5400轉', 9990);

    const keys = [coolpc, sinya, autobuy].map(exactMatchKey);
    expect(keys[0]).toBe('HDD-MPN-ST8000DM004');
    expect(keys[0]).toBe(keys[1]);
    expect(keys[1]).toBe(keys[2]);
  });

  it('同規格不同介面（SATA 017B vs SAS 018B）依料號分開', () => {
    const sata = hdd('a1', 'autobuy', 'Seagate 希捷 企業號 8TB 3.5吋 7200轉 256M快取 SATA3 EXOS企業級硬碟(ST8000NM017B-5Y)', 'EXOS 8TB', 13990);
    const sas = hdd('a2', 'autobuy', 'Seagate 希捷 Exos 7E10 8TB 3.5吋 7200轉 256M快取 SAS企業級硬碟(ST8000NM018B-5Y)', 'EXOS 7E10 8TB', 14990);
    expect(exactMatchKey(sata)).not.toBe(exactMatchKey(sas));
  });

  it('無料號時退回「品牌+系列+容量+轉速」規格鍵', () => {
    const a = hdd('c1', 'coolpc', 'Seagate 8TB【新梭魚】(256M/5400轉/3年保)【限組裝】', 'Seagate 8TB', 9390);
    const b = hdd('s1', 'sinya', '【新梭魚】Seagate 8TB 5400轉/256MB/3.5吋/三年保固', 'Seagate 8TB 5400轉', 9450);
    expect(exactMatchKey(a)).toBe('HDD-SPEC-SEAGATE-BARRACUDA-8T-5400');
    expect(exactMatchKey(a)).toBe(exactMatchKey(b));
  });

  it('不同容量或轉速不可同鍵', () => {
    const a = hdd('c1', 'coolpc', 'Seagate 8TB【新梭魚】(256M/5400轉/3年保)', 'Seagate 8TB', 9390);
    const b = hdd('s1', 'sinya', '【新梭魚】Seagate 4TB 5400轉/256MB/3.5吋', 'Seagate 4TB', 5990);
    const c = hdd('s2', 'sinya', '【新梭魚】Seagate 8TB 7200轉/256MB/3.5吋', 'Seagate 8TB 7200轉', 13890);
    expect(exactMatchKey(a)).not.toBe(exactMatchKey(b));
    expect(exactMatchKey(a)).not.toBe(exactMatchKey(c));
  });

  it('缺系列詞時退回原廠料號（Toshiba HDW*）', () => {
    const a = hdd('c1', 'coolpc', 'Toshiba 2TB (256M/7200轉/3年保) (HDWD320UZSVA)【限組裝】', 'Toshiba 2TB', 4790, 'Toshiba');
    const b = hdd('s1', 'sinya', '東芝 Toshiba 2TB 桌上型 (HDWD320UZSVA) 7200轉', 'Toshiba 2TB 7200轉', 4890, 'Toshiba');
    expect(exactMatchKey(a)).toBeDefined();
    expect(exactMatchKey(a)).toBe(exactMatchKey(b));
  });

  it('RAM exact key 對語序與通用詞（桌上型/筆記型記憶體、D5 縮寫）不敏感', () => {
    const coolpc: Product = { ...product('c1', 'coolpc', 5299), category: ProductCategory.RAM, brand: 'Crucial', model: undefined, name: '美光16GB DDR5-5600 NB', rawName: '美光16GB DDR5-5600 NB' };
    const sinya: Product = { ...product('s1', 'sinya', 6199), category: ProductCategory.RAM, brand: 'Crucial', model: undefined, name: 'Micron Crucial NB DDR5-5600 16G 美光筆記型記憶體', rawName: 'Micron Crucial NB DDR5-5600 16G 美光筆記型記憶體' };
    expect(exactMatchKey(coolpc)).toBeDefined();
    expect(exactMatchKey(coolpc)).toBe(exactMatchKey(sinya));
  });

  it('RAM 單條與雙條套件（16G*2）不可同鍵', () => {
    const single: Product = { ...product('c1', 'coolpc', 3250), category: ProductCategory.RAM, brand: 'Crucial', model: undefined, name: 'Crucial DDR5-5600 32G 桌上型記憶體', rawName: 'Crucial DDR5-5600 32G' };
    const kit: Product = { ...product('s1', 'sinya', 6400), category: ProductCategory.RAM, brand: 'Crucial', model: undefined, name: 'Crucial DDR5-5600 16G*2 桌上型記憶體', rawName: 'Crucial DDR5-5600 16G*2' };
    expect(exactMatchKey(single)).not.toBe(exactMatchKey(kit));
  });
});
