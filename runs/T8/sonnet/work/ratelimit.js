export function createLimiter({ capacity, refillPerSec, now = Date.now } = {}) {
  if (!(typeof capacity === 'number' && Number.isFinite(capacity) && capacity > 0)) {
    throw new TypeError('capacity must be a positive finite number');
  }
  if (!(typeof refillPerSec === 'number' && Number.isFinite(refillPerSec) && refillPerSec >= 0)) {
    throw new TypeError('refillPerSec must be a non-negative finite number');
  }
  const EPS = 1e-9;
  const buckets = new Map();

  function take(key, cost = 1) {
    if (typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0) {
      throw new TypeError('cost must be a positive finite number');
    }
    const t = now();
    let b = buckets.get(key);
    if (!b) {
      b = { tokens: capacity, last: t };
      buckets.set(key, b);
    } else {
      const elapsed = Math.max(0, t - b.last);
      b.tokens = Math.min(capacity, b.tokens + (elapsed * refillPerSec) / 1000);
      b.last = t;
    }
    if (cost > capacity) {
      return { ok: false, remaining: Math.floor(b.tokens + EPS), retryAfterMs: Infinity };
    }
    if (b.tokens + EPS >= cost) {
      b.tokens = Math.max(0, b.tokens - cost);
      return { ok: true, remaining: Math.floor(b.tokens + EPS), retryAfterMs: 0 };
    }
    const retryAfterMs = refillPerSec === 0
      ? Infinity
      : Math.max(1, Math.ceil(((cost - b.tokens) * 1000) / refillPerSec - EPS));
    return { ok: false, remaining: Math.floor(b.tokens + EPS), retryAfterMs };
  }

  return { take };
}
