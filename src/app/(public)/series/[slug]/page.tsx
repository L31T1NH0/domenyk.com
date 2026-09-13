import type { Metadata } from "next"
import Link from "next/link"
import { cache } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { Header } from "@/components/Header"
import { PostContentShell } from "@/components/post/PostContentShell"
import { PostReadingPosition } from "@/components/post/PostReadingPosition"
import { BackHome } from "@/components/BackHome"
import { getSeriesBySlug, getSeriesChapters } from "@/lib/db/series"
import { isAdmin } from "@/lib/auth"
import { renderMarkdown } from "@/lib/mdx"
import { absoluteUrl, authorJsonLd, buildPageMetadata, jsonLd, siteConfig } from "@/lib/seo"
import { formatSiteDate } from "@/lib/datetime"

type Props = { params: Promise<{ slug: string }> }

function decodeSlug(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return ""
  }
}

const findSeries = cache(async (slug: string) => {
  const admin = await isAdmin()
  const series = await getSeriesBySlug(slug, { publishedOnly: !admin })
  return { admin, series }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeSlug((await params).slug)
  if (!slug || slug.length > 100) return {}
  const { series } = await findSeries(slug)
  if (!series) return {}
  return buildPageMetadata({
    title: series.title,
    description: series.description,
    path: `/series/${series.slug}`,
    noIndex: !series.published,
  })
}

export default async function SeriesPage({ params }: Props) {
  const slug = decodeSlug((await params).slug)
  if (!slug || slug.length > 100) notFound()
  const { admin, series } = await findSeries(slug)
  if (!series) notFound()
  const chapters = await getSeriesChapters(series, { includeUnpublished: admin })
  const renderedChapters = await Promise.all(chapters.map(async (chapter) => ({
    chapter,
    html: await renderMarkdown(chapter.content, {
      defaultImageAlt: `Imagem relacionada a “${chapter.title}”`,
    }),
  })))
  const totalReadingTime = chapters.reduce((total, chapter) => total + chapter.readingTimeMinutes, 0)
  const publishedChapters = chapters.filter((chapter) => chapter.published)
  const url = absoluteUrl(`/series/${series.slug}`)
  const nonce = (await headers()).get("x-nonce") ?? undefined

  return (
    <div className="series-reading-page">
      <Header />
      <script
        nonce={nonce}
        suppressHydrationWarning
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "CollectionPage",
                "@id": `${url}#series`,
                url,
                name: series.title,
                description: series.description,
                inLanguage: "pt-BR",
                author: authorJsonLd(),
                publisher: { "@id": `${siteConfig.url}/#person` },
                mainEntity: {
                  "@type": "ItemList",
                  itemListElement: publishedChapters.map((chapter, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    name: chapter.title,
                    url: absoluteUrl(`/posts/${encodeURIComponent(chapter.slug)}`),
                  })),
                },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
                  { "@type": "ListItem", position: 2, name: series.title, item: url },
                ],
              },
            ],
          }),
        }}
      />

      <header className="series-reading-header">
        <span>Série em andamento</span>
        <h1>{series.title}</h1>
        <p>{series.description}</p>
        <dl>
          <div><dt>Capítulos</dt><dd>{chapters.length}</dd></div>
          <div><dt>Leitura</dt><dd>{totalReadingTime} min</dd></div>
          <div><dt>Atualizada</dt><dd>{formatSiteDate(series.updatedAt, { dateStyle: "medium" })}</dd></div>
        </dl>
        {!series.published && <p className="series-draft-label">Prévia administrativa · série ainda não publicada</p>}
      </header>

      <div className="series-reading-layout">
        <nav className="series-table-of-contents" aria-label="Capítulos da série">
          <p>Índice</p>
          <ol>
            {chapters.map((chapter, index) => (
              <li key={chapter._id.toString()}>
                <a href={`#capitulo-${index + 1}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{chapter.title}</span>
                  {!chapter.published && <small>rascunho</small>}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div data-post-content className="series-chapters">
          {renderedChapters.map(({ chapter, html }, index) => (
            <article key={chapter._id.toString()} id={`capitulo-${index + 1}`} className="series-chapter">
              <header>
                <span>Capítulo {String(index + 1).padStart(2, "0")}</span>
                <h2>{chapter.title}</h2>
                <div>
                  {chapter.publishedAt && <time dateTime={chapter.publishedAt.toISOString()}>{formatSiteDate(chapter.publishedAt, { dateStyle: "long" })}</time>}
                  <span>{chapter.readingTimeMinutes} min</span>
                  {!chapter.published && <span>rascunho</span>}
                </div>
              </header>
              <PostContentShell html={html} />
              <footer>
                <Link href={`/posts/${encodeURIComponent(chapter.slug)}`}>Abrir capítulo, comentários e detalhes</Link>
              </footer>
            </article>
          ))}
          {chapters.length === 0 && <p className="series-empty">Esta série ainda não tem capítulos publicados.</p>}
        </div>
      </div>

      {chapters.length > 0 && <PostReadingPosition postId={`series:${series.publicId}`} updatedAt={series.updatedAt.toISOString()} />}
      <div id="series-content-boundary" className="series-reading-end">Fim da edição atual · novos capítulos aparecerão nesta mesma página.</div>
      <BackHome boundaryId="series-content-boundary" label="Voltar para a página inicial" />
      {admin && <Link href={`/admin/series/${series._id.toString()}`} className="series-admin-link">Editar série</Link>}
    </div>
  )
}
