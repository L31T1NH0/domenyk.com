import { NextRequest, NextResponse } from "next/server"
import { getNotes, serializeNote } from "@/lib/db/notes"
import { adminOnly } from "@/lib/auth"
import { toObjectId } from "@/lib/validation"
import { createSerializedNoteFromBody, NoteInputError, type NoteInputBody } from "@/lib/api/note-input"
import { NoteThreadError } from "@/lib/db/notes"
import { rateLimit } from "@/lib/rate-limit"
import { requestIdentity } from "@/lib/request-identity"
import { getCachedInitialNotes, invalidatePublicContentCache } from "@/lib/public-content-cache"

const PUBLIC_CACHE_HEADERS = { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" }

export async function GET(req: NextRequest) {
  if (!(await rateLimit(`notes-read:${requestIdentity(req)}`, { limit: 120, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })
  }
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined
  if (cursor && !toObjectId(cursor)) {
    return NextResponse.json({ error: "Cursor inválido" }, { status: 400 })
  }

  if (!cursor) {
    return NextResponse.json(await getCachedInitialNotes(20), { headers: PUBLIC_CACHE_HEADERS })
  }

  const { notes, nextCursor, total } = await getNotes({ cursor })
  return NextResponse.json({ notes: notes.map(serializeNote), nextCursor, total }, { headers: PUBLIC_CACHE_HEADERS })
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as NoteInputBody | null
  try {
    const note = await createSerializedNoteFromBody(body)
    invalidatePublicContentCache()
    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    if (err instanceof NoteInputError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof NoteThreadError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    throw err
  }
}
