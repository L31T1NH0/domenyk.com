import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import { isIP } from "node:net";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number | null;
  resetSeconds: number | null;
};

export type RateLimitOptions = {
  identifier: string;
  windowSeconds: number;
  maxRequests: number;
  prefix?: string;
};

const fallbackStore = new Map<string, { count: number; expiresAt: number }>();
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
    console.warn("Rate limit redis disabled", error);
    redisClient = null;
  }

  return redisClient;
}

function buildKey(options: RateLimitOptions): string {
  const prefix = options.prefix ?? "api";
  const safeIdentifier = options.identifier.replace(/\s+/g, "_").slice(0, 128);
  return `${prefix}:rate:${safeIdentifier}`;
}

export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { windowSeconds, maxRequests } = options;
  if (maxRequests <= 0) {
    return { allowed: true, remaining: null, resetSeconds: null };
  }

  const redisKey = buildKey(options);
  const client = getRedisClient();

  if (client) {
    try {
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.expire(redisKey, windowSeconds);
        return { allowed: true, remaining: maxRequests - 1, resetSeconds: windowSeconds };
      }

      const ttl = await client.ttl(redisKey);
      if (typeof ttl === "number" && ttl < 0) {
        await client.expire(redisKey, windowSeconds);
      }

      if (count > maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetSeconds: typeof ttl === "number" ? Math.max(ttl, 0) : windowSeconds,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - count),
        resetSeconds: typeof ttl === "number" ? Math.max(ttl, 0) : windowSeconds,
      };
    } catch (error) {
      console.warn("Rate limit redis fallback", error);
    }
  }

  const now = Date.now();
  const entry = fallbackStore.get(redisKey);
  if (!entry || entry.expiresAt <= now) {
    fallbackStore.set(redisKey, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: maxRequests - 1, resetSeconds: windowSeconds };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.ceil((entry.expiresAt - now) / 1000),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - entry.count),
    resetSeconds: Math.ceil((entry.expiresAt - now) / 1000),
  };
}

export function getRequestIdentifier(
  req: Request,
  fallback: string = "anonymous"
): string {
  const normalizeIp = (value: string | null | undefined): string | null => {
    if (!value || typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
    return isIP(normalized) ? normalized : null;
  };

  const fromNextRequest = normalizeIp((req as Request & { ip?: string | null }).ip);
  if (fromNextRequest) {
    return fromNextRequest;
  }

  const cloudflareIp = normalizeIp(req.headers.get("cf-connecting-ip"));
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const isVercelRequest = Boolean(req.headers.get("x-vercel-id"));
  if (isVercelRequest) {
    const vercelForwarded = req.headers.get("x-vercel-forwarded-for");
    if (vercelForwarded) {
      const first = vercelForwarded.split(",")[0]?.trim();
      const normalized = normalizeIp(first);
      if (normalized) {
        return normalized;
      }
    }

    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const first = forwardedFor.split(",")[0]?.trim();
      const normalized = normalizeIp(first);
      if (normalized) {
        return normalized;
      }
    }

    const realIp = normalizeIp(req.headers.get("x-real-ip"));
    if (realIp) {
      return realIp;
    }
  }

  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 160);
  const acceptLanguage = (req.headers.get("accept-language") ?? "").slice(0, 80);
  const secChUa = (req.headers.get("sec-ch-ua") ?? "").slice(0, 80);
  const fingerprintSource = `${fallback}|${userAgent}|${acceptLanguage}|${secChUa}`;
  const fingerprint = createHash("sha256")
    .update(fingerprintSource)
    .digest("hex")
    .slice(0, 32);

  return `fp:${fingerprint}`;
}
