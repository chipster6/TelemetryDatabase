export interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  cleanupInterval: number;
  enableMetrics: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  memoryUsage: number;
}

export interface CacheMetrics {
  totalGets: number;
  totalSets: number;
  totalDeletes: number;
  totalEvictions: number;
  totalExpired: number;
}

interface CacheEntry<TValue> {
  value: TValue;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export interface ICacheManager<TKey, TValue> {
  get(key: TKey): Promise<TValue | null>;
  set(key: TKey, value: TValue, ttl?: number): Promise<void>;
  delete(key: TKey): Promise<void>;
  clear(): Promise<void>;
  getStats(): CacheStats;
  getMetrics(): CacheMetrics;
}

export class AdvancedCacheManager<TKey, TValue> implements ICacheManager<TKey, TValue> {
  private cache = new Map<TKey, CacheEntry<TValue>>();
  private metrics: CacheMetrics = {
    totalGets: 0,
    totalSets: 0,
    totalDeletes: 0,
    totalEvictions: 0,
    totalExpired: 0
  };
  private stats = {
    hits: 0,
    misses: 0
  };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private config: CacheConfig) {
    this.startCleanupTimer();
  }

  async get(key: TKey): Promise<TValue | null> {
    this.metrics.totalGets++;
    
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.metrics.totalExpired++;
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    return entry.value;
  }

  async set(key: TKey, value: TValue, ttl?: number): Promise<void> {
    this.metrics.totalSets++;
    
    const expiresAt = Date.now() + (ttl || this.config.defaultTtl);
    const size = this.estimateSize(value);
    
    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxSize) {
      await this.evictLRU();
    }

    const entry: CacheEntry<TValue> = {
      value,
      expiresAt,
      createdAt: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      size
    };

    this.cache.set(key, entry);
  }

  async delete(key: TKey): Promise<void> {
    this.metrics.totalDeletes++;
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.resetStats();
  }

  private async evictLRU(): Promise<void> {
    if (this.cache.size === 0) return;

    let oldestKey: TKey | null = null;
    let oldestTime = Date.now();

    // Find least recently used entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
      this.metrics.totalEvictions++;
    }
  }

  private startCleanupTimer(): void {
    if (!this.config.cleanupInterval) return;
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: TKey[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.metrics.totalExpired++;
    });
  }

  private estimateSize(value: TValue): number {
    try {
      return JSON.stringify(value).length * 2; // Rough UTF-16 estimation
    } catch {
      return 100; // Default size for non-serializable objects
    }
  }

  private resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.metrics = {
      totalGets: 0,
      totalSets: 0,
      totalDeletes: 0,
      totalEvictions: 0,
      totalExpired: 0
    };
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    
    let memoryUsage = 0;
    for (const entry of this.cache.values()) {
      memoryUsage += entry.size;
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      size: this.cache.size,
      memoryUsage
    };
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  // Advanced cache operations
  async mget(keys: TKey[]): Promise<Map<TKey, TValue | null>> {
    const results = new Map<TKey, TValue | null>();
    
    for (const key of keys) {
      results.set(key, await this.get(key));
    }
    
    return results;
  }

  async mset(entries: Map<TKey, TValue>, ttl?: number): Promise<void> {
    for (const [key, value] of entries.entries()) {
      await this.set(key, value, ttl);
    }
  }

  async exists(key: TKey): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.metrics.totalExpired++;
      return false;
    }
    
    return true;
  }

  async expire(key: TKey, ttl: number): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    entry.expiresAt = Date.now() + ttl;
    return true;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }
}