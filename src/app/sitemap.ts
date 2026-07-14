import type { MetadataRoute } from "next"
import { getLatestPublishedPostUpdate, getPostsWithPublishedVersions } from "@/lib/db/posts"
import { getIndexableNotes } from "@/lib/db/notes"
import { getActiveThemeUpdates } from "@/lib/db/themes"
import { absoluteUrl, preferredContentImages } from "@/lib/seo"
import { getSitemapDescriptors, SITEMAP_PAGE_SIZE } from "@/lib/sitemaps"
import { localizedPostPath, POST_LOCALE_DETAILS, POST_LOCALES } from "@/lib/post-locales"

const FALLBACK_DATE = new Date("2026-07-12T00:00:00.000Z")

export async function generateSitemaps() {
  return getSitemapDescriptors()
}

async function indexSitemap(): Promise<MetadataRoute.Sitemap> {
  const [latestPostDate, notes] = await Promise.all([
    getLatestPublishedPostUpdate(),
    getIndexableNotes({ limit: 1 }),
  ])
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
    {
      url: absoluteUrl("/sobre"),
      lastModified: FALLBACK_DATE,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/fale-comigo"),
      lastModified: FALLBACK_DATE,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}

async function topicsSitemap(): Promise<MetadataRoute.Sitemap> {
  const themes = await getActiveThemeUpdates()
  return themes.map(({ slug, updatedAt }) => ({
    url: absoluteUrl(`/temas/${encodeURIComponent(slug)}`),
    lastModified: updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }))
}

async function postsSitemap(page: number): Promise<MetadataRoute.Sitemap> {
  const posts = await getPostsWithPublishedVersions({ page: page + 1, limit: SITEMAP_PAGE_SIZE })
  return posts.flatMap((post) => {
    const locales = POST_LOCALES.filter((locale) => (
      locale === "pt" ? post.published : post.translations?.[locale]?.published === true
    ))
    const languages = Object.fromEntries(locales.map((locale) => [
      POST_LOCALE_DETAILS[locale].htmlLang,
      absoluteUrl(localizedPostPath(post, locale)),
    ]))
    if (post.published) languages["x-default"] = absoluteUrl(localizedPostPath(post, "pt"))

    return locales.map((locale) => {
      const translation = locale === "pt" ? undefined : post.translations?.[locale]
      return {
        url: absoluteUrl(localizedPostPath(post, locale)),
        lastModified: translation?.updatedAt ?? post.updatedAt,
        changeFrequency: "monthly" as const,
        priority: post.pinned ? 0.9 : 0.8,
        images: preferredContentImages({
          cover: post.cover?.url,
          markdown: locale === "pt" ? post.content : translation?.content,
        }).map(absoluteUrl),
        alternates: { languages },
      }
    })
  })
}

async function notesSitemap(page: number): Promise<MetadataRoute.Sitemap> {
  const notes = await getIndexableNotes({ page: page + 1, limit: SITEMAP_PAGE_SIZE })
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
  if (sitemapId === "topics") return topicsSitemap()

  const match = /^(posts|notes)-(\d+)$/.exec(sitemapId)
  if (!match) return []

  const page = Number(match[2])
  return match[1] === "posts" ? postsSitemap(page) : notesSitemap(page)
}
