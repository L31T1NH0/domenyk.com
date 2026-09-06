import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { parseWritingInput } from "@/lib/api/writing-input"
import { createWritingEntry } from "@/lib/db/writing-progress"
import { invalidatePublicContentCache } from "@/lib/public-content-cache"

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  let input
  try {
    input = parseWritingInput(await req.json().catch(() => null))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos." }, { status: 400 })
  }
  const entry = await createWritingEntry(input)
  invalidatePublicContentCache()
  return NextResponse.json(entry, { status: 201 })
}
