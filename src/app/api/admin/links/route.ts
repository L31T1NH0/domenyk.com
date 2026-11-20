import { NextRequest, NextResponse } from "next/server"
import { adminOnly } from "@/lib/auth"
import { parseLinkInput } from "@/lib/links"
import { getLinks, requestAdminLinks } from "@/lib/links-api"
import { GoAdminError } from "@/lib/go-admin"

export async function GET() {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  try {
    return NextResponse.json(await getLinks(true), { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os links na API Go." }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized
  let input
  try { input = parseLinkInput(await req.json()) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Link inválido." }, { status: 400 })
  }
  try {
    return NextResponse.json(await requestAdminLinks("POST", undefined, input), { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof GoAdminError ? error.message : "Não foi possível salvar o link." }, { status: error instanceof GoAdminError ? error.status : 503 })
  }
}
