import { describe, expect, it } from 'vitest';
import { bundleReason, categorizeProduct, gpuMatchKey, isRealBundle } from './categorizer.js';
import { extractBrand } from './normalizer.js';
import { ProductCategory } from '../shared/types.js';
import type { Product } from '../shared/types.js';

function makeProduct(rawName: string, category: ProductCategory): Product {
  return {
    id: `test-${Buffer.from(rawName).toString('hex').slice(0, 12)}`,
    name: rawName,
    price: 1000,
    category,
    specs: {},
    inStock: true,
    priceChange: null,
    source: 'coolpc',
    sourceUrl: 'https://example.test',
    rawName,
    scrapedAt: '2026-07-04T00:00:00.000Z',
  };
}

describe('categorizeProduct 分類順序', () => {
  it('先辨識 A+B GPU 套裝，不讓來源 GPU 分類直接通過', () => {
    const rawName = 'ASUS【H-V501MV-09270H003WB】+ 華碩 DUAL-RTX5060-O8G, $40990 ◆ ★';

    expect(isRealBundle(rawName)).toBe(true);
    expect(categorizeProduct(makeProduct(rawName, ProductCategory.GPU)).category).toBe(ProductCategory.PACKAGE);
  });

  it('先辨識完整工作站規格，不被 RTX 關鍵字誤收為單張顯卡', () => {
    const rawName = '技嘉【AI TOP 100 Z890】U9 285K / 128G / 2T + 320G / 360水冷 / RTX5090【訂】, $249000 ◆ ★';

    expect(isRealBundle(rawName)).toBe(true);
    expect(categorizeProduct(makeProduct(rawName, ProductCategory.GPU)).category).toBe(ProductCategory.PACKAGE);
  });

  it('單張 AI TOP 顯卡不是完整工作站套裝', () => {
    const rawName = '技嘉 GeForce RTX 5090 AI TOP 32G 顯示卡 (std:2600MHz/三風扇/長34cm), $89990';

    expect(isRealBundle(rawName)).toBe(false);
    expect(categorizeProduct(makeProduct(rawName, ProductCategory.GPU)).category).toBe(ProductCategory.GPU);
  });

  // 任搭 CPU 是主機板的搭板價 → 不留在 CPU，也不是零件淨價，歸「搭購價單品 > 主機板」
  it('任搭 CPU 活動中的主機板不留在 CPU，改列搭板價主機板', () => {
    const rawName = '[任搭CPU活動] 華碩 PRIME B840M-A-CSM(M-ATX/註冊四年保)8+2+1相供電, $2990 ★';
    const categorized = categorizeProduct(makeProduct(rawName, ProductCategory.CPU));

    expect(categorized.category).toBe(ProductCategory.PACKAGE);
    expect(categorized.subcategory).toBe('搭購價單品 > 主機板 > 搭板價');
    expect(categorized.specs.priceCondition).toBe('搭板價');
  });

  it('mATX 標記的任搭 CPU 主機板也要重判為主機板（搭板價）', () => {
    const rawName = '【任搭CPU】華碩 B650M-AYW WIFI(mATX/1H/Realtek 2.5Gb/註冊五年保)';
    const categorized = categorizeProduct(makeProduct(rawName, ProductCategory.CPU));

    expect(categorized.subcategory).toBe('搭購價單品 > 主機板 > 搭板價');
  });

  it('無條件價的主機板仍歸主機板（不因重判被吸進 PACKAGE）', () => {
    const clean = categorizeProduct(makeProduct('華碩 PRIME B840M-A-CSM(M-ATX/註冊四年保)8+2+1相供電', ProductCategory.CPU));
    expect(clean.category).toBe(ProductCategory.MOTHERBOARD);
    expect(clean.subcategory).toBe('AMD AM5 > B840 > ASUS');
  });

  it('U 版專案 CPU + 主機板是真組合', () => {
    const rawName = '【U版專案】AMD Ryzen5 7500F MPK+技嘉 B650EM FORCE WIFI6E<font color="#ff0000">【現省600】</font>';

    expect(isRealBundle(rawName)).toBe(true);
    expect(categorizeProduct(makeProduct(rawName, ProductCategory.CPU)).category).toBe(ProductCategory.PACKAGE);
  });

  it('完整迷你整機規格不應落在 SSD 或散熱器', () => {
    const gx10 = 'ASUS Ascent GX10 GB10 / 128G / Gen4 1TB SSD【現貨】, $175900 ◆ ★';
    const rog = 'ASUS ROG【GM700TZ-R9800X149W】R7 9800X3D / 16G / 1T / 850W電供 / 水冷, $50990 ◆ ★';
    const barebone = 'MSI PRO DP21 14M【248BTW】Intel H610(CPU.RAM.DISK選購), $5490 ◆ ★';
    const compact = 'ASUS ROG【GR70-N90026AN】R9 9955HX3D / 32G / 2T / RTX5070【訂】, $129990↘$124900 ◆ ★';

    expect(categorizeProduct(makeProduct(gx10, ProductCategory.SSD)).category).toBe(ProductCategory.PACKAGE);
    expect(categorizeProduct(makeProduct(rog, ProductCategory.COOLER)).category).toBe(ProductCategory.PACKAGE);
    expect(categorizeProduct(makeProduct(barebone, ProductCategory.CPU)).category).toBe(ProductCategory.PACKAGE);
    expect(categorizeProduct(makeProduct(compact, ProductCategory.GPU)).category).toBe(ProductCategory.PACKAGE);
  });

  it('內顯整機（CPU+晶片組+RAM+儲存、無獨顯無電源）不可留在零件分類', () => {
    const igpuBuild = '華碩【I5管理者】I5-12400 / H610 / 8G DDR4 / 512G SSD, $13500 ◆ ★';
    const apuBuild = '華碩【R5管理者】R5 3400G / A520 / 8G DDR4 / 512G SSD, $9990 ◆ ★';

    expect(isRealBundle(igpuBuild)).toBe(true);
    expect(isRealBundle(apuBuild)).toBe(true);
    expect(categorizeProduct(makeProduct(igpuBuild, ProductCategory.SSD)).category).toBe(ProductCategory.PACKAGE);
    expect(categorizeProduct(makeProduct(apuBuild, ProductCategory.SSD)).category).toBe(ProductCategory.PACKAGE);
  });

  it('欣亞與品牌電競整機不可因 RTX 型號留在 GPU', () => {
    const sinyaPc = '欣亞PC【天秤座】(i5-12400F/H610M/16G/500GB M.2/技嘉 RTX5060/650W主日系/Windows 11 Home/4年完美保固)';
    const acerDesktop = 'Acer Predator Orion PO3-665 電競電腦 (Ultra 7-265F/RTX5060 8G/16GB DDR5/1TB PCIe/650W/Win11/三年保固/DG.E4TTA.001)';
    const zeusLaptop = 'Genuine捷元 ZEUS 15G /C7-250H/RTX5070/16G/500G 黑 J0076614, $46990 ◆ ★';

    expect(isRealBundle(sinyaPc)).toBe(true);
    expect(isRealBundle(acerDesktop)).toBe(true);
    expect(isRealBundle(zeusLaptop)).toBe(true);
    expect(categorizeProduct(makeProduct(sinyaPc, ProductCategory.GPU)).category).toBe(ProductCategory.PACKAGE);
    expect(categorizeProduct(makeProduct(acerDesktop, ProductCategory.GPU)).category).toBe(ProductCategory.PACKAGE);
    expect(categorizeProduct(makeProduct(zeusLaptop, ProductCategory.GPU)).category).toBe(ProductCategory.PACKAGE);
  });

  it('螢幕加鍵盤或桌子的套裝不是單一鍵盤/滑鼠', () => {
    const keyboardBundle = '【開局即滿裝】AOC Q27G42HE 電競螢幕 2K/200hz+狼蛛鍵盤❰三模❱+電競桌(120cm)<font color="#ff0000">【↘現省4600】</font>';
    const mouseBundle = '【破盤價】【27型】AOC Q27G42HE 電競螢幕 (DP/HDMI/Fast IPS/2K/1ms/200Hz/Adaptive Sync/HDR10/內建喇叭/三年保固+)狼蛛 AULA F99pro 星落凝雲 （淺藍+白+深紫）';

    expect(categorizeProduct(makeProduct(keyboardBundle, ProductCategory.KEYBOARD)).category).toBe(ProductCategory.PACKAGE);
    expect(categorizeProduct(makeProduct(mouseBundle, ProductCategory.MOUSE)).category).toBe(ProductCategory.PACKAGE);
  });

  it('內建喇叭的螢幕仍是螢幕，外接燒錄機不被 Mac OS 字樣誤歸 OS', () => {
    const monitor = '【27型】AOC Q27G42HE 電競螢幕 (DP/HDMI/Fast IPS/2K/1ms/200Hz/Adaptive Sync/HDR10/內建喇叭/三年保固)';
    const optical = '華碩 SDRW-08D2S 黑 外接式超薄燒錄機 (8XDVD/支援 M-DISC/支援Mac OS)<font color="#ff0000">【熱賣】</font>';

    expect(categorizeProduct(makeProduct(monitor, ProductCategory.SPEAKER)).category).toBe(ProductCategory.MONITOR);
    // 光碟機不再是獨立分類：燒錄機落 OTHER 由 diy-filter 移除，但不可被誤收進 OS
    expect(categorizeProduct(makeProduct(optical, ProductCategory.OS)).category).toBe(ProductCategory.OTHER);
  });

  it('一般喇叭的 Hz 頻率規格不可被誤當螢幕污染', () => {
    const speaker = 'Edifier R1280DBs 2.0聲道藍牙喇叭 55Hz-20kHz 木紋';

    expect(categorizeProduct(makeProduct(speaker, ProductCategory.SPEAKER)).category).toBe(ProductCategory.SPEAKER);
  });

  it('含喇叭的智慧螢幕不可留在 speaker', () => {
    const smartMonitor = '三星 Smart M7 S32FM703UC〈2H1C/VA/含喇叭/HDR10/白色〉【9成9新.. 保固比照新品】';

    expect(categorizeProduct(makeProduct(smartMonitor, ProductCategory.SPEAKER)).category).toBe(ProductCategory.MONITOR);
  });

  it('行動電源與掌機收納包不是 PSU 或 PC 機殼', () => {
    const powerBank = 'iWALK 五代 PRO【4800mAh】額定容量:2800mAh Lightning 數位顯示行動電源 - 粉紅, $499';
    const travelCase = 'ASUS ROG XBOX ALLY TRAVEL CASE 二合一收納保護包 / 防潑水, $1499 ◆ ★';

    expect(categorizeProduct(makeProduct(powerBank, ProductCategory.PSU)).category).toBe(ProductCategory.OTHER);
    expect(categorizeProduct(makeProduct(travelCase, ProductCategory.CASE)).category).toBe(ProductCategory.OTHER);
  });

  it('來源誤標 SSD 的 3.5 吋外接硬碟要歸 HDD', () => {
    const rawName = 'Seagate 希捷 新黑鑽 Expansion Desktop 24TB 3.5吋外接硬碟(STKP24000400)☆26990元';
    const categorized = categorizeProduct(makeProduct(rawName, ProductCategory.SSD));

    expect(categorized.category).toBe(ProductCategory.HDD);
    expect(categorized.subcategory).toContain('24TB');
  });

  it('舊款 GT 顯卡與工作站主機板也要有子分類', () => {
    const gt = categorizeProduct(makeProduct('華碩 GT1030-SL-2G-BRK(1468MHz/GDDR5/17cm/註四年), $3590', ProductCategory.GPU));
    const ws = categorizeProduct(makeProduct('華碩 Pro WS W890E-SAGE SE(EEB/2*Intel 10G+LAN 1Gb/註四年)16+2+2+1+2 相供電, $39990', ProductCategory.MOTHERBOARD));

    expect(gt.subcategory).toContain('GT 1030');
    expect(ws.subcategory).toBe('Intel LGA1851 > W890 > ASUS');
  });

  it('CPU 側欄不輸出高階或舊款孤立世代節點', () => {
    const ryzen9 = categorizeProduct(makeProduct('AMD Ryzen 9 9950X 處理器', ProductCategory.CPU));
    const shortRyzen7 = categorizeProduct(makeProduct('AMD R7 5800X3D 十週年紀念版 AM4輝煌十載', ProductCategory.CPU));
    const threadripper = categorizeProduct(makeProduct('AMD Ryzen Threadripper 7960X 處理器', ProductCategory.CPU));
    const oldIntel = categorizeProduct(makeProduct('Intel Core i7-5960X 八核心處理器《3.0Ghz/LGA2011》(代理商貨)', ProductCategory.CPU));
    const ultra = categorizeProduct(makeProduct('Intel Core Ultra 7 265K 處理器(Core Ultra 200S)', ProductCategory.CPU));

    expect(ryzen9.subcategory).toBe('AMD > Ryzen 9000 (Zen5) > Ryzen 9');
    expect(shortRyzen7.subcategory).toBe('AMD > Ryzen 5000 (Zen3) > Ryzen 7');
    expect(threadripper.subcategory).toBe('AMD > Threadripper 7000');
    // 舊款不再裸「Intel」：落到明確「其他／舊款」桶（避免側欄無子節點）
    expect(oldIntel.subcategory).toBe('Intel > 其他／舊款 > Core i7');
    expect(ultra.subcategory).toBe('Intel > Core Ultra 200S > Ultra 7');
    expect([ryzen9.subcategory, threadripper.subcategory, oldIntel.subcategory].join(' ')).not.toContain('高階');
    expect(oldIntel.subcategory).not.toContain('第 5 代');
  });

  it('來源標成 MONITOR 但本體是投影機或贈品時要重判', () => {
    const rawName = 'ASUS ZenBeam Latte L2可攜式LED投影機(1080P/1920x1080/960流明)*附Android TV BOX, $9999 ◆ ★ 熱賣';

    expect(categorizeProduct(makeProduct(rawName, ProductCategory.MONITOR)).category).toBe(ProductCategory.OTHER);
  });

  it('真正螢幕仍保留在 MONITOR', () => {
    const rawName = 'ASUS ROG Strix XG27UQDMS 27吋 4K 240Hz 電競螢幕, $29900';

    expect(categorizeProduct(makeProduct(rawName, ProductCategory.MONITOR)).category).toBe(ProductCategory.MONITOR);
  });

  it('NITRO+ 型號名稱中的加號不是套裝符號', () => {
    const rawName = '藍寶石 NITRO+氮動 RX 9060 XT 16GB D6 OC (std:3320MHz/三風扇/註冊五年保/長30cm)';

    const categorized = categorizeProduct(makeProduct(rawName, ProductCategory.GPU));
    expect(isRealBundle(rawName)).toBe(false);
    expect(categorized.category).toBe(ProductCategory.GPU);
  });

  it('GPU 型號不可從價格或核心時脈裸數字誤判', () => {
    const rx9070 = categorizeProduct(makeProduct('技嘉 RX9070XT GAMING OC 16G(3060MHz/29cm/三風扇/五年保), $27890↘$26690 ◆ ★ 熱賣', ProductCategory.GPU));
    const rtxPro = categorizeProduct(makeProduct('麗臺 NVIDIA RTX PRO 6000 Blackwell 96GB GDDR7 工作站繪圖卡【少量】, $476000 ◆ ★', ProductCategory.GPU));
    const rtxPro4500 = categorizeProduct(makeProduct('麗臺 NVIDIA RTX PRO 4500 Blackwell 32GB GDDR7 工作站繪圖卡【少量】, $131000 ◆ ★', ProductCategory.GPU));

    expect(rx9070.subcategory).toBe('AMD RX 9000系列 > RX 9070 XT > GIGABYTE');
    expect(rtxPro.subcategory).toBe('NVIDIA 專業繪圖卡 > RTX PRO 6000 > Leadtek');
    expect(rtxPro4500.subcategory).toBe('NVIDIA 專業繪圖卡 > RTX PRO 4500 > Leadtek');
  });

  it('GPU 精確鍵要區分白色版與一般版', () => {
    const black = gpuMatchKey('ASUS 華碩 DUAL-RTX5060-O8G 顯示卡');
    const white = gpuMatchKey('ASUS 華碩 DUAL-RTX5060-O8G-WHITE 顯示卡');
    const pro4500 = gpuMatchKey('麗臺 NVIDIA RTX PRO 4500 Blackwell 32GB GDDR7 工作站繪圖卡 黑色');
    const eagleIceAutobuy = gpuMatchKey('Gigabyte 技嘉 RTX 5060 EAGLE OC ICE 8G 顯示卡');
    const eagleIceSinya = gpuMatchKey('技嘉 RTX 5060 EAGLE OC ICE 8G 白色');
    const aeroAutobuy = gpuMatchKey('Gigabyte 技嘉 RTX 5080 AERO OC SFF 16G 顯示卡');
    const aeroSinya = gpuMatchKey('技嘉 RTX 5080 AERO OC SFF 16G 白色');
    const lowProfileCoolpc = gpuMatchKey('技嘉 RTX5050 OC Low Profile 8G');
    const lowProfileSinya = gpuMatchKey('技嘉 RTX 5050 OC Low Profile 8G');

    expect(black).toBeDefined();
    expect(white).toBeDefined();
    expect(pro4500).toBe('RTXPRO4500-PRO-32G');
    expect(eagleIceAutobuy).toBe(eagleIceSinya);
    expect(aeroAutobuy).toBe(aeroSinya);
    expect(lowProfileCoolpc).toBe(lowProfileSinya);
    expect(black).not.toBe(white);
  });
});

