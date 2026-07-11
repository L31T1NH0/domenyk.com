import { NextRequest, NextResponse } from "next/server"
import {
  deleteImage,
  isAllowedImageType,
  MAX_IMAGE_UPLOAD_BYTES,
  sanitizeImageUpload,
  uploadImage,
} from "@/lib/blob"

const MAX_MULTIPART_SIZE_BYTES = MAX_IMAGE_UPLOAD_BYTES + 256 * 1024

export type ImageUploadFolder = "posts" | "notes" | "comments" | "media"

async function readBoundedBody(
  req: NextRequest
): Promise<{ body: ArrayBuffer | null; tooLarge: boolean }> {
  if (!req.body) return { body: null, tooLarge: false }

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      total += value.byteLength
      if (total > MAX_MULTIPART_SIZE_BYTES) {
        await reader.cancel().catch(() => undefined)
        return { body: null, tooLarge: true }
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return { body: body.buffer, tooLarge: false }
}

export async function uploadImageFromRequest(
  req: NextRequest,
  folder: ImageUploadFolder,
  onUploaded?: (url: string) => Promise<void>
) {
  const contentType = req.headers.get("content-type") ?? ""
  if (!/^multipart\/form-data(?:;|$)/i.test(contentType)) {
    return NextResponse.json({ error: "O conteúdo deve ser multipart/form-data." }, { status: 400 })
  }

  const contentLengthHeader = req.headers.get("content-length")
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader)
  if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0)) {
    return NextResponse.json({ error: "Content-Length inválido." }, { status: 400 })
  }
  if (contentLength !== null && contentLength > MAX_MULTIPART_SIZE_BYTES) {
    return NextResponse.json({ error: "A requisição deve ter no máximo 4,25MB." }, { status: 413 })
  }

  const requestBody = await readBoundedBody(req).catch(() => null)
  if (!requestBody) {
    return NextResponse.json({ error: "Não foi possível ler o formulário." }, { status: 400 })
  }
  if (requestBody.tooLarge) {
    return NextResponse.json({ error: "A requisição deve ter no máximo 4,25MB." }, { status: 413 })
  }
  if (!requestBody.body) {
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 })
  }

  const formData = await new Response(requestBody.body, {
    headers: { "content-type": contentType },
  }).formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 })
  }

  return uploadImageFromFormData(formData, folder, onUploaded)
}

export async function uploadImageFromFormData(
  formData: FormData,
  folder: ImageUploadFolder,
  onUploaded?: (url: string) => Promise<void>
) {
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  }

  if (!isAllowedImageType(file.type)) {
    return NextResponse.json({ error: "Arquivo inválido. Envie PNG, JPG ou WebP." }, { status: 400 })
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 4MB." }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const image = await sanitizeImageUpload(file.name, buffer, file.type).catch(() => null)
  if (!image) {
    return NextResponse.json({ error: "Imagem inválida ou corrompida." }, { status: 400 })
  }

  const url = await uploadImage(image.filename, image.data, folder, image.contentType)
  if (onUploaded) {
    try {
      await onUploaded(url)
    } catch (error) {
      await deleteImage(url).catch(() => undefined)
      throw error
    }
  }
  return NextResponse.json({ url }, { status: 201 })
}
