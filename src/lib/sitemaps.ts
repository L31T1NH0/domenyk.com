import "server-only"

import { countPosts } from "@/lib/db/posts"
import { countNotes } from "@/lib/db/notes"

export const SITEMAP_PAGE_SIZE = 10_000

function chunkCount(total: number): number {
  return Math.ceil(total / SITEMAP_PAGE_SIZE)
}

export async function getSitemapDescriptors(): Promise<Array<{ id: string }>> {
  const [postCount, noteCount] = await Promise.all([countPosts(), countNotes()])
  return [
    { id: "index" },
    ...Array.from({ length: chunkCount(postCount) }, (_, index) => ({ id: `posts-${index}` })),
    ...Array.from({ length: chunkCount(noteCount) }, (_, index) => ({ id: `notes-${index}` })),
  ]
}
