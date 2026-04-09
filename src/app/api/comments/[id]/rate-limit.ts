import { createHash } from "crypto";
import { isIP } from "node:net";

type RateLimitParams = {
  ip: string | null | undefined;
  userId: string | null | undefined;
  userAgent?: string | null;
  acceptLanguage?: string | null;
};

function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== "string") {
    return null;
  }

  const trimmed = ip.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
  return isIP(normalized) ? normalized : null;
}

export function deriveRateLimitIdentifier({
  ip,
  userId,
  userAgent,
  acceptLanguage,
}: RateLimitParams): string {
  const normalizedIp = normalizeIp(ip);
  const trimmedUserAgent = userAgent?.trim();
  const trimmedAcceptLanguage = acceptLanguage?.trim();

  const source = userId
    ? `user:${userId}`
    : normalizedIp
    ? `ip:${normalizedIp}`
    : trimmedUserAgent || trimmedAcceptLanguage
    ? `fp:${trimmedUserAgent ?? ""}|${trimmedAcceptLanguage ?? ""}`
    : "anonymous";

  return createHash("sha256").update(source).digest("hex");
}
