import { publicLinkRequest } from "@/lib/links-api"

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 })
  const body = await request.json().catch(() => null)
  if (!body || !["post", "note", "link"].includes(body.kind) || typeof body.id !== "string" || !/^[a-f\d]{24}$/i.test(body.id)) return new Response(null, { status: 400 })
  try { await publicLinkRequest("/v1/links/click", { kind: body.kind, id: body.id }); return new Response(null, { status: 204 }) }
  catch { return new Response(null, { status: 503 }) }
}
