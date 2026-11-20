import { adminOnly } from "@/lib/auth"
import { parseLinkPageSettings } from "@/lib/link-page"
import { linkActionError, requestLinksAction } from "@/lib/links-api"

export async function GET() {
  const denied = await adminOnly(); if (denied) return denied
  try {
    const data = await requestLinksAction<unknown>("/v1/admin/links/settings")
    return Response.json(data === null ? null : parseLinkPageSettings(data), { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return linkActionError(error) }
}
export async function PUT(request: Request) {
  const denied = await adminOnly(); if (denied) return denied
  let body
  try { body = parseLinkPageSettings(await request.json()) }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Configuração inválida." }, { status: 400 }) }
  try { return Response.json(await requestLinksAction("/v1/admin/links/settings", "PUT", body)) }
  catch (error) { return linkActionError(error) }
}
