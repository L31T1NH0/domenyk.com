import { notFound } from "next/navigation"
import { PostEditor } from "@/components/editor/PostEditor"
import { getDb } from "@/lib/db/client"
import type { Post } from "@/lib/db/posts"
import { toObjectId } from "@/lib/validation"

type Props = { params: Promise<{ id: string }> }

export default async function EditPostPage({ params }: Props) {
  const { id } = await params
  const objectId = toObjectId(id)
  if (!objectId) notFound()

  const db = await getDb()
  const post = await db.collection<Post>("posts").findOne({ _id: objectId })
  if (!post) notFound()

  return (
    <PostEditor
      post={{
        id: post._id.toString(),
        title: post.title,
        content: post.content,
        slug: post.slug,
        excerpt: post.excerpt,
        tags: post.tags,
        style: post.style,
        hiddenFromTimeline: post.hiddenFromTimeline,
        cover: post.cover,
        showCoverInTimeline: post.showCoverInTimeline,
        friendImage: post.friendImage,
        coAuthorUserId: post.coAuthorUserId,
        audioUrl: post.audioUrl,
      }}
    />
  )
}
