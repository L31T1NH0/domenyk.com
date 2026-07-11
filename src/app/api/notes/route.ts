import { NextRequest, NextResponse } from "next/server"
import { getNotes, serializeNote } from "@/lib/db/notes"
import { adminOnly } from "@/lib/auth"
import { toObjectId } from "@/lib/validation"
import { createSerializedNoteFromBody } from "@/lib/api/note-input"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"

export async function GET(req: NextRequest) {
  if (!(await rateLimit(`notes-read:${requestIdentity(req)}`, { limit: 120, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })
  }
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
  try {
    const note = await createSerializedNoteFromBody(body)
    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    if (!(err instanceof Error) || err.message !== "content é obrigatório") throw err
    return NextResponse.json({ error: "content é obrigatório" }, { status: 400 })
  }
}
