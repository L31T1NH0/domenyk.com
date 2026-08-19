import { after, NextRequest, NextResponse } from "next/server"
import { deleteNote, normalizeNoteContent, serializeNote, updateNote } from "@/lib/db/notes"
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

  // Delete the primary record first. Comment/image/cache cleanup is auxiliary
  // and must not prevent or misreport the note deletion.
  let result: Awaited<ReturnType<typeof deleteNote>>
  try {
    result = await deleteNote(id)
  } catch (error) {
    console.error("Failed to delete primary note record", { noteId: id, error })
    const databaseCode = typeof error === "object" && error && "code" in error
      ? String(error.code)
      : null
    return NextResponse.json(
      { error: `Falha ao excluir a nota no banco de dados${databaseCode ? ` (código ${databaseCode})` : ""}.` },
      { status: 500 }
    )
  }
  if (!result.deleted) return NextResponse.json({ ok: true, thread: [] })

  let contents: string[] = []
  try {
    const comments = await getCommentsForParent(id)
    contents = comments.map((comment) => comment.content)
  } catch (error) {
    console.error("Failed to read comments while deleting note", { noteId: id, error })
  }

  if (contents.length > 0) {
    await queueCommentImagesForCleanup(contents).catch((error) => {
      console.error("Failed to queue comment images while deleting note", { noteId: id, error })
    })
  }
  await deleteCommentsForParent(id).catch((error) => {
    console.error("Failed to delete comments while deleting note", { noteId: id, error })
  })
  if (contents.length > 0) {
    await deleteCommentImagesFromContents(contents).catch((error) => {
      console.error("Failed to delete comment images while deleting note", { noteId: id, error })
    })
  }

  try {
    invalidatePublicContentCache()
  } catch (error) {
    console.error("Failed to invalidate public cache after deleting note", { noteId: id, error })
  }
  after(() => notifyIndexNow([`/notes/${id}`]))
  let serializedThread: ReturnType<typeof serializeNote>[] = []
  try {
    serializedThread = result.thread.map(serializeNote)
  } catch (error) {
    console.error("Failed to serialize repaired note thread after deletion", { noteId: id, error })
  }
  return NextResponse.json({ ok: true, thread: serializedThread })
}
