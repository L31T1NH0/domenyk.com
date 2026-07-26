import { ObjectId } from "mongodb"
import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { noteToMarkdown } from "@/lib/content-export"
import { siteDateKey } from "@/lib/datetime"
import { getDb } from "@/lib/db/client"
import type { Note } from "@/lib/db/notes"

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : []

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhuma nota selecionada." }, { status: 400 })
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: "Selecione no máximo 100 notas por exportação." }, { status: 400 })
  }
  if (ids.some((id) => !ObjectId.isValid(id))) {
    return NextResponse.json({ error: "Lista contém IDs inválidos." }, { status: 400 })
  }

  const notes = await (await getDb())
    .collection<Note>("notes")
    .find({
      _id: { $in: ids.map((id) => new ObjectId(id)) },
      deleting: { $ne: true },
    })
    .sort({ publishedAt: -1, createdAt: -1 })
    .toArray()

  if (notes.length === 0) {
    return NextResponse.json({ error: "Nenhuma nota foi encontrada." }, { status: 404 })
  }

  return new NextResponse(notes.map(noteToMarkdown).join("\n\n---\n\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="notas-${siteDateKey()}.md"`,
    },
  })
}

