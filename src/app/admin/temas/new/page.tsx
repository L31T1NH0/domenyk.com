import Link from "next/link"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { ThemeEditor } from "../../themes/ThemeEditor"

export default async function NewThemePage() {
  const { posts } = await getPosts({ includeUnpublished: true, limit: 200 })
  return <>
    <header className="admin-resource-header"><div><p><Link href="/admin/temas">Temas</Link> / Novo</p><h1>Novo tema</h1></div></header>
    <ThemeEditor posts={posts.map((post) => serializePostSummary(post, { includeUnpublishedTranslations: true }))} />
  </>
}
