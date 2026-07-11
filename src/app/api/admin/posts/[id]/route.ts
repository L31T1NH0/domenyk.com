import { NextRequest, NextResponse } from "next/server"
import { updatePost, deletePost, getPostById, markPostDeleting } from "@/lib/db/posts"
import { adminOnly } from "@/lib/auth"
import { toObjectId } from "@/lib/validation"
import { parsePostPatch } from "@/lib/api/post-input"
import { deleteCommentsForParent, getCommentsForParent } from "@/lib/db/comments"
import { deleteCommentImagesFromContents, queueCommentImagesForCleanup } from "@/lib/db/comment-uploads"

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
    const data = parsePostPatch(body)
    if (body.cover === null) data.showCoverInTimeline = false

    if ("published" in body) {
      const published = body.published === true
      data.published = published
      if (published && !existingPost.published) data.publishedAt = new Date()
      if (!published) data.publishedAt = undefined
    }

    if (Object.keys(data).length > 0) {
      await updatePost(id, data)
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
