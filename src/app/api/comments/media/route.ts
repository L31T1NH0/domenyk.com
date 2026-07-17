import { after, NextRequest, NextResponse } from "next/server"
import { getAuthUserId, isAdmin } from "@/lib/auth"
import { uploadImageFromRequest } from "@/lib/api/image-upload"
import { rateLimit } from "@/lib/rate-limit"
import { cleanupExpiredCommentUploads, recordCommentUpload } from "@/lib/db/comment-uploads"

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Apenas o administrador pode enviar imagens nos comentários." },
      { status: 403 }
    )
  }
  if (!(await rateLimit(`comment-media:${userId}`, { limit: 8, windowMs: 60_000 }))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 })
  }
  if (!(await rateLimit(`comment-media-daily:${userId}`, { limit: 50, windowMs: 24 * 60 * 60_000 }))) {
    return NextResponse.json({ error: "Limite diário de imagens atingido." }, { status: 429 })
  }

  const response = await uploadImageFromRequest(
    req,
    "comments",
    (url) => recordCommentUpload(url, userId)
  )

  if (response.ok) {
    after(() => cleanupExpiredCommentUploads({ maxDurationMs: 750, concurrency: 1 })
      .catch(() => undefined))
  }

  return response
}
