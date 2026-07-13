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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")

  function handlePosted(note: SerializedNote) {
    setError("")
    setNotes((prev) => [note, ...prev])
  }

  async function handleDelete(id: string) {
    if (deletingId) return
    setDeletingId(id)
    setError("")

    try {
      const response = await fetch(`/api/admin/notes/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? "Não foi possível deletar a nota.")
      }
      setNotes((prev) => prev.filter((note) => note._id !== id))
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Não foi possível deletar a nota."
      setError(message)
      throw new Error(message)
    } finally {
      setDeletingId(null)
    }
  }

  function handleUpdate(updatedNote: SerializedNote) {
    setError("")
    setNotes((prev) => prev.map((note) => note._id === updatedNote._id ? updatedNote : note))
  }

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/notes?cursor=${encodeURIComponent(cursor)}`)
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? "Não foi possível carregar mais notas.")
      }

      const data = await response.json() as { notes?: SerializedNote[]; nextCursor?: string | null }
      if (!Array.isArray(data.notes)) throw new Error("A resposta das notas é inválida.")

      const loadedNotes = data.notes
      setNotes((prev) => [...prev, ...loadedNotes])
      setCursor(data.nextCursor ?? null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar mais notas.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {(isAdmin || showComposer) && <NoteComposer onPosted={handlePosted} />}
      {!isAdmin && !showComposer && showAdminHint && (
        <div className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 dark:border-white/10 dark:text-[#c2bbb1]">
          Entre com a conta admin para escrever uma nota.
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div>
        {notes.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Nenhuma nota publicada ainda.</p>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              showMetadata
              viewContext="notes"
              isAdmin={isAdmin}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              deleting={deletingId === note._id}
              cropTallImages
            />
          ))
        )}
      </div>

      {cursor && (
        <button
          onClick={loadMore}
          disabled={loading}
          aria-live="polite"
          className="min-h-10 self-center rounded-md px-3 text-sm text-neutral-600 transition-colors hover:bg-neutral-950/5 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-wait disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100 dark:focus-visible:ring-neutral-300"
        >
          {loading ? "Carregando..." : "Carregar mais"}
        </button>
      )}
    </div>
  )
}
