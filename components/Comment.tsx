"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

import {
  STANDARD_COMMENT_MAX_LENGTH,
  buildLengthErrorMessage,
  useCommentLength,
} from "@components/comments/lengthUtils";
import { layoutClasses } from "@components/layout";
import { useReveal } from "@lib/useReveal";

import CommentThread from "./comments/CommentThread";
import { CommentDraft, CommentEntity, SubmissionStatus } from "./comments/types";
import {
  buildCommentLookup,
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
  const [storedIp, setStoredIp] = useState<string>("");
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, CommentDraft>>({});
  const [replyStatuses, setReplyStatuses] = useState<Record<string, SubmissionStatus>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string | null>>({});
  const [isClient, setIsClient] = useState(false);

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
        const parsed = JSON.parse(storedUser) as { nome?: string; ip?: string };
        const { nome, ip } = parsed;
        setCommentDraft((prev) => ({ ...prev, nome: nome ?? "" }));
        if (ip) setStoredIp(ip);
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
    } catch {
      ipValue = ipValue || "Unknown";
    }

    const tempId = `temp-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const optimisticHtml = sanitizeCommentHtml(commentDraft.comentario.replace(/\n/g, "<br />"));

    const optimisticComment: CommentEntity = userId
      ? {
          _id: tempId,
          postId,
          comentario: optimisticHtml,
          ip: ipValue,
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
          ip: ipValue,
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
        localStorage.setItem(`user-${postId}`, JSON.stringify({ nome: trimmedName, ip: ipValue }));
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
          ip: storedIp || "Unknown",
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
          ip: storedIp || "Unknown",
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
          JSON.stringify({ nome: trimmedName || commentDraft.nome, ip: storedIp })
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

  const sectionRef = useReveal<HTMLDivElement>({ threshold: 0.2 });
  const headingRef = useReveal<HTMLDivElement>({ threshold: 0.25 });

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

  return (
    <section className={layoutClasses.section} aria-label="Seção de comentários">
      <div ref={sectionRef} className={`reveal-init ${layoutClasses.grid}`}>
        <div className={layoutClasses.columns.main}>
          <div className="flex flex-col gap-10">
            <div ref={headingRef} className="reveal-init comment-heading">
              <span className="text-xs uppercase tracking-[0.5em] text-[var(--color-muted)]">Leitura coletiva</span>
              <h2 className="text-[clamp(1.9rem,3vw,2.4rem)] leading-tight text-white">
                Readers’ Reflections
              </h2>
              <span className="text-[var(--color-muted)] text-xs tracking-[0.35em]">
                ({totalComments})
              </span>
            </div>

            <form onSubmit={handleCommentSubmit} className="comment-form flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-col gap-4 text-left">
                {!userId && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="comment-name" className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
                      Identifique-se
                    </label>
                    <input
                      id="comment-name"
                      type="text"
                      placeholder="Digite seu nome"
                      value={commentDraft.nome}
                      onChange={(event) => handleCommentDraftChange("nome", event.target.value)}
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-transparent px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] transition focus:border-[var(--color-accent)] focus:outline-none"
                      disabled={submissionStatus === "sending"}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label htmlFor="comment-message" className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
                    Compartilhe sua visão
                  </label>
                  <textarea
                    id="comment-message"
                    placeholder="Escreva seu comentário"
                    value={commentDraft.comentario}
                    onChange={(event) => handleCommentDraftChange("comentario", event.target.value)}
                    className="min-h-[140px] w-full resize-none rounded-xl border border-[rgba(255,255,255,0.12)] bg-transparent px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] transition focus:border-[var(--color-accent)] focus:outline-none"
                    disabled={submissionStatus === "sending"}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 text-xs uppercase tracking-[0.24em] text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
                <span className={commentLength.isOverLimit ? "text-[var(--color-accent)]" : undefined}>
                  {commentLength.message}
                </span>
                <button
                  type="submit"
                  disabled={submissionStatus === "sending" || commentLength.isOverLimit}
                  className="comment-button motion-scale disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submissionStatus === "sending" ? "Enviando..." : "Publicar"}
                </button>
              </div>

              {submissionStatus === "success" && statusMessage && (
                <p className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-emerald-200">
                  {statusMessage}
                </p>
              )}

              {errorMessage && (
                <p className="rounded-full border border-[rgba(255,75,139,0.45)] bg-[rgba(255,75,139,0.12)] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[var(--color-text)]">
                  {errorMessage}
                </p>
              )}

              {submissionStatus === "typing" && (
                <p className="text-[0.6rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                  Pronto para enviar quando quiser.
                </p>
              )}
            </form>

            <div className="space-y-6">
              <CommentThread
                parentId={null}
                lookup={commentLookup}
                onReplyRequest={handleReplyRequest}
                onReplyCancel={handleReplyCancel}
                onReplySubmit={handleReplySubmit}
                onReplyDraftChange={handleReplyDraftChange}
                getReplyDraft={(commentId) => replyDrafts[commentId] ?? { nome: commentDraft.nome, comentario: "" }}
                getReplyStatus={(commentId) => replyStatuses[commentId] ?? "idle"}
                getReplyError={(commentId) => replyErrors[commentId] ?? null}
                isReplying={(commentId) => activeReplyId === commentId}
                canDelete={canDeleteComment}
                onDelete={handleDelete}
                requiresName={!userId}
                coAuthorUserId={coAuthorUserId}
              />

              {totalComments === 0 && (
                <p className="rounded-3xl border border-[var(--color-border)] bg-[rgba(22,22,22,0.7)] px-6 py-5 text-sm text-[var(--color-muted)]">
                  Nenhum comentário ainda. Seja o primeiro!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Comment;









