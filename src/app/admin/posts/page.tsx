import Link from "next/link"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { PostsTable } from "./PostsTable"
import { AdminCommandHeader } from "../AdminCommandHeader"

export default async function AdminPostsPage() {
  const { posts } = await getPosts({ includeUnpublished: true, limit: 100 })
  const serializedPosts = posts.map((post) => (
    serializePostSummary(post, { includeUnpublishedTranslations: true })
  ))

  return (
    <>
      <AdminCommandHeader
        title="Posts"
        description="Escreva, publique e acompanhe seu acervo editorial."
        actions={<Link href="/admin/posts/new" className="admin-button-primary">Novo post</Link>}
      />
      <PostsTable posts={serializedPosts} />
    </>
  )
}
