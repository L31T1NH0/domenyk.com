import { NextRequest, NextResponse } from "next/server"
import { updatePost, deletePost, publishPost } from "@/lib/db/posts"
import { requireAdmin } from "@/lib/auth"
import type { Post, PostStyle } from "@/lib/db/posts"
import { asHttpUrl, asOptionalString, asString, asStringArray, toObjectId } from "@/lib/validation"

type Params = { params: Promise<{ id: string }> }
const POST_STYLES: PostStyle[] = ["standard", "editorial", "opinion"]

function parseStyle(value: unknown): PostStyle | undefined {
  return POST_STYLES.includes(value as PostStyle) ? value as PostStyle : undefined
}

function parseCover(value: unknown): Post["cover"] | undefined {
  if (!value || typeof value !== "object") return undefined
  const cover = value as { url?: unknown; alt?: unknown }
  const url = asHttpUrl(cover.url)
  if (!url) return undefined
  return { url, alt: asOptionalString(cover.alt, 180) }
}

function parseBackground(value: unknown): Post["background"] | undefined {
  if (!value || typeof value !== "object") return undefined
  const background = value as { color?: unknown; imageUrl?: unknown }
  const color = asOptionalString(background.color, 80)
  const imageUrl = asHttpUrl(background.imageUrl)
  return color || imageUrl ? { color, imageUrl } : undefined
}

function parsePostPatch(body: Record<string, unknown>) {
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
  if ("style" in body) data.style = parseStyle(body.style) ?? "standard"
  if ("hiddenFromTimeline" in body) data.hiddenFromTimeline = body.hiddenFromTimeline === true
  if ("pinned" in body) data.pinned = body.pinned === true
  if ("cover" in body) data.cover = body.cover === null ? undefined : parseCover(body.cover)
  if ("showCoverInTimeline" in body) data.showCoverInTimeline = body.showCoverInTimeline === true
  if ("friendImage" in body) data.friendImage = asHttpUrl(body.friendImage)
  if ("coAuthorUserId" in body) data.coAuthorUserId = asOptionalString(body.coAuthorUserId, 120) ?? null
  if ("audioUrl" in body) data.audioUrl = asHttpUrl(body.audioUrl)
  if ("background" in body) data.background = parseBackground(body.background)

  return data
}

export async function PATCH(req: NextRequest, { params }: Params) {
  await requireAdmin()
  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 })

  try {
    const data = parsePostPatch(body)
    if (body.cover === null) data.showCoverInTimeline = false

    if (Object.keys(data).length > 0) {
      await updatePost(id, data)
    }

    if ("published" in body) {
      await publishPost(id, body.published === true)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message.includes("inválido")) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Slug ou publicId já existe." }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await requireAdmin()
  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  await deletePost(id)
  return NextResponse.json({ ok: true })
}
