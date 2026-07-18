import { after, NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { linkNoteToThread, NoteThreadError, serializeNote } from "@/lib/db/notes"
import { notifyIndexNow } from "@/lib/indexnow"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"
import { asString, toObjectId } from "@/lib/validation"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const body = await req.json().catch(() => null) as { sourceNoteId?: unknown } | null
  const sourceNoteId = asString(body?.sourceNoteId, 24)
  if (!sourceNoteId || !toObjectId(sourceNoteId)) {
    return NextResponse.json({ error: "Nota de origem inválida." }, { status: 400 })
  }

  try {
    const thread = await linkNoteToThread(sourceNoteId, id)
    invalidatePublicContentCache()
    after(() => notifyIndexNow(thread.map((note) => `/notes/${note._id.toString()}`)))
    return NextResponse.json({ thread: thread.map(serializeNote) })
  } catch (error) {
    if (error instanceof NoteThreadError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
  }
}
