export class TtlCache {
    constructor({ ttlMs = 10000, max = 500 } = {}) {
        this.ttlMs = ttlMs;
        this.max = max;
        this.map = new Map();
    }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.map.delete(key);
            return undefined;
        }
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    set(key, value, ttlMs) {
        const expiresAt = Date.now() + (ttlMs ?? this.ttlMs);
        this.map.set(key, { value, expiresAt });
        this.prune();
    }

    delete(key) {
        this.map.delete(key);
    }

    clear() {
        this.map.clear();
    }

    prune() {
        const now = Date.now();
        for (const [k, v] of this.map) {
            if (v.expiresAt <= now) this.map.delete(k);
        }

        while (this.map.size > this.max) {
            const oldestKey = this.map.keys().next().value;
            this.map.delete(oldestKey);
        }
    }

    async getOrSet(key, factory, ttlMs) {
        const cached = this.get(key);
        if (cached !== undefined) return cached;
        const value = await factory();
        this.set(key, value, ttlMs);
        return value;
    }
}

