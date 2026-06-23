import { NextRequest, NextResponse } from "next/server"
import { uploadImage, listMedia, serializeMediaItem, deleteImage, isAllowedImageType, sanitizeImageUpload } from "@/lib/blob"
import { adminOnly } from "@/lib/auth"

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024

export async function GET() {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const media = await listMedia()
  return NextResponse.json(media.map(serializeMediaItem))
}

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  const formData = await req.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  }

  if (!isAllowedImageType(file.type)) {
    return NextResponse.json({ error: "Arquivo inválido. Envie PNG, JPG ou WebP." }, { status: 400 })
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 4MB." }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const image = await sanitizeImageUpload(file.name, buffer, file.type).catch(() => null)
  if (!image) {
    return NextResponse.json({ error: "Imagem inválida ou corrompida." }, { status: 400 })
  }

  const url = await uploadImage(image.filename, image.data, "media", image.contentType)

  return NextResponse.json({ url }, { status: 201 })
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
