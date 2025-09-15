"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleObjectCache = void 0;
/**
 * A simple object cache with a time-to-live (TTL) for each key
 */
class SimpleObjectCache {
    /**
     * @param ttl Time to live in milliseconds
     * @param logger
     */
    constructor(ttl, logger = null) {
        this.ttl = ttl;
        this.logger = logger;
        this.cache = new Map();
    }
    /**
     * Set a key-value pair in the cache
     * @param key
     * @param value
     * @returns void
     * @example cache.set('foo', 'bar');
     * @example cache.set('foo', { bar: 'baz' });
     */
    set(key, value) {
        // If a timer already exists for this key, clear it
        if (this.cache.has(key)) {
            clearTimeout(this.cache.get(key).timer);
            this.logger?.debug(`Cache key ${key} was cleared`);
        }
        // Set a new timer
        const timer = setTimeout(() => {
            this.cache.delete(key);
            this.logger?.debug(`Cache key ${key} was expired`);
        }, this.ttl);
        // Store the value and the timer in the cache
        this.cache.set(key, { value, timer });
        this.logger?.debug(`Cache key ${key} was saved`);
    }
    /**
     * Get a value from the cache
     * @param key
     * @returns The value stored in the cache
     * @example cache.get('foo');
     */
    get(key) {
        const data = this.cache.get(key);
        if (!data) {
            return null;
        }
        this.logger?.debug(`Cache key ${key} was accessed`);
        return data.value;
    }
}
exports.SimpleObjectCache = SimpleObjectCache;