describe('第十三輪：HDD/FAN/NETWORK 污染與子分類修正', () => {
  it('Razer Barracuda（梭魚）耳機不可因 BARRACUDA 落入 HDD', () => {
    const raw = '雷蛇Razer Barracuda X 梭魚X 電競耳機(2022)/無線/記憶耳墊/心形指向麥克風';
    expect(categorizeProduct(makeProduct(raw, ProductCategory.HDD)).category).toBe(ProductCategory.HEADSET);
  });

  it('機殼風扇的「1900 RPM / PWM / 單入組」不可誤中 HDD', () => {
    const raw = '華碩 TUF Gaming TF120 白 A.RGB 單入組 (PWM/抗震襯墊/進階流體動力軸承/1900 RPM/2年保固)';
    const out = categorizeProduct(makeProduct(raw, ProductCategory.HDD));
    expect(out.category).toBe(ProductCategory.FAN);
    expect(out.subcategory).toBe('12cm 風扇');
  });

  it('HDMI 線型號含 HDD 字樣不可落入 HDD', () => {
    const raw = 'JETART HDMI PREMIUM 2.0版影音傳輸 HDMI線-1.2M/4Kx2K/黑鉻金屬外殼+雙鍍金接頭/HDD2012AA';
    expect(categorizeProduct(makeProduct(raw, ProductCategory.HDD)).category).not.toBe(ProductCategory.HDD);
  });

  it('Ti/XT 直接黏尾的顯卡型號要能被隱式 GPU 偵測抓到（不落 FAN）', () => {
    const raw = '微星 RTX 5070Ti 16G GAMING TRIO OC (std:2580MHz/三風扇/註冊五年保/長33.8cm)';
    expect(categorizeProduct(makeProduct(raw, ProductCategory.FAN)).category).toBe(ProductCategory.GPU);
    const raw2 = '華碩 PRIME-RX9070XT-O16G-WHITE 白色 (std:3030MHz/三風扇/註冊五年保/長31.2cm)';
    expect(categorizeProduct(makeProduct(raw2, ProductCategory.FAN)).category).toBe(ProductCategory.GPU);
  });

  it('型號內嵌瓦數的 PSU（UD750GM）與一體式水冷不可留在 FAN', () => {
    const psu = '技嘉 UD750GM PG5 V2 (80+金牌/ATX3.1/PCIe 5.1/HYB靜音風扇/全模組/全日系/十年保)';
    expect(categorizeProduct(makeProduct(psu, ProductCategory.FAN)).category).toBe(ProductCategory.PSU);
    const aio = '華碩 TUF GAMING LC III 360 ARGB (360mm/ARGB冷頭/預裝風扇/一體式風扇/六年保固)';
    expect(categorizeProduct(makeProduct(aio, ProductCategory.FAN)).category).toBe(ProductCategory.COOLER);
  });

  it('掌機（ROG ALLY / MSI Claw）歸 PACKAGE 整機', () => {
    const ally = 'ASUS ROG XBOX ALLY 白 Ryzen Z2 A / 16G / 512G / Radeon / Wi-Fi 6E';
    expect(categorizeProduct(makeProduct(ally, ProductCategory.NETWORK)).category).toBe(ProductCategory.PACKAGE);
    const claw = '微星 Claw A8+ BZ2EM【012TW】Ryzen Z2 Extreme / 24G / 1TB / Radeon / Wi-Fi 7';
    expect(categorizeProduct(makeProduct(claw, ProductCategory.NETWORK)).category).toBe(ProductCategory.PACKAGE);
  });

  it('印表機 / 無線充電座 / 無線耳麥不可留在 NETWORK', () => {
    const printer = categorizeProduct(makeProduct('EPSON L3550 高速三合一 Wi-Fi(列印/影印/掃描)連續供墨複合機', ProductCategory.NETWORK));
    expect(printer.category).not.toBe(ProductCategory.NETWORK);
    const charger = categorizeProduct(makeProduct('Gigastone 23W 三合一摺疊式磁吸無線充電座【WP-9330G】', ProductCategory.NETWORK));
    expect(charger.category).not.toBe(ProductCategory.NETWORK);
    const headset = categorizeProduct(makeProduct('羅技G Pro X II 職業級無線電競耳麥 第二代/黑色/無線/Lightspeed', ProductCategory.NETWORK));
    expect(headset.category).toBe(ProductCategory.HEADSET);
  });

  it('NETWORK 子分類拆分：攝影機 / NAS / Mesh / 網卡', () => {
    // 網通＝設備類型 > 品牌（不再先攤一整排品牌）
    expect(categorizeProduct(makeProduct('圓剛 PW315 高畫質定焦網路攝影機/AI人臉追蹤', ProductCategory.NETWORK)).subcategory).toBe('網路攝影機 > AverMedia');
    expect(categorizeProduct(makeProduct('Synology DS1823xs+【8Bay】AMD Ryzen V1780B 四核(3.35GHz)/8GB/10Gb*1', ProductCategory.NETWORK)).subcategory).toBe('NAS 網路儲存 > Synology');
    expect(categorizeProduct(makeProduct('華碩 ZENWIFI BT8 兩入組 (BE14000/Wi-Fi 7/三頻/MESH/隱藏八天線/2.5Gb)', ProductCategory.NETWORK)).subcategory).toBe('無線路由器 > Mesh 網狀 > ASUS');
    expect(categorizeProduct(makeProduct('TP-LINK Archer TBE400E ( BE6500 / Wi-Fi 7 / 雙天線 / 藍牙5.4 / PCI-E)', ProductCategory.NETWORK)).subcategory).toBe('網路卡 / 接收器 > TP-Link');
  });

  it('M.2 外接盒（USB10G 無容量）不可留在 SSD；USB10G 不可誤判為容量', () => {
    const enclosure = categorizeProduct(makeProduct('華碩【M.2/USB10G】ROG Strix Arion Lite / NVMe / USB-C to C【ESD-S1C Lite】', ProductCategory.SSD));
    expect(enclosure.category).not.toBe(ProductCategory.SSD);
  });

  it('HDD 監控碟獨立子分類；桌上型不再與監控混名', () => {
    const sky = categorizeProduct(makeProduct('【監控鷹AI】Seagate 10TB (ST10000VE001) 256M/7200轉/五年保固/三年資料救援', ProductCategory.HDD));
    expect(sky.subcategory).toMatch(/^監控碟 > /);
    const desktop = categorizeProduct(makeProduct('Seagate 1TB【新梭魚】(256M/7200轉/3年保) (ST1000DM014)', ProductCategory.HDD));
    expect(desktop.subcategory).toMatch(/^桌上型硬碟 > /);
    // 限組裝的同一顆碟不是零件淨價，移到搭購價單品
    const bundled = categorizeProduct(makeProduct('Seagate 1TB【新梭魚】(256M/7200轉/3年保) (ST1000DM014)【限組裝】', ProductCategory.HDD));
    expect(bundled.subcategory).toBe('搭購價單品 > 傳統硬碟 HDD > 限組裝');
  });

  it('加購優惠是條件價單品，不是組合（仍記錄原零件分類）', () => {
    const raw = '【加購優惠】買 ASUS NUC DDR5系列準系統 加購 美光 NB 16G D5-5600 (一台限購1)';
    const out = categorizeProduct(makeProduct(raw, ProductCategory.RAM));
    expect(isRealBundle(raw)).toBe(false);
    expect(out.subcategory).toBe('搭購價單品 > 記憶體 > 加購價');
    expect(out.specs?.priceCondition).toBe('加購價');
  });

  it('聯力 TL140 積木風扇歸 14cm；下吹式散熱器歸 COOLER', () => {
    const fan = categorizeProduct(makeProduct('LIAN LI 聯力 UNI FAN TL 140 單入 ARGB積木風扇(需搭控制器)《黑》', ProductCategory.FAN));
    expect(fan.category).toBe(ProductCategory.FAN);
    expect(fan.subcategory).toBe('14cm 風扇');
    const cooler = categorizeProduct(makeProduct('利民 AXP90-X47 黑化版 下吹式 (4導管/9cm風扇*1/高47mm)', ProductCategory.FAN));
    expect(cooler.category).toBe(ProductCategory.COOLER);
  });
});

