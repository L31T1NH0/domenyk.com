import type { MetadataRoute } from "next"
import { getPosts } from "@/lib/db/posts"
import { getNotes } from "@/lib/db/notes"
import { absoluteUrl, preferredContentImages } from "@/lib/seo"
import { getSitemapDescriptors, SITEMAP_PAGE_SIZE } from "@/lib/sitemaps"

const FALLBACK_DATE = new Date("2026-04-29T00:00:00.000Z")

export async function generateSitemaps() {
  return getSitemapDescriptors()
}

async function indexSitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ posts }, { notes }] = await Promise.all([
    getPosts({ limit: 1 }),
    getNotes({ limit: 1 }),
  ])
  const latestPostDate = posts[0]?.updatedAt
  const latestNoteDate = notes[0] ? (notes[0].updatedAt ?? notes[0].createdAt) : undefined
  const homeLastModified = [latestPostDate, latestNoteDate]
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? FALLBACK_DATE

  return [
    {
      url: absoluteUrl("/"),
      lastModified: homeLastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/notes"),
      lastModified: latestNoteDate ?? FALLBACK_DATE,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ]
}

async function postsSitemap(page: number): Promise<MetadataRoute.Sitemap> {
  const { posts } = await getPosts({ page: page + 1, limit: SITEMAP_PAGE_SIZE })
  return posts.map((post) => ({
    url: absoluteUrl(`/posts/${post.slug}`),
    lastModified: post.updatedAt,
    changeFrequency: "monthly" as const,
    priority: post.pinned ? 0.9 : 0.8,
    images: preferredContentImages({ cover: post.cover?.url }).map(absoluteUrl),
  }))
}

async function notesSitemap(page: number): Promise<MetadataRoute.Sitemap> {
  const { notes } = await getNotes({ page: page + 1, limit: SITEMAP_PAGE_SIZE })
  return notes.map((note) => ({
    url: absoluteUrl(`/notes/${note._id.toString()}`),
    lastModified: note.updatedAt ?? note.createdAt,
    changeFrequency: "monthly" as const,
    priority: 0.5,
    images: preferredContentImages({
      images: note.images,
      markdown: note.content,
    }).map(absoluteUrl),
  }))
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const sitemapId = await id
  if (sitemapId === "index") return indexSitemap()

  const match = /^(posts|notes)-(\d+)$/.exec(sitemapId)
  if (!match) return []

  const page = Number(match[2])
  return match[1] === "posts" ? postsSitemap(page) : notesSitemap(page)
}
