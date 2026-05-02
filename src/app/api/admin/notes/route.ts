import { NextRequest, NextResponse } from "next/server"
import { createNote, normalizeNoteContent, serializeNote } from "@/lib/db/notes"
import { requireAdmin } from "@/lib/auth"
import { asString, asStringArray } from "@/lib/validation"

export async function POST(req: NextRequest) {
  await requireAdmin()

  const body = await req.json().catch(() => null) as { content?: unknown; images?: unknown } | null
  const content = asString(body?.content, 20_000) ?? ""

  const normalizedContent = normalizeNoteContent(content)

  if (!normalizedContent) {
    return NextResponse.json({ error: "content é obrigatório" }, { status: 400 })
  }

  const images = asStringArray(body?.images, 6, 2048)
  const note = await createNote({ content: normalizedContent, images })
  return NextResponse.json(serializeNote(note), { status: 201 })
}
