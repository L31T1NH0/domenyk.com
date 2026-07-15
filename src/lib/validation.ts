import { ObjectId } from "mongodb"

function isValidObjectId(value: string): boolean {
  return ObjectId.isValid(value)
}

export function toObjectId(value: string): ObjectId | null {
  return isValidObjectId(value) ? new ObjectId(value) : null
}

export function asString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return undefined
  return trimmed
}

export function asSlug(value: unknown, maxLength = 180): string | undefined {
  const slug = asString(value, maxLength)
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return undefined
  return slug
}

export function asOptionalString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return undefined
  return trimmed
}

export function asStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength))
}

function asHttpUrl(value: unknown, maxLength = 2048): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return undefined

  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

export function asHttpsUrl(value: unknown, maxLength = 2048): string | undefined {
  const valueUrl = asHttpUrl(value, maxLength)
  if (!valueUrl) return undefined
  return new URL(valueUrl).protocol === "https:" ? valueUrl : undefined
}

export function asTrustedImageUrl(value: unknown, maxLength = 2048): string | undefined {
  const valueUrl = asHttpsUrl(value, maxLength)
  if (!valueUrl) return undefined
  const hostname = new URL(valueUrl).hostname.toLowerCase()
  const allowed =
    hostname === "res.cloudinary.com" ||
    hostname === "images.clerk.dev" ||
    hostname === "img.clerk.com" ||
    hostname.endsWith(".public.blob.vercel-storage.com")
  return allowed ? valueUrl : undefined
}

export function asTrustedImageUrlArray(value: unknown, maxItems: number, maxLength = 2048): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asTrustedImageUrl(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems)
}
