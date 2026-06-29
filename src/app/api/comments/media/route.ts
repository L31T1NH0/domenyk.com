import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { uploadImageFromFormData } from "@/lib/api/image-upload"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!rateLimit(`comment-media:${user.id}`, { limit: 8, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 })
  }

  return uploadImageFromFormData(await req.formData(), "notes")
}
