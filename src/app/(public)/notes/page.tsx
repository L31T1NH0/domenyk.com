import type { Metadata } from "next"
import { getNotes, serializeNote } from "@/lib/db/notes"
import { isAdmin } from "@/lib/auth"
import { Header } from "@/components/Header"
import { NotesTimeline } from "./NotesTimeline"

export const metadata: Metadata = { title: "Notes" }

export default async function NotesPage() {
  const admin = await isAdmin()
  const { notes, nextCursor } = await getNotes({ limit: 20 })
  const serializedNotes = notes.map(serializeNote)

  return (
    <>
      <Header />
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
