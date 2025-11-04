"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { sanitizeCommentHtml } from "@components/comments/utils";

type PostScopedComment = {
  _id: string;
  postId: string;
  comentario: string;
  createdAt: string;
  parentId: string | null;
  firstName?: string | null;
  nome?: string;
  replies?: PostScopedComment[];
};

type AdminComment = {
  _id: string;
  comentario: string;
  createdAt: string;
  postId: string;
  postTitle: string;
  author: string;
};

const prunePostComments = (
  comments: PostScopedComment[],
  targetId: string
): PostScopedComment[] => {
  const prune = (items: PostScopedComment[]): PostScopedComment[] =>
    items.reduce<PostScopedComment[]>((acc, item) => {
      if (item._id === targetId) {
        return acc;
      }

      let updated = item;

      if (Array.isArray(item.replies) && item.replies.length > 0) {
        const prunedReplies = prune(item.replies);
        if (prunedReplies.length !== item.replies.length) {
          updated = {
            ...item,
            replies: prunedReplies.length > 0 ? prunedReplies : undefined,
          };
        } else if (prunedReplies !== item.replies) {
          updated = { ...item, replies: prunedReplies };
        }
      }

      acc.push(updated);
      return acc;
    }, []);

  return prune(comments);
};

export default function CommentsModal({
  mode,
  postId,
  open,
  onClose,
}: {
  mode: "all" | "post";
  postId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminComments, setAdminComments] = useState<AdminComment[]>([]);
  const [postComments, setPostComments] = useState<PostScopedComment[]>([]);
  const [mounted, setMounted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setActionMessage(null);
      try {
        if (mode === "all") {
          const res = await fetch(`/admin/api/comments?limit=50`);
          if (!res.ok) throw new Error(await res.text());
          const payload = (await res.json()) as { comments: AdminComment[] };
          if (!cancelled) {
            setAdminComments(payload.comments);
            setPostComments([]);
          }
        } else {
          if (!postId) return;
          const res = await fetch(`/api/comments/${postId}`);
          if (!res.ok) throw new Error(await res.text());
          const data = (await res.json()) as PostScopedComment[];
          if (!cancelled) {
            setPostComments(data);
            setAdminComments([]);
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, postId]);

  if (!open) return null;

  const handleDelete = async ({
    commentId,
    targetPostId,
    isReply,
    parentId,
  }: {
    commentId: string;
    targetPostId: string;
    isReply: boolean;
    parentId?: string | null;
  }) => {
    if (deletingId) return;
    setDeletingId(commentId);
    setActionMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: targetPostId,
          isReply,
          ...(isReply && parentId ? { parentId } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      if (mode === "all") {
        setAdminComments((prev) => prev.filter((comment) => comment._id !== commentId));
      } else {
        setPostComments((prev) => prunePostComments(prev, commentId));
      }

      setActionMessage("Comentário removido com sucesso.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(raw || "Não foi possível remover o comentário.");
    } finally {
      setDeletingId(null);
    }
  };

  const renderReplies = (
    replies: PostScopedComment[],
    rootPostId: string,
    parentId: string
  ) => (
    <ul className="mt-4 space-y-4 border-l border-zinc-800 pl-4">
      {replies.map((reply) => (
        <li key={reply._id} className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{reply.firstName || reply.nome || "Usuário"}</span>
            <span>{reply.createdAt}</span>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() =>
                handleDelete({
                  commentId: reply._id,
                  targetPostId: reply.postId || rootPostId,
                  isReply: true,
                  parentId: reply.parentId || parentId,
                })
              }
              className="rounded-md border border-red-600 px-3 py-1 text-[11px] font-medium text-red-400 transition hover:border-red-500 hover:text-red-300 disabled:opacity-60"
              disabled={deletingId === reply._id}
            >
              {deletingId === reply._id ? "Removendo..." : "Remover"}
            </button>
          </div>
          <div
            className="prose prose-invert max-w-none text-sm"
            dangerouslySetInnerHTML={{
              __html: sanitizeCommentHtml(reply.comentario),
            }}
          />
          {Array.isArray(reply.replies) && reply.replies.length > 0 &&
            renderReplies(reply.replies, reply.postId || rootPostId, reply._id)}
        </li>
      ))}
    </ul>
  );

  const hasComments = mode === "all" ? adminComments.length > 0 : postComments.length > 0;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h3 className="text-sm font-medium">Comentários</h3>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Fechar
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4 text-sm space-y-4">
          {loading && <div className="text-zinc-400">Carregando...</div>}
          {error && <div className="text-red-400">{error}</div>}
          {actionMessage && <div className="text-green-400">{actionMessage}</div>}
          {!loading && !error && !hasComments && (
            <div className="text-zinc-400">Nenhum comentário.</div>
          )}
          <ul className="space-y-5">
            {mode === "all"
              ? adminComments.map((comment) => (
                  <li key={comment._id} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
                    <div className="flex items-start justify-between text-xs text-zinc-400">
                      <div>
                        <span className="text-zinc-500">Post:</span>{" "}
                        <Link href={`/posts/${comment.postId}`} className="text-zinc-200 hover:underline">
                          {comment.postTitle}
                        </Link>
                        <span className="text-zinc-500"> ({comment.postId})</span>
                      </div>
                      <span>{comment.createdAt}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Autor: {comment.author || "Usuário"}</span>
                      <button
                        onClick={() =>
                          handleDelete({
                            commentId: comment._id,
                            targetPostId: comment.postId,
                            isReply: false,
                          })
                        }
                        className="rounded-md border border-red-600 px-3 py-1 text-[11px] font-medium text-red-400 transition hover:border-red-500 hover:text-red-300 disabled:opacity-60"
                        disabled={deletingId === comment._id}
                      >
                        {deletingId === comment._id ? "Removendo..." : "Remover"}
                      </button>
                    </div>
                    <div
                      className="prose prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeCommentHtml(comment.comentario),
                      }}
                    />
                  </li>
                ))
              : postComments.map((comment) => (
                  <li key={comment._id} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{comment.firstName || comment.nome || "Usuário"}</span>
                      <span>{comment.createdAt}</span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() =>
                          handleDelete({
                            commentId: comment._id,
                            targetPostId: comment.postId,
                            isReply: Boolean(comment.parentId),
                            parentId: comment.parentId ?? undefined,
                          })
                        }
                        className="rounded-md border border-red-600 px-3 py-1 text-[11px] font-medium text-red-400 transition hover:border-red-500 hover:text-red-300 disabled:opacity-60"
                        disabled={deletingId === comment._id}
                      >
                        {deletingId === comment._id ? "Removendo..." : "Remover"}
                      </button>
                    </div>
                    <div
                      className="prose prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeCommentHtml(comment.comentario),
                      }}
                    />
                    {Array.isArray(comment.replies) && comment.replies.length > 0 &&
                      renderReplies(comment.replies, comment.postId, comment._id)}
                  </li>
                ))}
          </ul>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
