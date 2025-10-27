"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { ChatBubbleLeftRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  PARAGRAPH_COMMENT_MAX_LENGTH,
  buildLengthErrorMessage,
  useCommentLength,
} from "@components/comments/lengthUtils";
import { sanitizeCommentHtml } from "@components/comments/utils";
import { UPPERCASE_MAX_RATIO, getUppercaseState, buildUppercaseErrorMessage } from "@components/comments/uppercaseUtils";
import type { ParagraphComment } from "../../types/paragraph-comments";

const LOGIN_PROMPT_TIMEOUT_MS = 5000;

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
  isAdmin: boolean;
  isMobile: boolean;
};

export default function ParagraphCommentWidget({
  postId,
  paragraphId,
  paragraphIndex,
  coAuthorUserId,
  paragraphProps,
  children,
  isAdmin,
  isMobile,
}: ParagraphCommentWidgetProps) {
  const { isLoaded, userId } = useAuth();
  const OPEN_EVENT = "paragraph-comments:open";

  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [comments, setComments] = useState<ParagraphComment[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFeatureBlocked, setIsFeatureBlocked] = useState(false);
  const [queuedExpand, setQueuedExpand] = useState<boolean | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptProgress, setLoginPromptProgress] = useState(0);
  const [loginPromptCycle, setLoginPromptCycle] = useState(0);
  const loginPromptTitleId = useId();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deleteButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [undoToast, setUndoToast] = useState<{ comment: ParagraphComment } | null>(
    null
  );
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const undoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isUndoingDelete, setIsUndoingDelete] = useState(false);

  const clearPendingDeleteTimeout = useCallback(() => {
    if (pendingDeleteTimeoutRef.current) {
      clearTimeout(pendingDeleteTimeoutRef.current);
      pendingDeleteTimeoutRef.current = null;
    }
  }, []);

  const resetPendingDelete = useCallback(() => {
    clearPendingDeleteTimeout();
    setPendingDeleteId(null);
  }, [clearPendingDeleteTimeout]);

  const schedulePendingDeleteTimeout = useCallback(
    (commentId: string) => {
      clearPendingDeleteTimeout();
      pendingDeleteTimeoutRef.current = setTimeout(() => {
        setPendingDeleteId((current) => (current === commentId ? null : current));
      }, 6000);
    },
    [clearPendingDeleteTimeout]
  );

  const clearUndoTimers = useCallback(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current);
      undoIntervalRef.current = null;
    }
  }, []);

  const showUndoToast = useCallback(
    (comment: ParagraphComment) => {
      clearUndoTimers();
      setUndoCountdown(5);
      setUndoToast({ comment });
      undoTimeoutRef.current = setTimeout(() => {
        setUndoToast(null);
        setUndoCountdown(0);
        if (undoIntervalRef.current) {
          clearInterval(undoIntervalRef.current);
          undoIntervalRef.current = null;
        }
        undoTimeoutRef.current = null;
      }, 5000);
      undoIntervalRef.current = setInterval(() => {
        setUndoCountdown((previous) => {
          if (previous <= 1) {
            if (undoIntervalRef.current) {
              clearInterval(undoIntervalRef.current);
              undoIntervalRef.current = null;
            }
            return 0;
          }
          return previous - 1;
        });
      }, 1000);
    },
    [clearUndoTimers]
  );

  useEffect(() => {
    return () => {
      clearPendingDeleteTimeout();
      clearUndoTimers();
    };
  }, [clearPendingDeleteTimeout, clearUndoTimers]);

  useEffect(() => {
    if (!pendingDeleteId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const button = deleteButtonRefs.current[pendingDeleteId];
      if (
        button &&
        (button === event.target || button.contains(event.target as Node))
      ) {
        return;
      }
      resetPendingDelete();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resetPendingDelete();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingDeleteId, resetPendingDelete]);

  useEffect(() => {
    const ids = new Set(comments.map((comment) => comment._id));
    Object.keys(deleteButtonRefs.current).forEach((key) => {
      if (!ids.has(key)) {
        delete deleteButtonRefs.current[key];
      }
    });
  }, [comments]);

  const handleUndoDelete = useCallback(async () => {
    if (!undoToast || isUndoingDelete) {
      return;
    }

    clearUndoTimers();
    setIsUndoingDelete(true);

    try {
      const response = await fetch(`/api/posts/${postId}/paragraph-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paragraphId: undoToast.comment.paragraphId,
          content: undoToast.comment.content,
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
        setUndoToast(null);
        setUndoCountdown(0);
        return;
      }

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as { comment: ParagraphComment };
      setComments((prev) => [...prev, data.comment]);
      setUndoToast(null);
      setUndoCountdown(0);
      setIsFeatureBlocked(false);
      } catch (error) {
      console.error("Failed to undo paragraph comment deletion", error);
      setErrorMessage("Não foi possível desfazer a exclusão.");
      setUndoToast(null);
      setUndoCountdown(0);
    } finally {
      setIsUndoingDelete(false);
    }
  }, [
    clearUndoTimers,
    isUndoingDelete,
    postId,
    setComments,
    setErrorMessage,
    setIsFeatureBlocked,
    undoToast,
  ]);

  const draftLength = useCommentLength(draft, PARAGRAPH_COMMENT_MAX_LENGTH);

  const openLoginPrompt = useCallback(() => {
    setLoginPromptProgress(0);
    setLoginPromptCycle((previous) => previous + 1);
    setShowLoginPrompt(true);
  }, []);

  const closeLoginPrompt = useCallback(
    (options?: { clearQueuedExpand?: boolean }) => {
      setShowLoginPrompt(false);
      setLoginPromptProgress(0);
      if (options?.clearQueuedExpand) {
        setQueuedExpand(null);
      }
    },
    [setQueuedExpand]
  );

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
      setQueuedExpand(next);
      openLoginPrompt();
      return;
    }

    if (next && !hasLoaded) {
      await loadComments();
    }

    if (next) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { paragraphId } }));
      }
    }

    setIsExpanded(next);
  }, [hasLoaded, isExpanded, isLoaded, loadComments, openLoginPrompt, paragraphId, userId]);

  const openComments = useCallback(async () => {
    const next = true;

    if (!isLoaded) {
      setQueuedExpand(next);
      return;
    }

    if (!userId) {
      setQueuedExpand(next);
      openLoginPrompt();
      return;
    }

    if (next && !hasLoaded) {
      await loadComments();
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { paragraphId } }));
    }

    setIsExpanded(next);
  }, [hasLoaded, isLoaded, loadComments, openLoginPrompt, paragraphId, userId]);

  useEffect(() => {
    if (!isLoaded || queuedExpand === null) {
      return;
    }

    if (!userId) {
      openLoginPrompt();
      return;
    }

    const next = queuedExpand;
    setQueuedExpand(null);

    const applyToggle = async () => {
      if (next && !hasLoaded) {
        await loadComments();
      }
      if (next) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { paragraphId } }));
        }
      }
      setIsExpanded(next);
    };

    void applyToggle();
  }, [hasLoaded, isLoaded, loadComments, openLoginPrompt, paragraphId, queuedExpand, userId]);

  const submitComment = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setErrorMessage("Escreva algo antes de enviar.");
      return;
    }

    if (draftLength.isOverLimit) {
      setErrorMessage(
        buildLengthErrorMessage(PARAGRAPH_COMMENT_MAX_LENGTH, "comentário")
      );
      return;
    }

    // Limite de letras maiúsculas: máximo 45% do total
    {
      const upperState = getUppercaseState(trimmed, UPPERCASE_MAX_RATIO);
      if (upperState.isOverLimit) {
        setErrorMessage(buildUppercaseErrorMessage(trimmed, UPPERCASE_MAX_RATIO));
        return;
      }
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
    if (!isLoaded) {
      return;
    }
    if (isSubmitting) {
      return;
    }
    if (!userId) {
      setQueuedExpand((prev) => (prev === null ? true : prev));
      openLoginPrompt();
      return;
    }
    await submitComment();
  };

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!isLoaded || !userId || isFeatureBlocked) {
        return;
      }

      if (
        !isAdmin &&
        !comments.some((comment) => comment._id === commentId && comment.userId === userId)
      ) {
        return;
      }

      const commentToDelete = comments.find((comment) => comment._id === commentId);
      if (!commentToDelete) {
        return;
      }

      if (pendingDeleteId !== commentId) {
        setPendingDeleteId(commentId);
        schedulePendingDeleteTimeout(commentId);
        return;
      }

      resetPendingDelete();

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
        showUndoToast(commentToDelete);
      } catch (error) {
        console.error("Failed to delete paragraph comment", error);
        setErrorMessage("Não foi possível remover o comentário.");
      } finally {
        setDeletingId(null);
      }
    },
    [
      comments,
      isAdmin,
      isFeatureBlocked,
      isLoaded,
      pendingDeleteId,
      postId,
      resetPendingDelete,
      schedulePendingDeleteTimeout,
      showUndoToast,
      userId,
    ]
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

  const {
    className: incomingClassName,
    onClick: incomingOnClick,
    onFocus: incomingOnFocus,
    onKeyDown: incomingOnKeyDown,
    ...restParagraphProps
  } = paragraphProps ?? {};

  const paragraphClassName = useMemo(() => {
    const baseClass = "prose prose-zinc dark:prose-invert max-w-none";
    const extra = incomingClassName ?? "";
    return `${baseClass} ${extra}`.trim();
  }, [incomingClassName]);

  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isExpanded) return;
    const handleDocClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !sectionRef.current) return;
      if (!sectionRef.current.contains(target)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("touchstart", handleDocClick, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("touchstart", handleDocClick);
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!showLoginPrompt) {
      return;
    }
    if (userId) {
      closeLoginPrompt();
    }
  }, [closeLoginPrompt, showLoginPrompt, userId]);

  useEffect(() => {
    if (!showLoginPrompt || userId) {
      return;
    }

    setLoginPromptProgress(0);

    let animationFrame: number | null = null;
    const startedAt = performance.now();

    const updateProgress = () => {
      const elapsed = performance.now() - startedAt;
      const nextProgress = Math.min(elapsed / LOGIN_PROMPT_TIMEOUT_MS, 1);
      setLoginPromptProgress(nextProgress);

      if (nextProgress >= 1) {
        closeLoginPrompt();
        return;
      }

      animationFrame = requestAnimationFrame(updateProgress);
    };

    animationFrame = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [closeLoginPrompt, loginPromptCycle, showLoginPrompt, userId]);

  useEffect(() => {
    const onOtherParagraphOpen = (e: Event) => {
      try {
        const ce = e as CustomEvent<{ paragraphId: string }>;
        if (!ce?.detail) return;
        if (ce.detail.paragraphId !== paragraphId) {
          setIsExpanded(false);
        }
      } catch {
        // noop
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener(OPEN_EVENT, onOtherParagraphOpen as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(OPEN_EVENT, onOtherParagraphOpen as EventListener);
      }
    };
  }, [paragraphId]);

  const loginPromptProgressPercent = Math.min(Math.max(loginPromptProgress, 0), 1) * 100;

  return (
    <>
      <section ref={sectionRef} className="flex flex-col gap-3" data-paragraph-id={paragraphId}>
        <div className="relative group">
          <p
            {...restParagraphProps}
            tabIndex={0}
            onClick={(e) => {
            incomingOnClick?.(e);
            if ((e as React.MouseEvent<HTMLParagraphElement>).defaultPrevented) return;
            if (isMobile) void openComments();
          }}
          onFocus={(e) => {
            incomingOnFocus?.(e);
            if ((e as React.FocusEvent<HTMLParagraphElement>).defaultPrevented) return;
            if (isMobile && !isExpanded) void openComments();
          }}
          onKeyDown={(e) => {
            incomingOnKeyDown?.(e);
            if (e.defaultPrevented) return;
            if (!isMobile) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void openComments();
            }
          }}
          className={`${paragraphClassName} peer`}
        >
          {children}
        </p>
        <span aria-hidden="true" className="hidden md:block absolute right-[-2rem] top-0 h-full w-8 pointer-events-none" />
        <button
          type="button"
          onClick={toggleComments}
          className="hidden md:inline-flex pointer-events-none absolute right-[-2rem] top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity peer-hover:opacity-100 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 peer-hover:pointer-events-auto group-hover:pointer-events-auto hover:pointer-events-auto focus:pointer-events-auto md:inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-600 shadow-sm hover:border-zinc-400 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
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

          <div className="-mt-2 mb-1 flex justify-end">
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="Fechar comentários deste parágrafo"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white dark:hover:border-zinc-500"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
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
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-800 shadow-inner outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-700 whitespace-pre-wrap break-words"
              disabled={isFeatureBlocked}
            />
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span
                className={
                  draftLength.isOverLimit
                    ? "font-medium text-red-500 dark:text-red-400"
                    : undefined
                }
              >
                {draftLength.message}
              </span>
              <button
                type="submit"
                disabled={
                  isSubmitting || isFeatureBlocked || draftLength.isOverLimit
                }
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
                  <div className="flex-1 min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100">
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
                            ref={(element) => {
                              deleteButtonRefs.current[comment._id] = element;
                            }}
                            onClick={() => handleDelete(comment._id)}
                            disabled={deletingId === comment._id}
                            className={`rounded-full text-xs font-medium text-red-500 transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:text-red-300 ${
                              pendingDeleteId === comment._id ? "text-red-600 font-semibold" : ""
                            }`}
                          >
                            {deletingId === comment._id
                              ? "Removendo..."
                              : pendingDeleteId === comment._id
                              ? "Confirmar exclusão?"
                              : "Remover"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      className="mt-2 leading-relaxed break-words break-all"
                      dangerouslySetInnerHTML={{ __html: comment.safeHtml }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          {undoToast && (
            <div className="mt-4">
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <span>Comentário excluído.</span>
                <button
                  type="button"
                  onClick={handleUndoDelete}
                  disabled={isUndoingDelete || undoCountdown <= 0}
                  className="inline-flex items-center justify-center rounded-full border border-purple-500 px-3 py-1 text-xs font-semibold text-purple-600 transition-colors hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-purple-400 dark:text-purple-300 dark:hover:bg-purple-400/10"
                >
                  {isUndoingDelete
                    ? "Restaurando..."
                    : `Desfazer (${Math.max(undoCountdown, 0)}s)`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </section>

      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-8">
          <div
            className="absolute inset-0 bg-black/20"
            aria-hidden="true"
            onClick={() => closeLoginPrompt({ clearQueuedExpand: true })}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={loginPromptTitleId}
            className="relative z-10 w-full max-w-xs rounded-2xl border border-zinc-200 bg-white/95 px-4 pb-4 pt-6 text-sm shadow-xl transition dark:border-zinc-700 dark:bg-zinc-900/95"
          >
            <div
              className="absolute inset-x-4 top-4 h-1 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-700/70"
              aria-hidden="true"
            >
              <div
                className="h-full bg-purple-500 transition-[width] duration-75 ease-linear dark:bg-purple-400"
                style={{ width: `${loginPromptProgressPercent}%` }}
              />
            </div>
            <h2 id={loginPromptTitleId} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Quer participar?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Faça login para comentar neste parágrafo e acompanhar a conversa.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => closeLoginPrompt({ clearQueuedExpand: true })}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white"
              >
                Cancelar
              </button>
              {/* Clerk typings omit afterSignInUrl for modal buttons, but runtime supports it. */}
              {/* @ts-expect-error -- afterSignInUrl is accepted at runtime for modal mode. */}
              <SignInButton mode="modal" afterSignInUrl={buildRedirectUrl()}>
                <button
                  type="button"
                  className="rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:bg-purple-500 dark:hover:bg-purple-400"
                >
                  Fazer login
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


