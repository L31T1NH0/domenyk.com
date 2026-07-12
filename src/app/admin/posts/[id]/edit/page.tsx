import { notFound } from "next/navigation"
import { PostEditor } from "@/components/editor/PostEditor"
import { getDb } from "@/lib/db/client"
import type { Post } from "@/lib/db/posts"
import { getOriginalContentUpdatedAt } from "@/lib/db/posts"
import { TRANSLATION_LOCALES } from "@/lib/post-locales"
import { toObjectId } from "@/lib/validation"

type Props = { params: Promise<{ id: string }> }

export default async function EditPostPage({ params }: Props) {
  const { id } = await params
  const objectId = toObjectId(id)
  if (!objectId) notFound()

  const db = await getDb()
  const post = await db.collection<Post>("posts").findOne({ _id: objectId })
  if (!post) notFound()

  const translations = Object.fromEntries(
    TRANSLATION_LOCALES.flatMap((locale) => {
      const translation = post.translations?.[locale]
      return translation ? [[locale, {
        title: translation.title,
        content: translation.content,
        excerpt: translation.excerpt,
        subtitle: translation.subtitle,
        coverAlt: translation.coverAlt,
        tags: translation.tags,
        published: translation.published,
        publishedAt: translation.publishedAt?.toISOString(),
        sourceUpdatedAt: translation.sourceUpdatedAt.toISOString(),
        updatedAt: translation.updatedAt.toISOString(),
      }]] : []
    })
  )

  return (
    <PostEditor
      post={{
        id: post._id.toString(),
        title: post.title,
        content: post.content,
        slug: post.slug,
        excerpt: post.excerpt,
        subtitle: post.subtitle,
        tags: post.tags,
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
      }}
    />
  )
}
