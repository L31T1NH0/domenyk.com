import { after, NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { createSerializedNoteFromBody, NoteInputError, type NoteInputBody } from "@/lib/api/note-input"
import { NoteThreadError } from "@/lib/db/notes"
import { sendReaderPush } from "@/lib/push"
import { descriptionFromMarkdown, noteDisplayTitle } from "@/lib/seo"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as NoteInputBody | null
  try {
    const note = await createSerializedNoteFromBody(body)
    invalidatePublicContentCache()
    after(() => sendReaderPush({
      dedupeKey: `note:published:${note._id}`,
      source: "automatic",
      topic: "notes",
      contentType: "note",
      contentId: note._id,
      title: "Nova nota de Domenyk",
      body: note.seoDescription?.trim() || noteDisplayTitle(note) || descriptionFromMarkdown(note.content, 180),
      url: `/notes/${note._id}`,
    }).catch(() => undefined))
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
