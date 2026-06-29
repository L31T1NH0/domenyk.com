import type { Post, PostStyle } from "@/lib/db/posts"
import { asHttpUrl, asOptionalString, asString, asStringArray } from "@/lib/validation"

const POST_STYLES: PostStyle[] = ["standard", "editorial", "opinion"]

export function parsePostStyle(value: unknown, fallback: PostStyle): PostStyle {
  return POST_STYLES.includes(value as PostStyle) ? value as PostStyle : fallback
}

export function parsePostCover(value: unknown): Post["cover"] | undefined {
  if (!value || typeof value !== "object") return undefined
  const cover = value as { url?: unknown; alt?: unknown }
  const url = asHttpUrl(cover.url)
  if (!url) return undefined
  return { url, alt: asOptionalString(cover.alt, 180) }
}

export function parsePostBackground(value: unknown): Post["background"] | undefined {
  if (!value || typeof value !== "object") return undefined
  const background = value as { color?: unknown; imageUrl?: unknown }
  const color = asOptionalString(background.color, 80)
  const imageUrl = asHttpUrl(background.imageUrl)
  return color || imageUrl ? { color, imageUrl } : undefined
}

export function parsePostPatch(body: Record<string, unknown>) {
  const data: Partial<Omit<Post, "_id" | "createdAt">> = {}

  if ("title" in body) {
    const title = asString(body.title, 180)
    if (!title) throw new Error("Título inválido.")
    data.title = title
  }
  if ("content" in body) {
    const content = asString(body.content, 300_000)
    if (!content) throw new Error("Conteúdo inválido.")
    data.content = content
  }
  if ("slug" in body) {
    const slug = asString(body.slug, 180)
    if (!slug) throw new Error("Slug inválido.")
    data.slug = slug
  }
  if ("excerpt" in body) data.excerpt = asOptionalString(body.excerpt, 500)
  if ("tags" in body) data.tags = asStringArray(body.tags, 20, 40)
  if ("style" in body) data.style = parsePostStyle(body.style, "standard")
  if ("hiddenFromTimeline" in body) data.hiddenFromTimeline = body.hiddenFromTimeline === true
  if ("pinned" in body) data.pinned = body.pinned === true
  if ("cover" in body) data.cover = body.cover === null ? undefined : parsePostCover(body.cover)
  if ("showCoverInTimeline" in body) data.showCoverInTimeline = body.showCoverInTimeline === true
  if ("friendImage" in body) data.friendImage = asHttpUrl(body.friendImage)
  if ("coAuthorUserId" in body) data.coAuthorUserId = asOptionalString(body.coAuthorUserId, 120) ?? null
  if ("audioUrl" in body) data.audioUrl = asHttpUrl(body.audioUrl)
  if ("background" in body) data.background = parsePostBackground(body.background)

  return data
}
