export const POST_LOCALES = ["pt", "en", "de", "id"] as const
export const TRANSLATION_LOCALES = ["en", "de", "id"] as const

export type PostLocale = (typeof POST_LOCALES)[number]
export type TranslationLocale = (typeof TRANSLATION_LOCALES)[number]

export type PostLocaleDetails = {
  code: PostLocale
  shortLabel: string
  adminLabel: string
  nativeLabel: string
  htmlLang: string
  openGraphLocale: string
}

export const POST_LOCALE_DETAILS: Record<PostLocale, PostLocaleDetails> = {
  pt: {
    code: "pt",
    shortLabel: "PT",
    adminLabel: "Português",
    nativeLabel: "Português",
    htmlLang: "pt-BR",
    openGraphLocale: "pt_BR",
  },
  en: {
    code: "en",
    shortLabel: "EN",
    adminLabel: "Inglês",
    nativeLabel: "English",
    htmlLang: "en",
    openGraphLocale: "en_US",
  },
  de: {
    code: "de",
    shortLabel: "DE",
    adminLabel: "Alemão",
    nativeLabel: "Deutsch",
    htmlLang: "de",
    openGraphLocale: "de_DE",
  },
  id: {
    code: "id",
    shortLabel: "ID",
    adminLabel: "Indonésio",
    nativeLabel: "Bahasa Indonesia",
    htmlLang: "id",
    openGraphLocale: "id_ID",
  },
}

export function isPostLocale(value: string): value is PostLocale {
  return (POST_LOCALES as readonly string[]).includes(value)
}

export function isTranslationLocale(value: string): value is TranslationLocale {
  return (TRANSLATION_LOCALES as readonly string[]).includes(value)
}

export function postPath(slug: string, locale: PostLocale = "pt"): string {
  const encodedSlug = encodeURIComponent(slug)
  return locale === "pt" ? `/posts/${encodedSlug}` : `/${locale}/posts/${encodedSlug}`
}

export function slugifyPostTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[ßẞ]/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180)
    .replace(/-$/g, "")
}

type LocalizedSlugPost = {
  slug: string
  translations?: Partial<Record<TranslationLocale, { title: string; slug?: string }>>
}

export function localizedPostSlug(post: LocalizedSlugPost, locale: PostLocale): string {
  if (locale === "pt") return post.slug
  const translation = post.translations?.[locale]
  return translation?.slug || (translation ? slugifyPostTitle(translation.title) : post.slug) || post.slug
}

export function localizedPostPath(post: LocalizedSlugPost, locale: PostLocale = "pt"): string {
  return postPath(localizedPostSlug(post, locale), locale)
}

export function isTranslationRevisionStale(
  sourceUpdatedAt: string | Date,
  originalContentUpdatedAt: string | Date
): boolean {
  return new Date(sourceUpdatedAt).getTime() < new Date(originalContentUpdatedAt).getTime()
}
