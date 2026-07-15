import Link from "next/link"
import { notFound } from "next/navigation"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { getThemeById, serializeTheme } from "@/lib/db/themes"
import { ThemeEditor } from "../../themes/ThemeEditor"
import { AdminCommandHeader } from "../../AdminCommandHeader"

export default async function EditThemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [theme, { posts }] = await Promise.all([getThemeById(id), getPosts({ includeUnpublished: true, limit: 200 })])
  if (!theme) notFound()
  return <>
    <AdminCommandHeader title={theme.name} description="Identidade, publicação e ordem editorial da coleção." back={{ href: "/admin/temas", label: "Temas" }} actions={theme.active ? <Link className="admin-button-secondary" href={`/temas/${theme.slug}`} target="_blank">Ver no site</Link> : undefined} />
    <ThemeEditor theme={serializeTheme(theme)} posts={posts.map((post) => serializePostSummary(post, { includeUnpublishedTranslations: true }))} />
  </>
}
