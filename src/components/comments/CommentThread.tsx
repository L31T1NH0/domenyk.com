"use client"

import { useUser } from "@clerk/nextjs"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useComments } from "@/components/comments/useComments"
import { CommentContent } from "@/components/comments/CommentContent"
import { RichCommentComposer } from "@/components/comments/RichCommentComposer"

type Props = { postId: string; isAdmin?: boolean }

export function CommentThread({ postId, isAdmin = false }: Props) {
  const { user } = useUser()
  const { comments, draft, submitting, setDraft, submit, remove } = useComments(`/api/comments/${postId}`)

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
              <CommentContent
                comment={c}
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
          <div className="flex-1">
            <RichCommentComposer
              draft={draft}
              submitting={submitting}
              submitLabel="Comentar"
              submittingLabel="enviando..."
              onDraftChange={setDraft}
              onSubmit={submit}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-400">Faça login para comentar.</p>
      )}
    </section>
  )
}
