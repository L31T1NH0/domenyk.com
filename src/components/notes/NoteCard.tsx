import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { SerializedNote } from "@/lib/db/notes"

type Props = {
  note: SerializedNote
  isAdmin?: boolean
  onDelete?: (id: string) => void
}

export function NoteCard({ note, isAdmin, onDelete }: Props) {
  const ago = formatDistanceToNow(new Date(note.publishedAt), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <article className="group flex flex-col gap-3 border-y border-white/10 py-5">
      <div className="flex items-center justify-between gap-3">
        <time className="text-xs text-[#A8A095]/75">{ago}</time>
        {isAdmin && onDelete && (
          <button
            onClick={() => onDelete(note._id)}
            className="text-xs text-[#A8A095]/50 opacity-100 transition-colors hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
          >
            deletar
          </button>
        )}
      </div>

      <div
        className="note-content text-[15px] leading-relaxed text-[#f1f1f1]"
        dangerouslySetInnerHTML={{ __html: note.contentHtml }}
      />

      {note.images && note.images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {note.images.map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              className="aspect-square w-full rounded-xl border border-white/10 object-cover"
            />
          ))}
        </div>
      )}
    </article>
  )
}
