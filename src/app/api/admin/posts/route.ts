import { NextRequest, NextResponse } from "next/server"
import { createPost, publishPost } from "@/lib/db/posts"
import { adminOnly } from "@/lib/auth"
import type { PostStyle } from "@/lib/db/posts"
import { asHttpUrl, asOptionalString, asString, asStringArray } from "@/lib/validation"

const POST_STYLES: PostStyle[] = ["standard", "editorial", "opinion"]

function parseStyle(value: unknown): PostStyle {
  return POST_STYLES.includes(value as PostStyle) ? value as PostStyle : "standard"
}

function parseCover(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  const cover = value as { url?: unknown; alt?: unknown }
  const url = asHttpUrl(cover.url)
  if (!url) return undefined
  return { url, alt: asOptionalString(cover.alt, 180) }
}

function parseBackground(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  const background = value as { color?: unknown; imageUrl?: unknown }
  const color = asOptionalString(background.color, 80)
  const imageUrl = asHttpUrl(background.imageUrl)
  return color || imageUrl ? { color, imageUrl } : undefined
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 })

  const title = asString(body.title, 180)
  const content = asString(body.content, 300_000)
  const slug = asString(body.slug, 180)

  if (!title || !content || !slug) {
    return NextResponse.json({ error: "title, content e slug são obrigatórios" }, { status: 400 })
  }

  try {
    const cover = parseCover(body.cover)
    const post = await createPost({
      title,
      content,
      slug,
      excerpt: asOptionalString(body.excerpt, 500),
      cover,
      showCoverInTimeline: Boolean(cover) && body.showCoverInTimeline !== false,
      friendImage: asHttpUrl(body.friendImage),
      coAuthorUserId: asOptionalString(body.coAuthorUserId, 120) ?? null,
      audioUrl: asHttpUrl(body.audioUrl),
      background: parseBackground(body.background),
      tags: asStringArray(body.tags, 20, 40),
      style: parseStyle(body.style),
      hiddenFromTimeline: body.hiddenFromTimeline === true,
    })

    if (body.published === true) {
      await publishPost(post._id.toString(), true)
      post.published = true
      post.publishedAt = new Date()
    }

    return NextResponse.json(post, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Slug ou publicId já existe." }, { status: 409 })
    }
    throw err
  }
}
