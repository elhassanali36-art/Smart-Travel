export interface RateDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

// Fixed-window in-memory limiter. PER PROCESS ONLY: with several API instances each keeps its own
// counters (use a shared store such as Redis for a real deployment). Memory is bounded by maxKeys.
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly now: () => number;
  private readonly maxKeys: number;

  constructor(now: () => number = () => Date.now(), maxKeys = 50000) {
    this.now = now;
    this.maxKeys = maxKeys;
  }

  consume(key: string, limit: number, windowMs: number): RateDecision {
    const t = this.now();
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      if (!entry) this.makeRoom(t);
      entry = { count: 0, resetAt: t + windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)),
    };
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  get size(): number {
    return this.hits.size;
  }

  private makeRoom(t: number): void {
    if (this.hits.size < this.maxKeys) return;
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
    // Still full of live entries: evict the oldest inserted keys.
    for (const k of this.hits.keys()) {
      if (this.hits.size < this.maxKeys) break;
      this.hits.delete(k);
    }
  }
}
