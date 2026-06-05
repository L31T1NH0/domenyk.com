"use client"

import { useEffect, useState, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { ExpandableText } from "@/components/text/ExpandableText"

type Comment = {
  _id: string
  authorName: string
  authorImageUrl: string
  content: string
  authorId: string
  createdAt: string
}

type Props = {
  postId: string
  paragraphId: string
  isAdmin?: boolean
  autoFocus?: boolean
  onCountChange?: (count: number) => void
  onClose: () => void
}

export function ParagraphThread({ postId, paragraphId, isAdmin = false, autoFocus = true, onCountChange, onClose }: Props) {
  const { user } = useUser()
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/comments/${postId}/paragraph/${paragraphId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((next: Comment[]) => {
        setComments(next)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
      })

    return () => {
      controller.abort()
    }
  }, [postId, paragraphId])

  useEffect(() => {
    onCountChange?.(comments.length)
  }, [comments.length, onCountChange])

  useEffect(() => {
    if (!autoFocus) return
    textareaRef.current?.focus()
  }, [autoFocus])

  async function submit() {
    if (!draft.trim() || submitting) return
    setSubmitting(true)
    const res = await fetch(`/api/comments/${postId}/paragraph/${paragraphId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft.trim() }),
    })
	    if (res.ok) {
	      const comment = await res.json()
	      setComments((prev) => [...prev, comment])
	      setDraft("")
	    }
    setSubmitting(false)
  }

	  async function remove(id: string) {
	    const res = await fetch(`/api/comments/by-id/${id}`, { method: "DELETE" })
	    if (res.ok) setComments((prev) => prev.filter((c) => c._id !== id))
	  }

  return (
    <div className="absolute right-0 z-50 w-72 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500">Comentários</span>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-sm leading-none">✕</button>
      </div>

      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-xs text-neutral-400">Nenhum comentário ainda.</p>
        )}
        {comments.map((c) => (
          <div key={c._id} className="flex gap-2 text-xs">
            {c.authorImageUrl ? (
              <img src={c.authorImageUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5" style={{ filter: "none" }} />
            ) : (
              <div className="w-5 h-5 rounded-full shrink-0 mt-0.5 bg-neutral-200 dark:bg-neutral-800 text-[10px] grid place-items-center">
                {c.authorName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <span className="font-medium">{c.authorName}</span>
              <ExpandableText
                text={c.content}
                maxLines={4}
                className="text-neutral-600 dark:text-neutral-400"
              />
            </div>
            {(isAdmin || user?.id === c.authorId) && (
              <button onClick={() => remove(c._id)} className="text-neutral-300 hover:text-red-400 shrink-0">✕</button>
            )}
          </div>
        ))}
      </div>

      {user ? (
        <div className="flex gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit() }}
            rows={2}
            placeholder="Escreva um comentário..."
            className="flex-1 resize-none text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-transparent p-1.5 outline-none focus:ring-1 focus:ring-neutral-300"
          />
          <button
            onClick={submit}
            disabled={submitting || !draft.trim()}
            className="self-end px-2 py-1 text-xs rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      ) : (
        <p className="text-xs text-neutral-400 pt-1 border-t border-neutral-100 dark:border-neutral-800">
          Faça login para comentar.
        </p>
      )}
    </div>
  )
}
