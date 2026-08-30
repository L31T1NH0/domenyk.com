import type { Metadata } from "next"
import Link from "next/link"
import { cache } from "react"
import { notFound } from "next/navigation"
import { Header } from "@/components/Header"
import { BackHome } from "@/components/BackHome"
import { getNote, getNoteThread, serializeNote } from "@/lib/db/notes"
import { buildPageMetadata, descriptionFromMarkdown, isNoteIndexable, jsonLd, noteDisplayTitle, preferredContentImages, siteConfig } from "@/lib/seo"
import { noteMachineMetadata, notePageJsonLd } from "@/lib/content-semantics"
import { headers } from "next/headers"
import { NoteViewTracker } from "@/components/notes/NoteViewTracker"
import { NoteContentShell } from "@/components/notes/NoteContentShell"
import { PostDescriptionDisclosure } from "@/components/post/PostDescriptionDisclosure"
import { formatSiteDate } from "@/lib/datetime"
import { isAdmin } from "@/lib/auth"
import { NoteDetailAdminActions } from "@/components/notes/NoteDetailAdminActions"

type Props = { params: Promise<{ id: string }> }

const getCachedNotePageData = cache(async (id: string) => {
  const note = await getNote(id)
  if (!note) return null
  return { note, thread: await getNoteThread(note) }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await getCachedNotePageData(id)
  if (!data) return {}
  const { note, thread } = data
  const isThread = thread.length > 1

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
    type: "website",
    publishedTime: note.publishedAt.toISOString(),
    modifiedTime: (note.updatedAt ?? note.createdAt).toISOString(),
    noIndex: !indexable,
  })

  const typedMetadata = { ...metadata, other: noteMachineMetadata(isThread, thread.length) }
  return indexable ? typedMetadata : { ...typedMetadata, robots: { index: false, follow: true } }
}

export default async function NotePage({ params }: Props) {
  const nonce = (await headers()).get("x-nonce") ?? undefined
  const { id } = await params
  const [data, admin] = await Promise.all([getCachedNotePageData(id), isAdmin()])
  if (!data) notFound()
  const { note, thread } = data

  const serializedNote = serializeNote(note)
  const serializedThread = thread.map(serializeNote)
  const isThread = serializedThread.length > 1
  const visibleTitle = noteDisplayTitle(note)

  return (
    <>
      <Header />
      <NoteViewTracker noteId={serializedNote._id} />
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(notePageJsonLd(serializedThread, serializedNote._id)),
        }}
      />
      <section aria-label={isThread ? "Thread de notas" : "Nota"}>
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
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
          </div>
          {admin && <NoteDetailAdminActions noteId={serializedNote._id} />}
        </header>

        <ol className="m-0 list-none p-0">
          {serializedThread.map((threadNote, index) => {
            const isCurrent = threadNote._id === serializedNote._id
            const threadTitle = noteDisplayTitle(threadNote)
            return (
              <li key={threadNote._id}>
                <article className={[
                  "flex flex-col gap-4 border-neutral-200 dark:border-white/10",
                  !isThread
                    ? "py-6"
                    : index === 0
                      ? "pb-3 pt-6"
                      : index === serializedThread.length - 1
                        ? "pb-6 pt-3"
                        : "py-3",
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
                        {formatSiteDate(threadNote.publishedAt, { dateStyle: "long", timeStyle: "short", hourCycle: "h23" })}
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
                  <NoteContentShell
                    surface="detail"
                    html={threadNote.contentHtml}
                    className="text-[15px] leading-relaxed text-neutral-900 dark:text-[#f1f1f1]"
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
              publishedLabel={formatSiteDate(serializedNote.publishedAt, { dateStyle: "long" })}
              updatedLabel={formatSiteDate(serializedNote.updatedAt, { dateStyle: "long" })}
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
