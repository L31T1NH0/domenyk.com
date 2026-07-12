import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { headers } from "next/headers"
import { getPostByPublicId, getPostBySlug, type Post, type PostStyle } from "@/lib/db/posts"
import { isAdmin } from "@/lib/auth"
import { renderMarkdown } from "@/lib/mdx"
import { absoluteUrl, buildPageMetadata, descriptionFromMarkdown, jsonLd, preferredContentImages, siteConfig } from "@/lib/seo"
import { getCachedClerkUserImage } from "@/lib/clerk-users"
import {
  POST_LOCALE_DETAILS,
  postPath,
  type PostLocale,
} from "@/lib/post-locales"
import { getPostVersion, getPublishedPostLocales } from "@/lib/post-versions"
import { BackHome } from "@/components/BackHome"
import { ParagraphCommentsLayer } from "@/components/post/ParagraphCommentsLayer"
import { PostContentShell } from "@/components/post/PostContentShell"
import { PostLanguageSwitcher } from "@/components/post/PostLanguageSwitcher"
import { PostMetaBar } from "@/components/post/PostMetaBar"
import { PostReadingPosition } from "@/components/post/PostReadingPosition"
import { PostTopics } from "@/components/post/PostTopics"
import { CommentThread } from "@/components/comments/CommentThread"
import { PostHeader } from "@/components/PostHeader"
import { AudioPlayer } from "@/components/AudioPlayer"
import { DocumentLanguage } from "@/components/DocumentLanguage"

const pageCopy: Record<PostLocale, {
  back: string
  draft: string
  edit: string
  minute: (minutes: number) => string
  styleLabels: Record<PostStyle, string>
}> = {
  pt: {
    back: "Voltar para a página inicial",
    draft: "rascunho",
    edit: "Editar post",
    minute: (minutes) => `${minutes} min`,
    styleLabels: { standard: "", editorial: "Editorial", opinion: "Opinião" },
  },
  en: {
    back: "Back to the home page",
    draft: "draft",
    edit: "Edit post",
    minute: (minutes) => `${minutes} min read`,
    styleLabels: { standard: "", editorial: "Editorial", opinion: "Opinion" },
  },
  de: {
    back: "Zur Startseite",
    draft: "Entwurf",
    edit: "Beitrag bearbeiten",
    minute: (minutes) => `${minutes} Min. Lesezeit`,
    styleLabels: { standard: "", editorial: "Editorial", opinion: "Meinung" },
  },
  id: {
    back: "Kembali ke beranda",
    draft: "draf",
    edit: "Edit tulisan",
    minute: (minutes) => `${minutes} menit baca`,
    styleLabels: { standard: "", editorial: "Editorial", opinion: "Opini" },
  },
}

function getPostStyleClasses(style: PostStyle) {
  if (style === "editorial") {
    return {
      page: "post-style-editorial",
      article: "mt-8 border-y border-[#A8A095]/25 py-7 sm:py-10",
      eyebrow: "mb-4 block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#A8A095]",
      content: "post-content-editorial",
    }
  }

  if (style === "opinion") {
    return {
      page: "post-style-opinion",
      article: "mt-8 border-l-2 border-[#E00070] pl-4 sm:pl-7",
      eyebrow: "mb-4 block text-[11px] font-semibold uppercase tracking-[0.24em] text-[#E00070]",
      content: "post-content-opinion",
    }
  }

  return { page: "", article: "mt-6", eyebrow: "", content: "" }
}

async function findPost(slug: string): Promise<Post | null> {
  return (await getPostBySlug(slug)) ?? (await getPostByPublicId(slug))
}

function languageUrls(post: Post) {
  const urls = Object.fromEntries(getPublishedPostLocales(post).map((locale) => [
    POST_LOCALE_DETAILS[locale].htmlLang,
    absoluteUrl(postPath(post.slug, locale)),
  ]))
  if (post.published) urls["x-default"] = absoluteUrl(postPath(post.slug, "pt"))
  return urls
}

export async function getLocalizedPostMetadata(slug: string, locale: PostLocale): Promise<Metadata> {
  const post = await findPost(slug)
  if (!post) return {}
  const version = getPostVersion(post, locale)
  if (!version) return {}

  const admin = await isAdmin()
  if (!version.published && !admin) {
    return { robots: { index: false, follow: false } }
  }

  const details = POST_LOCALE_DETAILS[locale]
  const canonicalPath = postPath(post.slug, locale)
  const description = (version.excerpt ?? version.subtitle ?? descriptionFromMarkdown(version.content)) || siteConfig.description
  const [preferredImage] = preferredContentImages({ cover: version.cover?.url, markdown: version.content })
  const publishedLocales = getPublishedPostLocales(post)

  return buildPageMetadata({
    title: version.title,
    description,
    path: canonicalPath,
    image: preferredImage ?? `/og/posts/${encodeURIComponent(post.slug)}?locale=${locale}`,
    type: "article",
    publishedTime: version.publishedAt?.toISOString(),
    modifiedTime: version.updatedAt.toISOString(),
    tags: version.tags,
    noIndex: !version.published,
    languages: languageUrls(post),
    openGraphLocale: details.openGraphLocale,
    openGraphAlternateLocales: publishedLocales
      .filter((availableLocale) => availableLocale !== locale)
      .map((availableLocale) => POST_LOCALE_DETAILS[availableLocale].openGraphLocale),
  })
}

