import { NextRequest } from "next/server"
import { adminOnly } from "@/lib/auth"
import { uploadImageFromFormData } from "@/lib/api/image-upload"

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  return uploadImageFromFormData(await req.formData(), "notes")
}
