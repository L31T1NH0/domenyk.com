import { NextRequest } from "next/server"
import { adminOnly } from "@/lib/auth"
import { uploadImageFromRequest } from "@/lib/api/image-upload"

export async function POST(req: NextRequest) {
  const unauthorized = await adminOnly()
  if (unauthorized) return unauthorized

  return uploadImageFromRequest(req, "notes")
}
