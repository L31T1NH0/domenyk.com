import type { Metadata } from "next"
import { getNotes, serializeNote } from "@/lib/db/notes"
import { isAdmin } from "@/lib/auth"
import { Header } from "@/components/Header"
import { NotesTimeline } from "./NotesTimeline"
import { absoluteUrl, buildPageMetadata, jsonLd, siteConfig } from "@/lib/seo"
import { headers } from "next/headers"

export const metadata: Metadata = buildPageMetadata({
  title: "Notes",
  description: "Notas rápidas e registros curtos de Domenyk.",
  path: "/notes",
})

export default async function NotesPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined
  const admin = await isAdmin()
  const { notes, nextCursor } = await getNotes({ limit: 20 })
  const serializedNotes = notes.map(serializeNote)

  return (
    <>
      <Header />
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "@id": `${absoluteUrl("/notes")}#collection`,
            url: absoluteUrl("/notes"),
            name: "Notes",
            description: "Notas rápidas e registros curtos de Domenyk.",
            inLanguage: "pt-BR",
            publisher: { "@id": `${siteConfig.url}/#person` },
            mainEntity: {
              "@type": "ItemList",
              itemListElement: serializedNotes.map((note, index) => ({
                "@type": "ListItem",
                position: index + 1,
                url: absoluteUrl(`/notes/${note._id}`),
              })),
            },
          }),
        }}
      />
      <div className="flex flex-col gap-6">
        <h1 className="text-sm font-semibold text-[#A8A095] uppercase tracking-wider">Notes</h1>
        <NotesTimeline
        initialNotes={serializedNotes}
        initialCursor={nextCursor}
        isAdmin={admin}
      />
      </div>
    </>
  )
}
