import type { Metadata } from "next"

export const siteConfig = {
  name: "domenyk",
  author: "Domenyk",
  title: "domenyk",
  description: "Blog de Domenyk sobre política, liberalismo, ideias e debate público.",
  url: getSiteUrl(),
  locale: "pt_BR",
  image: "/opengraph-image",
}

const authorTopics = [
  "política",
  "economia",
  "liberalismo",
  "filosofia",
  "instituições",
  "tecnologia",
  "debate público",
]

const authorProfiles = [
  "https://www.instagram.com/dome.nyk_/",
]

function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === "development"
      ? process.env.VERCEL_URL ?? "http://localhost:3000"
      : "https://domenyk.com")

  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`
  return url.replace(/\/$/, "")
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//.test(path)) return path
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`
}

export function descriptionFromMarkdown(markdown: string, maxLength = 155): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength + 1)
  return `${truncated.slice(0, truncated.lastIndexOf(" ") || maxLength).trim()}...`
}

export function metadataDescription(value: string, maxLength = 160): string {
  return descriptionFromMarkdown(value, maxLength) || siteConfig.description
}

export function wordCountFromMarkdown(markdown: string): number {
  const text = descriptionFromMarkdown(markdown, Number.MAX_SAFE_INTEGER)
  return text ? text.split(/\s+/).length : 0
}

export function titleFromMarkdown(markdown: string, maxLength = 68): string {
  const description = descriptionFromMarkdown(markdown, maxLength)
  if (!description) return ""
  return description.replace(/\.\.\.$/, "").trim()
}

export function noteDisplayTitle(note: { title?: string; content: string }): string {
  return note.title?.trim() || titleFromMarkdown(note.content) || "Nota de Domenyk"
}

export function imageUrlsFromMarkdown(markdown: string): string[] {
  const urls = new Set<string>()
  const imagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let match: RegExpExecArray | null

  while ((match = imagePattern.exec(markdown)) !== null) {
    urls.add(match[1])
  }

  return [...urls]
}

export function preferredContentImages({
  cover,
  images,
  markdown,
}: {
  cover?: string
  images?: string[]
  markdown?: string
}): string[] {
  const urls = new Set<string>()
  if (cover) urls.add(cover)
  images?.forEach((image) => urls.add(image))
  if (markdown) imageUrlsFromMarkdown(markdown).forEach((image) => urls.add(image))
  return [...urls]
}

export function authorJsonLd() {
  return {
    "@type": "Person",
    "@id": `${siteConfig.url}/#person`,
    name: siteConfig.author,
    url: absoluteUrl("/sobre"),
    image: absoluteUrl("/images/profile.jpg"),
    description: "Autor de um blog independente sobre política, economia, liberalismo, filosofia, instituições e tecnologia.",
    knowsAbout: authorTopics,
    sameAs: authorProfiles,
  }
}

export function blogJsonLd() {
  return {
    "@type": "Blog",
    "@id": `${siteConfig.url}/#blog`,
    url: siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    inLanguage: "pt-BR",
    author: { "@id": `${siteConfig.url}/#person` },
    publisher: { "@id": `${siteConfig.url}/#person` },
    isPartOf: { "@id": `${siteConfig.url}/#website` },
    about: authorTopics.map((name) => ({ "@type": "Thing", name })),
  }
}

export function isNoteIndexable(note: { seoTitle?: string; seoDescription?: string }): boolean {
  return Boolean(note.seoTitle?.trim() && note.seoDescription?.trim())
}

export function buildPageMetadata({
  title,
  description = siteConfig.description,
  path = "/",
  image = siteConfig.image,
  type = "website",
  publishedTime,
  modifiedTime,
  tags,
  noIndex = false,
  languages,
  openGraphLocale = siteConfig.locale,
  openGraphAlternateLocales,
}: {
  title?: string
  description?: string
  path?: string
  image?: string
  type?: "website" | "article"
  publishedTime?: string
  modifiedTime?: string
  tags?: string[]
  noIndex?: boolean
  languages?: Record<string, string>
  openGraphLocale?: string
  openGraphAlternateLocales?: string[]
} = {}): Metadata {
  const url = absoluteUrl(path)
  const imageUrl = absoluteUrl(image)
  const images = [{
    url: imageUrl,
    alt: title ?? siteConfig.title,
    ...(image === siteConfig.image
      ? { width: 1200, height: 630, type: "image/png" as const }
      : {}),
  }]
  const conciseDescription = metadataDescription(description)

  return {
    ...(title ? { title } : {}),
    description: conciseDescription,
    alternates: {
      canonical: url,
      languages,
      types: {
        "text/markdown": absoluteUrl("/llms.txt"),
      },
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      title: title ?? siteConfig.title,
      description: conciseDescription,
      url,
      siteName: siteConfig.name,
      locale: openGraphLocale,
      alternateLocale: openGraphAlternateLocales,
      type,
      images,
      publishedTime,
      modifiedTime,
      tags,
    },
    twitter: {
      card: "summary_large_image",
      title: title ?? siteConfig.title,
      description: conciseDescription,
      images: [imageUrl],
    },
  }
}

export function jsonLd(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}
