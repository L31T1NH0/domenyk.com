import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number | null;
  resetSeconds: number | null;
};

type RateLimitOptions = {
  key: string;
  windowSeconds: number;
  maxEvents: number;
};

let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redisClient = Redis.fromEnv();
    } else {
      redisClient = null;
    }
  } catch (error) {
    console.warn("Analytics rate limit redis disabled", error);
    redisClient = null;
  }

  return redisClient;
}

const fallbackStore = new Map<string, { count: number; expiresAt: number }>();

export async function consumeAnalyticsRateLimit({
  key,
  windowSeconds,
  maxEvents,
}: RateLimitOptions): Promise<RateLimitResult> {
  if (maxEvents <= 0) {
    return { allowed: true, remaining: null, resetSeconds: null };
  }

  const client = getRedisClient();
  if (client) {
    try {
      const redisKey = `analytics:rate:${key}`;
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.expire(redisKey, windowSeconds);
        return {
          allowed: true,
          remaining: maxEvents - 1,
          resetSeconds: windowSeconds,
        };
      }

      const ttl = await client.ttl(redisKey);
      if (typeof ttl === "number" && ttl < 0) {
        await client.expire(redisKey, windowSeconds);
      }

      if (count > maxEvents) {
        return {
          allowed: false,
          remaining: 0,
          resetSeconds: typeof ttl === "number" ? Math.max(ttl, 0) : windowSeconds,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, maxEvents - count),
        resetSeconds: typeof ttl === "number" ? Math.max(ttl, 0) : windowSeconds,
      };
    } catch (error) {
      console.warn("Analytics rate limit redis fallback", error);
    }
  }

  const now = Date.now();
  const entry = fallbackStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    fallbackStore.set(key, {
      count: 1,
      expiresAt: now + windowSeconds * 1000,
    });
    return {
      allowed: true,
      remaining: maxEvents - 1,
      resetSeconds: windowSeconds,
    };
  }

  if (entry.count >= maxEvents) {
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.ceil((entry.expiresAt - now) / 1000),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxEvents - entry.count),
    resetSeconds: Math.ceil((entry.expiresAt - now) / 1000),
  };
}
