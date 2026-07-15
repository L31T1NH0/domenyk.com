import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { ThemeEditor } from "../../themes/ThemeEditor"
import { AdminCommandHeader } from "../../AdminCommandHeader"

export default async function NewThemePage() {
  const { posts } = await getPosts({ includeUnpublished: true, limit: 200 })
  return <>
    <AdminCommandHeader title="Novo tema" description="Crie uma coleção e escolha os textos que farão parte dela." back={{ href: "/admin/temas", label: "Temas" }} />
    <ThemeEditor posts={posts.map((post) => serializePostSummary(post, { includeUnpublishedTranslations: true }))} />
  </>
}