export async function LocalizedPostPage({ slug, locale }: { slug: string; locale: PostLocale }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined
  const post = await findPost(slug)
  if (!post) notFound()
  if (post.slug !== slug) permanentRedirect(postPath(post.slug, locale))

  const version = getPostVersion(post, locale)
  if (!version) notFound()
  const admin = await isAdmin()
  if (!version.published && !admin) notFound()

  let coAuthorImageUrl = version.friendImage ?? null
  if (version.coAuthorUserId) {
    coAuthorImageUrl = await getCachedClerkUserImage(version.coAuthorUserId) ?? coAuthorImageUrl
  }

  const details = POST_LOCALE_DETAILS[locale]
  const copy = pageCopy[locale]
  const postId = version._id.toString()
  const html = await renderMarkdown(version.content, { coAuthorImageUrl })
  const dateLabel = version.publishedAt
    ? new Intl.DateTimeFormat(details.htmlLang, { dateStyle: "long" }).format(version.publishedAt)
    : undefined
  const subtitle = version.subtitle ?? version.excerpt
  const description = (version.excerpt ?? version.subtitle ?? descriptionFromMarkdown(version.content)) || siteConfig.description
  const style = version.style ?? "standard"
  const styleClasses = getPostStyleClasses(style)
  const styleLabel = copy.styleLabels[style]
  const postUrl = absoluteUrl(postPath(post.slug, locale))
  const postImages = preferredContentImages({ cover: version.cover?.url, markdown: version.content })
  const postStructuredImages = (postImages.length > 0 ? postImages : [siteConfig.image]).map(absoluteUrl)
  const publishedLocales = getPublishedPostLocales(post)
  const selectorLocales = version.published
    ? publishedLocales
    : [locale, ...publishedLocales.filter((availableLocale) => availableLocale !== locale)]

  return (
    <div className={styleClasses.page} lang={details.htmlLang}>
      <DocumentLanguage language={details.htmlLang} />
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "@id": `${postUrl}#article`,
            mainEntityOfPage: postUrl,
            headline: version.title,
            description,
            image: postStructuredImages,
            datePublished: version.publishedAt?.toISOString(),
            dateModified: version.updatedAt.toISOString(),
            author: { "@id": `${siteConfig.url}/#person` },
            publisher: { "@id": `${siteConfig.url}/#person` },
            inLanguage: details.htmlLang,
            keywords: version.tags,
            timeRequired: `PT${version.readingTimeMinutes}M`,
            isAccessibleForFree: true,
          }),
        }}
      />
      <PostHeader
        title={version.title}
        subtitle={subtitle}
        cover={version.cover}
        secondaryImage={coAuthorImageUrl}
        background={version.background}
      />
      <PostLanguageSwitcher
        currentLocale={locale}
        options={selectorLocales.map((availableLocale) => ({
          locale: availableLocale,
          href: postPath(post.slug, availableLocale),
        }))}
      />

      <PostMetaBar
        publicId={version.publicId}
        dateLabel={dateLabel}
        readingTime={copy.minute(version.readingTimeMinutes)}
        initialViews={version.views ?? 0}
        locale={locale}
      />
      {!version.published && <p className="mt-2 text-xs text-amber-400">{copy.draft}</p>}

      <article className={["relative flex flex-col gap-6", styleClasses.article].join(" ")}>
        {styleLabel && <span className={styleClasses.eyebrow}>{styleLabel}</span>}
        {version.audioUrl && <AudioPlayer audioUrl={version.audioUrl} />}

        <div className="relative">
          <PostContentShell html={html} className={styleClasses.content} />
          <PostReadingPosition postId={`${postId}:${locale}`} updatedAt={version.updatedAt.toISOString()} />
          <ParagraphCommentsLayer postId={postId} locale={locale} isAdmin={admin} />
          <PostTopics />
        </div>
      </article>

      <div id="post-content-boundary" className="mt-8 border-t border-zinc-200/80 pt-5 dark:border-zinc-700/80">
        {version.tags.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {version.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-full border border-zinc-300/80 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <BackHome label={copy.back} />
      {admin && (
        <div className="mb-2 mt-4 sm:mt-6">
          <Link
            href={`/admin/posts/${postId}/edit`}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {copy.edit}
          </Link>
        </div>
      )}

      <div className="mb-6 mt-4 sm:mt-6">
        <CommentThread postId={postId} locale={locale} isAdmin={admin} />
      </div>
    </div>
  )
}
