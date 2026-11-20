import { adminOnly } from "@/lib/auth"
import { linkActionError, requestLinksAction } from "@/lib/links-api"

export async function PUT(request: Request) {
  const denied = await adminOnly(); if (denied) return denied
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.items) || body.items.length > 1000) return Response.json({ error: "Ordem inválida." }, { status: 400 })
  try { return Response.json(await requestLinksAction("/v1/admin/links/order", "PUT", body)) }
  catch (error) { return linkActionError(error) }
}
