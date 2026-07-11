import type { Metadata } from "next"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { notFound } from "next/navigation"
import { Header } from "@/components/Header"
import { BackHome } from "@/components/BackHome"
import { getNote, serializeNote } from "@/lib/db/notes"
import { absoluteUrl, buildPageMetadata, descriptionFromMarkdown, jsonLd, preferredContentImages, siteConfig } from "@/lib/seo"
import { headers } from "next/headers"

type Props = { params: Promise<{ id: string }> }

function noteTitle(publishedAt: Date) {
  return `Nota de ${format(publishedAt, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const note = await getNote(id)
  if (!note) return {}

  const title = noteTitle(note.publishedAt)
  const description = descriptionFromMarkdown(note.content) || siteConfig.description
  const [image] = preferredContentImages({
    images: note.images,
    markdown: note.content,
  })

  return buildPageMetadata({
    title,
    description,
    path: `/notes/${note._id.toString()}`,
    image: image ?? siteConfig.image,
    type: "article",
    publishedTime: note.publishedAt.toISOString(),
    modifiedTime: (note.updatedAt ?? note.createdAt).toISOString(),
  })
}

export default async function NotePage({ params }: Props) {
  const nonce = (await headers()).get("x-nonce") ?? undefined
  const { id } = await params
  const note = await getNote(id)
  if (!note) notFound()

  const serializedNote = serializeNote(note)
  const title = noteTitle(note.publishedAt)
  const noteUrl = absoluteUrl(`/notes/${serializedNote._id}`)
  const description = descriptionFromMarkdown(serializedNote.content) || siteConfig.description
  const noteImages = preferredContentImages({
    images: serializedNote.images,
    markdown: serializedNote.content,
  })
  const structuredImages = (noteImages.length > 0 ? noteImages : [siteConfig.image]).map(absoluteUrl)

  return (
    <>
      <Header />
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "@id": `${noteUrl}#article`,
            mainEntityOfPage: noteUrl,
            headline: title,
            description,
            image: structuredImages,
            datePublished: serializedNote.publishedAt,
            dateModified: serializedNote.updatedAt,
            author: { "@id": `${siteConfig.url}/#person` },
            publisher: { "@id": `${siteConfig.url}/#person` },
            inLanguage: "pt-BR",
            isAccessibleForFree: true,
          }),
        }}
      />
      <article className="flex flex-col gap-4 border-y border-neutral-200 py-6 dark:border-white/10">
        <time className="text-xs text-neutral-500 dark:text-[#A8A095]/75" dateTime={serializedNote.publishedAt}>
          {format(new Date(serializedNote.publishedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
        </time>
        <div
          className="note-content text-[15px] leading-relaxed text-neutral-900 dark:text-[#f1f1f1]"
          dangerouslySetInnerHTML={{ __html: serializedNote.contentHtml }}
        />
        {serializedNote.images && serializedNote.images.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {serializedNote.images.map((url) => (
              <img
                key={url}
                src={url}
                alt=""
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
