import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export const ANALYTICS_SESSION_COOKIE_NAME = "da_session";
export const ANALYTICS_SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

const textEncoder = new TextEncoder();

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
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function hashSessionId(sessionId: string): string {
  const saltBytes = textEncoder.encode(getSalt());
  const sessionBytes = textEncoder.encode(sessionId);
  const digest = hmac(sha256, saltBytes, sessionBytes);
  return bytesToHex(digest);
}

export function anonymizeNetworkIdentifier(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const saltBytes = textEncoder.encode(`${getSalt()}::network`);
  const valueBytes = textEncoder.encode(value);
  const digest = hmac(sha256, saltBytes, valueBytes);
  return bytesToHex(digest).slice(0, 32);
}
