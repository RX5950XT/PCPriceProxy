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
      'Threadripper',
      'Ryzen 9000 (Zen5)',
      'Ryzen 3000 (Zen2)',
    ])).toEqual([
      'Ryzen 9000 (Zen5)',
      'Ryzen 8000 (Zen4)',
      'Ryzen 7000 (Zen4)',
      'Ryzen 5000 (Zen3)',
      'Ryzen 3000 (Zen2)',
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
});
