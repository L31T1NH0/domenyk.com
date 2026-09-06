import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { toObjectId } from "@/lib/validation"
import { parseWritingInput } from "@/lib/api/writing-input"
import { updateWritingEntry } from "@/lib/db/writing-progress"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const id = toObjectId((await params).id)
  if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  const body = await req.json().catch(() => null)
  let input
  try {
    input = parseWritingInput(body)
    if ("completed" in body && typeof body.completed !== "boolean") throw new Error("Estado inválido.")
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos." }, { status: 400 })
  }
  const found = await updateWritingEntry(id, { ...input, ...("completed" in body ? { completed: body.completed } : {}) })
  if (!found) return NextResponse.json({ error: "Texto não encontrado." }, { status: 404 })
  invalidatePublicContentCache()
  return NextResponse.json({ ok: true })
}
