import { createHash } from "crypto";

type RateLimitParams = {
  ip: string | null | undefined;
  userId: string | null | undefined;
  userAgent?: string | null;
};

export function deriveRateLimitIdentifier({
  ip,
  userId,
  userAgent,
}: RateLimitParams): string {
  const trimmedIp = ip?.trim();
  const trimmedUserAgent = userAgent?.trim();

  const source = trimmedIp
    ? `ip:${trimmedIp}`
    : userId
    ? `user:${userId}`
    : trimmedUserAgent
    ? `ua:${trimmedUserAgent}`
    : "anonymous";

  return createHash("sha256").update(source).digest("hex");
}
