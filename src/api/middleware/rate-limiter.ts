import type { MiddlewareHandler } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple token bucket rate limiter
 */
export function rateLimiter(
  maxRequests: number = 100,
  windowMs: number = 60_000,
): MiddlewareHandler {
  const clients = new Map<string, RateLimitEntry>();

  // Cleanup expired entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of clients) {
      if (now > entry.resetAt) clients.delete(key);
    }
  }, 60_000);

  return async (c, next) => {
    const clientIp = c.req.header('x-forwarded-for')
      ?? c.req.header('x-real-ip')
      ?? 'unknown';

    const now = Date.now();
    const entry = clients.get(clientIp);

    if (!entry || now > entry.resetAt) {
      clients.set(clientIp, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count++;
      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        c.header('Retry-After', String(retryAfter));
        c.header('X-RateLimit-Limit', String(maxRequests));
        c.header('X-RateLimit-Remaining', '0');
        return c.json(
          { success: false, data: null, error: 'Rate limit exceeded' },
          429,
        );
      }
    }

    const current = clients.get(clientIp)!;
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - current.count)));

    await next();
  };
}
