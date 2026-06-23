import { NextRequest, NextResponse } from "next/server"
import { uploadImage, isAllowedImageType, sanitizeImageUpload } from "@/lib/blob"
import { adminOnly } from "@/lib/auth"

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024

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

  const url = await uploadImage(image.filename, image.data, "notes", image.contentType)

  return NextResponse.json({ url }, { status: 201 })
}
