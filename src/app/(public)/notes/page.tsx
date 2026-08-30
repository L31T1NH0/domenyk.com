import type { Metadata } from "next"
import { getNotes, serializeNote } from "@/lib/db/notes"
import { isAdmin } from "@/lib/auth"
import { Header } from "@/components/Header"
import { NotesTimeline } from "./NotesTimeline"
import { buildPageMetadata, jsonLd } from "@/lib/seo"
import { NOTES_COLLECTION_PATH, collectionMachineMetadata, contentCollectionJsonLd } from "@/lib/content-semantics"
import { headers } from "next/headers"

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Notas e threads",
    description: "Coleção de notas de Domenyk, incluindo notas autônomas e threads ordenadas de notas relacionadas.",
    path: NOTES_COLLECTION_PATH,
  }),
  other: collectionMachineMetadata("notes"),
}

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
          __html: jsonLd(contentCollectionJsonLd({ mode: "notes", notes: serializedNotes })),
        }}
      />
      <div className="flex flex-col gap-6">
        <h1 className="text-sm font-semibold text-[#A8A095] uppercase tracking-wider">Notas</h1>
        <NotesTimeline
        initialNotes={serializedNotes}
        initialCursor={nextCursor}
        isAdmin={admin}
      />
      </div>
    </>
  )
}
