import { describe, expect, it } from 'vitest';
import { categorizeProduct, gpuMatchKey, isRealBundle } from './categorizer.js';
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

  it('任搭 CPU 活動中的主機板要歸主機板，不留在 CPU', () => {
    const rawName = '[任搭CPU活動] 華碩 PRIME B840M-A-CSM(M-ATX/註冊四年保)8+2+1相供電, $2990 ★';
    const categorized = categorizeProduct(makeProduct(rawName, ProductCategory.CPU));

    expect(categorized.category).toBe(ProductCategory.MOTHERBOARD);
    expect(categorized.subcategory).toBe('AMD AM5 > B840 > ASUS');
  });

  it('mATX 標記的任搭 CPU 主機板也要重判為主機板', () => {
    const rawName = '【任搭CPU】華碩 B650M-AYW WIFI(mATX/1H/Realtek 2.5Gb/註冊五年保)';
    const categorized = categorizeProduct(makeProduct(rawName, ProductCategory.CPU));

    expect(categorized.category).toBe(ProductCategory.MOTHERBOARD);
    expect(categorized.subcategory).toBe('AMD AM5 > B650 > ASUS');
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
    expect(categorizeProduct(makeProduct(optical, ProductCategory.OS)).category).toBe(ProductCategory.OPTICAL_DRIVE);
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

    expect(ryzen9.subcategory).toBe('AMD > Ryzen 9000 (Zen5) > Ryzen 9');
    expect(shortRyzen7.subcategory).toBe('AMD > Ryzen 5000 (Zen3) > Ryzen 7');
    expect(threadripper.subcategory).toBe('AMD > Threadripper');
    expect(oldIntel.subcategory).toBe('Intel');
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
    expect(categorizeProduct(makeProduct('圓剛 PW315 高畫質定焦網路攝影機/AI人臉追蹤', ProductCategory.NETWORK)).subcategory).toBe('網路攝影機');
    expect(categorizeProduct(makeProduct('Synology DS1823xs+【8Bay】AMD Ryzen V1780B 四核(3.35GHz)/8GB/10Gb*1', ProductCategory.NETWORK)).subcategory).toBe('NAS 網路儲存');
    expect(categorizeProduct(makeProduct('華碩 ZENWIFI BT8 兩入組 (BE14000/Wi-Fi 7/三頻/MESH/隱藏八天線/2.5Gb)', ProductCategory.NETWORK)).subcategory).toBe('無線路由器 > Mesh 網狀');
    expect(categorizeProduct(makeProduct('TP-LINK Archer TBE400E ( BE6500 / Wi-Fi 7 / 雙天線 / 藍牙5.4 / PCI-E)', ProductCategory.NETWORK)).subcategory).toBe('網路卡 / 接收器');
  });

  it('M.2 外接盒（USB10G 無容量）不可留在 SSD；USB10G 不可誤判為容量', () => {
    const enclosure = categorizeProduct(makeProduct('華碩【M.2/USB10G】ROG Strix Arion Lite / NVMe / USB-C to C【ESD-S1C Lite】', ProductCategory.SSD));
    expect(enclosure.category).not.toBe(ProductCategory.SSD);
  });

  it('HDD 監控碟獨立子分類；桌上型不再與監控混名', () => {
    const sky = categorizeProduct(makeProduct('【監控鷹AI】Seagate 10TB (ST10000VE001) 256M/7200轉/五年保固/三年資料救援', ProductCategory.HDD));
    expect(sky.subcategory).toMatch(/^監控碟 > /);
    const desktop = categorizeProduct(makeProduct('Seagate 1TB【新梭魚】(256M/7200轉/3年保) (ST1000DM014)【限組裝】', ProductCategory.HDD));
    expect(desktop.subcategory).toMatch(/^桌上型硬碟 > /);
  });

  it('加購優惠是條件價單品，不是組合', () => {
    const raw = '【加購優惠】買 ASUS NUC DDR5系列準系統 加購 美光 NB 16G D5-5600 (一台限購1)';
    const out = categorizeProduct(makeProduct(raw, ProductCategory.RAM));
    expect(out.category).toBe(ProductCategory.RAM);
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
