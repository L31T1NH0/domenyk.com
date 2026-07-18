"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { NoteCard } from "@/components/notes/NoteCard"
import { NoteComposer } from "@/components/notes/NoteComposer"
import type { SerializedNote } from "@/lib/db/notes"
import { groupNotesByThread, mergeNotesById } from "@/lib/note-thread"
import { NoteTimelineGroup } from "@/components/notes/NoteTimelineGroup"

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
  const router = useRouter()
  const composerRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState(initialNotes)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [threadParent, setThreadParent] = useState<SerializedNote | null>(null)
  const [linkingNoteId, setLinkingNoteId] = useState<string | null>(null)
  const noteGroups = useMemo(() => groupNotesByThread(notes), [notes])

  function handlePosted(note: SerializedNote) {
    setError("")
    setNotes((prev) => [
      note,
      ...prev.map((existing) => (
        threadParent && existing._id === threadParent._id && !existing.thread && note.thread
          ? { ...existing, thread: { rootId: existing._id, position: 1 } }
          : existing
      )),
    ])
    setThreadParent(null)
  }

  function handleContinueThread(note: SerializedNote) {
    setError("")
    setThreadParent(note)
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  async function handleLinkToThread(note: SerializedNote) {
    if (!threadParent || linkingNoteId) return
    setLinkingNoteId(note._id)
    setError("")

    try {
      const response = await fetch(`/api/admin/notes/${note._id}/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceNoteId: threadParent._id }),
      })
      const data = await response.json().catch(() => null) as { error?: string; thread?: SerializedNote[] } | null
      if (!response.ok || !Array.isArray(data?.thread)) {
        throw new Error(data?.error ?? "Não foi possível linkar a nota à thread.")
      }
      setNotes((current) => mergeNotesById(current, data.thread!))
      setThreadParent(null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível linkar a nota à thread.")
    } finally {
      setLinkingNoteId(null)
    }
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
      const data = await response.json().catch(() => null) as { thread?: SerializedNote[] } | null
      setNotes((prev) => {
        const removed = prev.find((note) => note._id === id)
        const replacements = new Map((data?.thread ?? []).map((note) => [note._id, note]))
        return prev
          .filter((note) => note._id !== id)
          .map((note) => removed?.thread?.rootId === note.thread?.rootId
            ? replacements.get(note._id) ?? note
            : note)
      })
      if (threadParent?._id === id) setThreadParent(null)
      router.refresh()
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
      setNotes((prev) => mergeNotesById(prev, loadedNotes))
      setCursor(data.nextCursor ?? null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar mais notas.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {(isAdmin || showComposer) && (
        <div ref={composerRef}>
          <NoteComposer
            onPosted={handlePosted}
            threadParent={threadParent}
            onCancelThread={() => setThreadParent(null)}
          />
        </div>
      )}
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
          noteGroups.map((group) => (
            <NoteTimelineGroup key={group[0].thread?.rootId ?? group[0]._id} notes={group}>
              {(note, placement, threadSize) => (
                <NoteCard
                  note={note}
                  showMetadata
                  viewContext="notes"
                  isAdmin={isAdmin}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  onContinueThread={isAdmin ? handleContinueThread : undefined}
                  deleting={deletingId === note._id}
                  cropTallImages
                  timelineThreadPlacement={placement}
                  timelineThreadSize={threadSize}
                  showThreadLabel={group.length === 1}
                  threadLinkSource={threadParent}
                  onLinkToThread={handleLinkToThread}
                  onCancelThreadLink={() => setThreadParent(null)}
                  linkingToThread={linkingNoteId === note._id}
                />
              )}
            </NoteTimelineGroup>
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
