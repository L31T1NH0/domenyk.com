import { after, NextRequest, NextResponse } from "next/server"
import { createPost, serializePost } from "@/lib/db/posts"
import { adminOnly } from "@/lib/auth"
import { asHttpsUrl, asOptionalString, asSlug, asString, asStringArray, asTrustedImageUrl } from "@/lib/validation"
import { parsePostBackground, parsePostCover, parsePostSources, parsePostStyle } from "@/lib/api/post-input"
import { sendReaderPush } from "@/lib/push"
import { descriptionFromMarkdown } from "@/lib/seo"
import { notifyIndexNow } from "@/lib/indexnow"

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  if ("locale" in body && body.locale !== "pt") {
    return NextResponse.json({ error: "Salve primeiro a versão original em português." }, { status: 400 })
  }

  const title = asString(body.title, 180)
  const content = asString(body.content, 300_000)
  const slug = asSlug(body.slug)

  if (!title || !content || !slug) {
    return NextResponse.json({ error: "title, content e slug são obrigatórios" }, { status: 400 })
  }

  try {
    const cover = parsePostCover(body.cover)
    const post = await createPost({
      title,
      seoTitle: asOptionalString(body.seoTitle, 180),
      seoDescription: asOptionalString(body.seoDescription, 500),
      content,
      slug,
      excerpt: asOptionalString(body.excerpt, 500),
      subtitle: asOptionalString(body.subtitle, 500),
      cover,
      showCoverInTimeline: Boolean(cover) && body.showCoverInTimeline !== false,
      friendImage: asTrustedImageUrl(body.friendImage),
      coAuthorUserId: asOptionalString(body.coAuthorUserId, 120) ?? null,
      audioUrl: asHttpsUrl(body.audioUrl),
      background: parsePostBackground(body.background),
      tags: asStringArray(body.tags, 20, 40),
      sources: parsePostSources(body.sources),
      style: parsePostStyle(body.style, "standard"),
      hiddenFromTimeline: body.hiddenFromTimeline === true,
      published: body.published === true,
    })

    if (post.published) {
      if (!post.hiddenFromTimeline) after(() => notifyIndexNow([`/posts/${post.slug}`]))
      after(() => sendReaderPush({
        dedupeKey: `post:published:${post._id.toString()}:pt`,
        source: "automatic",
        topic: "posts",
        contentType: "post",
        contentId: post._id.toString(),
        title: `Novo post: ${post.title}`,
        body: post.excerpt?.trim() || descriptionFromMarkdown(post.content, 180),
        url: `/posts/${post.slug}`,
      }).catch(() => undefined))
    }

    return NextResponse.json(serializePost(post, { includeUnpublishedTranslations: true }), { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message.includes("duplicate key")) {
      return NextResponse.json({ error: "Slug ou publicId já existe." }, { status: 409 })
    }
    throw err
  }
}
