/**
 * TTL Cache Utility - DocFusion
 *
 * A Map-like cache with time-to-live expiration and maximum size enforcement.
 * Prevents unbounded memory growth from module-level caches.
 *
 * API mirrors Map's get/set/has/delete for drop-in replacement of bare Maps
 * used as caches. Expired entries are lazily evicted on read and eagerly
 * evicted when the cache reaches capacity on write.
 */

export class TTLCache<K, V> {
	private cache = new Map<K, { value: V; expiry: number }>();
	private readonly ttlMs: number;
	private readonly maxSize: number;

	constructor(ttlMs: number, maxSize: number = 1000) {
		this.ttlMs = ttlMs;
		this.maxSize = maxSize;
	}

	get(key: K): V | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;
		if (Date.now() > entry.expiry) {
			this.cache.delete(key);
			return undefined;
		}
		return entry.value;
	}

	set(key: K, value: V): void {
		// Evict expired entries first when at capacity
		if (this.cache.size >= this.maxSize) {
			this.evictExpired();
		}
		// If still at capacity, evict oldest (insertion-order first key)
		if (this.cache.size >= this.maxSize) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey !== undefined) {
				this.cache.delete(oldestKey);
			}
		}
		this.cache.set(key, { value, expiry: Date.now() + this.ttlMs });
	}

	has(key: K): boolean {
		return this.get(key) !== undefined;
	}

	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		this.evictExpired();
		return this.cache.size;
	}

	private evictExpired(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache) {
			if (now > entry.expiry) {
				this.cache.delete(key);
			}
		}
	}
}
