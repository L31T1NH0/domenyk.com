import { NextRequest, NextResponse } from "next/server"
import { deleteNote, normalizeNoteContent, serializeNote, updateNote } from "@/lib/db/notes"
import { requireAdmin } from "@/lib/auth"
import { asHttpUrlArray, asString, toObjectId } from "@/lib/validation"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const body = await req.json().catch(() => null) as { content?: unknown; images?: unknown } | null
  const content = asString(body?.content, 20_000) ?? ""
  const normalizedContent = normalizeNoteContent(content)

  if (!normalizedContent) {
    return NextResponse.json({ error: "content é obrigatório" }, { status: 400 })
  }

  const images = body && "images" in body ? asHttpUrlArray(body.images, 6) : undefined
  const note = await updateNote(id, { content: normalizedContent, images })

  if (!note) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 })

  return NextResponse.json(serializeNote(note))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  await deleteNote(id)
  return NextResponse.json({ ok: true })
}
