import { after, NextRequest, NextResponse } from "next/server"
import { deleteNote, markNoteDeleting, normalizeNoteContent, serializeNote, updateNote } from "@/lib/db/notes"
import { adminOnly } from "@/lib/auth"
import { asString, asTrustedImageUrlArray, toObjectId } from "@/lib/validation"
import { deleteCommentsForParent, getCommentsForParent } from "@/lib/db/comments"
import { deleteCommentImagesFromContents, queueCommentImagesForCleanup } from "@/lib/db/comment-uploads"
import { notifyIndexNow } from "@/lib/indexnow"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const body = await req.json().catch(() => null) as { title?: unknown; seoTitle?: unknown; seoDescription?: unknown; content?: unknown; images?: unknown } | null
  const title = body && "title" in body ? asString(body.title, 120)?.trim() || null : undefined
  const seoTitle = body && "seoTitle" in body ? asString(body.seoTitle, 120)?.trim() || null : undefined
  const seoDescription = body && "seoDescription" in body ? asString(body.seoDescription, 300)?.trim() || null : undefined
  const content = asString(body?.content, 20_000) ?? ""
  const normalizedContent = normalizeNoteContent(content)

  if (!normalizedContent) {
    return NextResponse.json({ error: "content é obrigatório" }, { status: 400 })
  }

  const images = body && "images" in body ? asTrustedImageUrlArray(body.images, 6) : undefined
  const note = await updateNote(id, { title, seoTitle, seoDescription, content: normalizedContent, images })

  if (!note) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 })

  invalidatePublicContentCache()
  after(() => notifyIndexNow([`/notes/${id}`]))

  return NextResponse.json(serializeNote(note))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const marked = await markNoteDeleting(id)
  if (!marked) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 })
  const comments = await getCommentsForParent(id)
  const contents = comments.map((comment) => comment.content)
  await queueCommentImagesForCleanup(contents)
  await deleteCommentsForParent(id)
  await deleteNote(id)
  await deleteCommentImagesFromContents(contents)
  invalidatePublicContentCache()
  after(() => notifyIndexNow([`/notes/${id}`]))
  return NextResponse.json({ ok: true })
}
