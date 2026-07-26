import { ObjectId } from "mongodb"
import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { messageThreadToMarkdown } from "@/lib/content-export"
import { siteDateKey } from "@/lib/datetime"
import { getDb } from "@/lib/db/client"
import type { MessageThread } from "@/lib/db/messages"

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : []

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhuma conversa selecionada." }, { status: 400 })
  }
  if (ids.length > 20) {
    return NextResponse.json({ error: "Selecione no máximo 20 conversas por exportação." }, { status: 400 })
  }
  if (ids.some((id) => !ObjectId.isValid(id))) {
    return NextResponse.json({ error: "Lista contém IDs inválidos." }, { status: 400 })
  }

  const threads = await (await getDb())
    .collection<MessageThread>("message_threads")
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
    .sort({ updatedAt: -1, _id: -1 })
    .toArray()

  if (threads.length === 0) {
    return NextResponse.json({ error: "Nenhuma conversa foi encontrada." }, { status: 404 })
  }

  return new NextResponse(threads.map(messageThreadToMarkdown).join("\n\n---\n\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="conversas-${siteDateKey()}.md"`,
    },
  })
}
