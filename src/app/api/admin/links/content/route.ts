import { adminOnly } from "@/lib/auth"
import { linkActionError, getLinkContents, requestLinksAction } from "@/lib/links-api"

export async function GET(request: Request) {
  const denied = await adminOnly(); if (denied) return denied
  const search = new URL(request.url).searchParams.get("q") ?? ""
  if (search.length > 100) return Response.json({ error: "Use até 100 caracteres na busca." }, { status: 400 })
  try {
    const data = await requestLinksAction<{ items: unknown[] }>(`/v1/admin/links/content?${search ? `q=${encodeURIComponent(search)}&` : ""}limit=50`)
    if (!Array.isArray(data.items) || data.items.length > 50) throw new Error("Resposta inválida")
    return Response.json({ items: await getLinkContents(data.items) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return linkActionError(error) }
}
