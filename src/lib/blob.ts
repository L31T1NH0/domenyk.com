import "server-only"

import { put, del, list } from "@vercel/blob"
import sharp from "sharp"

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_IMAGE_INPUT_PIXELS = 16_000_000
const MAX_IMAGE_INPUT_DIMENSION = 12_000
const MAX_IMAGE_OUTPUT_DIMENSION = 2_400
const IMAGE_PROCESSING_TIMEOUT_SECONDS = 8
const IMAGE_WEBP_QUALITY = 80
const IMAGE_WEBP_FALLBACK_QUALITY = 64

export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024
const MAX_SANITIZED_IMAGE_BYTES = 4 * 1024 * 1024

export function isAllowedImageType(type: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(type.toLowerCase())
}

function safeFilename(filename: string): string {
  const normalized = filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  return normalized || "image"
}

function webpFilename(filename: string): string {
  const safe = safeFilename(filename).replace(/\.[^.]+$/, "")
  return `${safe || "image"}.webp`
}

function detectImageType(data: Buffer): string | null {
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg"
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png"
  }
  if (
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

export async function sanitizeImageUpload(
  filename: string,
  data: ArrayBuffer,
  declaredType: string
): Promise<{ filename: string; data: Buffer; contentType: string }> {
  const buffer = Buffer.from(data)
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error("Invalid image")
  }

  const detectedType = detectImageType(buffer)
  const normalizedDeclaredType = declaredType.toLowerCase()

  if (!detectedType || !isAllowedImageType(detectedType) || detectedType !== normalizedDeclaredType) {
    throw new Error("Invalid image")
  }

  const image = sharp(buffer, {
    animated: false,
    failOn: "error",
    limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    sequentialRead: true,
  })
  const metadata = await image.timeout({ seconds: IMAGE_PROCESSING_TIMEOUT_SECONDS }).metadata()

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_IMAGE_INPUT_DIMENSION ||
    metadata.height > MAX_IMAGE_INPUT_DIMENSION ||
    metadata.width * metadata.height > MAX_IMAGE_INPUT_PIXELS ||
    (metadata.pages && metadata.pages > 1)
  ) {
    throw new Error("Invalid image")
  }

  const encode = (quality: number) => sharp(buffer, {
    animated: false,
    failOn: "error",
    limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    sequentialRead: true,
  })
    .rotate()
    .resize({
      width: MAX_IMAGE_OUTPUT_DIMENSION,
      height: MAX_IMAGE_OUTPUT_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
      fastShrinkOnLoad: true,
    })
    .webp({ quality, alphaQuality: quality, effort: 2, smartSubsample: true })
    .timeout({ seconds: IMAGE_PROCESSING_TIMEOUT_SECONDS })
    .toBuffer()

  let sanitized = await encode(IMAGE_WEBP_QUALITY)
  if (sanitized.length > MAX_SANITIZED_IMAGE_BYTES) {
    sanitized = await encode(IMAGE_WEBP_FALLBACK_QUALITY)
  }
  if (sanitized.length > MAX_SANITIZED_IMAGE_BYTES) {
    throw new Error("Image output is too large")
  }

  return {
    filename: webpFilename(filename),
    data: sanitized,
    contentType: "image/webp",
  }
}

export async function uploadImage(
  filename: string,
  data: ArrayBuffer | Blob | Buffer,
  folder: "posts" | "notes" | "comments" | "media",
  contentType?: string
): Promise<string> {
  const { url } = await put(`${folder}/${safeFilename(filename)}`, data, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  })
  return url
}

export async function deleteImage(url: string): Promise<void> {
  await del(url)
}

export type MediaItem = { url: string; pathname: string; size: number; uploadedAt: Date }
export type SerializedMediaItem = Omit<MediaItem, "uploadedAt"> & { uploadedAt: string }

export function serializeMediaItem(item: MediaItem): SerializedMediaItem {
  return { ...item, uploadedAt: item.uploadedAt.toISOString() }
}

export async function listMedia(): Promise<MediaItem[]> {
  const media: MediaItem[] = []
  let cursor: string | undefined

  do {
    const page = await list({ prefix: "media/", cursor, limit: 1_000 })
    media.push(...page.blobs.map((blob) => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    })))

    if (!page.hasMore) break
    if (!page.cursor || page.cursor === cursor) {
      throw new Error("Invalid cursor returned while listing media")
    }
    cursor = page.cursor
  } while (true)

  return media
}
