import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import {
  getLocalizedPostMetadata,
  LocalizedPostPage,
} from "@/components/post/LocalizedPostPage"
import { isPostLocale } from "@/lib/post-locales"

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isPostLocale(locale)) return {}
  if (locale === "pt") return {}
  return getLocalizedPostMetadata(slug, locale)
}

export default async function TranslatedPostPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isPostLocale(locale)) notFound()
  if (locale === "pt") permanentRedirect(`/posts/${encodeURIComponent(slug)}`)
  return <LocalizedPostPage slug={slug} locale={locale} />
}
