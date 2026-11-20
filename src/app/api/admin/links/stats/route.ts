import { adminOnly } from "@/lib/auth"
import { linkActionError, requestLinksAction } from "@/lib/links-api"

export async function GET(request: Request) {
  const denied = await adminOnly(); if (denied) return denied
  const days = new URL(request.url).searchParams.get("days") ?? "7"
  if (!["7", "30", "90"].includes(days)) return Response.json({ error: "Período inválido." }, { status: 400 })
  try { return Response.json(await requestLinksAction(`/v1/admin/links/stats?days=${days}`), { headers: { "Cache-Control": "private, no-store" } }) }
  catch (error) { return linkActionError(error) }
}