describe('第十三輪：家具過濾', () => {
  it('電競椅 / 電競桌 / 升降桌不可留在鍵盤或滑鼠分類', () => {
    const chair = categorizeProduct(makeProduct('Cougar Explore Neo Royal F 電競椅/仿亞麻布椅面/可收納腳托/3D扶手', ProductCategory.KEYBOARD));
    expect(chair.category).toBe(ProductCategory.OTHER);
    const desk = categorizeProduct(makeProduct('irocks D01-SL-DX 電競桌-電動升降(北歐雲杉)/靜音雙馬達/乘重:100KG', ProductCategory.KEYBOARD));
    expect(desk.category).toBe(ProductCategory.OTHER);
  });
});

describe('第十四輪：主機板腳位樹與 GPU 品牌層', () => {
  it('主機板子分類為「CPU 腳位 > 晶片組 > 品牌」，無 DDR 與尺寸層', () => {
    const mb = categorizeProduct(makeProduct('微星 MAG B850 TOMAHAWK MAX WIFI (ATX/2.5G LAN/DDR5)', ProductCategory.MOTHERBOARD));
    expect(mb.subcategory).toBe('AMD AM5 > B850 > MSI');
    const intel = categorizeProduct(makeProduct('華碩 PRIME B860M-A WIFI (M-ATX/DDR5/1G LAN)', ProductCategory.MOTHERBOARD));
    expect(intel.subcategory).toBe('Intel LGA1851 > B860 > ASUS');
  });

  it('GPU 子分類為「系列 > 型號 > 品牌」，僅多顯存型號插入容量層', () => {
    const single = categorizeProduct(makeProduct('技嘉 RTX 5090 GAMING OC 32G (std:2655MHz/三風扇)', ProductCategory.GPU));
    expect(single.subcategory).toBe('NVIDIA RTX 50系列 > RTX 5090 > GIGABYTE');
    const multi = categorizeProduct(makeProduct('華碩 DUAL-RTX5060TI-O16G (std:2692MHz/雙風扇)', ProductCategory.GPU));
    expect(multi.subcategory).toBe('NVIDIA RTX 50系列 > RTX 5060 Ti > 16G > ASUS');
  });

  it('RX 9070 GRE 是獨立型號，不與 RX 9070 混同', () => {
    const gre = categorizeProduct(makeProduct('藍寶石 PULSE 脈動 RX 9070 GRE 12GB D6 (std:2790MHz/雙風扇)', ProductCategory.GPU));
    expect(gre.subcategory).toBe('AMD RX 9000系列 > RX 9070 GRE > Sapphire');
  });
});

