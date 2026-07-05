import { describe, expect, it } from 'vitest';
import { extractBrand, normalizeName, normalizeProduct } from './normalizer.js';
import { ProductCategory } from '../shared/types.js';
import type { Product } from '../shared/types.js';

describe('normalizeName SKU 變體保留', () => {
  it('鍵盤標題保留顏色與軸體，避免不同 SKU 顯示成同名卡', () => {
    const whiteRed = normalizeName(
      'irocks K71M-Gateron 機械式鍵盤(白)/有線/Pbt/紅軸/金屬旋鈕/中文/懸浮/Rgb, $2390 ◆ ★',
      ProductCategory.KEYBOARD,
    );
    const blackTea = normalizeName(
      'irocks K71M-Gateron 機械式鍵盤(黑)/有線/Pbt/茶軸/金屬旋鈕/中文/懸浮/Rgb, $2390 ◆ ★',
      ProductCategory.KEYBOARD,
    );

    expect(whiteRed).toContain('白色');
    expect(whiteRed).toContain('紅軸');
    expect(blackTea).toContain('黑色');
    expect(blackTea).toContain('茶軸');
    expect(whiteRed).not.toBe(blackTea);
  });

  it('darkFlash 鍵盤保留來源特殊色，避免不同色誤併', () => {
    const blue = normalizeProduct(makeProduct(
      'darkFlash GD100 雙模機械式鍵盤(星空藍)/有線/無線/黃軸/中文/熱插拔/Pbt/三色/無光, $1190 ◆ ★',
      ProductCategory.KEYBOARD,
    ));
    const caramel = normalizeProduct(makeProduct(
      '大飛 darkFlash GD100 雙模機械式鍵盤(焦糖色/有線-無線/黃軸/中文/無光/多媒體按鍵/熱插拔/PBT/1年保固)',
      ProductCategory.KEYBOARD,
    ));

    expect(blue.brand).toBe('darkFlash');
    expect(caramel.brand).toBe('darkFlash');
    expect(blue.name).toContain('星空藍');
    expect(caramel.name).toContain('焦糖色');
    expect(blue.name).not.toBe(caramel.name);
  });

  it('背插與背插式主機板命名統一', () => {
    const coolpc = normalizeName(
      '微星 B850 GAMING PLUS WIFI PZ 背插(ATX/LAN5G+Wi-Fi 7/註五年/白)12+2+1相, $6290 ◆ ★',
      ProductCategory.MOTHERBOARD,
    );
    const sinya = normalizeName(
      '微星 B850 GAMING PLUS WIFI PZ 背插式 (ATX/1P/Realtek 5Gb/Wi-Fi 7+BT 5.4/白色/註冊五年保) 12+2+1相供電',
      ProductCategory.MOTHERBOARD,
    );

    expect(coolpc).toBe('微星 B850 GAMING PLUS WIFI PZ 背插');
    expect(sinya).toBe(coolpc);
  });

  it('滑鼠與水冷標題保留顏色，避免不同顏色看起來重複', () => {
    const mouse = normalizeName(
      '羅技 G Pro X Superlight 2 無線電競滑鼠(電光藍)/混合微動/44000Dpi/超輕量60g/8000Hz, $3390',
      ProductCategory.MOUSE,
    );
    const cooler = normalizeName(
      '華碩 ROG RYUO IV 360 ARGB(白) 龍王四代/6.67吋曲面/6年【XZ】, $11290 ◆ ★',
      ProductCategory.COOLER,
    );

    expect(mouse).toContain('電光藍');
    expect(cooler).toContain('白色');
  });

  it('水冷標題會先移除來源色字再加 canonical 顏色，避免黑黑色/白白色落單', () => {
    const coolpc = normalizeName(
      '酷碼 MasterLiquid 360 Atmos II LCD ARGB(黑)/360mm/三風扇, $3990 ◆ ★',
      ProductCategory.COOLER,
    );
    const sinya = normalizeName(
      '酷碼 MasterLiquid 360 Atmos II LCD ARGB 黑 水冷 黑色',
      ProductCategory.COOLER,
    );

    expect(coolpc).toBe('酷碼 MasterLiquid 360 Atmos II LCD ARGB 黑色');
    expect(sinya).toBe(coolpc);
  });

  it('水冷標題統一色版與三代冗字', () => {
    const jonsbo = normalizeName('JONSBO 喬思伯 TH-360 黑色版 一體式水冷散熱器☆2990元', ProductCategory.COOLER);
    const rog = normalizeName('華碩 ROG STRIX LC III 360 ARGB LCD 飛龍三代 水冷散熱器', ProductCategory.COOLER);

    expect(jonsbo).toBe('JONSBO 喬思伯 TH-360 黑色');
    expect(rog).toBe('華碩 ROG STRIX LC III 360 ARGB LCD 飛龍');
  });

  it('主機板標題移除供電相數，避免相/相供電造成同款分裂', () => {
    const coolpc = normalizeName(
      '華碩 ROG STRIX B860-I GAMING WIFI 10+1+2+1相',
      ProductCategory.MOTHERBOARD,
    );
    const sinya = normalizeName(
      '華碩 ROG STRIX B860-I GAMING WIFI 10+1+2+1相供電',
      ProductCategory.MOTHERBOARD,
    );

    expect(coolpc).toBe('華碩 ROG STRIX B860-I GAMING WIFI');
    expect(sinya).toBe(coolpc);
  });

  it('主機板標題移除 socket、主機板與促銷註記，避免同款分裂', () => {
    const autobuy = normalizeName(
      'ASUS 華碩 TUF GAMING B650M-PLUS WIFI AM5主機板 (M-ATX/3+2年保)(任搭U)☆4390元',
      ProductCategory.MOTHERBOARD,
    );
    const coolpc = normalizeName(
      '華碩 TUF GAMING B650M-PLUS WIFI(M-ATX/LAN 2.5G+無線)12+2+2相*7/31止, $4390 ◆ ★',
      ProductCategory.MOTHERBOARD,
    );

    expect(autobuy).toBe('ASUS 華碩 TUF GAMING B650M-PLUS WIFI');
    expect(coolpc).toBe('華碩 TUF GAMING B650M-PLUS WIFI');
  });

  it('主機板標題移除白色描述但保留 W/ICE 型號 token', () => {
    const withWhite = normalizeName('華碩 ROG STRIX B850-I GAMING WIFI7 W 白色', ProductCategory.MOTHERBOARD);
    const ice = normalizeName('技嘉 B850M AORUS ELITE WIFI6E ICE 白色', ProductCategory.MOTHERBOARD);

    expect(withWhite).toBe('華碩 ROG STRIX B850-I GAMING WIFI7 W');
    expect(ice).toBe('技嘉 B850M AORUS ELITE WIFI6E ICE');
  });

  it('ASUS 白龍王/白龍神水冷會正規化為白色變體', () => {
    const coolpc = normalizeName(
      '華碩 ROG RYUO IV 360 ARGB(白) 龍王四代/6.67吋曲面/6年【XZ】, $11290 ◆ ★',
      ProductCategory.COOLER,
    );
    const sinya = normalizeName(
      '華碩 ROG RYUO IV 360 ARGB 白龍王四代 (360mm/6.67″AMOLED曲面水冷頭/六年換新保固)',
      ProductCategory.COOLER,
    );

    expect(coolpc).toBe('華碩 ROG RYUO IV 360 ARGB 龍王四代 白色');
    expect(sinya).toBe(coolpc);
  });

  it('風扇標題保留黑白與單顆/三入組，避免單顆和套裝誤併', () => {
    const singleBlack = normalizeName(
      'ASUS 華碩 TUF GAMING TR120 ARGB 風扇(單入) 《黑》☆569元',
      ProductCategory.FAN,
    );
    const tripleWhite = normalizeName(
      '華碩 TUF Gaming TR120 ARGB(白) 風扇/三顆裝/厚28mm/側邊雙模式/PWM/二年保, $1790 ◆ ★',
      ProductCategory.FAN,
    );

    expect(singleBlack).toContain('黑色');
    expect(singleBlack).toContain('單顆');
    expect(tripleWhite).toContain('白色');
    expect(tripleWhite).toContain('3IN1');
    expect(singleBlack).not.toBe(tripleWhite);
  });

  it('反向風扇標題統一 REVERSE/反向扇，避免同款跨店落單', () => {
    const autobuyReverse = normalizeName(
      'ASUS 華碩 TUF GAMING TR120 ARGB REVERSE 3IN1反向風扇(三入組) 《黑》☆1690元',
      ProductCategory.FAN,
    );
    const coolpcReverse = normalizeName(
      '華碩 TUF Gaming TR120 ARGB(黑) 反向扇/三顆裝/厚28mm/側邊雙模式/PWM/二年保, $1690 ◆ ★',
      ProductCategory.FAN,
    );

    expect(autobuyReverse).toContain('黑色');
    expect(autobuyReverse).toContain('3IN1');
    expect(autobuyReverse).toContain('反向');
    expect(coolpcReverse).toContain('黑色');
    expect(coolpcReverse).toContain('3IN1');
    expect(coolpcReverse).toContain('反向');
  });

  it('散熱膏標題保留克數，避免 2g 與 5.8g 誤併', () => {
    const small = normalizeName('Thermalright 利民 TF8 散熱膏(2g)☆250元', ProductCategory.COOLER);
    const large = normalizeName('利民 Thermalright TF8 散熱膏/5.8公克/導熱係數 13.8W/mK, $590 ◆ ★', ProductCategory.COOLER);

    expect(small).toContain('2g');
    expect(large).toContain('5.8g');
    expect(small).not.toBe(large);
  });

  it('麗臺 NVIDIA 專業卡品牌歸 Leadtek，不被晶片品牌 NVIDIA 蓋掉', () => {
    expect(extractBrand('麗臺 NVIDIA RTX PRO 4500 Blackwell 32GB GDDR7 工作站繪圖卡')).toBe('Leadtek');
    expect(extractBrand('Leadtek 麗臺 RTX PRO 4500 Blackwell 32G GDDR7 256bit 繪圖卡')).toBe('Leadtek');

    const normalized = normalizeProduct(makeProduct(
      '麗臺 NVIDIA RTX PRO 4500 Blackwell 32GB GDDR7 工作站繪圖卡【少量】, $131000 ◆ ★',
      ProductCategory.GPU,
      'NVIDIA',
    ));
    expect(normalized.brand).toBe('Leadtek');
  });

  it('主機板來源品牌若是 Intel/AMD 平台，改用商品名中的板廠品牌', () => {
    const normalized = normalizeProduct(makeProduct(
      '華碩 ROG STRIX B860-I GAMING WIFI 10+1+2+1相供電',
      ProductCategory.MOTHERBOARD,
      'Intel',
    ));

    expect(normalized.brand).toBe('ASUS');
  });
});

function makeProduct(rawName: string, category: ProductCategory, brand?: string): Product {
  return {
    id: 'test-product',
    name: rawName,
    price: 1000,
    category,
    brand,
    specs: {},
    inStock: true,
    priceChange: null,
    source: 'coolpc',
    sourceUrl: 'https://example.test',
    rawName,
    scrapedAt: '2026-07-04T00:00:00.000Z',
  };
}
