interface CacheEntry<T> {
  readonly data: T;
  readonly cachedAt: number;
  readonly ttl: number;
}

export class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtl: number;

  constructor(defaultTtlMs: number = 15 * 60 * 1000) {
    this.defaultTtl = defaultTtlMs;
  }

  get<T>(key: string): { data: T; cachedAt: string } | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.cachedAt > entry.ttl) {
      this.store.delete(key);
      return null;
    }

    return {
      data: entry.data,
      cachedAt: new Date(entry.cachedAt).toISOString(),
    };
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      cachedAt: Date.now(),
      ttl: ttlMs ?? this.defaultTtl,
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }
}
