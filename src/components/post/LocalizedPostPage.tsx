import type { Metadata } from "next"
import { cache } from "react"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { headers } from "next/headers"
import { getPostByLocalizedSlug, getPostByPublicId, getPostBySlug, getRelatedPosts, type Post, type PostStyle } from "@/lib/db/posts"
import { isAdmin } from "@/lib/auth"
import { renderMarkdown } from "@/lib/mdx"
import { absoluteUrl, authorJsonLd, buildPageMetadata, descriptionFromMarkdown, jsonLd, preferredContentImages, siteConfig } from "@/lib/seo"
import { getCachedClerkUserImage } from "@/lib/clerk-users"
import {
  POST_LOCALE_DETAILS,
  localizedPostPath,
  localizedPostSlug,
  type PostLocale,
} from "@/lib/post-locales"
import { getPostVersion, getPublishedPostLocales } from "@/lib/post-versions"
import { BackHome } from "@/components/BackHome"
import { ParagraphCommentsLayer } from "@/components/post/ParagraphCommentsLayer"
import { PostContentShell } from "@/components/post/PostContentShell"
import { PostMetaBar } from "@/components/post/PostMetaBar"
import { PostEngagementTracker } from "@/components/post/PostEngagementTracker"
import { PostReadingPosition } from "@/components/post/PostReadingPosition"
import { PostDescriptionDisclosure } from "@/components/post/PostDescriptionDisclosure"
import { PostTopics } from "@/components/post/PostTopics"
import { EditorialSectionNav } from "@/components/post/EditorialSectionNav"
import { CommentThread } from "@/components/comments/CommentThread"
import { PostHeader } from "@/components/PostHeader"
import { AudioPlayer } from "@/components/AudioPlayer"
import { DocumentLanguage } from "@/components/DocumentLanguage"
import { PostLanguageMenuRegistration } from "@/components/public-menu/PublicMenuContext"

const pageCopy: Record<PostLocale, {
  back: string
  draft: string
  edit: string
  showDescription: string
  hideDescription: string
  minute: (minutes: number) => string
  styleLabels: Record<PostStyle, string>
  editorial: { structure: string; thesis: string; reading: string; topics: string }
}> = {
  pt: {
    back: "Voltar para a página inicial",
    draft: "rascunho",
    edit: "Editar post",
    showDescription: "ver descrição",
    hideDescription: "ocultar descrição",
    minute: (minutes) => `${minutes} min`,
    styleLabels: { standard: "", editorial: "Editorial", opinion: "Opinião" },
    editorial: { structure: "Estrutura", thesis: "Tese central", reading: "Leitura", topics: "Assuntos" },
  },
  en: {
    back: "Back to the home page",
    draft: "draft",
    edit: "Edit post",
    showDescription: "show description",
    hideDescription: "hide description",
    minute: (minutes) => `${minutes} min read`,
    styleLabels: { standard: "", editorial: "Editorial", opinion: "Opinion" },
    editorial: { structure: "Structure", thesis: "Central thesis", reading: "Reading", topics: "Topics" },
  },
  de: {
    back: "Zur Startseite",
    draft: "Entwurf",
    edit: "Beitrag bearbeiten",
    showDescription: "Beschreibung anzeigen",
    hideDescription: "Beschreibung ausblenden",
    minute: (minutes) => `${minutes} Min. Lesezeit`,
    styleLabels: { standard: "", editorial: "Editorial", opinion: "Meinung" },
    editorial: { structure: "Struktur", thesis: "Zentrale These", reading: "Lesezeit", topics: "Themen" },
  },
  id: {
    back: "Kembali ke beranda",
    draft: "draf",
    edit: "Edit tulisan",
    showDescription: "lihat deskripsi",
    hideDescription: "sembunyikan deskripsi",
    minute: (minutes) => `${minutes} menit baca`,
    styleLabels: { standard: "", editorial: "Editorial", opinion: "Opini" },
    editorial: { structure: "Struktur", thesis: "Tesis utama", reading: "Waktu baca", topics: "Topik" },
  },
}