describe('第十五輪：除污與品牌分類', () => {
  it('AIO 水冷「Core II」不可誤中 CPU 關鍵字 Core i，應歸散熱器', () => {
    const aio = categorizeProduct(makeProduct('酷碼 MasterLiquid 240 Core II ARGB 黑 (240mm/雙腔式冷頭/CRYOFUZE散熱膏/12cm風扇*2)', ProductCategory.CPU));
    expect(aio.category).toBe(ProductCategory.COOLER);
  });

  it('電源擴充線 / 免電源轉換線 不可因「電源」誤收為 PSU', () => {
    const cable = categorizeProduct(makeProduct('銀欣 1轉3 PWM 風扇電源擴充線 100mm(SST-CPF02)', ProductCategory.PSU));
    expect(cable.category).not.toBe(ProductCategory.PSU);
  });

  it('PSU：瓦數藏型號可解、SFX-L 尺寸成頂層', () => {
    const hidden = categorizeProduct(makeProduct('技嘉 UD750GM PG5 V2 (80+金牌/ATX3.1/PCIe 5.1/HYB靜音風扇/全模組/全日系/十年保)', ProductCategory.PSU));
    expect(hidden.subcategory).toBe('ATX 電源 > 750W~1000W > 80+ 金牌 > 全模組');
    const sfxl = categorizeProduct(makeProduct('華碩 ROG LOKI 850W 雙8/白金/ATX3.0(PCIe 5.0)/ARGB風扇/10年保【SFX-L規格】', ProductCategory.PSU));
    expect(sfxl.subcategory).toBe('SFX-L 電源 > 750W~1000W > 80+ 白金牌');
  });

  it('伺服器 ECC RDIMM 不混入桌上型；料號 BD4 不可誤判 D5 為 DDR4', () => {
    const reg = categorizeProduct(makeProduct('金士頓32GB 5600MT/s D5 ECC Reg CL46 DIMM 2R*8 Hynix A(KSM56R46BD8/32HA)', ProductCategory.RAM));
    expect(reg.subcategory).toBe('伺服器記憶體 > DDR5 > 32G > 5600MHz');
    const bd4 = categorizeProduct(makeProduct('金士頓96GB 6400MT/s D5 ECC Reg CL52 DIMM 2R*4 Micron C(KSM64R52BD4/96MC)', ProductCategory.RAM));
    expect(bd4.subcategory).toBe('伺服器記憶體 > DDR5 > 96G > 6400MHz');
  });

  it('機殼＝最大板型 > 品牌 > 系列；中文品牌走別名', () => {
    const tt = categorizeProduct(makeProduct('曜越 View 390 Air 黑 顯卡長42/CPU高16/鷗翼式曲面玻璃/分艙設計/支援背插/ATX', ProductCategory.CASE));
    expect(tt.subcategory).toBe('ATX > Thermaltake > View');
    const eatx = categorizeProduct(makeProduct('聯力 O11 Dynamic EVO RGB 黑 顯卡長45.5/U高16.7/全景玻璃/E-ATX', ProductCategory.CASE));
    expect(eatx.subcategory).toBe('E-ATX > Lian Li > O11');
    const matx = categorizeProduct(makeProduct('華碩 Prime AP201 白 顯卡長33.8/CPU高17/方形進氣孔/M-ATX', ProductCategory.CASE));
    expect(matx.subcategory).toBe('M-ATX > ASUS > Prime');
    const itx = categorizeProduct(makeProduct('Cooler Master 酷碼【NCORE 100 MAX】ITX電腦機殼《古銅》', ProductCategory.CASE));
    expect(itx.subcategory).toMatch(/^Mini-ITX > Cooler Master/);
  });

  it('鍵盤＝機制 > 軸 > 有線/無線 > 品牌；喇叭＝型態 > 品牌', () => {
    const kb = categorizeProduct(makeProduct('keychron K8 Max 80% 三模機械鍵盤 鋁框 RGB Mac/Win 熱插拔 Super紅軸', ProductCategory.KEYBOARD));
    expect(kb.subcategory).toBe('機械式鍵盤 > 紅軸 > 無線 > Keychron');
    const membrane = categorizeProduct(makeProduct('羅技 Logitech K120 有線鍵盤 薄膜', ProductCategory.KEYBOARD));
    expect(membrane.subcategory).toBe('薄膜鍵盤 > 有線 > Logitech');
    // 三音路書架型雙模 → 2.0（不當便攜、也不再品牌優先）
    const spk = categorizeProduct(makeProduct('漫步者Edifier R2750DB 三音路喇叭 /Bluetooth V4.', ProductCategory.SPEAKER));
    expect(spk.subcategory).toBe('2.0 桌面／書架 > Edifier');
  });

  it('喇叭型態：2.0／2.1／聲霸／重低音／便攜；藍芽＝藍牙', () => {
    const desk = categorizeProduct(makeProduct('漫步者Edifier R1280DB 2.0聲道藍牙喇叭 (藍牙無線+有線/二件式)', ProductCategory.SPEAKER));
    expect(desk.subcategory).toBe('2.0 桌面／書架 > Edifier');
    // 藍芽異體字仍應進 2.0（有 2.0 標示）
    const blueya = categorizeProduct(makeProduct('Edifier 漫步者 G1000 II 2.0 電競藍芽喇叭 (黑色)', ProductCategory.SPEAKER));
    expect(blueya.subcategory).toBe('2.0 桌面／書架 > Edifier');
    const multi = categorizeProduct(makeProduct('羅技 Z625 2.1聲道 三件式喇叭/400W大功率輸出/THX專業認證', ProductCategory.SPEAKER));
    expect(multi.subcategory).toBe('2.1／多件式 > Logitech');
    const bar = categorizeProduct(makeProduct('雷蛇 Razer LEVIATHAN V2 Sound Bar 利維坦巨獸/有線/藍芽/兩件式重低音喇叭', ProductCategory.SPEAKER));
    expect(bar.subcategory).toBe('聲霸 > Razer');
    const sub = categorizeProduct(makeProduct('漫步者Edifier T5 主動式超重低音喇叭 /DSP數位音訊處理/70W', ProductCategory.SPEAKER));
    expect(sub.subcategory).toBe('重低音（單顆） > Edifier');
    const portable = categorizeProduct(makeProduct('AIWA 愛華 便攜式藍牙喇叭 BST-330 黑色', ProductCategory.SPEAKER));
    expect(portable.subcategory).toBe('便攜藍牙 > AIWA');
    const stream = categorizeProduct(makeProduct('EDIFIER ES300 藍牙串流喇叭 (黑色)', ProductCategory.SPEAKER));
    expect(stream.subcategory).toBe('便攜藍牙 > Edifier');
    // Nommo 系列品名常寫「重低音」但實為桌面全頻喇叭，不可落「其他」或單顆重低音
    const nommo = categorizeProduct(makeProduct('雷蛇Razer Nommo V2 天狼星 重低音喇叭', ProductCategory.SPEAKER));
    expect(nommo.subcategory).toBe('2.0 桌面／書架 > Razer');
  });

  it('耳機 / 麥克風＝連線或產品大類 > 品牌', () => {
    const wireless = categorizeProduct(makeProduct('羅技G Pro X II 職業級無線電競耳麥 第二代/黑色/無線/Lightspeed', ProductCategory.HEADSET));
    expect(wireless.subcategory).toBe('無線耳機 > Logitech');
    const wired = categorizeProduct(makeProduct('HyperX Cloud II 電競耳機 有線 7.1', ProductCategory.HEADSET));
    expect(wired.subcategory).toBe('有線耳機 > HyperX');
    const usbMic = categorizeProduct(makeProduct('圓剛 AM310 USB 麥克風', ProductCategory.HEADSET));
    expect(usbMic.subcategory).toBe('USB 麥克風 > AverMedia');
  });

  it('條件價單品移出零件分類，歸「整機/組合 > 搭購價單品 > 原分類 > 條件」', () => {
    const assembled = categorizeProduct(makeProduct('【組裝價】Intel Core i5-12400F【6核12緒】(2.5GHz(Turbo 4.4GHz)/快取18M/無內顯/65W)【代理公司貨】', ProductCategory.CPU));
    expect(assembled.category).toBe(ProductCategory.PACKAGE);
    expect(assembled.subcategory).toBe('搭購價單品 > CPU 處理器 > 組裝價');

    const boardPrice = categorizeProduct(makeProduct('【搭板】Intel 第12代 Core i5-12400 6核12緒 處理器《2.5Ghz/LGA1700》(代理商貨)☆5500元', ProductCategory.CPU));
    expect(boardPrice.subcategory).toBe('搭購價單品 > CPU 處理器 > 搭板價');

    // 乾淨單品仍留在 CPU
    const clean = categorizeProduct(makeProduct('Intel Core i5-12400F【6核12緒】(2.5GHz(Turbo 4.4GHz)/快取18M/無內顯/65W)【代理公司貨】', ProductCategory.CPU));
    expect(clean.category).toBe(ProductCategory.CPU);
    expect(clean.specs.priceCondition).toBeUndefined();
  });

  it('CPU 盒裝的「不含風扇」不可被判成系統風扇', () => {
    const cpu = categorizeProduct(makeProduct('【搭板】Intel Core Ultra 9 285K 24核24緒 另加NPU 的 AI 處理器(Core Ultra 200S)《3.7Ghz/LGA1851/不含風扇》(代理商貨)☆18200元', ProductCategory.PACKAGE));
    expect(cpu.subcategory).toBe('搭購價單品 > CPU 處理器 > 搭板價');
  });

  it('假加號：加號後不是品牌就不是組合（型號 / 規格 / 介面加號）', () => {
    expect(bundleReason('SAPPHIRE 藍寶石 NITRO+ 氮動 RX 9070 XT GAMING OC 16GB 顯示卡(3+2年保)☆28990元')).toBeNull();
    expect(bundleReason('ZOWIE FK1+-B 電競滑鼠《黑》☆2290元')).toBeNull();
    expect(bundleReason('ASRock 華擎 B650M-H/M.2+ WIFI AM5主機板(MATX/3+1年保)☆2990元')).toBeNull();
    expect(bundleReason('BenQ 明基 GW2791 27型 低藍光+不閃屏 IPS螢幕☆2888元')).toBeNull();
    expect(bundleReason('華擎 TRX50 WS(E-ATX/Marvell 10Gb+LAN 2.5Gb+無線/註五年)18+3+3 電源相位')).toBeNull();
    expect(bundleReason('Synology DS225+【2Bay】Intel J4125 四核心 2.0G/2GB DDR4/1Gb*1/2.5Gb*1')).toBeNull();
    expect(bundleReason('INTEL N6235 mini PCIE介面 無線網路模組☆900元')).toBeNull();
    // 真組合必須保留
    expect(bundleReason('視博通 蒼龍戰士 + 視博通 450W電源(2年) 顯卡長30/CPU高15/ATX')).toBe('plus-part');
    expect(bundleReason('華碩 Prime AP201 黑 /方形進氣孔/M-ATX + 華碩 PRIME 550W 銅牌/直出線/6年保')).toBe('plus-psu-rated');
    expect(bundleReason('【U版專案】Intel Core i5-12400+華碩 PRIME B760M-F D4-CSM')).toBe('plus-cpu-chipset');
    expect(bundleReason('【優惠組合】技嘉 AORUS WATERFORCE II 360 鷹魂二代 + EPONTEC T300 玻璃透側機殼')).toBe('bundle-keyword');
  });

  it('機殼「內含 850W 電源」是本體規格，不是電源也不是組合', () => {
    const nc = categorizeProduct(makeProduct('Cooler Master 酷碼【NCORE 100 MAX】ITX電腦機殼《古銅》(內含SFX 850W+120mm水冷)☆12500元', ProductCategory.PACKAGE));
    expect(nc.category).toBe(ProductCategory.CASE);
    // 「內附顯卡支撐架」的機殼 + 電源仍是真組合
    expect(isRealBundle('【促銷】聯力 V100R 白 全景玻璃機殼 (ATX/內附顯卡支撐架/顯卡415mm)+EPONTEC MARS 750W (80+金牌/全模組)')).toBe(true);
  });

  it('SSD「1TB 含散熱片」是本體規格；純散熱片配件仍排除', () => {
    const ssd = categorizeProduct(makeProduct('三星 Samsung 9100 PRO 1TB含散熱片/PCIe 5.0 x4/讀14700/寫13300/TLC【五年保】~限整機~', ProductCategory.SSD));
    expect(ssd.subcategory).toBe('搭購價單品 > 固態硬碟 SSD > 限組裝');
  });

  it('整機/筆電品牌取品名開頭，不抓規格裡的零件品牌', () => {
    const omen = categorizeProduct(makeProduct('HP HyperX OMEN i7-14650HX/RTX5060/16G/1T/15吋 究極黑 15-ga0008TX 筆電', ProductCategory.PACKAGE));
    expect(omen.subcategory).toBe('筆電 > HP');
    const pn = categorizeProduct(makeProduct('ASUS【PN43-100UMZA】Intel N100 / 8G / 128G / WIN 11 Pro', ProductCategory.PACKAGE));
    expect(pn.subcategory).toBe('整機電腦 > ASUS');
    const coolpc = categorizeProduct(makeProduct('酷！PC【黑熊】 I5-12400/H610/16G DDR5/512G SSD/原廠機殼/650W原廠電供', ProductCategory.PACKAGE));
    expect(coolpc.subcategory).toBe('整機電腦 > 原價屋 酷!PC');
  });

  it('Snapdragon 筆電（無 x86 CPU 型號）仍判為筆電，不落記憶體', () => {
    const zen = categorizeProduct(makeProduct('ASUS Zenbook A14 UX3407QA-0112G26100 冰岩灰 華碩時尚極致纖薄筆電/Snapdragon X X1 26 100/16GB LPDDR5X/512GB PCIe/14吋 16:10', ProductCategory.RAM));
    expect(zen.category).toBe(ProductCategory.PACKAGE);
    expect(zen.subcategory).toBe('筆電 > ASUS');
  });

  it('零件組合依搭配類型分區', () => {
    const casePsu = categorizeProduct(makeProduct('華碩 Prime AP201 黑 /方形進氣孔/M-ATX + 華碩 PRIME 550W 銅牌/直出線/6年保', ProductCategory.PACKAGE));
    expect(casePsu.subcategory).toBe('零件組合 > 機殼 + 電源');
    const coolerCase = categorizeProduct(makeProduct('【優惠促銷】技嘉 AORUS WATERFORCE II 360 鷹魂二代 + Antec 安鈦克 P30 AIR 玻璃透側機殼', ProductCategory.PACKAGE));
    expect(coolerCase.subcategory).toBe('零件組合 > 散熱器 + 機殼');
    const mbRam = categorizeProduct(makeProduct('【重磅價】華碩 PRIME B760M-F D4-CSM+威剛 ADATA DDR4-3200 16G+十銓 TEAM MP33 512GB', ProductCategory.PACKAGE));
    expect(mbRam.subcategory).toBe('零件組合 > 主機板 + 記憶體/儲存');
  });
});

