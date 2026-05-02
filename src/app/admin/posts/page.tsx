import Link from "next/link"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { PostsTable } from "./PostsTable"

export default async function AdminPostsPage() {
  const { posts } = await getPosts({ includeUnpublished: true, limit: 100 })
  const serializedPosts = posts.map(serializePostSummary)

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Conteúdo</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Posts</h1>
        </div>
        <Link
          href="/admin/posts/new"
          className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
        >
          Novo post
        </Link>
      </div>
      <PostsTable posts={serializedPosts} />
    </>
  )
}
