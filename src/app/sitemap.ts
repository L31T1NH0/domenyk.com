import type { MetadataRoute } from "next"
import { getPosts } from "@/lib/db/posts"
import { getNotes } from "@/lib/db/notes"
import { absoluteUrl } from "@/lib/seo"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ posts }, { notes }] = await Promise.all([
    getPosts({ limit: 1000 }),
    getNotes({ limit: 1000 }),
  ])
  const fallbackDate = new Date("2026-04-29T00:00:00.000Z")
  const latestPostDate = posts.reduce<Date | null>(
    (latest, post) => latest && latest > post.updatedAt ? latest : post.updatedAt,
    null
  )
  const latestNoteDate = notes.reduce<Date | null>(
    (latest, note) => latest && latest > note.createdAt ? latest : note.createdAt,
    null
  )
  const homeLastModified = [latestPostDate, latestNoteDate]
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? fallbackDate
  const notesLastModified = latestNoteDate ?? fallbackDate

  return [
    {
      url: absoluteUrl("/"),
      lastModified: homeLastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/notes"),
      lastModified: notesLastModified,
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
