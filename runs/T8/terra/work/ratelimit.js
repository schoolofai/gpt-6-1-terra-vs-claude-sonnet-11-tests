export function createLimiter({ capacity, refillPerSec, now = Date.now }) {
  if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity < 0) {
    throw new TypeError('capacity must be a non-negative finite number');
  }
  if (typeof refillPerSec !== 'number' || !Number.isFinite(refillPerSec) || refillPerSec < 0) {
    throw new TypeError('refillPerSec must be a non-negative finite number');
  }
  if (typeof now !== 'function') {
    throw new TypeError('now must be a function');
  }

  const buckets = new Map();

  return {
    take(key, cost = 1) {
      if (typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0) {
        throw new TypeError('cost must be a positive finite number');
      }

      const time = now();
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: capacity, time };
        buckets.set(key, bucket);
      } else if (time > bucket.time) {
        const elapsed = time - bucket.time;
        bucket.tokens = Math.min(capacity, bucket.tokens + (elapsed / 1000) * refillPerSec);
        bucket.time = time;
      }

      if (cost > capacity) {
        return { ok: false, remaining: Math.floor(bucket.tokens), retryAfterMs: Infinity };
      }
      if (bucket.tokens >= cost) {
        bucket.tokens -= cost;
        return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
      }
      let retryAfterMs = refillPerSec === 0
        ? Infinity
        : Math.max(1, Math.ceil(((cost - bucket.tokens) / refillPerSec) * 1000));
      // Floating-point division can put an exact millisecond just above its
      // integer boundary. Check the preceding millisecond using the same
      // refill calculation as take().
      if (Number.isSafeInteger(retryAfterMs) && retryAfterMs > 1 &&
          bucket.tokens + ((retryAfterMs - 1) / 1000) * refillPerSec >= cost) {
        retryAfterMs--;
      }
      return { ok: false, remaining: Math.floor(bucket.tokens), retryAfterMs };
    },
  };
}
