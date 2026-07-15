import { notFound } from "next/navigation"
import { PostEditor } from "@/components/editor/PostEditor"
import { getDb } from "@/lib/db/client"
import type { Post } from "@/lib/db/posts"
import { getOriginalContentUpdatedAt } from "@/lib/db/posts"
import { TRANSLATION_LOCALES } from "@/lib/post-locales"
import { toObjectId } from "@/lib/validation"
import { getThemesForPost } from "@/lib/db/themes"

type Props = { params: Promise<{ id: string }> }

export default async function EditPostPage({ params }: Props) {
  const { id } = await params
  const objectId = toObjectId(id)
  if (!objectId) notFound()

  const db = await getDb()
  const post = await db.collection<Post>("posts").findOne({ _id: objectId })
  if (!post) notFound()
  const themes = await getThemesForPost(post._id)

  const translations = Object.fromEntries(
    TRANSLATION_LOCALES.flatMap((locale) => {
      const translation = post.translations?.[locale]
      return translation ? [[locale, {
        slug: translation.slug,
        title: translation.title,
        seoTitle: translation.seoTitle,
        seoDescription: translation.seoDescription,
        content: translation.content,
        excerpt: translation.excerpt,
        subtitle: translation.subtitle,
        coverAlt: translation.coverAlt,
        tags: translation.tags,
        sources: translation.sources,
        published: translation.published,
        publishedAt: translation.publishedAt?.toISOString(),
        sourceUpdatedAt: translation.sourceUpdatedAt.toISOString(),
        updatedAt: translation.updatedAt.toISOString(),
      }]] : []
    })
  )

  return (
    <div className="admin-edit-post-surface">
      <PostEditor
        post={{
          id: post._id.toString(),
          title: post.title,
          content: post.content,
          slug: post.slug,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          excerpt: post.excerpt,
          subtitle: post.subtitle,
          tags: post.tags,
          sources: post.sources,
          style: post.style,
          hiddenFromTimeline: post.hiddenFromTimeline,
          cover: post.cover,
          showCoverInTimeline: post.showCoverInTimeline,
          friendImage: post.friendImage,
          coAuthorUserId: post.coAuthorUserId,
          audioUrl: post.audioUrl,
          published: post.published,
          publishedAt: post.publishedAt?.toISOString(),
          originalContentUpdatedAt: getOriginalContentUpdatedAt(post).toISOString(),
          translations,
          themeIds: themes.map((theme) => theme._id.toString()),
        }}
      />
    </div>
  )
}
