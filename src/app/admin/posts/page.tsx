import { loadAdminPostsPage } from "./data"
import { PostsWorkspace } from "./PostsWorkspace"
export const metadata = { title: "Posts" }
export default async function AdminPostsPage() {
  const { posts } = await loadAdminPostsPage()
  return <PostsWorkspace posts={posts} />
}
