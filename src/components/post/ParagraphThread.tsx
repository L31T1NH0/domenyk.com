"use client"

import { useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useComments } from "@/components/comments/useComments"
import { CommentContent } from "@/components/comments/CommentContent"
import { RichCommentComposer } from "@/components/comments/RichCommentComposer"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import type { PostLocale } from "@/lib/post-locales"

type Props = {
  postId: string
  paragraphId: string
  locale?: PostLocale
  isAdmin?: boolean
  autoFocus?: boolean
  onCountChange?: (count: number) => void
  onClose: () => void
}

export function ParagraphThread({ postId, paragraphId, locale = "pt", isAdmin = false, autoFocus = true, onCountChange, onClose }: Props) {
  const { user } = useUser()
  const { comments, draft, loaded, totalCount, submitting, hasMore, loadingOlder, error, setDraft, submit, remove, loadOlder } = useComments(`/api/comments/${postId}/paragraph/${paragraphId}?locale=${locale}`)

  useEffect(() => {
    if (loaded) onCountChange?.(totalCount)
  }, [loaded, onCountChange, totalCount])

  return (
    <div className="relative z-50 flex w-full max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border border-neutral-950/10 bg-[#f4f4f4] p-3 text-neutral-800 shadow-[0_2px_8px_rgb(0_0_0_/_0.14)] dark:border-white/10 dark:bg-[#040404] dark:text-[#f1f1f1] dark:shadow-none xl:h-full xl:rounded-t-none xl:border-t-0">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-950/10 pb-2 dark:border-white/10">
        <span className="text-xs font-semibold text-neutral-950 dark:text-[#f1f1f1]">
          Comentários do parágrafo <span className="font-normal text-neutral-500 dark:text-[#A8A095]">· {totalCount}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar comentários"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-950/10 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070]/70 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1]"
        >
          <span aria-hidden>✕</span>
        </button>
      </div>

      {user ? (
        <div className="border-b border-neutral-950/10 pb-3 dark:border-white/10">
          <RichCommentComposer
            draft={draft}
            submitting={submitting}
            size="compact"
            autoFocus={autoFocus}
            allowImageUpload={isAdmin}
            onDraftChange={setDraft}
            onSubmit={submit}
          />
        </div>
      ) : (
        <p className="border-b border-neutral-950/10 pb-3 text-xs text-neutral-500 dark:border-white/10 dark:text-[#A8A095]">
          Faça login para comentar.
        </p>
      )}

      <div className="flex max-h-56 min-h-0 flex-col gap-3 overflow-y-auto pr-1 xl:max-h-none xl:flex-1">
        {error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>}
        {hasMore && (
          <button
            type="button"
            onClick={() => void loadOlder()}
            disabled={loadingOlder}
            className="min-h-6 self-start rounded px-1.5 text-[11px] text-neutral-500 hover:text-neutral-950 disabled:opacity-50 dark:text-[#A8A095] dark:hover:text-[#f1f1f1]"
          >
            {loadingOlder ? "Carregando..." : "Comentários anteriores"}
          </button>
        )}
        {comments.length === 0 && (
          <p className="py-1 text-xs leading-relaxed text-neutral-500 dark:text-[#A8A095]">
            Nenhum comentário ainda.
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
              <CommentContent
                comment={c}
                maxLines={4}
                className="text-neutral-600 dark:text-[#A8A095]"
              />
            </div>
            {(isAdmin || c.canDelete) && <DeleteActionMenu title="Excluir comentário?" onDelete={async () => { if (!(await remove(c._id))) throw new Error("Não foi possível excluir o comentário.") }} triggerAriaLabel="Opções do comentário" triggerClassName="grid size-6 shrink-0 place-items-center rounded-md text-neutral-400 outline-none transition-colors hover:bg-neutral-950/10 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:hover:bg-white/10 dark:hover:text-white" />}
          </div>
        ))}
      </div>
    </div>
  )
}
