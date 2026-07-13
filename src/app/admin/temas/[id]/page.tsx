import Link from "next/link"
import { notFound } from "next/navigation"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { getThemeById, serializeTheme } from "@/lib/db/themes"
import { ThemeEditor } from "../../themes/ThemeEditor"

export default async function EditThemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [theme, { posts }] = await Promise.all([getThemeById(id), getPosts({ includeUnpublished: true, limit: 200 })])
  if (!theme) notFound()
  return <>
    <header className="admin-resource-header"><div><p><Link href="/admin/temas">Temas</Link> / {theme.name}</p><h1>{theme.name}</h1></div>{theme.active && <Link className="admin-button-secondary" href={`/temas/${theme.slug}`} target="_blank">Ver no site</Link>}</header>
    <ThemeEditor theme={serializeTheme(theme)} posts={posts.map((post) => serializePostSummary(post, { includeUnpublishedTranslations: true }))} />
  </>
}
