import { createHmac, randomUUID } from "crypto";

export const ANALYTICS_SESSION_COOKIE_NAME = "da_session";
export const ANALYTICS_SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

function getSalt(): string {
  const salt = process.env.ANALYTICS_SESSION_SALT;
  if (salt && salt.trim().length > 0) {
    return salt.trim();
  }

  const fallback = process.env.NEXT_AUTH_SECRET ?? process.env.MONGODB_DB;
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }

  return "domenyk-analytics-salt";
}

export function generateSessionId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function hashSessionId(sessionId: string): string {
  return createHmac("sha256", getSalt()).update(sessionId).digest("hex");
}

export function anonymizeNetworkIdentifier(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return createHmac("sha256", `${getSalt()}::network`).update(value).digest("hex").slice(0, 32);
}
