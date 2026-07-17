import "server-only"

import { revalidateTag, unstable_cache } from "next/cache"
import { countNotes, getNotes, serializeNote, type SerializedNote } from "@/lib/db/notes"
import { countPosts, getPosts, serializePostSummary, type SerializedPostSummary } from "@/lib/db/posts"
import { getTimelinePage } from "@/lib/db/timeline"

export const PUBLIC_CONTENT_CACHE_TAG = "public-content"
const PUBLIC_CONTENT_REVALIDATE_SECONDS = 60

export type PublicFeedMode = "all" | "posts" | "notes"

export type CachedHomeFeed = {
  posts: SerializedPostSummary[]
  notes: SerializedNote[]
}

export const getCachedPublicContentCounts = unstable_cache(
  async () => {
    const [totalPosts, totalNotes] = await Promise.all([
      countPosts({ excludeHiddenFromTimeline: true }),
      countNotes(),
    ])
    return { totalPosts, totalNotes }
  },
  ["public-content-counts"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS }
)

export const getCachedHomeFeed = unstable_cache(
  async (page: number, mode: PublicFeedMode, limit: number): Promise<CachedHomeFeed> => {
    if (mode === "all") {
      const entries = await getTimelinePage({ page, limit })
      return {
        posts: entries
          .filter((entry) => entry.type === "post")
          .map((entry) => serializePostSummary(entry.post)),
        notes: entries
          .filter((entry) => entry.type === "note")
          .map((entry) => serializeNote(entry.note)),
      }
    }

    if (mode === "posts") {
      const { posts } = await getPosts({
        page,
        limit,
        excludeHiddenFromTimeline: true,
      })
      return { posts: posts.map((post) => serializePostSummary(post)), notes: [] }
    }

    const { notes } = await getNotes({ page, limit })
    return { posts: [], notes: notes.map(serializeNote) }
  },
  ["home-feed"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS }
)

export const getCachedPublicPosts = unstable_cache(
  async (page: number, limit: number) => {
    const { posts, total } = await getPosts({
      page,
      limit,
      excludeHiddenFromTimeline: true,
    })
    return { posts: posts.map((post) => serializePostSummary(post)), total }
  },
  ["public-post-list"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS }
)

export const getCachedInitialNotes = unstable_cache(
  async (limit: number) => {
    const { notes, nextCursor, total } = await getNotes({ limit })
    return { notes: notes.map(serializeNote), nextCursor, total }
  },
  ["public-note-list-initial"],
  { tags: [PUBLIC_CONTENT_CACHE_TAG], revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS }
)

export function invalidatePublicContentCache() {
  revalidateTag(PUBLIC_CONTENT_CACHE_TAG, { expire: 0 })
}
