import Link from "next/link"
import { notFound } from "next/navigation"
import { getPosts, serializePostSummary } from "@/lib/db/posts"
import { getSeriesById, serializeSeries } from "@/lib/db/series"
import { SeriesEditor } from "@/components/series/SeriesEditor"
import { AdminCommandHeader } from "../../AdminCommandHeader"

export default async function EditSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [series, { posts }] = await Promise.all([
    getSeriesById(id),
    getPosts({ includeUnpublished: true, limit: 200 }),
  ])
  if (!series) notFound()
  return (
    <>
      <AdminCommandHeader
        title={series.title}
        description="Identidade, publicação e sequência dos capítulos."
        back={{ href: "/admin/series", label: "Séries" }}
        actions={series.published ? <Link className="admin-button-secondary" href={`/series/${series.slug}`} target="_blank">Ler série</Link> : undefined}
      />
      <SeriesEditor series={serializeSeries(series)} posts={posts.map((post) => serializePostSummary(post, { includeUnpublishedTranslations: true }))} />
    </>
  )
}
