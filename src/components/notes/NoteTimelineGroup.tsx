import type { ReactNode } from "react"
import type { SerializedNote } from "@/lib/db/notes"

export type NoteTimelinePlacement = "only" | "first" | "middle" | "last"

type Props = {
  notes: SerializedNote[]
  children: (note: SerializedNote, placement: NoteTimelinePlacement, threadSize: number) => ReactNode
}

export function NoteTimelineGroup({ notes, children }: Props) {
  const connected = notes.length > 1

  return (
    <div
      role={connected ? "group" : undefined}
      aria-label={connected ? `Thread com ${notes.length} notas` : undefined}
      data-note-thread={connected ? "true" : undefined}
    >
      {notes.map((note, index) => {
        const placement: NoteTimelinePlacement = notes.length === 1
          ? "only"
          : index === 0
            ? "first"
            : index === notes.length - 1
              ? "last"
              : "middle"

        return (
          <div key={note._id}>
            {children(note, placement, notes.length)}
          </div>
        )
      })}
    </div>
  )
}
