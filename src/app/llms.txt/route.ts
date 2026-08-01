import { getIndexableNotes } from "@/lib/db/notes"
import { getPosts } from "@/lib/db/posts"
import { getThemes } from "@/lib/db/themes"
import { buildLlmsTxt } from "@/lib/llms"

export const runtime = "nodejs"

export async function GET() {
  const [{ posts }, themes, notes] = await Promise.all([
    getPosts({ page: 1, limit: 1_000, excludeHiddenFromTimeline: true }),
    getThemes({ activeOnly: true }),
    getIndexableNotes({ page: 1, limit: 1_000 }),
  ])

  return new Response(buildLlmsTxt({ posts, themes, notes }), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
