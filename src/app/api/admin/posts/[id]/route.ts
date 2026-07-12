import { NextRequest, NextResponse } from "next/server"
import {
  deletePost,
  getOriginalContentUpdatedAt,
  getPostById,
  markPostDeleting,
  serializePostTranslation,
  updatePost,
  updatePostTranslation,
} from "@/lib/db/posts"
import { adminOnly } from "@/lib/auth"
import { toObjectId } from "@/lib/validation"
import { parsePostPatch, parsePostTranslation } from "@/lib/api/post-input"
import { deleteCommentsForParent, getCommentsForParent } from "@/lib/db/comments"
import { deleteCommentImagesFromContents, queueCommentImagesForCleanup } from "@/lib/db/comment-uploads"
import { isTranslationLocale } from "@/lib/post-locales"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  const existingPost = await getPostById(id)
  if (!existingPost) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 })

  try {
    if (typeof body.locale === "string" && body.locale !== "pt") {
      if (!isTranslationLocale(body.locale)) {
        return NextResponse.json({ error: "Idioma inválido" }, { status: 400 })
      }

      const parsed = parsePostTranslation(body)
      const existingTranslation = existingPost.translations?.[body.locale]
      const translation = await updatePostTranslation(
        id,
        body.locale,
        {
          ...parsed,
          published: "published" in body ? body.published === true : undefined,
        },
        getOriginalContentUpdatedAt(existingPost),
        existingTranslation
      )

      return NextResponse.json({
        ok: true,
        locale: body.locale,
        translation: serializePostTranslation(translation),
      })
    }

    const data = parsePostPatch(body)
    if (body.cover === null) data.showCoverInTimeline = false

    const originalChanged = (["title", "content", "excerpt", "subtitle"] as const).some((field) => (
      field in data && data[field] !== existingPost[field]
    )) || (
      "cover" in data && data.cover?.alt !== existingPost.cover?.alt
    ) || (
      "tags" in data && JSON.stringify(data.tags) !== JSON.stringify(existingPost.tags)
    )
    if (originalChanged) data.originalContentUpdatedAt = new Date()

    if ("published" in body) {
      const published = body.published === true
      data.published = published
      if (published && !existingPost.published) data.publishedAt = new Date()
      if (!published) data.publishedAt = undefined
    }

    if (Object.keys(data).length > 0) {
      await updatePost(id, data)
    }

    return NextResponse.json({
      ok: true,
      locale: "pt",
      published: data.published ?? existingPost.published,
      publishedAt: data.publishedAt?.toISOString() ?? (
        data.published === false ? undefined : existingPost.publishedAt?.toISOString()
      ),
      originalContentUpdatedAt: (
        data.originalContentUpdatedAt ?? getOriginalContentUpdatedAt(existingPost)
      ).toISOString(),
    })
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
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const marked = await markPostDeleting(id)
  if (!marked) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 })
  const comments = await getCommentsForParent(id)
  const contents = comments.map((comment) => comment.content)
  await queueCommentImagesForCleanup(contents)
  await deleteCommentsForParent(id)
  await deletePost(id)
  await deleteCommentImagesFromContents(contents)
  return NextResponse.json({ ok: true })
}
