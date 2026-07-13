"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { SerializedNote } from "@/lib/db/notes"

type Props = { notes: SerializedNote[] }

export function AdminNotesTable({ notes: initial }: Props) {
  const [notes, setNotes] = useState(initial)

  async function remove(id: string) {
    if (!window.confirm("Deletar esta nota? Esta ação não pode ser desfeita.")) return
    await fetch(`/api/admin/notes/${id}`, { method: "DELETE" })
    setNotes((prev) => prev.filter((n) => n._id !== id))
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-900 dark:bg-neutral-950">
      <div className="border-b border-neutral-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:border-neutral-900">
        Notas
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
      {notes.map((note) => (
        <div key={note._id} className="flex gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3 break-words text-sm sm:truncate">{note.content}</p>
            <time className="text-xs text-neutral-400">
              {formatDistanceToNow(new Date(note.publishedAt), { addSuffix: true, locale: ptBR })}
            </time>
          </div>
          <button onClick={() => remove(note._id)} aria-label="Excluir nota" className="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300">
            Excluir
          </button>
        </div>
      ))}
      {notes.length === 0 && <p className="px-4 py-10 text-center text-sm text-neutral-500">Nenhuma nota publicada.</p>}
      </div>
    </div>
  )
}
