import Link from "next/link"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { PostsTable } from "./PostsTable"

export default async function AdminPostsPage() {
  const { posts } = await getPosts({ includeUnpublished: true, limit: 100 })
  const serializedPosts = posts.map((post) => (
    serializePostSummary(post, { includeUnpublishedTranslations: true })
  ))

  return (
    <>
      <header className="admin-page-header">
        <div><h1>Posts</h1><p>Escreva, publique e acompanhe seu acervo editorial.</p></div>
        <Link
          href="/admin/posts/new"
          className="admin-button-primary"
        >
          Novo post
        </Link>
      </header>
      <PostsTable posts={serializedPosts} />
    </>
  )
}
