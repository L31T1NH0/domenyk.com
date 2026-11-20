import { adminOnly } from "@/lib/auth"
import { linkActionError, requestLinksAction } from "@/lib/links-api"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly(); if (denied) return denied
  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) return Response.json({ error: "Link inválido." }, { status: 400 })
  try { return Response.json(await requestLinksAction(`/v1/admin/links/${id}/check`, "POST", {})) }
  catch (error) { return linkActionError(error) }
}
