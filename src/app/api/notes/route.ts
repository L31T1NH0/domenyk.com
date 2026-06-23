import { NextRequest, NextResponse } from "next/server"
import { createNote, getNotes, normalizeNoteContent, serializeNote } from "@/lib/db/notes"
import { adminOnly } from "@/lib/auth"
import { asHttpUrlArray, asString, toObjectId } from "@/lib/validation"

export async function GET(req: NextRequest) {
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined
  if (cursor && !toObjectId(cursor)) {
    return NextResponse.json({ error: "Cursor inválido" }, { status: 400 })
  }

  const { notes, nextCursor, total } = await getNotes({ cursor })
  return NextResponse.json({ notes: notes.map(serializeNote), nextCursor, total })
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as { content?: unknown; images?: unknown } | null
  const content = asString(body?.content, 20_000) ?? ""
  const normalizedContent = normalizeNoteContent(content)

  if (!normalizedContent) {
    return NextResponse.json({ error: "content é obrigatório" }, { status: 400 })
  }

  const images = asHttpUrlArray(body?.images, 6)

  const note = await createNote({ content: normalizedContent, images })
  return NextResponse.json(serializeNote(note), { status: 201 })
}
