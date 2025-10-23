"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/solid";

import CommentThread from "./comments/CommentThread";
import {
  CommentDraft,
  CommentEntity,
  SubmissionStatus,
} from "./comments/types";
import {
  buildCommentLookup,
  flattenServerComments,
  normalizeServerComment,
  sanitizeCommentHtml,
} from "./comments/utils";

type CommentProps = {
  postId: string;
};

const COMMENT_MAX_LENGTH = 120;
const COOLDOWN_MS = 2500;

const emptyDraft: CommentDraft = { nome: "", comentario: "" };

const Comment: React.FC<CommentProps> = ({ postId }) => {
  const { userId, isLoaded } = useAuth();
  const { user } = useUser();

  const [comments, setComments] = useState<CommentEntity[]>([]);
  const [commentDraft, setCommentDraft] = useState<CommentDraft>(emptyDraft);
  const [storedIp, setStoredIp] = useState<string>("");
  const [submissionStatus, setSubmissionStatus] =
    useState<SubmissionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, CommentDraft>>({});
  const [replyStatuses, setReplyStatuses] =
    useState<Record<string, SubmissionStatus>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string | null>>({});
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);

  const pendingRequestRef = useRef<AbortController | null>(null);
  const replyRequestRefs = useRef<Record<string, AbortController | null>>({});
  const cooldownUntilRef = useRef<number>(0);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || userId || !isLoaded) {
      return;
    }

    const storedUser = localStorage.getItem(`user_${postId}`);
    if (storedUser) {
      try {
        const { nome, ip } = JSON.parse(storedUser) as {
          nome?: string;
          ip?: string;
        };
        setCommentDraft((prev) => ({
          ...prev,
          nome: nome ?? "",
        }));
        if (ip) {
          setStoredIp(ip);
        }
      } catch (error) {
        console.warn("Failed to parse stored user", error);
      }
    }
  }, [isClient, isLoaded, postId, userId]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch("/admin/api/check", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = await response.json();
        setIsAdmin(Boolean(data.isAdmin));
      } catch (error) {
        setIsAdmin(false);
      }
    };

    if (isLoaded) {
      checkAdminStatus();
    }
  }, [isLoaded]);

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/comments/${postId}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as unknown;
      if (Array.isArray(data)) {
        setComments(flattenServerComments(data as any));
      } else {
        setComments([]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao carregar comentários.";
      setErrorMessage(message);
      setComments([]);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => () => {
    pendingRequestRef.current?.abort();
    Object.values(replyRequestRefs.current).forEach((controller) =>
      controller?.abort()
    );
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

  const commentLookup = useMemo(
    () => buildCommentLookup(comments),
    [comments]
  );

  const totalComments = comments.length;

  const canDeleteComment = useCallback(
    (comment: CommentEntity) => {
      if (!isLoaded) {
        return false;
      }
      if (isAdmin) {
        return true;
      }
      return (
        Boolean(userId) &&
        "userId" in comment &&
        comment.userId === userId
      );
    },
    [isAdmin, isLoaded, userId]
  );

  const resetForm = () => {
    setCommentDraft((prev) => ({ ...prev, comentario: "" }));
  };

  const ensureReplyDraft = useCallback(
    (commentId: string) => {
      setReplyDrafts((prev) => {
        if (prev[commentId]) {
          return prev;
        }
        return {
          ...prev,
          [commentId]: {
            nome: commentDraft.nome,
            comentario: "",
          },
        };
      });
    },
    [commentDraft.nome]
  );

  const handleCommentDraftChange = (
    field: keyof CommentDraft,
    value: string
  ) => {
    setCommentDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (submissionStatus !== "sending") {
      setSubmissionStatus(value ? "typing" : "idle");
    }
    if (statusMessage) {
      setStatusMessage(null);
    }
    if (errorMessage) {
      setErrorMessage(null);
    }
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

    if (pendingRequestRef.current) {
      return;
    }

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

    if (trimmedComment.length > COMMENT_MAX_LENGTH) {
      setErrorMessage(
        `O comentário deve ter no máximo ${COMMENT_MAX_LENGTH} caracteres.`
      );
      return;
    }

    setSubmissionStatus("sending");
    setStatusMessage(null);
    setErrorMessage(null);

    const controller = new AbortController();
    pendingRequestRef.current = controller;

    let ipValue = storedIp;
    try {
      if (!ipValue) {
        const ipResponse = await fetch("https://api.ipify.org?format=json", {
          method: "GET",
          signal: controller.signal,
        });
        const ipData = await ipResponse.json();
        ipValue = typeof ipData.ip === "string" ? ipData.ip : "Unknown";
        setStoredIp(ipValue);
      }
    } catch (error) {
      ipValue = ipValue || "Unknown";
    }

    const tempId = `temp-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const optimisticHtml = sanitizeCommentHtml(
      commentDraft.comentario.replace(/\n/g, "<br />")
    );

    const optimisticComment: CommentEntity = userId
      ? {
          _id: tempId,
          postId,
          comentario: optimisticHtml,
          ip: ipValue,
          createdAt,
          parentId: null,
          firstName: user?.firstName ?? "Você",
          role: user?.publicMetadata?.role === "admin" ? "admin" : null,
          userId,
          imageURL: user?.imageUrl ?? "",
          hasImage: Boolean(user?.hasImage),
          optimistic: true,
        }
      : {
          _id: tempId,
          postId,
          comentario: optimisticHtml,
          ip: ipValue,
          createdAt,
          parentId: null,
          nome: trimmedName || "Anonymous",
          optimistic: true,
        };

    setComments((prev) => [optimisticComment, ...prev]);

    try {
      const payload: Record<string, unknown> = {
        comentario: trimmedComment,
        parentId: null,
      };

      if (!userId) {
        payload.nome = trimmedName || "Anonymous";
      }

      const response = await fetch(`/api/comments/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      const rawComment = userId ? result.comment : result.comment;
      const resolved = normalizeServerComment(rawComment);
      replaceOptimistic(tempId, resolved);

      if (!userId && isClient) {
        localStorage.setItem(
          `user_${postId}`,
          JSON.stringify({ nome: trimmedName, ip: ipValue })
        );
      }

      resetForm();
      setActiveReplyId(null);
      setSubmissionStatus("success");
      setStatusMessage("Comentário enviado com sucesso!");
      cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
    } catch (error) {
      if ((error as DOMException).name === "AbortError") {
        return;
      }
      removeOptimistic(tempId);
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o comentário.";
      setSubmissionStatus("error");
      setErrorMessage(message);
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
    setReplyDrafts((prev) => ({
      ...prev,
      [commentId]: {
        ...prev[commentId],
        comentario: "",
      },
    }));
    setReplyStatuses((prev) => ({ ...prev, [commentId]: "idle" }));
    setReplyErrors((prev) => ({ ...prev, [commentId]: null }));
  };

  const handleReplyDraftChange = (commentId: string, draft: CommentDraft) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [commentId]: draft,
    }));
    setReplyStatuses((prev) => ({
      ...prev,
      [commentId]: draft.comentario ? "typing" : "idle",
    }));
  };

  const handleReplySubmit = async (
    commentId: string,
    draft: CommentDraft
  ) => {
    if (replyRequestRefs.current[commentId]) {
      return;
    }

    const trimmedComment = draft.comentario.trim();
    const trimmedName = draft.nome.trim();

    if (!trimmedComment) {
      setReplyErrors((prev) => ({
        ...prev,
        [commentId]: "Responda antes de enviar.",
      }));
      return;
    }

    if (!userId && !trimmedName) {
      setReplyErrors((prev) => ({
        ...prev,
        [commentId]: "Informe seu nome.",
      }));
      return;
    }

    if (trimmedComment.length > COMMENT_MAX_LENGTH) {
      setReplyErrors((prev) => ({
        ...prev,
        [commentId]: `A resposta deve ter até ${COMMENT_MAX_LENGTH} caracteres.`,
      }));
      return;
    }

    const controller = new AbortController();
    replyRequestRefs.current[commentId] = controller;
    setReplyStatuses((prev) => ({ ...prev, [commentId]: "sending" }));
    setReplyErrors((prev) => ({ ...prev, [commentId]: null }));

    const tempId = `temp-reply-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const htmlContent = sanitizeCommentHtml(
      draft.comentario.replace(/\n/g, "<br />")
    );

    const optimisticReply: CommentEntity = userId
      ? {
          _id: tempId,
          postId,
          comentario: htmlContent,
          ip: storedIp || "Unknown",
          createdAt,
          parentId: commentId,
          firstName: user?.firstName ?? "Você",
          role: user?.publicMetadata?.role === "admin" ? "admin" : null,
          userId,
          imageURL: user?.imageUrl ?? "",
          hasImage: Boolean(user?.hasImage),
          optimistic: true,
        }
      : {
          _id: tempId,
          postId,
          comentario: htmlContent,
          ip: storedIp || "Unknown",
          createdAt,
          parentId: commentId,
          nome: trimmedName || commentDraft.nome || "Anonymous",
          optimistic: true,
        };

    setComments((prev) => [optimisticReply, ...prev]);

    try {
      const payload: Record<string, unknown> = {
        comentario: trimmedComment,
        parentId: commentId,
      };
      if (!userId) {
        payload.nome = trimmedName || commentDraft.nome || "Anonymous";
      }

      const response = await fetch(`/api/comments/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      const rawReply = result.reply ?? result.comment;
      const resolved = normalizeServerComment(rawReply);
      replaceOptimistic(tempId, resolved);

      if (!userId && isClient) {
        localStorage.setItem(
          `user_${postId}`,
          JSON.stringify({
            nome: trimmedName || commentDraft.nome,
            ip: storedIp,
          })
        );
      }

      setReplyDrafts((prev) => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          comentario: "",
        },
      }));
      setReplyStatuses((prev) => ({ ...prev, [commentId]: "success" }));
      setActiveReplyId(null);
    } catch (error) {
      if ((error as DOMException).name === "AbortError") {
        return;
      }
      removeOptimistic(tempId);
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a resposta.";
      setReplyStatuses((prev) => ({ ...prev, [commentId]: "error" }));
      setReplyErrors((prev) => ({ ...prev, [commentId]: message }));
    } finally {
      replyRequestRefs.current[commentId] = null;
    }
  };

  const removeBranch = useCallback(
    (targetId: string) => {
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
    },
    []
  );

  const handleDelete = useCallback(
    async (comment: CommentEntity) => {
      const confirmed = window.confirm(
        "Tem certeza de que deseja remover este comentário?"
      );
      if (!confirmed) {
        return;
      }

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

        if (!response.ok) {
          throw new Error(await response.text());
        }

        removeBranch(comment._id);
        setStatusMessage("Comentário removido.");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível remover o comentário.";
        setErrorMessage(message);
      }
    },
    [postId, removeBranch]
  );

  return (
    <section className="space-y-6" aria-label="Seção de comentários">
      <header className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
        <ChatBubbleLeftRightIcon className="h-5 w-5" />
        Comentários ({totalComments})
      </header>

      <form
        onSubmit={handleCommentSubmit}
        className="space-y-4 rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-6 shadow-inner shadow-black/40"
      >
        <div className="flex flex-col gap-3">
          <div className="space-y-2">
            <label
              htmlFor="comment-name"
              className="text-xs font-semibold uppercase tracking-wide text-zinc-400"
            >
              Nome
            </label>
            <input
              id="comment-name"
              type="text"
              placeholder={
                userId
                  ? "Nome que será exibido"
                  : "Digite seu nome"
              }
              value={commentDraft.nome}
              onChange={(event) =>
                handleCommentDraftChange("nome", event.target.value)
              }
              className="w-full rounded-2xl border border-zinc-800/70 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/40"
              disabled={submissionStatus === "sending"}
            />
            {!userId && (
              <p className="text-xs text-zinc-500">
                Esse nome aparecerá junto ao seu comentário.
              </p>
            )}
          </div>

          <textarea
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="Escreva seu comentário"
            value={commentDraft.comentario}
            onChange={(event) =>
              handleCommentDraftChange("comentario", event.target.value)
            }
            className="h-36 w-full resize-none rounded-2xl border border-zinc-800/70 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/40"
            disabled={submissionStatus === "sending"}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-xs text-zinc-500">
            {commentDraft.comentario.length}/{COMMENT_MAX_LENGTH}
          </div>
          <button
            type="submit"
            disabled={submissionStatus === "sending"}
            className="rounded-full bg-purple-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-purple-800/60"
          >
            {submissionStatus === "sending" ? "Enviando…" : "Enviar comentário"}
          </button>
        </div>

        {submissionStatus === "success" && statusMessage && (
          <p className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {statusMessage}
          </p>
        )}

        {submissionStatus === "error" && errorMessage && (
          <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {errorMessage}
          </p>
        )}

        {submissionStatus === "typing" && (
          <p className="text-xs text-zinc-500">Pronto para enviar quando quiser.</p>
        )}
      </form>

      {submissionStatus !== "success" && errorMessage && submissionStatus !== "error" && (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {errorMessage}
        </p>
      )}

      <div className="space-y-4">
        <CommentThread
          parentId={null}
          lookup={commentLookup}
          onReplyRequest={handleReplyRequest}
          onReplyCancel={handleReplyCancel}
          onReplySubmit={handleReplySubmit}
          onReplyDraftChange={handleReplyDraftChange}
          getReplyDraft={(commentId) =>
            replyDrafts[commentId] ?? { nome: commentDraft.nome, comentario: "" }
          }
          getReplyStatus={(commentId) => replyStatuses[commentId] ?? "idle"}
          getReplyError={(commentId) => replyErrors[commentId] ?? null}
          isReplying={(commentId) => activeReplyId === commentId}
          canDelete={canDeleteComment}
          onDelete={handleDelete}
          requiresName={!userId}
        />

        {totalComments === 0 && (
          <p className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-400">
            Nenhum comentário ainda. Seja o primeiro!
          </p>
        )}
      </div>
    </section>
  );
};

export default Comment;
