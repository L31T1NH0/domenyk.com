import { put, del, list } from "@vercel/blob"

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

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

export async function uploadImage(
  filename: string,
  data: ArrayBuffer | Blob,
  folder: "posts" | "notes" | "media"
): Promise<string> {
  const { url } = await put(`${folder}/${safeFilename(filename)}`, data, {
    access: "public",
    addRandomSuffix: true,
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
