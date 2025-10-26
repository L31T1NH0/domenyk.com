"use client";

import { useAuth } from "@clerk/nextjs";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sanitizeCommentHtml } from "@components/comments/utils";
import type { ParagraphComment } from "../../types/paragraph-comments";

const MAX_COMMENT_LENGTH = 480;

function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildRedirectUrl(): string {
  if (typeof window === "undefined") {
    return "/sign-in";
  }
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  const target = `${window.location.pathname}${search}${hash}`;
  return `/sign-in?redirect_url=${encodeURIComponent(target)}`;
}

type ParagraphCommentWidgetProps = {
  postId: string;
  paragraphId: string;
  paragraphIndex: number;
  coAuthorUserId?: string | null;
  paragraphProps?: React.HTMLAttributes<HTMLParagraphElement>;
  children: React.ReactNode;
};

export default function ParagraphCommentWidget({
  postId,
  paragraphId,
  paragraphIndex,
  coAuthorUserId,
  paragraphProps,
  children,
}: ParagraphCommentWidgetProps) {
  const { isLoaded, userId } = useAuth();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [comments, setComments] = useState<ParagraphComment[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFeatureBlocked, setIsFeatureBlocked] = useState(false);
  const [queuedExpand, setQueuedExpand] = useState<boolean | null>(null);

  const loadComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/posts/${postId}/paragraph-comments?paragraphId=${encodeURIComponent(paragraphId)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      if (response.status === 403) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setErrorMessage(
          data?.error ?? "Comentários por parágrafo desativados para este post."
        );
        setIsFeatureBlocked(true);
        setComments([]);
        setHasLoaded(true);
        return;
      }

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as ParagraphComment[];
      setComments(data);
      setHasLoaded(true);
      setErrorMessage(null);
      setIsFeatureBlocked(false);
    } catch (error) {
      console.error("Failed to load paragraph comments", error);
  setErrorMessage("Não foi possível carregar os comentários agora.");
    } finally {
      setIsLoading(false);
    }
  }, [paragraphId, postId]);

  const toggleComments = useCallback(async () => {
    const next = !isExpanded;

    if (!isLoaded) {
      setQueuedExpand(next);
      return;
    }

    if (!userId) {
      window.location.href = buildRedirectUrl();
      return;
    }

    if (next && !hasLoaded) {
      await loadComments();
    }

    setIsExpanded(next);
  }, [hasLoaded, isExpanded, isLoaded, loadComments, userId]);

  useEffect(() => {
    if (!isLoaded || queuedExpand === null) {
      return;
    }

    const next = queuedExpand;
    setQueuedExpand(null);

    if (!userId) {
      window.location.href = buildRedirectUrl();
      return;
    }

    const applyToggle = async () => {
      if (next && !hasLoaded) {
        await loadComments();
      }
      setIsExpanded(next);
    };

    void applyToggle();
  }, [hasLoaded, isLoaded, loadComments, queuedExpand, userId]);

  useEffect(() => {
    if (!isLoaded || !userId) {
      setIsAdmin(false);
      return;
    }

    let isCancelled = false;

    const checkAdmin = async () => {
      try {
        const response = await fetch("/admin/api/check", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = (await response.json()) as { isAdmin?: boolean };
        if (!isCancelled) {
          setIsAdmin(Boolean(data.isAdmin));
        }
      } catch (error) {
        console.error("Failed to check admin status", error);
        if (!isCancelled) {
          setIsAdmin(false);
        }
      }
    };

    checkAdmin();

    return () => {
      isCancelled = true;
    };
  }, [isLoaded, userId]);

  const submitComment = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setErrorMessage("Escreva algo antes de enviar.");
      return;
    }

    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setErrorMessage(
        `O comentário deve ter no máximo ${MAX_COMMENT_LENGTH} caracteres.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/posts/${postId}/paragraph-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paragraphId,
          content: trimmed,
        }),
      });

      if (response.status === 403) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setErrorMessage(
          data?.error ?? "Comentários por parágrafo desativados para este post."
        );
        setIsFeatureBlocked(true);
        return;
      }

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as { comment: ParagraphComment };
      setComments((prev) => [...prev, data.comment]);
      setDraft("");
      setErrorMessage(null);
      setIsFeatureBlocked(false);
      if (!hasLoaded) {
        setHasLoaded(true);
      }
    } catch (error) {
      console.error("Failed to submit paragraph comment", error);
  setErrorMessage("Não foi possível enviar seu comentário.");
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, paragraphId, postId, hasLoaded]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (isFeatureBlocked) {
      return;
    }
    if (!isLoaded || !userId || isSubmitting) {
      if (!isLoaded) return;
      if (!userId) {
        window.location.href = buildRedirectUrl();
      }
      return;
    }
    await submitComment();
  };

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!isLoaded || !userId || isFeatureBlocked) {
        return;
      }

      if (!isAdmin && !comments.some((comment) => comment._id === commentId && comment.userId === userId)) {
        return;
      }

  const confirmed = window.confirm("Remover este comentário?");
      if (!confirmed) {
        return;
      }

      try {
        setDeletingId(commentId);
        const response = await fetch(
          `/api/posts/${postId}/paragraph-comments/${commentId}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (response.status === 403) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          setErrorMessage(
            data?.error ?? "Comentários por parágrafo desativados para este post."
          );
          setIsFeatureBlocked(true);
          return;
        }

        if (!response.ok) {
          throw new Error(await response.text());
        }

        setComments((prev) => prev.filter((comment) => comment._id !== commentId));
        setIsFeatureBlocked(false);
      } catch (error) {
        console.error("Failed to delete paragraph comment", error);
  setErrorMessage("Não foi possível remover o comentário.");
      } finally {
        setDeletingId(null);
      }
    },
    [comments, isAdmin, isFeatureBlocked, isLoaded, postId, userId]
  );

  const formattedComments = useMemo(
    () =>
      comments
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((comment) => ({
          ...comment,
          safeHtml: sanitizeCommentHtml(comment.content.replace(/\n/g, "<br />")),
        })),
    [comments]
  );

  const { className: incomingClassName, ...restParagraphProps } = paragraphProps ?? {};

  const paragraphClassName = useMemo(() => {
    const baseClass = "prose prose-zinc dark:prose-invert max-w-none";
    const extra = incomingClassName ?? "";
    return `${baseClass} ${extra}`.trim();
  }, [incomingClassName]);

  return (
    <section className="flex flex-col gap-3" data-paragraph-id={paragraphId}>
      <div className="relative group">
        <p {...restParagraphProps} className={`${paragraphClassName} peer`}>
          {children}
        </p>
        <span aria-hidden="true" className="absolute right-[-2rem] top-0 h-full w-8" />
        <button
          type="button"
          onClick={toggleComments}
          className="pointer-events-none absolute right-[-2rem] top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity peer-hover:opacity-100 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 peer-hover:pointer-events-auto group-hover:pointer-events-auto hover:pointer-events-auto focus:pointer-events-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-600 shadow-sm hover:border-zinc-400 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
          aria-label="Comentar parágrafo"
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
        </button>
      </div>

      {isExpanded && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between pb-3">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              Comentários deste parágrafo
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Parágrafo {paragraphIndex + 1}
            </span>
          </div>

          {errorMessage && (
            <p className="mb-3 text-sm text-red-500" role="alert">
              {errorMessage}
            </p>
          )}

          <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
            <textarea
              name="paragraph-comment"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (errorMessage && !isFeatureBlocked) {
                  setErrorMessage(null);
                }
              }}
              placeholder="Escreva seu comentário"
              maxLength={MAX_COMMENT_LENGTH}
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-800 shadow-inner outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
              disabled={isFeatureBlocked}
            />
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {draft.length}/{MAX_COMMENT_LENGTH}
              </span>
              <button
                type="submit"
                disabled={isSubmitting || isFeatureBlocked}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:border-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
              >
                {isSubmitting ? "Enviando..." : "Publicar"}
              </button>
            </div>
          </form>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-zinc-500">Carregando comentários...</p>
            ) : formattedComments.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Ainda não há comentários neste parágrafo.
              </p>
            ) : (
              formattedComments.map((comment) => (
                <div key={comment._id} className="flex items-start gap-3">
                  {comment.authorImageUrl ? (
                    <img
                      src={comment.authorImageUrl}
                      alt={comment.authorName}
                      className="h-8 w-8 rounded-full object-cover icon"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
                      {comment.authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-800 dark:text-white">
                          {comment.authorName}
                        </span>
                        {coAuthorUserId && comment.userId === coAuthorUserId && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                            co-autor
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{formatDateLabel(comment.createdAt)}</span>
                        {(isAdmin || comment.userId === userId) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(comment._id)}
                            disabled={deletingId === comment._id}
                            className="text-xs font-medium text-red-500 transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-full disabled:cursor-not-allowed disabled:text-red-300"
                          >
                            {deletingId === comment._id ? "Removendo..." : "Remover"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      className="mt-2 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: comment.safeHtml }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