describe('第十七輪：線材獨立分類、OS/軟體合併、光碟機移除', () => {
  const cat = (raw: string, source = ProductCategory.OTHER) => categorizeProduct(makeProduct(raw, source));

  it('伺服器 / 商用工作站不可被品名裡的 DVD-RW 拖進光碟機', () => {
    const server = 'ASUS RS300-E12-RS4 華碩伺服器/Intel E-2436/32G D5 ECC/DVD-RW/450W/IKVM遠端管理模組/三年隔日到府保固';
    const workstation = 'HP Z6 G5 惠普商用工作站/W5-3423/16G D5/512G SSD/1125W/DVD-RW/Win11 Pro WK/3年到府維修保固';

    expect(bundleReason(server)).toBe('server-workstation');
    expect(cat(server).subcategory).toBe('伺服器 / 工作站 > ASUS');
    expect(cat(workstation).subcategory).toBe('伺服器 / 工作站 > HP');
  });

  it('「行動工作站」帶螢幕吋數，是筆電不是工作站', () => {
    const zbook = 'HP ZBOOK 8 G1i 惠普商用行動工作站/Ultra7-255U/16G D5/512G SSD/14吋 WUXGA/Win11 Pro/3年到府';

    expect(cat(zbook).subcategory).toBe('筆電 > HP');
  });

  it('「工作站主機板」不可被誤判成整機', () => {
    const mb = '華碩 PRO WS W790-ACE 工作站主機板 /LGA4677/E-ATX/M.2/DDR5';

    expect(bundleReason(mb)).toBeNull();
    expect(cat(mb, ProductCategory.MOTHERBOARD).category).toBe(ProductCategory.MOTHERBOARD);
  });

  it('外接燒錄機落 OTHER（光碟機不再是獨立分類）', () => {
    expect(cat('華碩【BW-16D1H-U PRO】16X藍光燒錄器 / USB5G / 黑 / 附支架 / 支援Mac').category).toBe(ProductCategory.OTHER);
    expect(cat('ASUS 華碩 SDRW-08D2S-U 外接式燒錄機《黑》').category).toBe(ProductCategory.OTHER);
  });

  it('Windows 隨機版《含DVD》是作業系統，不是光碟機', () => {
    const win = cat('Microsoft 微軟 Windows 11 家用中文 64位元隨機版《含DVD》');

    expect(win.category).toBe(ProductCategory.OS);
    expect(win.subcategory).toBe('作業系統 > Windows 11');
  });

  it('作業系統與應用軟體合併為同一分類，靠第一層區隔', () => {
    expect(cat('Microsoft Office 2024 家用版 中文盒裝').subcategory).toBe('應用軟體 > 辦公軟體');
    expect(cat('PC-cillin 2025 雲端版 12個月1台防護版', ProductCategory.OS).subcategory).toBe('應用軟體 > 防毒軟體');
    // Office 相容註記「WIN10、MAC共用」不可誤吸成 Windows 10
    expect(cat(
      'Microsoft Office 2024 Home and Student 家用中文版/含Word、Excel、PowerPoint/WIN10、MAC共用',
      ProductCategory.OS,
    ).subcategory).toBe('應用軟體 > 辦公軟體');
    expect(cat('Windows 11 Pro 中文專業隨機版 64位元', ProductCategory.OS).subcategory).toBe('作業系統 > Windows 11');
  });

  it('線材依大類 > 細類分層；沒有「線」字的接頭配對也要撈到', () => {
    expect(cat('廣鐸 CAT.6網路線-3米').subcategory).toBe('網路線 > CAT.6');
    expect(cat('LINDY 林帝【47592】CAT.6A 1米 支援到1Gbps U/FTP純銅鍍金接點 / 極細線 / 灰').subcategory).toBe('網路線 > CAT.6A');
    expect(cat('3C Pig【HDMI-100】HDMI 2.0 公-公 / 鍍金頭 / 全銅 / 抗干擾磁環 / 1米').subcategory).toBe('影音線 > HDMI');
    expect(cat('Gigastone【CC-7800B】Type-C to C USB10G / 100W充電傳輸線 / 黑 / 1.5M').subcategory).toBe('USB / 傳輸線 > Type-C to C');
    expect(cat('保護傘 安全插座延長線/6切6座獨立開關/過載自動斷電保護/耐燃材質/1.8米').subcategory).toBe('電源延長線 / 插座 > 延長線插座');
    expect(cat('SATA 硬碟排線 ( 黑 )', ProductCategory.HDD).subcategory).toBe('機內排線 / 延長線 > SATA 排線');
    expect(cat('酷碼 PCI-E 5.0 X16 延長線(黑) 200mm/90度/抗電磁干擾').subcategory).toBe('機內排線 / 延長線 > PCIe 延長線');
    expect(cat('LIAN LI 聯力 STRIMER WIRELESS 24PIN 無線 ARGB延長線 (需搭無線控制器)').subcategory).toBe('機內排線 / 延長線 > 24Pin 電源延長');
    // Type-C 充電線帶 DP Alt Mode 不可被影音線吸走
    expect(cat('LINDY 林帝 Type-C to C 公-公 20Gbps 傳輸線 最大60W / DP Alt Mode / 1M').subcategory).toBe('USB / 傳輸線 > Type-C to C');
  });

  it('內建 KVM 的電競螢幕不可被線材分類吸走', () => {
    const monitor = '【27型】BenQ MOBIUZ EX271Q電競螢幕 (DP/HDMI/KVM/Type-C(65W)/Type-A/IPS/2K/1ms/180Hz)';

    expect(cat(monitor, ProductCategory.MONITOR).category).toBe(ProductCategory.MONITOR);
  });

  it('顯卡立架與風扇集線器只是「附一條線」，不是線材本體', () => {
    expect(cat('聯力 VG4-4-V2X 黑 顯卡立架+PCI-E 4.0延長線/200mm').category).not.toBe(ProductCategory.CABLE);
    expect(cat('華碩 TUF Gaming ARGB PWM 風扇集線器 1分6/磁吸式/雙SATA供電').category).not.toBe(ProductCategory.CABLE);
  });

  it('電源規格的「黑色線材」不可把整顆電源踢出 PSU', () => {
    const antec = cat('Antec 安鈦克 NE850GM 白 (80+金牌/黑色線材/ATX/全模組/全日系/十年保固)', ProductCategory.PSU);
    const msi = cat('微星 MAG A1200PLS PCIE5 (80+白金/ATX3.1/PCIe 5.1/雙原生12V-2x6連接埠，12V-2x6 雙色線材/全模組)');

    expect(antec.category).toBe(ProductCategory.PSU);
    expect(antec.subcategory).toBe('ATX 電源 > 750W~1000W > 80+ 金牌 > 全模組');
    expect(msi.category).toBe(ProductCategory.PSU);
  });

  it('硬體的隨附軟體字樣不可被歸進「作業系統 / 軟體」', () => {
    expect(cat('羅技 C922 Pro Stream /動態1080P 30FPS/軟體最高1500萬畫素/附腳架/自動對焦').category).not.toBe(ProductCategory.OS);
    expect(cat('Toshiba 2TB(綠) Canvio Advance V10 (Type-A / 3年保)*加密.備份軟體').category).not.toBe(ProductCategory.OS);
    expect(cat('PCM 科風 WAR-1000AP 在線互動式不斷電系統 (1000VA/支援監控軟體/AVR自動穩壓)').category).not.toBe(ProductCategory.OS);
    // 「監控惡意軟體」是防毒軟體的功能描述，不可被誤擋
    expect(cat('卡巴斯基 標準版/隱私防護/監控惡意軟體 1台1年/無附光碟').category).toBe(ProductCategory.OS);
  });

  it('已移除的舊分類（optical_drive / software）會被強制重判而非直接刪除', () => {
    const legacy = makeProduct('Microsoft Office 2024 家用版 中文盒裝', 'software' as ProductCategory);

    expect(categorizeProduct(legacy).category).toBe(ProductCategory.OS);
  });
});

