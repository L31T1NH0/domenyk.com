import type { Metadata } from "next"
import Link from "next/link"
import { cache } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { notFound } from "next/navigation"
import { Header } from "@/components/Header"
import { BackHome } from "@/components/BackHome"
import { getNote, getNoteThread, serializeNote } from "@/lib/db/notes"
import { absoluteUrl, authorJsonLd, buildPageMetadata, descriptionFromMarkdown, isNoteIndexable, jsonLd, noteDisplayTitle, preferredContentImages, siteConfig } from "@/lib/seo"
import { headers } from "next/headers"
import { NoteViewTracker } from "@/components/notes/NoteViewTracker"
import { PostDescriptionDisclosure } from "@/components/post/PostDescriptionDisclosure"

type Props = { params: Promise<{ id: string }> }

const getCachedNote = cache(getNote)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const note = await getCachedNote(id)
  if (!note) return {}

  const indexable = isNoteIndexable(note)
  const visibleTitle = noteDisplayTitle(note)
  const title = note.seoTitle?.trim() || visibleTitle
  const description = note.seoDescription?.trim() || descriptionFromMarkdown(note.content) || siteConfig.description
  const [image] = preferredContentImages({
    images: note.images,
    markdown: note.content,
  })

  const metadata = buildPageMetadata({
    title,
    description,
    path: `/notes/${note._id.toString()}`,
    image: image ?? siteConfig.image,
    type: "article",
    publishedTime: note.publishedAt.toISOString(),
    modifiedTime: (note.updatedAt ?? note.createdAt).toISOString(),
    noIndex: !indexable,
  })

  return indexable ? metadata : { ...metadata, robots: { index: false, follow: true } }
}

export default async function NotePage({ params }: Props) {
  const nonce = (await headers()).get("x-nonce") ?? undefined
  const { id } = await params
  const note = await getCachedNote(id)
  if (!note) notFound()

  const serializedNote = serializeNote(note)
  const serializedThread = (await getNoteThread(note)).map(serializeNote)
  const isThread = serializedThread.length > 1
  const threadRootUrl = absoluteUrl(`/notes/${serializedThread[0]._id}`)
  const visibleTitle = noteDisplayTitle(note)
  const noteUrl = absoluteUrl(`/notes/${serializedNote._id}`)
  const description = note.seoDescription?.trim() || descriptionFromMarkdown(serializedNote.content) || siteConfig.description
  const noteImages = preferredContentImages({
    images: serializedNote.images,
    markdown: serializedNote.content,
  })
  const structuredImages = (noteImages.length > 0 ? noteImages : [siteConfig.image]).map(absoluteUrl)

  return (
    <>
      <Header />
      <NoteViewTracker noteId={serializedNote._id} />
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BlogPosting",
                "@id": `${noteUrl}#article`,
                mainEntityOfPage: noteUrl,
                headline: visibleTitle,
                description,
                image: structuredImages,
                datePublished: serializedNote.publishedAt,
                dateModified: serializedNote.updatedAt,
                author: authorJsonLd(),
                publisher: { "@id": `${siteConfig.url}/#person` },
                inLanguage: "pt-BR",
                isAccessibleForFree: true,
                ...(isThread ? { isPartOf: { "@id": `${threadRootUrl}#thread` } } : {}),
              },
              ...(isThread ? [{
                "@type": "ItemList",
                "@id": `${threadRootUrl}#thread`,
                name: `Thread de ${serializedThread.length} notas`,
                itemListOrder: "https://schema.org/ItemListOrderAscending",
                itemListElement: serializedThread.map((threadNote, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  url: absoluteUrl(`/notes/${threadNote._id}`),
                  name: noteDisplayTitle(threadNote),
                })),
              }] : []),
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
                  { "@type": "ListItem", position: 2, name: "Notas", item: absoluteUrl("/notes") },
                  { "@type": "ListItem", position: 3, name: visibleTitle, item: noteUrl },
                ],
              },
            ],
          }),
        }}
      />
      <section aria-label={isThread ? "Thread de notas" : "Nota"}>
        <header className="mb-4">
          <h1 className={isThread || note.title || note.seoTitle ? "text-balance text-lg font-semibold leading-snug text-neutral-950 dark:text-[#f1f1f1]" : "sr-only"}>
            {isThread
              ? serializedThread[0].title || serializedThread[0].seoTitle || "Thread de notas"
              : visibleTitle}
          </h1>
          {isThread && (
            <p className="mt-2 text-xs text-neutral-600 dark:text-[#c2bbb1]">
              {serializedThread.length} notas na thread
            </p>
          )}
        </header>

        <ol className="m-0 list-none p-0">
          {serializedThread.map((threadNote, index) => {
            const isCurrent = threadNote._id === serializedNote._id
            const threadTitle = noteDisplayTitle(threadNote)
            return (
              <li key={threadNote._id}>
                <article className={[
                  "flex flex-col gap-4 border-neutral-200 py-6 dark:border-white/10",
                  index === 0 ? "border-t" : "",
                  !isThread || index === serializedThread.length - 1 ? "border-b" : "",
                ].filter(Boolean).join(" ")}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {isThread && (
                      <span className="text-xs font-medium text-neutral-700 dark:text-[#d8d4ce]">
                        {index + 1} de {serializedThread.length}
                      </span>
                    )}
                    <Link
                      href={`/notes/${threadNote._id}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className="rounded text-xs text-neutral-500 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#A8A095]/80 dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
                    >
                      <time dateTime={threadNote.publishedAt}>
                        {format(new Date(threadNote.publishedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
                      </time>
                    </Link>
                    {isCurrent && isThread && <span className="text-xs text-neutral-500 dark:text-[#A8A095]/80">nota aberta</span>}
                  </div>

                  {threadNote.title && isThread && index > 0 && (
                    <h2 className="text-[15px] font-semibold leading-snug text-neutral-950 dark:text-[#f1f1f1]">
                      <Link href={`/notes/${threadNote._id}`} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:focus-visible:ring-neutral-300">
                        {threadNote.title}
                      </Link>
                    </h2>
                  )}
                  <div
                    className="note-content text-[15px] leading-relaxed text-neutral-900 dark:text-[#f1f1f1]"
                    dangerouslySetInnerHTML={{ __html: threadNote.contentHtml }}
                  />
                  {threadNote.images && threadNote.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {threadNote.images.map((url, imageIndex) => (
                        <img
                          key={url}
                          src={url}
                          alt={`Imagem ${imageIndex + 1}: ${threadTitle}`}
                          className="aspect-square w-full rounded-xl border border-neutral-200 object-cover dark:border-white/10"
                        />
                      ))}
                    </div>
                  )}
                </article>
              </li>
            )
          })}
        </ol>

        {(note.seoTitle?.trim() || note.seoDescription?.trim()) && (
          <div className="mt-4">
            <PostDescriptionDisclosure
              seoTitle={note.seoTitle}
              seoDescription={note.seoDescription}
              tags={[]}
              themes={[]}
              sources={[]}
              publishedLabel={format(new Date(serializedNote.publishedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              updatedLabel={format(new Date(serializedNote.updatedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              labels={{ subtitle: "Descrição", excerpt: "Resumo", seoTitle: "Título SEO", seoDescription: "Descrição SEO", themes: "Temas", tags: "Tags", sources: "Fontes", dates: "Datas", published: "Publicado em", updated: "Atualizado em" }}
              showLabel="ver detalhes"
              hideLabel="ocultar detalhes"
            />
          </div>
        )}
      </section>
      <BackHome />
    </>
  )
}
