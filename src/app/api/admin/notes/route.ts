import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { createSerializedNoteFromBody } from "@/lib/api/note-input"

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
