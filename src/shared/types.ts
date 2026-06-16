import { z } from 'zod';

export type Source = 'coolpc' | 'sinya' | 'autobuy';

export enum ProductCategory {
  CPU = 'cpu',
  MOTHERBOARD = 'motherboard',
  GPU = 'gpu',
  RAM = 'ram',
  SSD = 'ssd',
  HDD = 'hdd',
  PSU = 'psu',
  CASE = 'case',
  COOLER = 'cooler',
  MONITOR = 'monitor',
  KEYBOARD = 'keyboard',
  MOUSE = 'mouse',
  HEADSET = 'headset',
  SPEAKER = 'speaker',
  FAN = 'fan',
  OPTICAL_DRIVE = 'optical_drive',
  NETWORK = 'network',
  OS = 'os',
  SOFTWARE = 'software',
  PACKAGE = 'package',
  OTHER = 'other',
}

export interface ProductFilters {
  readonly source?: Source;
  readonly category?: string;
  readonly brand?: string;
  readonly subcategory?: string;
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly inStock?: boolean;
  readonly query?: string;
  readonly sort?: 'price_asc' | 'price_desc' | 'name' | 'updated';
  readonly page?: number;
  readonly limit?: number;
  readonly hasMultipleSources?: boolean;
}

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly originalPrice?: number;
  readonly category: ProductCategory;
  readonly subcategory?: string;
  readonly brand?: string;
  readonly model?: string;
  readonly specs: Readonly<Record<string, string>>;
  readonly inStock: boolean;
  readonly priceChange: 'up' | 'down' | 'new' | null;
  readonly source: Source;
  readonly sourceUrl: string;
  readonly rawName: string;
  readonly scrapedAt: string;
  readonly matchGroupId?: string;
}

export interface ScraperResult {
  readonly source: Source;
  readonly products: readonly Product[];
  readonly scrapedAt: string;
  readonly durationMs: number;
  readonly errors: readonly string[];
}

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T;
  readonly error?: string;
  readonly metadata?: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly cachedAt?: string;
    readonly ttl?: number;
  };
}

export interface PriceHistoryEntry {
  readonly price: number;
  readonly recordedAt: string;
}

export interface MatchGroup {
  readonly id: string;
  readonly name: string;
  readonly brand?: string;
  readonly model?: string;
  readonly products: readonly Product[];
  readonly lowestPrice: number;
  readonly highestPrice: number;
  readonly priceDiff: number;
}

export interface SourceStatus {
  readonly source: Source;
  readonly lastScrapedAt: string | null;
  readonly productCount: number;
  readonly status: 'healthy' | 'error' | 'stale';
  readonly lastError?: string;
}
