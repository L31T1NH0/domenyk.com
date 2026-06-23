import "server-only"

import { put, del, list } from "@vercel/blob"
import sharp from "sharp"

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_IMAGE_PIXELS = 25_000_000

export const ACCEPTED_IMAGE_MIME_TYPES = Array.from(ALLOWED_IMAGE_TYPES).join(",")

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
  const detectedType = detectImageType(buffer)
  const normalizedDeclaredType = declaredType.toLowerCase()

  if (!detectedType || !isAllowedImageType(detectedType) || detectedType !== normalizedDeclaredType) {
    throw new Error("Invalid image")
  }

  const image = sharp(buffer, {
    animated: false,
    failOn: "error",
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height || (metadata.pages && metadata.pages > 1)) {
    throw new Error("Invalid image")
  }

  const sanitized = await image
    .rotate()
    .webp({ quality: 82, effort: 4 })
    .toBuffer()

  return {
    filename: webpFilename(filename),
    data: sanitized,
    contentType: "image/webp",
  }
}

export async function uploadImage(
  filename: string,
  data: ArrayBuffer | Blob | Buffer,
  folder: "posts" | "notes" | "media",
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
  const { blobs } = await list({ prefix: "media/" })
  return blobs.map((b) => ({
    url: b.url,
    pathname: b.pathname,
    size: b.size,
    uploadedAt: b.uploadedAt,
  }))
}
