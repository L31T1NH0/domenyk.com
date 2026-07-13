"use client"

import { useUser } from "@clerk/nextjs"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useComments } from "@/components/comments/useComments"
import { CommentContent } from "@/components/comments/CommentContent"
import { RichCommentComposer } from "@/components/comments/RichCommentComposer"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import type { PostLocale } from "@/lib/post-locales"

type Props = { postId: string; locale?: PostLocale; isAdmin?: boolean }

export function CommentThread({ postId, locale = "pt", isAdmin = false }: Props) {
  const { user } = useUser()
  const { comments, draft, totalCount, submitting, hasMore, loadingOlder, error, setDraft, submit, remove, loadOlder } = useComments(`/api/comments/${postId}?locale=${locale}`)

  return (
    <section className="mt-12 flex flex-col gap-6">
      <h2 className="text-sm font-semibold">Comentários{totalCount > 0 ? ` (${totalCount})` : ""}</h2>

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="flex flex-col gap-4">
        {hasMore && (
          <button
            type="button"
            onClick={() => void loadOlder()}
            disabled={loadingOlder}
            className="self-start rounded-md px-2 py-1 text-xs text-neutral-500 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            {loadingOlder ? "Carregando..." : "Carregar comentários anteriores"}
          </button>
        )}
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
                {(isAdmin || c.canDelete) && <span className="ml-auto"><DeleteActionMenu title="Excluir comentário?" onDelete={async () => { if (!(await remove(c._id))) throw new Error("Não foi possível excluir o comentário.") }} triggerLabel="Excluir" triggerVariant="text" /></span>}
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
