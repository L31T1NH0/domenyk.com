import type { Metadata } from "next"
import Link from "next/link"
import { notFound, permanentRedirect } from "next/navigation"
import { getPostByPublicId, getPostBySlug } from "@/lib/db/posts"
import { isAdmin } from "@/lib/auth"
import { renderMarkdown } from "@/lib/mdx"
import { BackHome } from "@/components/BackHome"
import { ParagraphCommentsLayer } from "@/components/post/ParagraphCommentsLayer"
import { PostContentShell } from "@/components/post/PostContentShell"
import { PostMetaBar } from "@/components/post/PostMetaBar"
import { PostReadingPosition } from "@/components/post/PostReadingPosition"
import { PostTopics } from "@/components/post/PostTopics"
import { CommentThread } from "@/components/comments/CommentThread"
import { PostHeader } from "@/components/PostHeader"
import { AudioPlayer } from "@/components/AudioPlayer"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { PostStyle } from "@/lib/db/posts"
import { absoluteUrl, buildPageMetadata, descriptionFromMarkdown, jsonLd, preferredContentImages, siteConfig } from "@/lib/seo"
import { headers } from "next/headers"
import { getCachedClerkUserImage } from "@/lib/clerk-users"

type Props = { params: Promise<{ slug: string }> }

const styleLabels: Record<PostStyle, string> = {
  standard: "",
  editorial: "Editorial",
  opinion: "Opinião",
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

  return {
    page: "",
    article: "mt-6",
    eyebrow: "",
    content: "",
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = (await getPostBySlug(slug)) ?? (await getPostByPublicId(slug))
  if (!post) return {}
  const admin = await isAdmin()
  if (!post.published && !admin) {
    return { robots: { index: false, follow: false } }
  }

  const canonicalPath = `/posts/${post.slug}`
  const description = (post.excerpt ?? post.subtitle ?? descriptionFromMarkdown(post.content)) || siteConfig.description
  const [preferredImage] = preferredContentImages({
    cover: post.cover?.url,
    markdown: post.content,
  })

  return buildPageMetadata({
    title: post.title,
    description,
    path: canonicalPath,
    image: preferredImage ?? `/og/posts/${post.slug}`,
    type: "article",
    publishedTime: post.publishedAt?.toISOString(),
    modifiedTime: post.updatedAt.toISOString(),
    tags: post.tags,
    noIndex: !post.published,
  })
}

export default async function PostPage({ params }: Props) {
  const nonce = (await headers()).get("x-nonce") ?? undefined
  const { slug } = await params
  const post = (await getPostBySlug(slug)) ?? (await getPostByPublicId(slug))

  if (!post) notFound()
  if (post.slug !== slug) permanentRedirect(`/posts/${post.slug}`)
  const admin = await isAdmin()
  if (!post.published && !admin) notFound()

  let coAuthorImageUrl = post.friendImage ?? null
  if (post.coAuthorUserId) {
    coAuthorImageUrl = await getCachedClerkUserImage(post.coAuthorUserId) ?? coAuthorImageUrl
  }

  const postId = post._id.toString()
  const html = await renderMarkdown(post.content, { coAuthorImageUrl })
  const dateLabel = post.publishedAt
    ? format(new Date(post.publishedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : undefined
  const subtitle = post.subtitle ?? post.excerpt
  const description = (post.excerpt ?? post.subtitle ?? descriptionFromMarkdown(post.content)) || siteConfig.description
  const styleClasses = getPostStyleClasses(post.style ?? "standard")
  const styleLabel = styleLabels[post.style ?? "standard"]
  const postUrl = absoluteUrl(`/posts/${post.slug}`)
  const postImages = preferredContentImages({
    cover: post.cover?.url,
    markdown: post.content,
  })
  const postStructuredImages = (postImages.length > 0 ? postImages : [siteConfig.image]).map(absoluteUrl)

  return (
    <div className={styleClasses.page}>
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "@id": `${postUrl}#article`,
            mainEntityOfPage: postUrl,
            headline: post.title,
            description,
            image: postStructuredImages,
            datePublished: post.publishedAt?.toISOString(),
            dateModified: post.updatedAt.toISOString(),
            author: { "@id": `${siteConfig.url}/#person` },
            publisher: { "@id": `${siteConfig.url}/#person` },
            inLanguage: "pt-BR",
            keywords: post.tags,
            timeRequired: `PT${post.readingTimeMinutes}M`,
            isAccessibleForFree: true,
          }),
        }}
      />
      <PostHeader
        title={post.title}
        subtitle={subtitle}
        cover={post.cover}
        secondaryImage={coAuthorImageUrl}
        background={post.background}
      />

      <PostMetaBar
        publicId={post.publicId}
        dateLabel={dateLabel}
        readingTime={`${post.readingTimeMinutes} min`}
        initialViews={post.views ?? 0}
      />
      {!post.published && <p className="mt-2 text-xs text-amber-400">rascunho</p>}

      <article className={["relative flex flex-col gap-6", styleClasses.article].join(" ")}>
        {styleLabel && <span className={styleClasses.eyebrow}>{styleLabel}</span>}
        {post.audioUrl && <AudioPlayer audioUrl={post.audioUrl} />}

        <div className="relative">
          <PostContentShell html={html} className={styleClasses.content} />
          <PostReadingPosition postId={postId} updatedAt={post.updatedAt.toISOString()} />
          <ParagraphCommentsLayer postId={postId} isAdmin={admin} />
          <PostTopics />
        </div>
      </article>

      <div id="post-content-boundary" className="mt-8 border-t border-zinc-200/80 pt-5 dark:border-zinc-700/80">
        {post.tags.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-zinc-300/80 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <BackHome />
      {admin && (
        <div className="mt-4 sm:mt-6 mb-2">
          <Link
            href={`/admin/posts/${postId}/edit`}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Editar post
          </Link>
        </div>
      )}

      <div className="mt-4 sm:mt-6 mb-6">
        <CommentThread postId={postId} isAdmin={admin} />
      </div>
    </div>
  )
}
