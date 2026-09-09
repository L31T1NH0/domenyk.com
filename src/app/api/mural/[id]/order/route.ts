import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { getPersonalUpdates, movePersonalUpdate } from "@/lib/db/personal-timeline"
import { personalUpdateOrderDirection } from "@/lib/personal-timeline"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Context) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ error: "Publicação inválida." }, { status: 400 })
  const direction = personalUpdateOrderDirection(await req.json().catch(() => null))
  if (!direction) return NextResponse.json({ error: "Direção inválida." }, { status: 400 })

  const result = await movePersonalUpdate(id, direction)
  if (result === "not-found") return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 })
  return NextResponse.json(await getPersonalUpdates(), { headers: { "Cache-Control": "no-store" } })
}
