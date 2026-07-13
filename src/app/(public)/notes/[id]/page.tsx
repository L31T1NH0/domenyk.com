import type { Metadata } from "next"
import { cache } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { notFound } from "next/navigation"
import { Header } from "@/components/Header"
import { BackHome } from "@/components/BackHome"
import { getNote, serializeNote } from "@/lib/db/notes"
import { absoluteUrl, authorJsonLd, buildPageMetadata, descriptionFromMarkdown, isNoteIndexable, jsonLd, noteDisplayTitle, preferredContentImages, siteConfig } from "@/lib/seo"
import { headers } from "next/headers"
import { NoteViewTracker } from "@/components/notes/NoteViewTracker"

type Props = { params: Promise<{ id: string }> }

const getCachedNote = cache(getNote)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const note = await getCachedNote(id)
  if (!note) return {}

  const indexable = isNoteIndexable(note)
  const title = note.seoTitle?.trim() || noteDisplayTitle(note)
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
  const title = note.seoTitle?.trim() || noteDisplayTitle(note)
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
      <NoteViewTracker noteId={serializedNote._id} minimumVisibleMs={serializedNote.readingEstimate.directViewThresholdMs} />
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
                headline: title,
                description,
                image: structuredImages,
                datePublished: serializedNote.publishedAt,
                dateModified: serializedNote.updatedAt,
                author: authorJsonLd(),
                publisher: { "@id": `${siteConfig.url}/#person` },
                inLanguage: "pt-BR",
                isAccessibleForFree: true,
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: absoluteUrl("/") },
                  { "@type": "ListItem", position: 2, name: "Notas", item: absoluteUrl("/notes") },
                  { "@type": "ListItem", position: 3, name: title, item: noteUrl },
                ],
              },
            ],
          }),
        }}
      />
      <article className="flex flex-col gap-4 border-y border-neutral-200 py-6 dark:border-white/10">
        <h1 className={note.title || note.seoTitle ? "text-balance text-lg font-semibold leading-snug text-neutral-950 dark:text-[#f1f1f1]" : "sr-only"}>
          {title}
        </h1>
        {note.seoDescription?.trim() && (
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-[#c2bbb1]">{note.seoDescription.trim()}</p>
        )}
        <time className="text-xs text-neutral-500 dark:text-[#A8A095]/75" dateTime={serializedNote.publishedAt}>
          {format(new Date(serializedNote.publishedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
        </time>
        <div
          className="note-content text-[15px] leading-relaxed text-neutral-900 dark:text-[#f1f1f1]"
          dangerouslySetInnerHTML={{ __html: serializedNote.contentHtml }}
        />
        {serializedNote.images && serializedNote.images.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {serializedNote.images.map((url, index) => (
              <img
                key={url}
                src={url}
                alt={`Imagem ${index + 1}: ${title}`}
                className="aspect-square w-full rounded-xl border border-neutral-200 object-cover dark:border-white/10"
              />
            ))}
          </div>
        )}
      </article>
      <BackHome />
    </>
  )
}
