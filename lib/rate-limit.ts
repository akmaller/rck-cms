const globalScope = globalThis as unknown as {
  __rateLimitStore?: Map<string, { count: number; expiresAt: number }>;
};

const RATE_LIMIT_STORE =
  globalScope.__rateLimitStore ?? new Map<string, { count: number; expiresAt: number }>();

if (!globalScope.__rateLimitStore) {
  globalScope.__rateLimitStore = RATE_LIMIT_STORE;
}

export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = RATE_LIMIT_STORE.get(key);

  if (!entry || entry.expiresAt < now) {
    RATE_LIMIT_STORE.set(key, { count: 1, expiresAt: now + windowMs });
    return false;
  }

  if (entry.count >= limit) {
    return true;
  }

  entry.count += 1;
  RATE_LIMIT_STORE.set(key, entry);
  return false;
}

export function resetRateLimit(key: string) {
  RATE_LIMIT_STORE.delete(key);
}
