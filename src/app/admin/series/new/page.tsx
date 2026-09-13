import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { SeriesEditor } from "@/components/series/SeriesEditor"
import { AdminCommandHeader } from "../../AdminCommandHeader"

export default async function NewSeriesPage() {
  const { posts } = await getPosts({ includeUnpublished: true, limit: 200 })
  return (
    <>
      <AdminCommandHeader title="Nova série" description="Defina a obra e escolha os primeiros capítulos." back={{ href: "/admin/series", label: "Séries" }} />
      <SeriesEditor posts={posts.map((post) => serializePostSummary(post, { includeUnpublishedTranslations: true }))} />
    </>
  )
}
