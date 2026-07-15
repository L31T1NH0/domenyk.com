import type { Post, PostSource, PostStyle } from "@/lib/db/posts"
import { asHttpsUrl, asOptionalString, asSlug, asString, asStringArray, asTrustedImageUrl } from "@/lib/validation"

const POST_STYLES: PostStyle[] = ["standard", "editorial", "opinion"]

export function parsePostSources(value: unknown): PostSource[] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 40).flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const source = item as { label?: unknown; url?: unknown }
    const url = asHttpsUrl(source.url)
    if (!url) return []
    return [{ url, label: asOptionalString(source.label, 180) }]
  })
}

export function parsePostStyle(value: unknown, fallback: PostStyle): PostStyle {
  return POST_STYLES.includes(value as PostStyle) ? value as PostStyle : fallback
}

export function parsePostCover(value: unknown): Post["cover"] | undefined {
  if (!value || typeof value !== "object") return undefined
  const cover = value as { url?: unknown; alt?: unknown }
  const url = asTrustedImageUrl(cover.url)
  if (!url) return undefined
  return { url, alt: asOptionalString(cover.alt, 180) }
}

export function parsePostBackground(value: unknown): Post["background"] | undefined {
  if (!value || typeof value !== "object") return undefined
  const background = value as { color?: unknown; imageUrl?: unknown }
  const color = asOptionalString(background.color, 80)
  const imageUrl = asTrustedImageUrl(background.imageUrl)
  return color || imageUrl ? { color, imageUrl } : undefined
}

export function parsePostPatch(body: Record<string, unknown>) {
  const data: Partial<Omit<Post, "_id" | "createdAt">> = {}

  if ("title" in body) {
    const title = asString(body.title, 180)
    if (!title) throw new Error("Título inválido.")
    data.title = title
  }
  if ("seoTitle" in body) data.seoTitle = asOptionalString(body.seoTitle, 180)
  if ("seoDescription" in body) data.seoDescription = asOptionalString(body.seoDescription, 500)
  if ("content" in body) {
    const content = asString(body.content, 300_000)
    if (!content) throw new Error("Conteúdo inválido.")
    data.content = content
  }
  if ("slug" in body) {
    const slug = asSlug(body.slug)
    if (!slug) throw new Error("Slug inválido.")
    data.slug = slug
  }
  if ("excerpt" in body) data.excerpt = asOptionalString(body.excerpt, 500)
  if ("subtitle" in body) data.subtitle = asOptionalString(body.subtitle, 500)
  if ("tags" in body) data.tags = asStringArray(body.tags, 20, 40)
  if ("sources" in body) data.sources = parsePostSources(body.sources)
  if ("style" in body) data.style = parsePostStyle(body.style, "standard")
  if ("hiddenFromTimeline" in body) data.hiddenFromTimeline = body.hiddenFromTimeline === true
  if ("pinned" in body) data.pinned = body.pinned === true
  if ("cover" in body) data.cover = body.cover === null ? undefined : parsePostCover(body.cover)
  if ("showCoverInTimeline" in body) data.showCoverInTimeline = body.showCoverInTimeline === true
  if ("friendImage" in body) data.friendImage = asTrustedImageUrl(body.friendImage)
  if ("coAuthorUserId" in body) data.coAuthorUserId = asOptionalString(body.coAuthorUserId, 120) ?? null
  if ("audioUrl" in body) data.audioUrl = asHttpsUrl(body.audioUrl)
  if ("background" in body) data.background = parsePostBackground(body.background)

  return data
}

export function parsePostTranslation(body: Record<string, unknown>) {
  const title = asString(body.title, 180)
  const content = asString(body.content, 300_000)
  if (!title) throw new Error("Título inválido.")
  if (!content) throw new Error("Conteúdo inválido.")

  const slug = "slug" in body ? asSlug(body.slug) : undefined
  if ("slug" in body && !slug) throw new Error("Slug inválido.")

  return {
    title,
    slug,
    seoTitle: asOptionalString(body.seoTitle, 180),
    seoDescription: asOptionalString(body.seoDescription, 500),
    content,
    excerpt: asOptionalString(body.excerpt, 500),
    subtitle: asOptionalString(body.subtitle, 500),
    coverAlt: asOptionalString(body.coverAlt, 180),
    ...("tags" in body ? { tags: asStringArray(body.tags, 20, 40) } : {}),
    ...("sources" in body ? { sources: parsePostSources(body.sources) } : {}),
  }
}
