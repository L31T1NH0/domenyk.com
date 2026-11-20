import { createHash, timingSafeEqual } from "node:crypto"

export function isBackendRevalidationAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ") || header.length > 2048) return false
  const actual = createHash("sha256").update(header.slice(7)).digest()
  const expected = createHash("sha256").update(secret).digest()
  return timingSafeEqual(actual, expected)
}

export function backendRevalidationPaths(value: unknown): string[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).some(key => key !== "paths") || !Array.isArray(record.paths) || record.paths.length > 64) return null
  if (record.paths.some(path => typeof path !== "string" || path.length > 1024 || !path.startsWith("/") || path.startsWith("//") || /[?#\u0000-\u001f]/.test(path))) return null
  return [...new Set(record.paths as string[])]
}
