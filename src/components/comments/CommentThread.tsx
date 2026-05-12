"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ExpandableText } from "@/components/text/ExpandableText"

type Comment = {
  _id: string
  authorName: string
  authorImageUrl: string
  authorId: string
  content: string
  createdAt: string
}

type Props = { postId: string; isAdmin?: boolean }

export function CommentThread({ postId, isAdmin = false }: Props) {
  const { user } = useUser()
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/comments/${postId}`)
      .then((r) => r.json())
      .then(setComments)
  }, [postId])

  async function submit() {
    if (!draft.trim() || submitting) return
    setSubmitting(true)
    const res = await fetch(`/api/comments/${postId}`, {
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
    <section className="mt-12 flex flex-col gap-6">
      <h2 className="text-sm font-semibold">Comentários</h2>

      <div className="flex flex-col gap-4">
        {comments.map((c) => (
          <div key={c._id} className="flex gap-3">
            {c.authorImageUrl ? (
              <img src={c.authorImageUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" style={{ filter: "none" }} />
            ) : (
              <div className="w-7 h-7 rounded-full shrink-0 mt-0.5 bg-neutral-200 dark:bg-neutral-800 text-xs grid place-items-center">
                {c.authorName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{c.authorName}</span>
                <time className="text-xs text-neutral-400">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: ptBR })}
                </time>
                {(isAdmin || user?.id === c.authorId) && (
                  <button onClick={() => remove(c._id)} className="text-xs text-neutral-300 hover:text-red-400 ml-auto">
                    deletar
                  </button>
                )}
              </div>
              <ExpandableText
                text={c.content}
                maxLines={5}
                className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-300"
              />
            </div>
          </div>
        ))}
      </div>

      {user ? (
        <div className="flex gap-3">
            <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" style={{ filter: "none" }} />
          <div className="flex-1 flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit() }}
              rows={3}
              placeholder="Escreva um comentário..."
              className="w-full resize-none rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent p-3 text-sm outline-none focus:ring-1 focus:ring-neutral-300"
            />
            <button
              onClick={submit}
              disabled={submitting || !draft.trim()}
              className="self-end px-4 py-1.5 text-sm rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40"
            >
              {submitting ? "enviando..." : "Comentar"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-400">Faça login para comentar.</p>
      )}
    </section>
  )
}
