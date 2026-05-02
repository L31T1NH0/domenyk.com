import { NextRequest, NextResponse } from "next/server"
import { deleteNote } from "@/lib/db/notes"
import { requireAdmin } from "@/lib/auth"
import { toObjectId } from "@/lib/validation"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  if (!toObjectId(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  await deleteNote(id)
  return NextResponse.json({ ok: true })
}
