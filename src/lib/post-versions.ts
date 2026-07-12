import type { Post } from "@/lib/db/posts"
import {
  POST_LOCALES,
  isTranslationRevisionStale,
  type PostLocale,
} from "@/lib/post-locales"

export type LocalizedPost = Omit<
  Post,
  | "title"
  | "content"
  | "excerpt"
  | "subtitle"
  | "cover"
  | "published"
  | "publishedAt"
  | "readingTimeMinutes"
  | "createdAt"
  | "updatedAt"
> & {
  locale: PostLocale
  title: string
  content: string
  excerpt?: string
  subtitle?: string
  cover?: Post["cover"]
  published: boolean
  publishedAt?: Date
  readingTimeMinutes: number
  createdAt: Date
  updatedAt: Date
}

export function originalContentUpdatedAt(
  post: Pick<Post, "originalContentUpdatedAt" | "updatedAt">
): Date {
  return post.originalContentUpdatedAt ?? post.updatedAt
}

export function translationNeedsReview(
  post: Pick<Post, "originalContentUpdatedAt" | "updatedAt">,
  translation: { sourceUpdatedAt: Date }
): boolean {
  return isTranslationRevisionStale(translation.sourceUpdatedAt, originalContentUpdatedAt(post))
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
    content: translation.content,
    excerpt: translation.excerpt,
    subtitle: translation.subtitle,
    cover: post.cover ? {
      ...post.cover,
      alt: translation.coverAlt ?? post.cover.alt,
    } : undefined,
    tags: translation.tags ?? post.tags,
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
