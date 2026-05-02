"use client"

import { useEffect, useRef, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { ChatBubbleLeftEllipsisIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { SerializedNote } from "@/lib/db/notes"

type Comment = {
  _id: string
  authorName: string
  authorImageUrl: string
  authorId: string
  content: string
  createdAt: string
}

type Props = {
  note: SerializedNote
  isAdmin?: boolean
  onDelete?: (id: string) => void
}

type NoteCommentsPanelProps = {
  noteId: string
  comments: Comment[]
  isAdmin?: boolean
  onCommentsChange: (comments: Comment[]) => void
  onClose: () => void
}

function NoteCommentsPanel({ noteId, comments, isAdmin, onCommentsChange, onClose }: NoteCommentsPanelProps) {
  const { user } = useUser()
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function submit() {
    if (!draft.trim() || submitting) return
    setSubmitting(true)
    const res = await fetch(`/api/notes/${noteId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft.trim() }),
    })
    if (res.ok) {
      const comment = await res.json()
      onCommentsChange([...comments, comment])
      setDraft("")
    }
    setSubmitting(false)
  }

  async function remove(id: string) {
    await fetch(`/api/admin/comments/${id}`, { method: "DELETE" })
    onCommentsChange(comments.filter((comment) => comment._id !== id))
  }

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 flex max-h-[70vh] flex-col rounded-lg border border-white/10 bg-[#080808] p-3 sm:absolute sm:inset-x-auto sm:inset-y-0 sm:left-[calc(100%+1rem)] sm:bottom-auto sm:w-80 sm:max-h-full">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <span className="text-xs font-medium text-[#A8A095]">Comentários</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar comentários"
          className="grid size-7 place-items-center rounded-full text-[#A8A095] transition-colors hover:bg-white/10 hover:text-[#f1f1f1]"
        >
          <XMarkIcon className="size-4" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {comments.length === 0 ? (
          <p className="text-xs text-[#A8A095]/75">Nenhum comentário ainda.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => (
              <div key={comment._id} className="flex gap-2 text-xs">
                {comment.authorImageUrl ? (
                  <img
                    src={comment.authorImageUrl}
                    alt=""
                    className="mt-0.5 size-6 shrink-0 rounded-full object-cover"
                    style={{ filter: "none" }}
                  />
                ) : (
                  <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] text-[#f1f1f1]">
                    {comment.authorName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-[#f1f1f1]">{comment.authorName}</span>
                    <time className="shrink-0 text-[11px] text-[#A8A095]/70">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ptBR })}
                    </time>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words leading-relaxed text-[#d8d4ce]">{comment.content}</p>
                </div>
                {(isAdmin || user?.id === comment.authorId) && (
                  <button
                    type="button"
                    onClick={() => remove(comment._id)}
                    aria-label="Deletar comentário"
                    className="grid size-5 shrink-0 place-items-center text-[#A8A095]/50 transition-colors hover:text-red-400"
                  >
                    <XMarkIcon className="size-3" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {user ? (
        <div className="flex gap-2 border-t border-white/10 pt-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit()
            }}
            rows={2}
            placeholder="Escreva um comentário..."
            className="min-w-0 flex-1 resize-none rounded-md border border-white/10 bg-transparent p-2 text-xs text-[#f1f1f1] outline-none placeholder:text-[#A8A095]/60 focus:ring-1 focus:ring-[#A8A095]/40"
          />
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !draft.trim()}
            className="self-end rounded-md bg-[#f1f1f1] px-3 py-1.5 text-xs font-medium text-[#080808] transition-opacity disabled:opacity-40"
          >
            {submitting ? "..." : "Enviar"}
          </button>
        </div>
      ) : (
        <p className="border-t border-white/10 pt-2 text-xs text-[#A8A095]/75">Faça login para comentar.</p>
      )}
    </aside>
  )
}

export function NoteCard({ note, isAdmin, onDelete }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsOpen, setCommentsOpen] = useState(false)

  const ago = formatDistanceToNow(new Date(note.publishedAt), {
    addSuffix: true,
    locale: ptBR,
  })

  useEffect(() => {
    let cancelled = false

    fetch(`/api/notes/${note._id}/comments`)
      .then((response) => response.ok ? response.json() : [])
      .then((next: Comment[]) => {
        if (!cancelled) setComments(next)
      })
      .catch(() => {
        if (!cancelled) setComments([])
      })

    return () => {
      cancelled = true
    }
  }, [note._id])

  const commentActionLabel = comments.length > 0 ? "ver comentários" : "comentar"

  return (
    <article className="group relative flex flex-col gap-3 border-y border-white/10 pb-6 pt-5">
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

      <div className="pointer-events-none absolute bottom-0 left-0">
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          aria-expanded={commentsOpen}
          className="pointer-events-auto inline-flex items-center gap-1.5 text-xs text-[#A8A095]/70 opacity-100 transition-colors hover:text-[#f1f1f1] sm:opacity-0 sm:group-hover:opacity-100"
        >
          <ChatBubbleLeftEllipsisIcon className="size-4" aria-hidden />
          <span>{commentActionLabel}</span>
          {comments.length > 0 && <span className="tabular-nums">({comments.length})</span>}
        </button>
      </div>

      {commentsOpen && (
        <NoteCommentsPanel
          noteId={note._id}
          comments={comments}
          isAdmin={isAdmin}
          onCommentsChange={setComments}
          onClose={() => setCommentsOpen(false)}
        />
      )}
    </article>
  )
}
