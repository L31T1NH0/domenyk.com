import type { MetadataRoute } from "next"
import { getPosts } from "@/lib/db/posts"
import { absoluteUrl } from "@/lib/seo"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { posts } = await getPosts({ limit: 1000 })

  return [
    {
      url: absoluteUrl("/"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/notes"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...posts.map((post) => ({
      url: absoluteUrl(`/posts/${post.publicId}`),
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: post.pinned ? 0.9 : 0.8,
      images: post.cover?.url ? [absoluteUrl(post.cover.url)] : undefined,
    })),
  ]
}
