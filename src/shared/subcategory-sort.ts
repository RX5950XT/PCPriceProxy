import { ProductCategory } from './types.js';

const CHIPSET_ORDER: readonly string[] = [
  'Intel Z890', 'Intel W890', 'Intel Z790', 'Intel W790', 'Intel B860', 'Intel B760', 'Intel H810', 'Intel H610', 'Intel W680', 'Intel B660',
  'AMD X870E', 'AMD X870', 'AMD WRX90', 'AMD TRX50', 'AMD B850', 'AMD B840', 'AMD X670E', 'AMD X670', 'AMD B650E', 'AMD B650', 'AMD A620', 'AMD B550', 'AMD A520',
];

const GPU_SERIES_ORDER: readonly string[] = [
  'NVIDIA RTX 50系列', 'NVIDIA RTX 40系列', 'NVIDIA RTX 30系列', 'NVIDIA GT 10系列', 'NVIDIA GT 700系列',
  'AMD RX 9000系列', 'AMD RX 8000系列', 'AMD RX 7000系列', 'AMD RX 6000系列',
  'Intel Arc 系列', 'NVIDIA 專業繪圖卡', 'AMD 專業繪圖卡',
];

const DDR_ORDER: readonly string[] = ['DDR5', 'DDR4', 'D5', 'D4'];
const DEVICE_ORDER: readonly string[] = ['桌上型 UDIMM', '桌上型', '筆電用 SO-DIMM', '筆電用'];
const SIZE_ORDER: readonly string[] = ['E-ATX', 'ATX', 'Micro-ATX', 'Mini-ITX'];

export function compareSubcategoryNode(category: string, a: string, b: string): number {
  const exact = exactRank(category, a) - exactRank(category, b);
  if (exact !== 0) return exact;

  const semantic = semanticRank(category, a) - semanticRank(category, b);
  if (semantic !== 0) return semantic;

  if (category === ProductCategory.GPU) {
    const gpu = gpuModelRank(a) - gpuModelRank(b);
    if (gpu !== 0) return gpu;
  }

  if (shouldSortByCapacity(category)) {
    const cap = capacityValue(b) - capacityValue(a);
    if (cap !== 0) return cap;
  }

  const kit = kitRank(a) - kitRank(b);
  if (kit !== 0) return kit;

  const num = largestNumber(b) - largestNumber(a);
  if (num !== 0) return num;

  return a.localeCompare(b, 'zh-TW');
}

export function sortSubcategories<T extends { subcategory: string | null }>(
  category: string,
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => compareSubcategoryNode(category, a.subcategory ?? '', b.subcategory ?? ''));
}

function exactRank(category: string, value: string): number {
  const v = value.trim();
  if (!v) return Number.MAX_SAFE_INTEGER;
  if (category === ProductCategory.CPU) {
    if (v === 'Intel') return 0;
    if (v === 'AMD') return 1;
  }
  return 1000;
}

function semanticRank(category: string, value: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  if (category === ProductCategory.CPU) return cpuRank(value);
  if (category === ProductCategory.MOTHERBOARD) return orderedRank(value, CHIPSET_ORDER);
  if (category === ProductCategory.GPU) return orderedRank(value, GPU_SERIES_ORDER);

  const ddrRank = orderedRank(value, DDR_ORDER);
  if (ddrRank !== Number.MAX_SAFE_INTEGER) return ddrRank;

  const deviceRank = orderedRank(value, DEVICE_ORDER);
  if (deviceRank !== Number.MAX_SAFE_INTEGER) return deviceRank;

  const sizeRank = orderedRank(value, SIZE_ORDER);
  if (sizeRank !== Number.MAX_SAFE_INTEGER) return sizeRank;

  return Number.MAX_SAFE_INTEGER;
}

function cpuRank(value: string): number {
  const upper = value.toUpperCase();
  if (upper.includes('CORE ULTRA 200S')) return 10;
  const intelGen = value.match(/第\s*(\d{1,2})\s*代/);
  if (intelGen) return 100 - Number(intelGen[1]);
  const ryzenGen = upper.match(/RYZEN\s*(\d{4})/);
  if (ryzenGen) return 300 - Number(ryzenGen[1]) / 100;
  if (upper.includes('THREADRIPPER')) return 400;
  if (/CORE I9|ULTRA 9|RYZEN 9/.test(upper)) return 500;
  if (/CORE I7|ULTRA 7|RYZEN 7/.test(upper)) return 510;
  if (/CORE I5|ULTRA 5|RYZEN 5/.test(upper)) return 520;
  if (/CORE I3|ULTRA 3|RYZEN 3/.test(upper)) return 530;
  return Number.MAX_SAFE_INTEGER;
}

function orderedRank(value: string, order: readonly string[]): number {
  const upper = value.toUpperCase();
  for (let i = 0; i < order.length; i++) {
    const item = order[i].toUpperCase();
    if (upper === item || upper.includes(item)) return i;
  }
  return Number.MAX_SAFE_INTEGER;
}

function capacityValue(value: string): number {
  const match = value.match(/(?:^|>\s*|\s)(\d+)\s*(TB|GB|T|G|MB)(?=\s|$|\(|>)/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  if (unit.startsWith('T')) return amount * 1024 * 1024;
  if (unit.startsWith('G')) return amount * 1024;
  return amount;
}

function shouldSortByCapacity(category: string): boolean {
  return category === ProductCategory.RAM || category === ProductCategory.SSD || category === ProductCategory.HDD;
}

function gpuModelRank(value: string): number {
  const upper = value.toUpperCase();
  const match = upper.match(/\b(RTX|GTX|GT|RX)\s*(\d{3,4})(?:\s*(TI|SUPER|XTX|XT|GRE))?/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const base = Number(match[2]);
  const suffix = match[3] ?? '';
  const suffixBonus: Record<string, number> = {
    XTX: 4,
    TI: 3,
    SUPER: 2,
    XT: 2,
    GRE: 1,
  };
  return -(base * 10 + (suffixBonus[suffix] ?? 0));
}

function kitRank(value: string): number {
  return /[*xX]\s*\d|\(\d+G[*xX]\d+\)/.test(value) ? 0 : 1;
}

function largestNumber(value: string): number {
  const matches = [...value.matchAll(/(\d+)/g)].map(match => Number(match[1]));
  return matches.length > 0 ? Math.max(...matches) : 0;
}
