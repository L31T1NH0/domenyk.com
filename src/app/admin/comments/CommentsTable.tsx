"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { SerializedComment } from "@/lib/db/comments"

type Props = { comments: SerializedComment[] }

export function CommentsTable({ comments: initial }: Props) {
  const [comments, setComments] = useState(initial)

  async function remove(id: string) {
    const res = await fetch(`/api/comments/by-id/${id}`, { method: "DELETE" })
    if (res.ok) setComments((prev) => prev.filter((c) => c._id !== id))
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-900 dark:bg-neutral-950">
      <div className="border-b border-neutral-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:border-neutral-900">
        Comentários recentes
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
      {comments.map((c) => (
        <div key={c._id} className="flex gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
          {c.authorImageUrl ? (
            <img src={c.authorImageUrl} alt="" className="w-7 h-7 rounded-full shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full shrink-0 bg-neutral-200 dark:bg-neutral-800 text-xs grid place-items-center">
              {c.authorName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="min-w-0 break-words text-sm font-medium">{c.authorName}</span>
              {c.paragraphId && (
                <span className="text-xs text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 rounded">parágrafo</span>
              )}
              <time className="text-xs text-neutral-400 sm:ml-auto">
                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: ptBR })}
              </time>
            </div>
            <p className="line-clamp-3 break-words text-sm text-neutral-600 dark:text-neutral-400 sm:truncate">{c.content}</p>
          </div>
          <button onClick={() => remove(c._id)} className="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300">
            ✕
          </button>
        </div>
      ))}
      </div>
    </div>
  )
}
