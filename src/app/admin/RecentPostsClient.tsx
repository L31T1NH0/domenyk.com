"use client";

import { useState } from "react";
import Link from "next/link";
import VisibilityToggle from "./VisibilityToggle";

type PostRow = {
  postId: string;
  title: string;
  date?: string;
  views?: number;
  hidden?: boolean;
};

export default function RecentPostsClient({ initial }: { initial: PostRow[] }) {
  const [posts, setPosts] = useState<PostRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  async function onLoadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/posts?offset=${posts.length}&limit=5`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { posts: PostRow[]; hasMore: boolean };
      setPosts((p) => [...p, ...data.posts]);
      setHasMore(data.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {posts.map((p) => (
        <tr key={p.postId} className="border-t border-zinc-800 hover:bg-zinc-900/40">
          <td className="px-4 py-2 max-w-[420px] truncate">
            <Link href={`/posts/${p.postId}`} className="hover:underline">
              {p.title}
            </Link>
          </td>
          <td className="px-4 py-2 text-zinc-400">{p.postId}</td>
          <td className="px-4 py-2 text-zinc-400">{p.date ?? "-"}</td>
          <td className="px-4 py-2 text-right">{p.views ?? 0}</td>
          <td className="px-4 py-2 text-right"><VisibilityToggle postId={p.postId} hidden={p.hidden} /></td>
        </tr>
      ))}
      <tr>
        <td colSpan={5} className="px-4 py-3 text-right">
          {error && <span className="text-red-500 text-sm mr-3">{error}</span>}
          {hasMore ? (
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
            >
              {loading ? "Carregando..." : "Mostrar mais"}
            </button>
          ) : (
            <span className="text-sm text-zinc-400">Todos os posts carregados</span>
          )}
        </td>
      </tr>
    </>
  );
}
