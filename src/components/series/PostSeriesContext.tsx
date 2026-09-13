import Link from "next/link"
import type { Post } from "@/lib/db/posts"
import type { EditorialSeries } from "@/lib/db/series"

type Props = {
  series: EditorialSeries
  chapters: Post[]
  currentPostId: string
  placement: "before" | "after"
}

export function PostSeriesContext({ series, chapters, currentPostId, placement }: Props) {
  const currentIndex = chapters.findIndex((chapter) => chapter._id.toString() === currentPostId)
  if (currentIndex < 0) return null
  const currentPosition = currentIndex + 1
  const previous = chapters[currentIndex - 1]
  const next = chapters[currentIndex + 1]
  const seriesHref = `/series/${encodeURIComponent(series.slug)}`

  if (placement === "before") {
    return (
      <aside className="post-series-intro" aria-label="Este texto faz parte de uma série">
        <div>
          <span>Série · capítulo {String(currentPosition).padStart(2, "0")}</span>
          <Link href={seriesHref}>{series.title}</Link>
        </div>
        <span className="post-series-progress" aria-label={`${currentPosition} de ${chapters.length} capítulos`}>
          <span style={{ width: `${(currentPosition / chapters.length) * 100}%` }} />
        </span>
      </aside>
    )
  }

  return (
    <nav className="post-series-navigation" aria-label={`Navegação da série ${series.title}`}>
      <div className="post-series-navigation-heading">
        <span>Continue na série</span>
        <Link href={seriesHref}>Ler obra completa</Link>
      </div>
      <div className="post-series-navigation-grid">
        {previous ? (
          <Link href={`/posts/${encodeURIComponent(previous.slug)}`} rel="prev">
            <span>Capítulo anterior</span>
            <strong>{previous.title}</strong>
          </Link>
        ) : <span aria-hidden />}
        {next ? (
          <Link href={`/posts/${encodeURIComponent(next.slug)}`} rel="next">
            <span>Próximo capítulo</span>
            <strong>{next.title}</strong>
          </Link>
        ) : (
          <Link href={seriesHref}>
            <span>Você chegou ao capítulo mais recente</span>
            <strong>Rever a série completa</strong>
          </Link>
        )}
      </div>
    </nav>
  )
}
