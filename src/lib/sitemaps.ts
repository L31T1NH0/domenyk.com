import "server-only"

import { countPostsWithPublishedVersions } from "@/lib/db/posts"

export const SITEMAP_PAGE_SIZE = 10_000

function chunkCount(total: number): number {
  return Math.ceil(total / SITEMAP_PAGE_SIZE)
}

export async function getSitemapDescriptors(): Promise<Array<{ id: string }>> {
  const postCount = await countPostsWithPublishedVersions()
  return [
    { id: "index" },
    { id: "topics" },
    { id: "series" },
    ...Array.from({ length: chunkCount(postCount) }, (_, index) => ({ id: `posts-${index}` })),
  ]
}
