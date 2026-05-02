"use client"

import { useState } from "react"
import { NoteCard } from "@/components/notes/NoteCard"
import { NoteComposer } from "@/components/notes/NoteComposer"
import type { SerializedNote } from "@/lib/db/notes"

type Props = {
  initialNotes: SerializedNote[]
  initialCursor: string | null
  isAdmin: boolean
  showComposer?: boolean
  showAdminHint?: boolean
}

export function NotesTimeline({
  initialNotes,
  initialCursor,
  isAdmin,
  showComposer = false,
  showAdminHint = false,
}: Props) {
  const [notes, setNotes] = useState(initialNotes)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)

  function handlePosted(note: unknown) {
    setNotes((prev) => [note as SerializedNote, ...prev])
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/notes/${id}`, { method: "DELETE" })
    setNotes((prev) => prev.filter((n) => n._id !== id))
  }

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    const res = await fetch(`/api/notes?cursor=${cursor}`)
    const data = await res.json()
    setNotes((prev) => [...prev, ...data.notes])
    setCursor(data.nextCursor)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {(isAdmin || showComposer) && <NoteComposer onPosted={handlePosted} />}
      {!isAdmin && !showComposer && showAdminHint && (
        <div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-[#A8A095]">
          Entre com a conta admin para escrever uma nota.
        </div>
      )}

      <div>
        {notes.map((note) => (
          <NoteCard
            key={note._id}
            note={note}
            isAdmin={isAdmin}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {cursor && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-40 self-center"
        >
          {loading ? "carregando..." : "carregar mais"}
        </button>
      )}
    </div>
  )
}
