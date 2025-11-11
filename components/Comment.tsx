"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/solid";

import {
  STANDARD_COMMENT_MAX_LENGTH,
  buildLengthErrorMessage,
  useCommentLength,
} from "@components/comments/lengthUtils";

import CommentThread from "./comments/CommentThread";
import ThreadPanel from "./comments/ThreadPanel";
import { CommentDraft, CommentEntity, SubmissionStatus } from "./comments/types";
import {
  buildCommentLookup,
  countThreadReplies,
  flattenServerComments,
  normalizeServerComment,
  sanitizeCommentHtml,
} from "./comments/utils";
import {
  UPPERCASE_MAX_RATIO,
  buildUppercaseErrorMessage,
  getUppercaseState,
} from "./comments/uppercaseUtils";

type CommentProps = {
  postId: string;
  coAuthorUserId?: string;
  isAdmin: boolean;
};

const COOLDOWN_MS = 2500;

const emptyDraft: CommentDraft = { nome: "", comentario: "" };

const Comment: React.FC<CommentProps> = ({ postId, coAuthorUserId, isAdmin }) => {
  const { userId, isLoaded } = useAuth();
  const { user } = useUser();

  const [comments, setComments] = useState<CommentEntity[]>([]);
  const [commentDraft, setCommentDraft] = useState<CommentDraft>(emptyDraft);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, CommentDraft>>({});
  const [replyStatuses, setReplyStatuses] = useState<Record<string, SubmissionStatus>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string | null>>({});
  const [isClient, setIsClient] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isThreadPanelOpen, setIsThreadPanelOpen] = useState(false);

  const pendingRequestRef = useRef<AbortController | null>(null);
  const replyRequestRefs = useRef<Record<string, AbortController | null>>({});
  const cooldownUntilRef = useRef<number>(0);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || userId || !isLoaded) return;
    const storedUser = localStorage.getItem(`user-${postId}`);
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as { nome?: string };
        const { nome } = parsed;
        setCommentDraft((prev) => ({ ...prev, nome: nome ?? "" }));
      } catch (error) {
        console.warn("Failed to parse stored user info", error);
      }
    }
  }, [isClient, isLoaded, postId, userId]);

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/comments/${postId}`);
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as unknown;
      if (Array.isArray(data)) setComments(flattenServerComments(data as any));
      else setComments([]);
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const friendly = /Failed to fetch|NetworkError|TypeError/i.test(raw)
        ? "Falha ao conectar ao servidor. Tente novamente."
        : raw || "Falha ao carregar comentários.";
      setErrorMessage(friendly);
      setComments([]);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => () => {
    pendingRequestRef.current?.abort();
    Object.values(replyRequestRefs.current).forEach((controller) => controller?.abort());
  }, []);

  useEffect(() => {
    if (submissionStatus === "success") {
      const timeout = window.setTimeout(() => {
        setSubmissionStatus("idle");
        setStatusMessage(null);
      }, 3200);
      return () => window.clearTimeout(timeout);
    }
    if (submissionStatus === "error") {
      const timeout = window.setTimeout(() => {
        setSubmissionStatus("idle");
      }, 4000);
      return () => window.clearTimeout(timeout);
    }
  }, [submissionStatus]);

  const commentLookup = useMemo(() => buildCommentLookup(comments), [comments]);
  const commentById = useMemo(() => {
    const map = new Map<string, CommentEntity>();
    comments.forEach((comment) => {
      map.set(comment._id, comment);
    });
    return map;
  }, [comments]);
  const replyCounts = useMemo(
    () => countThreadReplies(commentLookup),
    [commentLookup]
  );
  const totalComments = comments.length;

  const commentLength = useCommentLength(
    commentDraft.comentario,
    STANDARD_COMMENT_MAX_LENGTH
  );

  const canDeleteComment = useCallback(
    (comment: CommentEntity) => {
      if (!isLoaded) return false;
      if (isAdmin) return true;
      return Boolean(userId) && "userId" in comment && comment.userId === userId;
    },
    [isAdmin, isLoaded, userId]
  );

  const resetForm = () => {
    setCommentDraft((prev) => ({ ...prev, comentario: "" }));
  };

  const ensureReplyDraft = useCallback(
    (commentId: string) => {
      setReplyDrafts((prev) => {
        if (prev[commentId]) return prev;
        return { ...prev, [commentId]: { nome: commentDraft.nome, comentario: "" } };
      });
    },
    [commentDraft.nome]
  );

  const handleCommentDraftChange = (field: keyof CommentDraft, value: string) => {
    setCommentDraft((prev) => ({ ...prev, [field]: value }));
    if (submissionStatus !== "sending") setSubmissionStatus(value ? "typing" : "idle");
    if (statusMessage) setStatusMessage(null);
    if (errorMessage) setErrorMessage(null);
  };

  const removeOptimistic = (tempId: string) => {
    setComments((prev) => prev.filter((comment) => comment._id !== tempId));
  };

  const replaceOptimistic = (tempId: string, incoming: CommentEntity) => {
    setComments((prev) => {
      const withoutTemp = prev.filter((comment) => comment._id !== tempId);
      return [...withoutTemp, incoming];
    });
  };

  const handleCommentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingRequestRef.current) return;

    const now = Date.now();
    if (cooldownUntilRef.current > now) {
  setErrorMessage("Aguarde alguns segundos antes de enviar outro comentário.");
      return;
    }

    const trimmedComment = commentDraft.comentario.trim();
    const trimmedName = commentDraft.nome.trim();

    if (!trimmedComment) {
  setErrorMessage("Escreva um comentário antes de enviar.");
      return;
    }

    if (!userId && !trimmedName) {
      setErrorMessage("Informe seu nome para comentar.");
      return;
    }

    // Limite de letras maiúsculas: máximo 45% do total
    {
      const upperState = getUppercaseState(trimmedComment, UPPERCASE_MAX_RATIO);
      if (upperState.isOverLimit) {
        setErrorMessage(buildUppercaseErrorMessage(trimmedComment, UPPERCASE_MAX_RATIO));
        return;
      }
    }

    if (commentLength.isOverLimit) {
      setErrorMessage(
        buildLengthErrorMessage(STANDARD_COMMENT_MAX_LENGTH, "comentário")
      );
      return;
    }

    setSubmissionStatus("sending");
    setStatusMessage(null);
    setErrorMessage(null);

    const controller = new AbortController();
    pendingRequestRef.current = controller;

    const tempId = `temp-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const optimisticHtml = sanitizeCommentHtml(commentDraft.comentario.replace(/\n/g, "<br />"));

    const optimisticComment: CommentEntity = userId
      ? {
          _id: tempId,
          postId,
          comentario: optimisticHtml,
          createdAt,
          parentId: null,
          firstName: user?.firstName ?? "Você",
          role:
            user?.publicMetadata?.role === "admin"
              ? "admin"
              : user?.publicMetadata?.role === "moderator"
              ? "moderator"
              : null,
          userId,
          imageURL: user?.imageUrl ?? "",
          hasImage: Boolean(user?.hasImage),
          optimistic: true,
        }
      : {
          _id: tempId,
          postId,
          comentario: optimisticHtml,
          createdAt,
          parentId: null,
          nome: trimmedName || "Anonymous",
          optimistic: true,
        };

    setComments((prev) => [optimisticComment, ...prev]);

    try {
      const payload: Record<string, unknown> = { comentario: trimmedComment, parentId: null };
      if (!userId) payload.nome = trimmedName || "Anonymous";

      const response = await fetch(`/api/comments/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      const rawComment = result.comment;
      const resolved = normalizeServerComment(rawComment);
      replaceOptimistic(tempId, resolved);

      if (!userId && isClient) {
        localStorage.setItem(
          `user-${postId}`,
          JSON.stringify({ nome: trimmedName })
        );
      }

      resetForm();
      setActiveReplyId(null);
      setSubmissionStatus("success");
  setStatusMessage("Comentário enviado com sucesso!");
      cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
      removeOptimistic(tempId);
      const raw = error instanceof Error ? error.message : String(error);
      const friendly = /Failed to fetch|NetworkError|TypeError/i.test(raw)
        ? "Falha ao conectar ao servidor. Tente novamente."
        : raw || "Não foi possível enviar o comentário.";
      setSubmissionStatus("error");
      setErrorMessage(friendly);
    } finally {
      pendingRequestRef.current = null;
    }
  };

  const handleReplyRequest = (commentId: string) => {
    ensureReplyDraft(commentId);
    setActiveReplyId(commentId);
  };

  const handleReplyCancel = (commentId: string) => {
    setActiveReplyId((prev) => (prev === commentId ? null : prev));
    setReplyDrafts((prev) => ({ ...prev, [commentId]: { ...prev[commentId], comentario: "" } }));
    setReplyStatuses((prev) => ({ ...prev, [commentId]: "idle" }));
    setReplyErrors((prev) => ({ ...prev, [commentId]: null }));
  };

  const handleReplyDraftChange = (commentId: string, draft: CommentDraft) => {
    setReplyDrafts((prev) => ({ ...prev, [commentId]: draft }));
    setReplyStatuses((prev) => ({ ...prev, [commentId]: draft.comentario ? "typing" : "idle" }));
  };

  const handleReplySubmit = async (commentId: string, draft: CommentDraft) => {
    if (replyRequestRefs.current[commentId]) return;

    const trimmedComment = draft.comentario.trim();
    const trimmedName = draft.nome.trim();

    if (!trimmedComment) {
      setReplyErrors((prev) => ({ ...prev, [commentId]: "Responda antes de enviar." }));
      return;
    }

    if (!userId && !trimmedName) {
      setReplyErrors((prev) => ({ ...prev, [commentId]: "Informe seu nome." }));
      return;
    }

    if (draft.comentario.length > STANDARD_COMMENT_MAX_LENGTH) {
      setReplyErrors((prev) => ({
        ...prev,
        [commentId]: buildLengthErrorMessage(
          STANDARD_COMMENT_MAX_LENGTH,
          "resposta",
          "f"
        ),
      }));
      return;
    }

    // Limite de letras maiúsculas nas respostas
    {
      const upperState = getUppercaseState(trimmedComment, UPPERCASE_MAX_RATIO);
      if (upperState.isOverLimit) {
        setReplyErrors((prev) => ({
          ...prev,
          [commentId]: buildUppercaseErrorMessage(trimmedComment, UPPERCASE_MAX_RATIO),
        }));
        return;
      }
    }

    const controller = new AbortController();
    replyRequestRefs.current[commentId] = controller;
    setReplyStatuses((prev) => ({ ...prev, [commentId]: "sending" }));
    setReplyErrors((prev) => ({ ...prev, [commentId]: null }));

    const tempId = `temp-reply-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const htmlContent = sanitizeCommentHtml(draft.comentario.replace(/\n/g, "<br />"));

    const optimisticReply: CommentEntity = userId
      ? {
          _id: tempId,
          postId,
          comentario: htmlContent,
          createdAt,
          parentId: commentId,
          firstName: user?.firstName ?? "Você",
          role:
            user?.publicMetadata?.role === "admin"
              ? "admin"
              : user?.publicMetadata?.role === "moderator"
              ? "moderator"
              : null,
          userId,
          imageURL: user?.imageUrl ?? "",
          hasImage: Boolean(user?.hasImage),
          optimistic: true,
        }
      : {
          _id: tempId,
          postId,
          comentario: htmlContent,
          createdAt,
          parentId: commentId,
          nome: trimmedName || commentDraft.nome || "Anonymous",
          optimistic: true,
        };

    setComments((prev) => [optimisticReply, ...prev]);

    try {
      const payload: Record<string, unknown> = { comentario: trimmedComment, parentId: commentId };
      if (!userId) payload.nome = trimmedName || commentDraft.nome || "Anonymous";

      const response = await fetch(`/api/comments/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      const rawReply = result.reply ?? result.comment;
      const resolved = normalizeServerComment(rawReply);
      replaceOptimistic(tempId, resolved);

      if (!userId && isClient) {
        localStorage.setItem(
          `user-${postId}`,
          JSON.stringify({ nome: trimmedName || commentDraft.nome })
        );
      }

      setReplyDrafts((prev) => ({ ...prev, [commentId]: { ...prev[commentId], comentario: "" } }));
      setReplyStatuses((prev) => ({ ...prev, [commentId]: "success" }));
      setActiveReplyId(null);
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
      removeOptimistic(tempId);
      const raw = error instanceof Error ? error.message : String(error);
      const friendly = /Failed to fetch|NetworkError|TypeError/i.test(raw)
        ? "Falha ao conectar ao servidor. Tente novamente."
        : raw || "Não foi possível enviar a resposta.";
      setReplyStatuses((prev) => ({ ...prev, [commentId]: "error" }));
      setReplyErrors((prev) => ({ ...prev, [commentId]: friendly }));
    } finally {
      replyRequestRefs.current[commentId] = null;
    }
  };

  const removeBranch = useCallback((targetId: string) => {
    setComments((prev) => {
      const idsToRemove = new Set<string>([targetId]);
      const queue = [targetId];
      while (queue.length > 0) {
        const current = queue.shift();
        prev
          .filter((comment) => comment.parentId === current)
          .forEach((child) => {
            if (!idsToRemove.has(child._id)) {
              idsToRemove.add(child._id);
              queue.push(child._id);
            }
          });
      }
      return prev.filter((comment) => !idsToRemove.has(comment._id));
    });
  }, []);

  const handleDelete = useCallback(
    async (comment: CommentEntity) => {
      try {
        const response = await fetch(`/api/comments/${comment._id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId,
            isReply: Boolean(comment.parentId),
            ...(comment.parentId ? { parentId: comment.parentId } : {}),
          }),
        });

      if (!response.ok) throw new Error(await response.text());

      removeBranch(comment._id);
  setStatusMessage("Comentário removido.");
    } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const friendly = /Failed to fetch|NetworkError|TypeError/i.test(raw)
          ? "Falha ao conectar ao servidor. Tente novamente."
          : raw || "Não foi possível remover o comentário.";
        setErrorMessage(friendly);
      }
    },
    [postId, removeBranch]
  );

  const getReplyDraftFor = useCallback(
    (commentId: string) =>
      replyDrafts[commentId] ?? { nome: commentDraft.nome, comentario: "" },
    [commentDraft.nome, replyDrafts]
  );

  const getReplyStatusFor = useCallback(
    (commentId: string) => replyStatuses[commentId] ?? "idle",
    [replyStatuses]
  );

  const getReplyErrorFor = useCallback(
    (commentId: string) => replyErrors[commentId] ?? null,
    [replyErrors]
  );

  const isReplyingTo = useCallback(
    (commentId: string) => activeReplyId === commentId,
    [activeReplyId]
  );

  const handleOpenThread = useCallback(
    (commentId: string) => {
      ensureReplyDraft(commentId);
      setActiveThreadId(commentId);
      setIsThreadPanelOpen(true);
    },
    [ensureReplyDraft]
  );

  const handleCloseThread = useCallback(() => {
    setIsThreadPanelOpen(false);
    setActiveThreadId(null);
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;
    if (!commentById.has(activeThreadId)) {
      setIsThreadPanelOpen(false);
      setActiveThreadId(null);
    }
  }, [activeThreadId, commentById]);

  return (
  <section className="space-y-4 mt-2 mb-2" aria-label="Seção de comentários">
      <div className="mx-auto w-full space-y-3">
        <header className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
          Comentários ({totalComments})
        </header>

        <form
          onSubmit={handleCommentSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70"
        >
          <div className="flex flex-col gap-2">
            {!userId && (
              <div className="space-y-2">
                <input
                  id="comment-name"
                  type="text"
                  placeholder="Digite seu nome"
                  value={commentDraft.nome}
                  onChange={(event) => handleCommentDraftChange("nome", event.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-800 shadow-inner outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
                  disabled={submissionStatus === "sending"}
                />
                <p className="text-xs text-zinc-500">Esse nome aparecerá junto ao seu comentário.</p>
              </div>
            )}

            <textarea
              placeholder="Escreva seu comentário"
              value={commentDraft.comentario}
              onChange={(event) =>
                handleCommentDraftChange("comentario", event.target.value)
              }
              className="h-20 sm:h-24 w-full resize-none rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-800 shadow-inner outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-700 whitespace-pre-wrap break-words"
              disabled={submissionStatus === "sending"}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span
              className={
                commentLength.isOverLimit
                  ? "font-medium text-red-500 dark:text-red-400"
                  : undefined
              }
            >
              {commentLength.message}
            </span>
            <button
              type="submit"
              disabled={
                submissionStatus === "sending" || commentLength.isOverLimit
              }
              className="inline-flex items-center my-2 gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:border-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
            >
              {submissionStatus === "sending" ? "Enviando..." : "Publicar"}
            </button>
          </div>

          {submissionStatus === "success" && statusMessage && (
            <p className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">{statusMessage}</p>
          )}

          {submissionStatus === "error" && errorMessage && (
            <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">{errorMessage}</p>
          )}

          {submissionStatus === "typing" && (
            <p className="text-xs text-zinc-500">Pronto para enviar quando quiser.</p>
          )}
        </form>

        {submissionStatus !== "success" && errorMessage && submissionStatus !== "error" && (
          <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">{errorMessage}</p>
        )}

        <div className="mt-4 space-y-4">
          <CommentThread
            lookup={commentLookup}
            replyCounts={replyCounts}
            onReplyRequest={handleReplyRequest}
            onReplyCancel={handleReplyCancel}
            onReplySubmit={handleReplySubmit}
            onReplyDraftChange={handleReplyDraftChange}
            getReplyDraft={getReplyDraftFor}
            getReplyStatus={getReplyStatusFor}
            getReplyError={getReplyErrorFor}
            isReplying={isReplyingTo}
            canDelete={canDeleteComment}
            onDelete={handleDelete}
            requiresName={!userId}
            onOpenThread={handleOpenThread}
            coAuthorUserId={coAuthorUserId}
          />

          {totalComments === 0 && (
            <p className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-2 sm:px-6 sm:py-4 text-sm text-zinc-400">Nenhum comentário ainda. Seja o primeiro!</p>
          )}
        </div>
      </div>
      {activeThreadId && isThreadPanelOpen && (
        <ThreadPanel
          rootCommentId={activeThreadId}
          lookup={commentLookup}
          replyCounts={replyCounts}
          commentById={commentById}
          onClose={handleCloseThread}
          onReplyRequest={handleReplyRequest}
          onReplyCancel={handleReplyCancel}
          onReplySubmit={handleReplySubmit}
          onReplyDraftChange={handleReplyDraftChange}
          getReplyDraft={getReplyDraftFor}
          getReplyStatus={getReplyStatusFor}
          getReplyError={getReplyErrorFor}
          isReplying={isReplyingTo}
          canDelete={canDeleteComment}
          onDelete={handleDelete}
          requiresName={!userId}
          coAuthorUserId={coAuthorUserId}
        />
      )}
    </section>
  );
};

export default Comment;









