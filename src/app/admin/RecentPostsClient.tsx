"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import VisibilityToggle from "./VisibilityToggle";
import CommentsModal from "./CommentsModal";

type PostRow = {
  postId: string;
  title: string;
  date?: string;
  views?: number;
  hidden?: boolean;
  commentCount?: number;
  tags?: string[];
  categories?: string[];
};

type SortKey = "date" | "views" | "status";
type SortOrder = "asc" | "desc";

function TagListEditor({
  values,
  label,
  onSave,
  saving,
}: {
  values: string[];
  label: string;
  onSave: (next: string[]) => Promise<void>;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(values.join(", "));
  const onSubmit = async () => {
    const next = text
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await onSave(next);
    setEditing(false);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {values.length > 0 ? (
          values.map((t) => (
            <span key={t} className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-300">
              {t}
            </span>
          ))
        ) : (
          <span className="text-xs text-zinc-500">-</span>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-w-[160px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            placeholder={`${label} separadas por vírgula`}
          />
          <button
            onClick={onSubmit}
            disabled={saving}
            className="rounded border border-zinc-700 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
          >
            Salvar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setText(values.join(", "));
            setEditing(true);
          }}
          className="self-start rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Editar
        </button>
      )}
    </div>
  );
}

export default function RecentPostsClient({ initial }: { initial: PostRow[] }) {
  const [posts, setPosts] = useState<PostRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [modalPostId, setModalPostId] = useState<string | null>(null);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const allSelected = posts.length > 0 && selectedIds.length === posts.length;

  function toggleSort(nextKey: SortKey) {
    setSortKey((prev) => {
      if (prev === nextKey) {
        setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortOrder("desc");
      return nextKey;
    });
    // refetch handled by effect
  }

  async function onLoadMore(reset = false) {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const offset = reset ? 0 : posts.length;
      const params = new URLSearchParams({
        offset: String(offset),
        limit: "5",
        sort: sortKey,
        order: sortOrder,
      });
      const res = await fetch(`/admin/api/posts?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { posts: PostRow[]; hasMore: boolean };
      setPosts((p) => (reset ? data.posts : [...p, ...data.posts]));
      setHasMore(data.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Reset and fetch when sorting changes
    setPosts([]);
    setHasMore(true);
    void onLoadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sortOrder]);

  async function updateMeta(postId: string, patch: Partial<Pick<PostRow, "tags" | "categories">>) {
    setError(null);
    const res = await fetch(`/admin/api/posts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, ...patch }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function bulkAction(action: "visibility" | "delete", payload?: { hidden?: boolean }) {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/posts/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postIds: selectedIds, ...(payload ?? {}) }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (action === "delete") {
        setPosts((p) => p.filter((row) => !selectedIds.includes(row.postId)));
      } else if (action === "visibility") {
        const hidden = Boolean(payload?.hidden);
        setPosts((p) => p.map((row) => (selectedIds.includes(row.postId) ? { ...row, hidden } : row)));
      }
      setSelected({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <>
      {selectedIds.length > 0 && (
        <tr className="border-t border-zinc-800 bg-zinc-900/60">
          <td className="px-4 py-2" colSpan={9}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-300">{selectedIds.length} selecionado(s)</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulkAction("visibility", { hidden: false })}
                  disabled={bulkLoading}
                  className="rounded-md border border-zinc-700 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
                >
                  Tornar visível
                </button>
                <button
                  onClick={() => bulkAction("visibility", { hidden: true })}
                  disabled={bulkLoading}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                >
                  Ocultar
                </button>
                <button
                  onClick={() => bulkAction("delete")}
                  disabled={bulkLoading}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-red-300 hover:bg-zinc-800 disabled:opacity-60"
                >
                  Excluir
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
      <tr className="border-t border-zinc-800">
        <td className="px-4 py-2" colSpan={9}>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => {
                  const next: Record<string, boolean> = {};
                  posts.forEach((p) => (next[p.postId] = e.target.checked));
                  setSelected(next);
                }}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-zinc-500"
              />
              Selecionar todos
            </label>
            <span className="text-zinc-400">Ordenar por:</span>
            <button
              onClick={() => toggleSort("views")}
              className={`rounded border px-2 py-1 ${sortKey === "views" ? "border-zinc-500 bg-zinc-100 text-zinc-900" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"}`}
            >
              Views
            </button>
            <button
              onClick={() => toggleSort("date")}
              className={`rounded border px-2 py-1 ${sortKey === "date" ? "border-zinc-500 bg-zinc-100 text-zinc-900" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"}`}
            >
              Data
            </button>
            <button
              onClick={() => toggleSort("status")}
              className={`rounded border px-2 py-1 ${sortKey === "status" ? "border-zinc-500 bg-zinc-100 text-zinc-900" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"}`}
            >
              Visibilidade
            </button>
            <button
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
              className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 hover:bg-zinc-800"
              title="Alternar ordem"
            >
              {sortOrder === "asc" ? "Asc" : "Desc"}
            </button>
          </div>
        </td>
      </tr>
      {posts.map((p) => (
        <tr key={p.postId} className="border-t border-zinc-800 hover:bg-zinc-900/40">
          <td className="px-4 py-2">
            <input
              type="checkbox"
              checked={!!selected[p.postId]}
              onChange={(e) => setSelected((s) => ({ ...s, [p.postId]: e.target.checked }))}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-zinc-500"
            />
          </td>
          <td className="px-4 py-2 max-w-[320px] truncate">
            <Link href={`/posts/${p.postId}`} className="hover:underline">
              {p.title}
            </Link>
          </td>
          <td className="px-4 py-2 text-zinc-400">{p.postId}</td>
          <td className="px-4 py-2 text-zinc-400">{p.date ?? "-"}</td>
          <td className="px-4 py-2 text-right">{p.views ?? 0}</td>
          <td className="px-4 py-2 text-right">
            <button
              onClick={() => setModalPostId(p.postId)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              title="Visualizar comentários"
            >
              {p.commentCount ?? 0} comentários
            </button>
          </td>
          <td className="px-4 py-2">
            <TagListEditor
              values={p.tags ?? []}
              label="tags"
              saving={false}
              onSave={async (next) => {
                await updateMeta(p.postId, { tags: next });
                setPosts((rows) => rows.map((r) => (r.postId === p.postId ? { ...r, tags: next } : r)));
              }}
            />
          </td>
          <td className="px-4 py-2">
            <TagListEditor
              values={p.categories ?? []}
              label="categorias"
              saving={false}
              onSave={async (next) => {
                await updateMeta(p.postId, { categories: next });
                setPosts((rows) => rows.map((r) => (r.postId === p.postId ? { ...r, categories: next } : r)));
              }}
            />
          </td>
          <td className="px-4 py-2 text-right"><VisibilityToggle postId={p.postId} hidden={p.hidden} /></td>
        </tr>
      ))}
      <tr>
        <td colSpan={9} className="px-4 py-3">
          <div className="flex items-center justify-center">
            {error && <span className="text-red-500 text-sm mr-3">{error}</span>}
            {hasMore ? (
              <button
                onClick={() => onLoadMore(false)}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
              >
                {loading ? "Carregando..." : "Mostrar mais"}
              </button>
            ) : (
              <span className="text-sm text-zinc-400">Todos os posts carregados</span>
            )}
          </div>
        </td>
      </tr>

      <CommentsModal postId={modalPostId} open={modalPostId !== null} onClose={() => setModalPostId(null)} />
    </>
  );
}
