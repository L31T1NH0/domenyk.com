import type { Post } from "@/lib/db/posts"
import {
  POST_LOCALES,
  type PostLocale,
} from "@/lib/post-locales"

export type LocalizedPost = Omit<
  Post,
  | "title"
  | "seoTitle"
  | "seoDescription"
  | "content"
  | "excerpt"
  | "subtitle"
  | "sources"
  | "cover"
  | "published"
  | "publishedAt"
  | "readingTimeMinutes"
  | "createdAt"
  | "updatedAt"
> & {
  locale: PostLocale
  title: string
  seoTitle?: string
  seoDescription?: string
  content: string
  excerpt?: string
  subtitle?: string
  sources?: Post["sources"]
  cover?: Post["cover"]
  published: boolean
  publishedAt?: Date
  readingTimeMinutes: number
  createdAt: Date
  updatedAt: Date
}

export function getPostVersion(post: Post, locale: PostLocale): LocalizedPost | null {
  if (locale === "pt") {
    return {
      ...post,
      locale,
    }
  }

  const translation = post.translations?.[locale]
  if (!translation) return null

  return {
    ...post,
    locale,
    title: translation.title,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    content: translation.content,
    excerpt: translation.excerpt,
    subtitle: translation.subtitle,
    cover: post.cover ? {
      ...post.cover,
      alt: translation.coverAlt ?? post.cover.alt,
    } : undefined,
    tags: translation.tags ?? post.tags,
    sources: translation.sources ?? post.sources,
    published: translation.published,
    publishedAt: translation.publishedAt,
    readingTimeMinutes: translation.readingTimeMinutes,
    createdAt: translation.createdAt,
    updatedAt: translation.updatedAt,
  }
}

export function getPublishedPostLocales(post: Post): PostLocale[] {
  return POST_LOCALES.filter((locale) => getPostVersion(post, locale)?.published === true)
}
