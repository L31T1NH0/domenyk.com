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
    <div className="relative z-50 flex w-full max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border border-neutral-950/10 bg-[#f4f4f4] p-3 text-neutral-800 shadow-[0_2px_8px_rgb(0_0_0_/_0.14)] dark:border-white/10 dark:bg-[#040404] dark:text-[#f1f1f1] dark:shadow-none xl:h-full xl:rounded-t-none xl:border-t-0">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-950/10 pb-2 dark:border-white/10">
        <div>
          <span className="block text-xs font-semibold text-neutral-950 dark:text-[#f1f1f1]">Comentários do parágrafo</span>
          <span className="mt-0.5 block text-[11px] text-neutral-500 dark:text-[#A8A095]">
            {comments.length === 1 ? "1 comentário" : `${comments.length} comentários`}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar comentários"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-950/10 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070]/70 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]"
        >
          <span aria-hidden>✕</span>
        </button>
      </div>

      <div className="flex max-h-56 min-h-0 flex-col gap-3 overflow-y-auto pr-1 xl:max-h-none xl:flex-1">
        {comments.length === 0 && (
          <p className="rounded-md border border-dashed border-neutral-950/15 px-3 py-2 text-xs leading-relaxed text-neutral-500 dark:border-white/15 dark:text-[#A8A095]">
            Nenhum comentário ainda. Use este espaço para responder diretamente a este trecho.
          </p>
        )}
        {comments.map((c) => (
          <div key={c._id} className="flex gap-2 text-xs leading-relaxed">
            {c.authorImageUrl ? (
              <img src={c.authorImageUrl} alt="" className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover" style={{ filter: "none" }} />
            ) : (
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-200 text-[10px] text-neutral-700 dark:bg-white/10 dark:text-[#f1f1f1]">
                {c.authorName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="font-medium text-neutral-950 dark:text-[#f1f1f1]">{c.authorName}</span>
              <ExpandableText
                text={c.content}
                maxLines={4}
                className="text-neutral-600 dark:text-[#A8A095]"
              />
            </div>
            {(isAdmin || user?.id === c.authorId) && (
              <button
                type="button"
                onClick={() => remove(c._id)}
                aria-label="Deletar comentário"
                className="h-5 w-5 shrink-0 rounded-full text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {user ? (
        <div className="flex flex-col gap-2 border-t border-neutral-950/10 pt-3 dark:border-white/10">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit() }}
            rows={2}
            placeholder="Escreva um comentário..."
            className="min-h-16 resize-none rounded-md border border-neutral-950/15 bg-white/70 p-2 text-xs leading-relaxed text-neutral-900 outline-none transition focus:border-[#E00070]/60 focus:ring-2 focus:ring-[#E00070]/20 dark:border-white/15 dark:bg-white/[0.04] dark:text-[#f1f1f1]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !draft.trim()}
            className="self-end rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#E00070] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#f1f1f1] dark:text-[#040404] dark:hover:bg-[#E00070] dark:hover:text-white"
          >
            {submitting ? "Enviando..." : "Enviar"}
          </button>
        </div>
      ) : (
        <p className="border-t border-neutral-950/10 pt-3 text-xs text-neutral-500 dark:border-white/10 dark:text-[#A8A095]">
          Faça login para comentar.
        </p>
      )}
    </div>
  )
}
