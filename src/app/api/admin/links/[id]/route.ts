import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { parseLinkInput } from "@/lib/links"
import { requestAdminLinks } from "@/lib/links-api"
import { GoAdminError } from "@/lib/go-admin"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const { id } = await params
  let input
  try { input = parseLinkInput(await req.json()) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Link inválido." }, { status: 400 })
  }
  try {
    return NextResponse.json(await requestAdminLinks("PATCH", id, input))
  } catch (error) {
    return NextResponse.json({ error: error instanceof GoAdminError ? error.message : "Não foi possível salvar o link." }, { status: error instanceof GoAdminError ? error.status : 503 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  const { id } = await params
  try {
    return NextResponse.json(await requestAdminLinks("DELETE", id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof GoAdminError ? error.message : "Não foi possível excluir o link." }, { status: error instanceof GoAdminError ? error.status : 503 })
  }
}
