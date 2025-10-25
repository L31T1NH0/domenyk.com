"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type PostScopedComment = {
  _id: string;
  comentario: string;
  createdAt: string;
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
  const [comments, setComments] = useState<(PostScopedComment | AdminComment)[]>([]);
  const [mounted, setMounted] = useState(false);

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
      try {
        let data: unknown;
        if (mode === "all") {
          const res = await fetch(`/admin/api/comments?limit=50`);
          if (!res.ok) throw new Error(await res.text());
          const payload = (await res.json()) as { comments: AdminComment[] };
          data = payload.comments;
        } else {
          if (!postId) return;
          const res = await fetch(`/api/comments/${postId}`);
          if (!res.ok) throw new Error(await res.text());
          data = (await res.json()) as PostScopedComment[];
        }
        if (!cancelled) setComments(data as any);
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

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-medium">Comentários</h3>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Fechar
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3 text-sm">
          {loading && <div className="text-zinc-400">Carregando...</div>}
          {error && <div className="text-red-400">{error}</div>}
          {!loading && !error && comments.length === 0 && (
            <div className="text-zinc-400">Nenhum comentário.</div>
          )}
          <ul className="space-y-4">
            {comments.map((c: any) => (
              <li key={c._id} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
                {mode === "all" ? (
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      <span className="text-zinc-500">Post:</span>{" "}
                      <Link href={`/posts/${c.postId}`} className="text-zinc-200 hover:underline">
                        {c.postTitle}
                      </Link>
                      <span className="text-zinc-500"> ({c.postId})</span>
                    </span>
                    <span>{c.createdAt}</span>
                  </div>
                ) : (
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                    <span>{c.firstName || c.nome || "Usuário"}</span>
                    <span>{c.createdAt}</span>
                  </div>
                )}
                {mode === "all" ? (
                  <div className="mb-2 text-xs text-zinc-400">Autor: {c.author || "Usuário"}</div>
                ) : null}
                <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: c.comentario }} />
                {mode === "post" && Array.isArray(c.replies) && c.replies.length > 0 && (
                  <ul className="mt-3 space-y-3 border-l border-zinc-800 pl-3">
                    {c.replies.map((r: any) => (
                      <li key={r._id}>
                        <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                          <span>{r.firstName || r.nome || "Usuário"}</span>
                          <span>{r.createdAt}</span>
                        </div>
                        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: r.comentario }} />
                      </li>
                    ))}
                  </ul>
                )}
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
