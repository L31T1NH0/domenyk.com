import { NextRequest, NextResponse } from "next/server"
import { uploadImage } from "@/lib/blob"
import { isAdmin } from "@/lib/auth"

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Arquivo inválido. Envie uma imagem." }, { status: 400 })
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 10MB." }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const url = await uploadImage(file.name, buffer, "notes")

  return NextResponse.json({ url }, { status: 201 })
}