describe('第十八輪：側欄分類精度與節點收斂', () => {
  it('GPU 來源混入的系統風扇與電源要重判到正確分類', () => {
    const reverseFan = 'MONTECH 君主 RX120 PRO 黑色 反向扇葉 ARGB 1600轉 來福軸承靜音風扇';
    const pwmFan = 'Scythe Grand Tornado 120 龍風丸 3000/LCP塑料/PWM/SPFDB2軸承(GT1225FD30-P)';
    const psu = '曜越 Toughpower GT 850W (80+金牌/ATX3.1/PCIe 5.1/全模組/十年保固)';

    expect(categorizeProduct(makeProduct(reverseFan, ProductCategory.GPU)).category).toBe(ProductCategory.FAN);
    expect(categorizeProduct(makeProduct(pwmFan, ProductCategory.GPU)).category).toBe(ProductCategory.FAN);
    expect(categorizeProduct(makeProduct(psu, ProductCategory.GPU)).category).toBe(ProductCategory.PSU);
  });

  it('主機板來源的機內延長線歸 CABLE，PCIe USB 擴充卡落 OTHER', () => {
    const extension = 'JONSBO 喬思伯 DY2 雙面發光線 主機板 24PIN ARGB延長線';
    const addInCard = '銀欣 ECU02-E【PCI-E 4X】主板20Pin Type-C / USB10G (ASM 3142)';

    const cable = categorizeProduct(makeProduct(extension, ProductCategory.MOTHERBOARD));
    expect(cable.category).toBe(ProductCategory.CABLE);
    expect(cable.subcategory).toBe('機內排線 / 延長線 > 24Pin 電源延長');
    expect(categorizeProduct(makeProduct(addInCard, ProductCategory.MOTHERBOARD)).category).toBe(ProductCategory.OTHER);
  });

  it('螢幕來源的掛燈、支架、小型機殼 LCD 不可污染螢幕側欄', () => {
    const light = 'BenQ ScreenBar Halo2 螢幕智能掛燈(無線旋鈕版)';
    const arm = 'BenQ ERGO ARM BSH01 黑色 (單螢幕/穿夾兩用/承載20KG)';
    const lcd = 'LIAN LI 聯力 8.8吋 IPS LCD 萬用螢幕《黑》(US88v1)';

    for (const raw of [light, arm, lcd]) {
      expect(categorizeProduct(makeProduct(raw, ProductCategory.MONITOR)).category).toBe(ProductCategory.OTHER);
    }
  });

  it('無明寫吋數的螢幕型號仍能抽出尺寸，VGA 公對公線則歸 CABLE', () => {
    const monitor = categorizeProduct(makeProduct('MSI MAG 272F〈1H1P/IPS/200Hz〉', ProductCategory.MONITOR));
    const cable = categorizeProduct(makeProduct('廣鐸ktnet VGA公對公 螢幕專用線-1.5M/Y15F15F1.5BLCU', ProductCategory.MONITOR));

    expect(monitor.subcategory).toBe('27吋 > MSI');
    expect(monitor.specs.panel).toBe('IPS');
    expect(monitor.specs.refreshTier).toBe('170–240Hz');
    expect(cable.category).toBe(ProductCategory.CABLE);
    expect(cable.subcategory).toBe('影音線 > VGA');
  });

  it('滑鼠＝用途 > 有線/無線 > 品牌', () => {
    const wireless = categorizeProduct(makeProduct('羅技 G304 Lightspeed 無線電競滑鼠 (藍色/無線)', ProductCategory.MOUSE));
    expect(wireless.subcategory).toBe('電競滑鼠 > 無線 > Logitech');
    const wired = categorizeProduct(makeProduct('雷蛇Razer Cobra響尾蛇 光學滑鼠 /有線/3代按鍵/6組可編程/Chroma RGB/8500 DPI', ProductCategory.MOUSE));
    expect(wired.subcategory).toBe('電競滑鼠 > 有線 > Razer');
    const office = categorizeProduct(makeProduct('Logitech 羅技 M171 無線滑鼠《紅》', ProductCategory.MOUSE));
    expect(office.subcategory).toBe('一般滑鼠 > 無線 > Logitech');
    const vertical = categorizeProduct(makeProduct('羅技 Lift 人體工學垂直滑鼠(玫瑰粉)/無線-藍牙', ProductCategory.MOUSE));
    expect(vertical.subcategory).toBe('垂直滑鼠 > 無線 > Logitech');
  });

  it('空冷高度正規化為裝機有意義的區間，不產生 15.xmm 碎片節點', () => {
    const compact = categorizeProduct(makeProduct('ID-COOLING IS-55 下吹式散熱器 高55mm 無光', ProductCategory.COOLER));
    const standard = categorizeProduct(makeProduct('JONSBO CR1000 V2 Pro ARGB 單塔 CPU散熱器(高15.7)', ProductCategory.COOLER));
    const tall = categorizeProduct(makeProduct('Noctua NH-D15 雙塔散熱器 高165mm', ProductCategory.COOLER));

    expect(compact.subcategory).toBe('下吹式空冷 > 100mm 以下（低矮型） > 無光');
    expect(standard.subcategory).toBe('單塔空冷 > 151–160mm > ARGB');
    expect(tall.subcategory).toBe('雙塔空冷 > 161mm 以上 > 無光');
  });

  it('舊顯卡與工作站/舊主機板要有穩定的系列與腳位路徑', () => {
    const n730 = categorizeProduct(makeProduct('MSI 微星 N730-2GD3V3 DDR3 2G 顯示卡', ProductCategory.GPU));
    const r7240 = categorizeProduct(makeProduct('撼訊 AXR7 240 2GBD5-HLEV2 顯示卡', ProductCategory.GPU));
    const w880 = categorizeProduct(makeProduct('華碩 PRO WS W880-ACE SE(ATX/雙Intel 2.5Gb)', ProductCategory.MOTHERBOARD));
    const wrx80 = categorizeProduct(makeProduct('華碩 PRO WS WRX80E-SAGE SE WIFI II(EEB/8DIMM)', ProductCategory.MOTHERBOARD));
    const h310 = categorizeProduct(makeProduct('華碩 PRIME H310M-K LGA1151主機板', ProductCategory.MOTHERBOARD));

    expect(n730.subcategory).toBe('NVIDIA GT 700系列 > GT 730 > 2G > MSI');
    expect(r7240.subcategory).toBe('AMD Radeon R7 系列 > Radeon R7 240 > PowerColor');
    expect(w880.subcategory).toBe('Intel LGA1851 > W880 > ASUS');
    expect(wrx80.subcategory).toBe('AMD sWRX8 > WRX80 > ASUS');
    expect(h310.subcategory).toBe('Intel LGA1151 > H310 > ASUS');
  });

  it('機殼品牌別名落在板型之下，不再落入未分類平列', () => {
    const apex = categorizeProduct(makeProduct('Apexgaming 艾湃 ZENITH TA100 玻璃透側 ATX機殼', ProductCategory.CASE));
    const mavoly = categorizeProduct(makeProduct('Mavoly 松聖 甘蔗 ATX電腦機殼', ProductCategory.CASE));
    const enermax = categorizeProduct(makeProduct('保銳 ENERPAZO EP237 白 玻璃側板 ATX機殼', ProductCategory.CASE));

    expect(apex.subcategory).toBe('ATX > Apexgaming');
    expect(mavoly.subcategory).toBe('ATX > Mavoly');
    expect(enermax.subcategory).toBe('ATX > Enermax');
  });

  it('通路常見的數字開頭螢幕型號能抽出尺寸', () => {
    const aopen = categorizeProduct(makeProduct('AOPEN 22SA2Q H〈1A1H/VA/100Hz〉', ProductCategory.MONITOR));
    const terra = categorizeProduct(makeProduct('terra 2441W〈1A1H/IPS/含喇叭/144Hz〉', ProductCategory.MONITOR));

    expect(aopen.subcategory).toBe('22吋 > AOPEN');
    expect(aopen.specs.panel).toBe('VA');
    expect(aopen.specs.refreshTier).toBe('100Hz 以下');
    expect(terra.subcategory).toBe('24吋');
    expect(terra.specs.panel).toBe('IPS');
    expect(terra.specs.refreshTier).toBe('120–165Hz');
  });

  it('螢幕樹＝尺寸(超寬語意) > 品牌；面板／Hz 進 specs 不當 path', () => {
    const gaming = categorizeProduct(makeProduct(
      'ASUS ROG Strix XG27UQDMS 27吋 4K 240Hz 電競螢幕 QD-OLED',
      ProductCategory.MONITOR,
    ));
    expect(gaming.subcategory).toBe('27吋 > ASUS');
    expect(gaming.specs.panel).toBe('QD-OLED');
    expect(gaming.specs.refreshTier).toBe('170–240Hz');
    expect(gaming.subcategory).not.toMatch(/IPS|OLED|Hz|未標|4K|2K|解析度/);

    const ultra = categorizeProduct(makeProduct(
      '【34型】MSI MPG 341CQR QD-OLED X36 電競螢幕 (DP/HDMI/QD-OLED/曲面/3440X1440 (UWQHD)/21:9/0.03ms/360Hz)',
      ProductCategory.MONITOR,
    ));
    expect(ultra.subcategory).toBe('34吋超寬 > MSI');
    expect(ultra.specs.panel).toBe('QD-OLED');
    expect(ultra.specs.refreshTier).toBe('240Hz 以上');

    const portable = categorizeProduct(makeProduct(
      'ACER 宏碁 PG161Q P 16型 IPS 可攜式螢幕',
      ProductCategory.MONITOR,
    ));
    expect(portable.subcategory).toBe('可攜 / 小尺寸 > 16吋 > Acer');
    expect(portable.specs.panel).toBe('IPS');

    const large = categorizeProduct(makeProduct(
      '三星 Odyssey Neo G9 57型 Mini LED 4K 240Hz 曲面電競螢幕',
      ProductCategory.MONITOR,
    ));
    expect(large.subcategory).toBe('57吋帶魚 > Samsung');
    expect(large.specs.panel).toBe('Mini-LED');
    expect(large.specs.refreshTier).toBe('170–240Hz');

    const superUw = categorizeProduct(makeProduct(
      '【49型】MSI MPG 491CQP QD-OLED 電競螢幕 (DP/HDMI/QD-OLED/曲面/2.5K/0.03ms/144Hz)',
      ProductCategory.MONITOR,
    ));
    expect(superUw.subcategory).toBe('49吋帶魚 > MSI');
    expect(superUw.specs.panel).toBe('QD-OLED');
    expect(superUw.specs.refreshTier).toBe('120–165Hz');
  });

  it('其他尺寸：先展開吋數再品牌，缺吋走未標吋數（品牌不與 28吋 同層）', () => {
    const inch28 = categorizeProduct(makeProduct(
      'BenQ MOBIUZ EX2710Q 28吋 IPS 電競螢幕 170Hz',
      ProductCategory.MONITOR,
    ));
    // 28 非主流 L1，應進其他尺寸 > 28吋 > 品牌
    expect(inch28.subcategory).toBe('其他尺寸 > 28吋 > BenQ');

    const noInch = categorizeProduct(makeProduct(
      '神秘品牌 電競螢幕 QD-OLED 240Hz HDR 無型號',
      ProductCategory.MONITOR,
    ));
    expect(noInch.subcategory).toMatch(/^其他尺寸 > 未標吋數/);
    // 嚴禁：其他尺寸 > 品牌（會與 28吋/40吋 混同層）
    expect(noInch.subcategory).not.toMatch(/^其他尺寸 > (Acer|AOC|ASUS|MSI|BenQ|DELL|GIGABYTE)$/);
  });

  it('解析度寫入 specs 供篩選，不進 subcategory path', () => {
    const uhd = categorizeProduct(makeProduct(
      'ASUS ROG Strix XG27UQDMS 27吋 4K 240Hz 電競螢幕 QD-OLED',
      ProductCategory.MONITOR,
    ));
    expect(uhd.specs.resolution).toBe('4K / UHD');
    expect(uhd.subcategory).not.toContain('4K');

    const qhd = categorizeProduct(makeProduct(
      'MSI MAG 275QF E21〈2H1P/IPS/210Hz/HDR400〉',
      ProductCategory.MONITOR,
    ));
    expect(qhd.specs.resolution).toBe('2K / QHD');

    const uw = categorizeProduct(makeProduct(
      '【34型】MSI MPG 341CQR QD-OLED 電競螢幕 (3440X1440 (UWQHD)/21:9/360Hz)',
      ProductCategory.MONITOR,
    ));
    expect(uw.specs.resolution).toBe('超寬 (UWQHD)');

    const dual = categorizeProduct(makeProduct(
      '技嘉 M27UP〈2H1P1C/IPS〉4K-160Hz/FHD-320Hz切換',
      ProductCategory.MONITOR,
    ));
    expect(dual.specs.resolution).toBe('4K / UHD');
  });

  it('面板／Hz／解析度缺資料時寫未標示，三欄必有值且無選項外孤兒', () => {
    // 辦公屏常見：有 IPS／無 Hz／無解析度
    const office = categorizeProduct(makeProduct(
      '華碩 VY229HE〈1A1H/IPS〉',
      ProductCategory.MONITOR,
    ));
    expect(office.specs.panel).toBe('IPS');
    expect(office.specs.refreshTier).toBe('未標示');
    expect(office.specs.resolution).toBe('未標示');

    // 量子點非 OLED 不應落未標
    const qd = categorizeProduct(makeProduct(
      '技嘉 M27Q2 QD〈2H1P1C/量子點/200Hz/HDR400〉',
      ProductCategory.MONITOR,
    ));
    expect(qd.specs.panel).toBe('量子點');
    expect(qd.specs.refreshTier).toBe('170–240Hz');

    // 三欄必存在
    for (const key of ['panel', 'refreshTier', 'resolution'] as const) {
      expect(office.specs[key]).toBeTruthy();
      expect(qd.specs[key]).toBeTruthy();
    }
  });

  it('未標吋數應由型號回填：M27UP / CS272 / X32 / EK271 / MA270 / PD34', () => {
    const cases: Array<[string, string]> = [
      ['技嘉 M27UP〈2H1P1C/IPS/含喇叭/HDR400/HDMI 2.1〉4K-160Hz/FHD-320Hz切換', '27吋'],
      ['Acer CS272〈3H/IPS/含喇叭/HDR10/白色〉智慧螢幕.支援Airplay', '27吋'],
      ['Acer Predator X32 X2〈2H1P/OLED/240Hz/含喇叭/HDR400/HDMI 2.1/無亮點〉', '32吋'],
      ['ACER 宏碁 X32 X2 OLED 4K電競螢幕', '32吋'],
      ['Acer EK271 P6〈1A1H/IPS/144Hz〉', '27吋'],
      ['Acer EK220Q E3〈1A1H/IPS/100Hz〉', '22吋'],
      ['Acer Predator X27U W2〈2H1P/OLED/240Hz/含喇叭/HDMI 2.1〉', '27吋'],
      ['BenQ MA270U〈2H1C/IPS/含喇叭/HDR400〉', '27吋'],
      ['BenQ MA320UP〈2H1C/IPS/含喇叭/HDR600/鏡面〉', '32吋'],
      ['BenQ PV3200U〈3H1C/IPS/含喇叭/HDR400〉', '32吋'],
      ['DELL P2426〈1H1P/IPS/100Hz/無亮點/四年保〉', '24吋'],
      ['MSI PRO MAX 271PHW E14〈1H1P1C/IPS/144Hz/含喇叭/白色〉', '27吋'],
      ['AOC AGON PD34〈2H1P1C/OLED曲面/1800R/240Hz/含喇叭/HDR400/HDMI 2.1〉', '34吋超寬'],
      ['AOC AGON PD49〈2H1P1C/OLED曲面/1800R/240Hz/含喇叭/HDR400/HDMI 2.1〉', '49吋帶魚'],
      ['技嘉 M28U〈2H1P1C/IPS/144Hz/含喇叭/HDR400/HDMI 2.1〉', '其他尺寸 > 28吋'],
      ['華碩 VS207DF〈1A/TN〉', '可攜 / 小尺寸 > 20吋'],
    ];
    for (const [raw, expectPrefix] of cases) {
      const p = categorizeProduct(makeProduct(raw, ProductCategory.MONITOR));
      expect(p.category).toBe(ProductCategory.MONITOR);
      expect(p.subcategory, raw).toMatch(new RegExp(`^${expectPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      expect(p.subcategory, raw).not.toContain('未標吋數');
    }
  });

  it('型號世代後綴 E14/E21/X24 不可蓋過主型號吋數', () => {
    const e21 = categorizeProduct(makeProduct('MSI MAG 275QF E21〈2H1P/IPS/210Hz/HDR400〉', ProductCategory.MONITOR));
    const e14 = categorizeProduct(makeProduct('MSI MAG 275UPD E14〈2H1P/IPS/含喇叭/HDMI 2.1〉4K-144Hz/FHD-288Hz切換', ProductCategory.MONITOR));
    const x24 = categorizeProduct(makeProduct('MSI MAG 275CQDF X24〈2H1P/VA曲面/1500R/240Hz〉2K-240Hz/HD-400Hz 雙模式', ProductCategory.MONITOR));
    const philips = categorizeProduct(makeProduct('PHILIPS 32E1N3100LA〈1A2H/VA/含喇叭〉', ProductCategory.MONITOR));
    const dell = categorizeProduct(makeProduct('DELL P2425H〈1A1H1P/IPS/100Hz/無亮點/四年保〉可升降旋轉', ProductCategory.MONITOR));

    expect(e21.subcategory).toMatch(/^27吋/);
    expect(e21.specs.panel).toBe('IPS');
    expect(e14.subcategory).toMatch(/^27吋/);
    expect(x24.subcategory).toMatch(/^27吋/);
    expect(x24.specs.panel).toBe('VA');
    expect(philips.subcategory).toMatch(/^32吋/);
    expect(dell.subcategory).toBe('24吋 > DELL');
    expect(dell.specs.panel).toBe('IPS');
    expect(dell.specs.refreshTier).toBe('100Hz 以下');
  });

  it('螢幕氣壓支架／穿夾臂／筆電架／筆電不是顯示器', () => {
    const raymii = 'Raymii LS5U (單螢幕/穿夾兩用/高負重氣壓/17-43吋/承載18KG) $2,539↘, $1499 ◆ ★';
    const silver = '銀欣 SST-ARM14 白色 (單螢幕 / 氣壓彈簧 / 穿夾兩用 / 最大49吋or20公斤)$2990↘, $1599 ◆ ★';
    const stand = 'Raymii R17 六段式隨身折疊鋁合金筆電架 / 通用於17吋以下筆電 / 折疊式設計 / 銀色';
    const laptop = 'HP OmniBook Ultra U7-356H/32G/1T/14吋/觸碰螢幕 流星金 14-KD0024TU';
    for (const raw of [raymii, silver, stand, laptop]) {
      expect(categorizeProduct(makeProduct(raw, ProductCategory.MONITOR)).category).not.toBe(ProductCategory.MONITOR);
    }
  });

  it('沒有螢幕關鍵字的掛燈促銷列與磁吸 LCD 配件也要移除', () => {
    const light = 'PHILIPS PAS351〈舒視光/手勢感應開關燈/AA級均勻照明/55cm超廣燈體〉';
    const promo = '↪ Raymii 滿 $1,000： 贈 D100 鋁合金旋轉支架 (市價 $349 / 限量 300 組)。';
    const lcd = 'Thermalright 利民 Trofeo Vision LCD磁吸數位螢幕《白》';

    for (const raw of [light, promo, lcd]) {
      expect(categorizeProduct(makeProduct(raw, ProductCategory.MONITOR)).category).toBe(ProductCategory.OTHER);
    }
  });

  it('Arduino Galileo/Edison 開發板不是 PC 主機板或 CPU', () => {
    const galileo = 'Intel Galileo2 內建CPU 主機板';
    const edison = 'Intel Edison Kit for Arduino 內建 CPU 主機板';

    expect(categorizeProduct(makeProduct(galileo, ProductCategory.MOTHERBOARD)).category).toBe(ProductCategory.OTHER);
    expect(categorizeProduct(makeProduct(edison, ProductCategory.MOTHERBOARD)).category).toBe(ProductCategory.OTHER);
  });

  it('機殼誤入主機板／CPU 來源要重判回 CASE', () => {
    const mbCase = categorizeProduct(makeProduct(
      'Phanteks 追風者 Evolv X2 黑 全景玻璃機殼 (ATX/Type-C/支援背插主板(限ATX)/顯卡380mm/塔散170mm)',
      ProductCategory.MOTHERBOARD,
    ));
    const cpuCase = categorizeProduct(makeProduct(
      'Montech X5 黑 顯卡長41/CPU高16.5/玻璃透側/顯卡支撐架/14cm*3前風扇/E-ATX',
      ProductCategory.CPU,
    ));
    expect(mbCase.category).toBe(ProductCategory.CASE);
    expect(cpuCase.category).toBe(ProductCategory.CASE);
    expect(mbCase.subcategory).toMatch(/ATX|E-ATX|M-ATX|未標板型/);
  });

  it('風扇控制器／HUB／接頭不是系統風扇', () => {
    const hub = categorizeProduct(makeProduct(
      '聯力 Edge USB HUB 白(EG-HUB01W) USB*4+風扇PWM*6/PCIe 8-PIN供電',
      ProductCategory.FAN,
    ));
    const ctrl = categorizeProduct(makeProduct(
      'NZXT 風扇燈光控制器 3代 /5組RGB燈光+5組PWM',
      ProductCategory.FAN,
    ));
    expect(hub.category).not.toBe(ProductCategory.FAN);
    expect(ctrl.category).not.toBe(ProductCategory.FAN);
  });

  it('網通：交換器／延伸器／網卡從其他網通回收；軌跡球踢出', () => {
    const sw = categorizeProduct(makeProduct(
      'ZyXEL合勤 XGS1250-12【12埠】1Gb*8/10Gb*3(RJ45)/10Gb*1 SFP+',
      ProductCategory.NETWORK,
    ));
    expect(sw.subcategory).toMatch(/^交換器/);

    const ext = categorizeProduct(makeProduct(
      'TP-LINK RE315 (AC1200 / Wi-Fi 5 / 訊號延伸器)',
      ProductCategory.NETWORK,
    ));
    expect(ext.subcategory).toMatch(/^Wi-Fi 延伸器/);

    const nic = categorizeProduct(makeProduct(
      'TP-LINK Archer TX35U Plus (AX1800 / Wi-Fi 6 / USB3.0)',
      ProductCategory.NETWORK,
    ));
    expect(nic.subcategory).toMatch(/^網路卡/);

    const ball = categorizeProduct(makeProduct(
      'Logitech 羅技 Ergo M575S 無線軌跡球(石墨黑)',
      ProductCategory.NETWORK,
    ));
    expect(ball.category).not.toBe(ProductCategory.NETWORK);
  });

  it('M.2 SSD 散熱片歸配件；空冷缺高度寫未標尺寸', () => {
    const m2 = categorizeProduct(makeProduct(
      '利民 M.2 2280 TYPE A B SSD 固態硬碟散熱片/鋁合金/單雙面皆適用',
      ProductCategory.COOLER,
    ));
    expect(m2.subcategory).toBe('散熱膏/配件 > M.2 散熱');

    const bare = categorizeProduct(makeProduct(
      'DeepCool AG400 單塔 CPU 散熱器 ARGB',
      ProductCategory.COOLER,
    ));
    expect(bare.subcategory).toBe('單塔空冷 > 未標尺寸 > ARGB');
  });

  it('AIO 不可落空冷：MasterLiquid／LC／Frozen／CoreLiquid；高度只信「高」', () => {
    const ml = categorizeProduct(makeProduct(
      '酷碼 MasterLiquid 360 Atmos II LCD ARGB 黑色/2.1吋液晶/一體式風扇/6年【WXZ】',
      ProductCategory.COOLER,
    ));
    expect(ml.subcategory).toBe('一體式水冷 (AIO) > 360mm > ARGB');

    const lc = categorizeProduct(makeProduct(
      '華碩 TUF GAMING LC III 360 ARGB(黑) /一體式風扇/厚:5.36cm/6年【WXZ】',
      ProductCategory.COOLER,
    ));
    expect(lc.subcategory).toBe('一體式水冷 (AIO) > 360mm > ARGB');
    // 厚:5.36cm 不可當塔高
    expect(lc.subcategory).not.toMatch(/100mm|161mm|空冷/);

    const core = categorizeProduct(makeProduct(
      '微星 MAG CoreLiquid A13 360(黑) /預裝風扇/可換式上蓋/厚:5.2(註冊3+2年)【XZ】',
      ProductCategory.COOLER,
    ));
    expect(core.subcategory).toBe('一體式水冷 (AIO) > 360mm > 無光');

    const frozen = categorizeProduct(makeProduct(
      '利民 Frozen Warframe 360 SE BLACK ARGB /2吋可轉向磁吸液晶/5年【WXZ】',
      ProductCategory.COOLER,
    ));
    expect(frozen.subcategory).toBe('一體式水冷 (AIO) > 360mm > ARGB');

    const liq = categorizeProduct(makeProduct(
      '保銳 LIQMAXFLO 360 風晶凌 /內置6cm VRM風扇/38mm加厚冷排/厚:6.5/5年【WXZ】',
      ProductCategory.COOLER,
    ));
    expect(liq.subcategory).toMatch(/^一體式水冷 \(AIO\) > 360mm/);

    const th = categorizeProduct(makeProduct(
      '喬思伯 TH-240 黑色版 /A.RGB/溫度監控/一體式無限鏡風扇/厚:5.5cm/5年【WXZ】',
      ProductCategory.COOLER,
    ));
    expect(th.subcategory).toMatch(/^一體式水冷 \(AIO\) > 240mm/);

    // 真雙塔高度：高16.8 → 161mm 以上（不是 360mm 誤判）
    const d15 = categorizeProduct(makeProduct(
      '貓頭鷹 NH-D15 /6導管/NF-A15 PWM風扇*2/雙塔/六年保/高16.8【WXZ】',
      ProductCategory.COOLER,
    ));
    expect(d15.subcategory).toBe('雙塔空冷 > 161mm 以上 > 無光');

    // 360mm 冷排字樣但已是 AIO 時不可進空冷 161
    const primeLc = categorizeProduct(makeProduct(
      '華碩 Prime LC 240 ARGB (240mm/可替換無限鏡面冷頭/預先安裝ARGB風扇/一體式風扇/六年保固)',
      ProductCategory.COOLER,
    ));
    expect(primeLc.subcategory).toBe('一體式水冷 (AIO) > 240mm > ARGB');

    // 液態金屬 → 配件
    const metal = categorizeProduct(makeProduct(
      '利民 Thermalright Silver King 液態金屬膏/1公克/導熱係數 79W/mK【避免接觸鋁製品】',
      ProductCategory.COOLER,
    ));
    expect(metal.subcategory).toBe('散熱膏/配件');

    // 純系統風扇組：一體式風扇 + RPM，不可當 AIO
    const unity = categorizeProduct(makeProduct(
      'COUGAR Unity 240 ARGB 黑(正向) 一體式風扇/側邊燈效/2500RPM/PWM/三年保',
      ProductCategory.COOLER,
    ));
    expect(unity.subcategory).not.toMatch(/一體式水冷/);

    // HydroShift／Panorama：無「水冷」字也是 AIO；360N 可抽冷排
    const hydro = categorizeProduct(makeProduct(
      '聯力 HydroShift II OLED Curved 360N(黑) 裸排/風扇選購/6.67吋電動曲面液晶/6年【XZ】',
      ProductCategory.COOLER,
    ));
    expect(hydro.subcategory).toBe('一體式水冷 (AIO) > 360mm > 無光');

    const pan = categorizeProduct(makeProduct(
      'TRYX Panorama SE 240 ARGB 黑 /6.5曲面可旋轉螢幕/Asetek泵浦/6年【WXZ】',
      ProductCategory.COOLER,
    ));
    expect(pan.subcategory).toBe('一體式水冷 (AIO) > 240mm > ARGB');

    // 高度15.6（無空白）可抽；分體水冷配件不進 AIO；筆電墊踢出
    const nx = categorizeProduct(makeProduct(
      'Montech NX400 ARGB 黑 4導管/高度15.6/FDB軸 28mm風壓扇【WXZ】',
      ProductCategory.COOLER,
    ));
    expect(nx.subcategory).toBe('單塔空冷 > 151–160mm > ARGB');

    const fluid = categorizeProduct(makeProduct(
      '曜越 T1000 透明水冷液/1000ml(CL-W245)【共7種顏色請詢問】',
      ProductCategory.COOLER,
    ));
    expect(fluid.subcategory).toBe('散熱膏/配件 > 分體水冷配件');

    const fit = categorizeProduct(makeProduct(
      '曜越 Pacific SF G1/4 公對母90度 水冷延伸管 白色',
      ProductCategory.COOLER,
    ));
    expect(fit.subcategory).toBe('散熱膏/配件 > 分體水冷配件');

    expect(categorizeProduct(makeProduct(
      '酷碼 NotePal X150 Spectrum RGB散熱墊 /含USB*3,Type-C*1/支援 17吋',
      ProductCategory.COOLER,
    )).category).not.toBe(ProductCategory.COOLER);
  });

  it('Xeon 與舊款 Intel 不落裸 Intel 節點；品牌別名海韻／利民', () => {
    const xeon = categorizeProduct(makeProduct(
      'Intel Xeon w5-2455X 12核24緒 處理器《3.2Ghz/LGA4677》',
      ProductCategory.CPU,
    ));
    expect(xeon.subcategory).toMatch(/^Intel > Xeon 工作站/);
    expect(xeon.subcategory).toContain('W5');

    const sea = categorizeProduct(makeProduct(
      '海韻 S12III-500W 銅牌/智慧溫控風扇/5年保',
      ProductCategory.PSU,
    ));
    // brand 由 normalizer.extractBrand 抽出（categorize 不覆寫 brand）
    expect(extractBrand(sea.rawName)).toBe('Seasonic');
    expect(sea.subcategory).toMatch(/600W 以下/);

    expect(extractBrand('利民 Peerless Assassin 120 SE ARGB')).toBe('Thermalright');
  });


  it('1st Player 與電鎧機殼落在板型 > 品牌', () => {
    const firstPlayer = categorizeProduct(makeProduct('1st Player SP7 黑 玻璃透側 ATX機殼', ProductCategory.CASE));
    const darkArmor = categorizeProduct(makeProduct('電鎧 DK104 A.RGB 玻璃透側 E-ATX電腦機殼', ProductCategory.CASE));

    expect(firstPlayer.subcategory).toBe('ATX > 1st Player');
    expect(darkArmor.subcategory).toBe('E-ATX > 電鎧');
  });

  it('機殼配件（支撐架／燈條套件）不可留在 CASE', () => {
    expect(categorizeProduct(makeProduct('華碩 ROG Herculx 顯示卡支撐架 /氣泡水平儀/ARGB燈效/2年(機殼需配置電源倉)', ProductCategory.CASE)).category)
      .not.toBe(ProductCategory.CASE);
    expect(categorizeProduct(makeProduct('華碩 GT502 Horizon 機殼專用 ARGB(黑) 燈效套件 /磁吸式/二年保', ProductCategory.CASE)).category)
      .not.toBe(ProductCategory.CASE);
  });

  it('機殼：USB 模組／HUB／垂直支架／AIO 不可留 CASE；工業機架與系列回填板型', () => {
    expect(categorizeProduct(makeProduct(
      '聯力 O11DE-3X 黑 擴充USB模組(O11 Dynamic EVO RGB 機殼專用), $570 ◆ ★',
      ProductCategory.CASE,
    )).category).not.toBe(ProductCategory.CASE);

    expect(categorizeProduct(makeProduct(
      'LIAN LI 聯力 USB HUB《白》(PCIe 8PIN供電)-EDGE金牌750/850或一般機殼☆590元',
      ProductCategory.CASE,
    )).category).not.toBe(ProductCategory.CASE);

    expect(categorizeProduct(makeProduct(
      'darkFlash 大飛 GCB470 垂直顯卡支架《白》(DY470機殼專用)☆1590元',
      ProductCategory.CASE,
    )).category).not.toBe(ProductCategory.CASE);

    const aio = categorizeProduct(makeProduct(
      '華碩 ROG RYUO IV SLC 360 ARGB 龍王四代 短管版 (360mm/6.67″AMOLED曲面水冷頭/預裝風扇/12cm風扇*3/六年換新保固/漏液損壞賠償)【短管設計機殼上方需支援280&360】',
      ProductCategory.CASE,
    ));
    expect(aio.category).toBe(ProductCategory.COOLER);

    const rack = categorizeProduct(makeProduct(
      '銀欣 SST-RM23-502 工業機殼 (2U雙5.25”托盤和USB 3.1 Gen 1介面的機架式工業儲存伺服器機殼)',
      ProductCategory.CASE,
    ));
    expect(rack.category).toBe(ProductCategory.CASE);
    expect(rack.subcategory).toMatch(/^機架式 \/ 工業/);

    const treeTop = categorizeProduct(makeProduct('TREETOP 樹昌 TI-U402S 4U工業機殼☆3100元', ProductCategory.CASE));
    expect(treeTop.subcategory).toMatch(/^機架式 \/ 工業/);

    // 品名無板型 token → 系列回填
    const ap201 = categorizeProduct(makeProduct('華碩 Prime AP201 黑 透側版 玻璃透側機殼', ProductCategory.CASE));
    expect(ap201.category).toBe(ProductCategory.CASE);
    expect(ap201.subcategory).toMatch(/^M-ATX/);

    const moti = categorizeProduct(makeProduct('darkFlash MOTI Mini 鏡之小島 黑 全景玻璃機殼', ProductCategory.CASE));
    expect(moti.subcategory).toMatch(/^Mini-ITX/);

    const c5 = categorizeProduct(makeProduct(
      'Antec 安鈦克【C5 Curve ARGB(B)】曲面全景玻璃透側 支援背插主機板《黑》(顯卡41/CPU高16)☆2990元',
      ProductCategory.CASE,
    ));
    expect(c5.subcategory).toMatch(/^ATX/);

    const forge = categorizeProduct(makeProduct('微星 PRO FORGE M051A 玻璃透側機殼', ProductCategory.CASE));
    expect(forge.subcategory).toMatch(/^M-ATX/);
  });

  it('機殼+電源／散熱促銷（瓦數藏型號）歸 PACKAGE', () => {
    const casePsu = categorizeProduct(makeProduct(
      '【優惠促銷】華碩 Prime AP201 黑 透側版 玻璃透側機殼 +海韻 Focus GX-850',
      ProductCategory.CASE,
    ));
    expect(casePsu.category).toBe(ProductCategory.PACKAGE);
    expect(casePsu.subcategory).toBe('零件組合 > 機殼 + 電源');
    expect(bundleReason(casePsu.rawName)).toBe('case-plus-psu');

    const caseCooler = categorizeProduct(makeProduct(
      '【優惠促銷】華碩 Prime AP303 黑 網狀版 電腦機殼+MONTECH NX400 ARGB',
      ProductCategory.CASE,
    ));
    expect(caseCooler.category).toBe(ProductCategory.PACKAGE);
    expect(caseCooler.subcategory).toBe('零件組合 > 散熱器 + 機殼');
    expect(bundleReason(caseCooler.rawName)).toBe('case-plus-cooler');

    const caseLc = categorizeProduct(makeProduct(
      '【優惠促銷】華碩 Prime AP202 ARGB 黑 全景玻璃機殼+華碩 Prime LC 360 ARGB',
      ProductCategory.CASE,
    ));
    expect(caseLc.category).toBe(ProductCategory.PACKAGE);
    expect(caseLc.subcategory).toBe('零件組合 > 散熱器 + 機殼');
  });
});