function getPostStyleClasses(style: PostStyle) {
  if (style === "editorial") {
    return {
      page: "post-style-editorial",
      article: "editorial-article",
      eyebrow: "",
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

const findPost = cache(async function findPost(slug: string, locale: PostLocale): Promise<Post | null> {
  if (locale === "pt") {
    return (await getPostBySlug(slug)) ?? (await getPostByPublicId(slug))
  }
  return (await getPostByLocalizedSlug(locale, slug))
    ?? (await getPostBySlug(slug))
    ?? (await getPostByPublicId(slug))
})

function languageUrls(post: Post) {
  const urls = Object.fromEntries(getPublishedPostLocales(post).map((locale) => [
    POST_LOCALE_DETAILS[locale].htmlLang,
    absoluteUrl(localizedPostPath(post, locale)),
  ]))
  if (post.published) urls["x-default"] = absoluteUrl(localizedPostPath(post, "pt"))
  return urls
}

export async function getLocalizedPostMetadata(slug: string, locale: PostLocale): Promise<Metadata> {
  const post = await findPost(slug, locale)
  if (!post) return {}
  const version = getPostVersion(post, locale)
  if (!version) return {}

  const admin = await isAdmin()
  if (!version.published && !admin) {
    return { robots: { index: false, follow: false } }
  }

  const details = POST_LOCALE_DETAILS[locale]
  const canonicalPath = localizedPostPath(post, locale)
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
  const post = await findPost(slug, locale)
  if (!post) notFound()
  if (localizedPostSlug(post, locale) !== slug) permanentRedirect(localizedPostPath(post, locale))

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
  const html = await renderMarkdown(version.content, {
    coAuthorImageUrl,
    defaultImageAlt: `Imagem relacionada a “${version.title}”`,
  })
  const dateLabel = version.publishedAt
    ? new Intl.DateTimeFormat(details.htmlLang, { dateStyle: "long" }).format(version.publishedAt)
    : undefined
  const visibleDescription = version.subtitle ?? version.excerpt
  const description = (version.excerpt ?? version.subtitle ?? descriptionFromMarkdown(version.content)) || siteConfig.description
  const style = version.style ?? "standard"
  const styleClasses = getPostStyleClasses(style)
  const styleLabel = copy.styleLabels[style]
  const postUrl = absoluteUrl(localizedPostPath(post, locale))
  const postImages = preferredContentImages({ cover: version.cover?.url, markdown: version.content })
  const postStructuredImages = (postImages.length > 0 ? postImages : [siteConfig.image]).map(absoluteUrl)
  const publishedLocales = getPublishedPostLocales(post)
  const selectorLocales = version.published
    ? publishedLocales
    : [locale, ...publishedLocales.filter((availableLocale) => availableLocale !== locale)]
  const relatedPosts = version.published ? await getRelatedPosts(post) : []
  const localizedRelatedPosts = relatedPosts
    .filter((relatedPost) => locale === "pt" ? relatedPost.published : relatedPost.translations?.[locale]?.published === true)
    .map((relatedPost) => ({
      publicId: relatedPost.publicId,
      href: localizedPostPath(relatedPost, locale),
      title: locale === "pt" ? relatedPost.title : relatedPost.translations?.[locale]?.title ?? relatedPost.title,
    }))

  return (
    <div className={styleClasses.page} lang={details.htmlLang}>
      <DocumentLanguage language={details.htmlLang} />
      <PostLanguageMenuRegistration
        currentLocale={locale}
        options={selectorLocales.map((availableLocale) => ({
          locale: availableLocale,
          href: localizedPostPath(post, availableLocale),
        }))}
      />
      <script
        nonce={nonce}
        suppressHydrationWarning
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BlogPosting",
                "@id": `${postUrl}#article`,
                mainEntityOfPage: postUrl,
                headline: version.title,
                description,
                image: postStructuredImages,
                datePublished: version.publishedAt?.toISOString(),
                dateModified: version.updatedAt.toISOString(),
                author: authorJsonLd(),
                publisher: { "@id": `${siteConfig.url}/#person` },
                inLanguage: details.htmlLang,
                keywords: version.tags,
                timeRequired: `PT${version.readingTimeMinutes}M`,
                isAccessibleForFree: true,
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: copy.back, item: absoluteUrl("/") },
                  { "@type": "ListItem", position: 2, name: version.title, item: postUrl },
                ],
              },
            ],
          }),
        }}
      />
      <PostHeader
        title={version.title}
        cover={version.cover}
        secondaryImage={coAuthorImageUrl}
        background={version.background}
        variant={style === "editorial" ? "editorial" : "default"}
        editorialLabel={styleLabel}
      />
      <PostMetaBar
        publicId={version.publicId}
        dateLabel={dateLabel}
        readingTime={copy.minute(version.readingTimeMinutes)}
        initialViews={version.views ?? 0}
        locale={locale}
        variant={style === "editorial" ? "editorial" : "default"}
      />
      <PostEngagementTracker publicId={version.publicId} readingTimeMinutes={version.readingTimeMinutes} />
      {!version.published && <p className="mt-2 text-xs text-amber-400">{copy.draft}</p>}

      <article className={["relative flex flex-col gap-6", styleClasses.article].join(" ")}>
        {styleLabel && style !== "editorial" && <span className={styleClasses.eyebrow}>{styleLabel}</span>}
        {version.audioUrl && <AudioPlayer audioUrl={version.audioUrl} />}

        {style === "editorial" ? (
          <div className="editorial-reading-grid">
            <EditorialSectionNav label={copy.editorial.structure} />
            <div className="editorial-content-column relative">
              <PostContentShell html={html} className={styleClasses.content} variant="editorial" />
              <PostReadingPosition postId={`${postId}:${locale}`} updatedAt={version.updatedAt.toISOString()} />
              <ParagraphCommentsLayer postId={postId} locale={locale} isAdmin={admin} variant="editorial" />
            </div>
            <aside className="editorial-margin-notes" aria-label={copy.editorial.reading}>
              <dl>
                <div>
                  <dt>{copy.editorial.reading}</dt>
                  <dd>{copy.minute(version.readingTimeMinutes)}</dd>
                </div>
                {version.tags.length > 0 && (
                  <div>
                    <dt>{copy.editorial.topics}</dt>
                    <dd>{version.tags.join(" · ")}</dd>
                  </div>
                )}
              </dl>
            </aside>
          </div>
        ) : (
          <div className="relative">
            <PostContentShell html={html} className={styleClasses.content} />
            <PostReadingPosition postId={`${postId}:${locale}`} updatedAt={version.updatedAt.toISOString()} />
            <ParagraphCommentsLayer postId={postId} locale={locale} isAdmin={admin} />
            <PostTopics />
          </div>
        )}
      </article>

      <div id="post-content-boundary" className={["mt-8 border-t border-zinc-200/80 pt-5 dark:border-zinc-700/80", style === "editorial" ? "editorial-post-footer" : ""].join(" ")}>
        {visibleDescription && (
          <PostDescriptionDisclosure
            description={visibleDescription}
            showLabel={copy.showDescription}
            hideLabel={copy.hideDescription}
          />
        )}
        {version.tags.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {version.tags.map((tag) => (
              locale === "pt" ? (
                <Link key={tag} href={`/temas/${encodeURIComponent(tag)}`} className="inline-flex items-center rounded-full border border-zinc-300/80 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-500 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-zinc-400 dark:hover:text-white dark:focus-visible:ring-neutral-300">
                  #{tag}
                </Link>
              ) : (
                <span key={tag} className="inline-flex items-center rounded-full border border-zinc-300/80 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200">#{tag}</span>
              )
            ))}
          </div>
        )}
      </div>

      {localizedRelatedPosts.length > 0 && (
        <aside aria-labelledby="related-posts-title" className={["mt-7 border-t border-zinc-200/80 pt-5 dark:border-zinc-700/80", style === "editorial" ? "editorial-post-footer" : ""].join(" ")}>
          <h2 id="related-posts-title" className="text-sm font-semibold text-neutral-950 dark:text-[#f1f1f1]">Textos relacionados</h2>
          <ul className="mt-3 divide-y divide-zinc-200/80 dark:divide-zinc-700/80">
            {localizedRelatedPosts.map((relatedPost) => (
              <li key={relatedPost.publicId}>
                <Link href={relatedPost.href} className="block rounded-sm py-3 text-sm leading-snug text-neutral-700 hover:text-neutral-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-zinc-300 dark:hover:text-white dark:focus-visible:ring-neutral-300">
                  {relatedPost.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <BackHome label={copy.back} variant={style === "editorial" ? "editorial" : "default"} />
      {admin && (
        <div className={["mb-2 mt-4 sm:mt-6", style === "editorial" ? "editorial-post-footer" : ""].join(" ")}>
          <Link
            href={`/admin/posts/${postId}/edit`}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {copy.edit}
          </Link>
        </div>
      )}

      <div className={["mb-6 mt-4 sm:mt-6", style === "editorial" ? "editorial-post-footer" : ""].join(" ")}>
        <CommentThread postId={postId} locale={locale} isAdmin={admin} />
      </div>
    </div>
  )
}
