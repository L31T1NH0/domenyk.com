import { NextRequest, NextResponse } from "next/server"
import { listMedia, serializeMediaItem, deleteImage } from "@/lib/blob"
import { adminOnly } from "@/lib/auth"
import { uploadImageFromFormData } from "@/lib/api/image-upload"

export async function GET() {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const media = await listMedia()
  return NextResponse.json(media.map(serializeMediaItem))
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  return uploadImageFromFormData(await req.formData(), "media")
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as { url?: unknown } | null
  const url = typeof body?.url === "string" ? body.url : ""

  if (!url) {
    return NextResponse.json({ error: "URL da imagem obrigatória" }, { status: 400 })
  }

  const media = await listMedia()
  const item = media.find((asset) => asset.url === url)

  if (!item) {
    return NextResponse.json({ error: "Asset não encontrado na biblioteca de media" }, { status: 404 })
  }

  await deleteImage(item.url)

  return NextResponse.json({ ok: true })
}
