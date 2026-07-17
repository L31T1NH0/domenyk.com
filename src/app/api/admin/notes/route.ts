import { after, NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { createSerializedNoteFromBody } from "@/lib/api/note-input"
import { sendReaderPush } from "@/lib/push"
import { descriptionFromMarkdown, noteDisplayTitle } from "@/lib/seo"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as { title?: unknown; content?: unknown; images?: unknown } | null
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
    if (!(err instanceof Error) || err.message !== "content é obrigatório") throw err
    return NextResponse.json({ error: "content é obrigatório" }, { status: 400 })
  }
}
