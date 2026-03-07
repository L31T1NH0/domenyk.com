"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import VisibilityToggle from "./VisibilityToggle";
import PinToggle from "./PinToggle";
import ParagraphCommentsToggle from "./ParagraphCommentsToggle";
import CommentsModal from "./CommentsModal";
import ScrollHeatmap from "./ScrollHeatmap";

type PostRow = {
  postId: string;
  title: string;
  subtitle?: string | null;
  date?: string;
  views?: number;
  hidden?: boolean;
  commentCount?: number;
  tags?: string[];
  categories?: string[];
  coAuthorUserId?: string | null;
  paragraphCommentsEnabled?: boolean;
  pinnedOrder?: number | null;
};

type SortKey = "date" | "views" | "status";
type SortOrder = "asc" | "desc";

function CheckboxBtn({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ${
        checked
          ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#f1f1f1]"
          : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]"
      }`}
    >
      <span className={`inline-block h-3 w-3 rounded-sm border transition-colors ${checked ? "bg-[#E00070] border-[#E00070]" : "bg-transparent border-white/20"}`} />
      {label}
    </button>
  );
}

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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((t, i) => (
            <span key={`${t}-${i}`} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
              {t}
            </span>
          ))
        ) : (
          <span className="text-xs text-zinc-500">-</span>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-w-[160px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs"
            placeholder={`${label} separadas por vírgula`}
          />
          <button
            onClick={onSubmit}
            disabled={saving}
            className="rounded border border-zinc-700 bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
          >
            Salvar
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
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
          className="self-start rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Editar
        </button>
      )}
    </div>
  );
}

function SubtitleEditor({
  value,
  onSave,
}: {
  value: string | null | undefined;
  onSave: (next: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setText(value ?? "");
    }
  }, [value, editing]);

  const onSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const trimmed = text.trim();
      await onSave(trimmed === "" ? null : trimmed);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        {value && value.trim() !== "" ? (
          <span className="text-sm text-zinc-300">{value}</span>
        ) : (
          <span className="text-sm text-zinc-500">-</span>
        )}
        <button
          onClick={() => {
            setEditing(true);
            setError(null);
          }}
          className="self-start rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-w-[200px] rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
        placeholder="Subtítulo do post"
      />
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
      <div className="flex items-center gap-2">
        <button
          onClick={onSubmit}
          disabled={saving}
          className="rounded border border-zinc-700 bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setText(value ?? "");
            setError(null);
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          Cancelar
        </button>
      </div>
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
  const [modalMode, setModalMode] = useState<"all" | "post">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedConfig, setExpandedConfig] = useState<Record<string, boolean>>({});

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
        limit: "3",
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
    // Reset and fetch when sorting changes. We keep the previous list visible
    // until the new request succeeds to avoid wiping the dashboard in case the
    // network call falhe (por exemplo, quando o Redis não está configurado).
    setHasMore(true);
    setError(null);
    void onLoadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sortOrder]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch("/admin/api/users", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { users: Array<{ id: string; firstName?: string | null; lastName?: string | null }> };
        const mapped = data.users.map((u) => ({ id: u.id, name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.id }));
        setUsers(mapped);
      } catch {
        // ignore
      }
    };
    loadUsers();
  }, []);

  async function updateMeta(
    postId: string,
    patch: Partial<Pick<PostRow, "tags" | "categories" | "coAuthorUserId" | "subtitle">>
  ) {
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

  const handleDownload = async () => {
    const ids = selectedIds.length > 0 ? selectedIds : "all";
    try {
      const res = await fetch("/admin/api/posts/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: ids }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        alert(err.error || "Erro ao baixar posts.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `posts-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Erro ao baixar posts.");
    }
  };



  return (
    <>
      <div className="space-y-4">
        <div className="border border-white/8 rounded-lg bg-[#040404] px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-[#A8A095]">
              {selectedIds.length} selecionado(s)
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <button
                onClick={handleDownload}
                className="inline-flex w-full items-center justify-center rounded-md border border-white/10 px-3 py-1.5 text-xs text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1] disabled:opacity-40 sm:w-auto transition-colors"
                title={selectedIds.length > 0 ? `Baixar ${selectedIds.length} post(s)` : "Baixar todos os posts"}
              >
                {selectedIds.length > 0 ? `⬇ Baixar (${selectedIds.length})` : "⬇ Baixar todos"}
              </button>
              <button
                onClick={() => bulkAction("visibility", { hidden: false })}
                disabled={bulkLoading || selectedIds.length === 0}
                className="inline-flex w-full items-center justify-center rounded-md bg-[#E00070] px-3 py-1.5 text-xs font-medium text-white hover:opacity-80 disabled:opacity-30 sm:w-auto transition-opacity"
              >
                Tornar visível
              </button>
              <button
                onClick={() => bulkAction("visibility", { hidden: true })}
                disabled={bulkLoading || selectedIds.length === 0}
                className="inline-flex w-full items-center justify-center rounded-md border border-white/10 px-3 py-1.5 text-xs text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1] disabled:opacity-40 sm:w-auto transition-colors"
              >
                Ocultar
              </button>
              <button
                onClick={() => bulkAction("delete")}
                disabled={bulkLoading || selectedIds.length === 0}
                className="inline-flex w-full items-center justify-center rounded-md border border-white/10 px-3 py-1.5 text-xs text-red-400 hover:border-red-400/30 hover:bg-red-400/5 disabled:opacity-40 sm:w-auto transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>

        <div className="border border-white/8 rounded-lg bg-[#040404] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <CheckboxBtn
              checked={allSelected}
              onChange={(next) => {
                const map: Record<string, boolean> = {};
                posts.forEach((row) => (map[row.postId] = next));
                setSelected(map);
              }}
              label="selecionar todos"
            />
            <span className="text-white/20 hidden sm:inline">|</span>
            <span className="text-[#A8A095]">order:</span>
            <button
              onClick={() => toggleSort("date")}
              className={`rounded-md border px-3 py-1.5 transition-colors ${sortKey === "date" ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#f1f1f1]" : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]"}`}
            >
              data
            </button>
            <button
              onClick={() => toggleSort("views")}
              className={`rounded-md border px-3 py-1.5 transition-colors ${sortKey === "views" ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#f1f1f1]" : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]"}`}
            >
              views
            </button>
            <button
              onClick={() => toggleSort("status")}
              className={`rounded-md border px-3 py-1.5 transition-colors ${sortKey === "status" ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#f1f1f1]" : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]"}`}
            >
              status
            </button>
            <div className="ml-1 flex items-center gap-1">
              <button
                onClick={() => setSortOrder("asc")}
                className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${sortOrder === "asc" ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#f1f1f1]" : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]"}`}
                title="Crescente"
              >
                ↑
              </button>
              <button
                onClick={() => setSortOrder("desc")}
                className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${sortOrder === "desc" ? "border-[#E00070]/40 bg-[#E00070]/10 text-[#f1f1f1]" : "border-white/10 text-[#A8A095] hover:border-white/20 hover:text-[#f1f1f1]"}`}
                title="Decrescente"
              >
                ↓
              </button>
            </div>
            <span className="mx-2 hidden h-4 w-px bg-white/8 sm:block" />
            <button
              onClick={() => {
                setModalMode("all");
                setModalPostId(null);
                setModalOpen(true);
              }}
              className="w-full rounded-md border border-white/10 px-3 py-1.5 text-[#A8A095] transition-colors hover:border-white/20 hover:text-[#f1f1f1] sm:w-auto"
            >
              ver todos os comentários
            </button>
          </div>
        </div>

        <div className="text-sm border border-white/8 rounded-lg overflow-hidden">
          <div className="hidden md:grid md:grid-cols-[2fr_1fr_80px_120px_80px_80px_80px] border-b border-white/6 px-4 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095]">Título</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095]">Data</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095] text-right">Views</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095] text-right">Comentários</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095] text-right">Fixado</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095] text-right">Visível</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A095] text-right"></div>
          </div>
          <div className="divide-y divide-white/6">
            {posts.map((p) => (
              <div
                key={p.postId}
                className="group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-white/2 md:grid md:grid-cols-[2fr_1fr_80px_120px_80px_80px_80px] md:items-center md:gap-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CheckboxBtn
                    checked={!!selected[p.postId]}
                    onChange={(next) => setSelected((s) => ({ ...s, [p.postId]: next }))}
                  />
                  <Link
                    href={`/posts/${p.postId}`}
                    className="truncate text-sm font-medium text-[#f1f1f1] hover:text-[#E00070] transition-colors"
                  >
                    {p.title}
                  </Link>
                </div>
                <div className="text-xs text-[#A8A095] md:pl-2">
                  {p.date ?? "-"}
                </div>
                <div className="text-xs text-[#f1f1f1] text-right tabular-nums">
                  {p.views ?? 0}
                  <ScrollHeatmap postId={p.postId} />
                </div>
                <div className="text-right">
                  <button
                    onClick={() => {
                      setModalMode("post");
                      setModalPostId(p.postId);
                      setModalOpen(true);
                    }}
                    className="text-xs text-[#A8A095] hover:text-[#f1f1f1] transition-colors"
                  >
                    {p.commentCount ?? 0} comentários
                  </button>
                </div>
                <div className="flex justify-end">
                  <PinToggle postId={p.postId} pinnedOrder={p.pinnedOrder} />
                </div>
                <div className="flex justify-end">
                  <VisibilityToggle postId={p.postId} hidden={p.hidden} />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      setExpandedConfig((prev) => ({
                        ...prev,
                        [p.postId]: !prev[p.postId],
                      }))
                    }
                    className={`text-xs transition-colors ${
                      expandedConfig[p.postId]
                        ? "text-[#E00070]"
                        : "text-[#A8A095] hover:text-[#f1f1f1]"
                    }`}
                  >
                    {expandedConfig[p.postId] ? "fechar" : "config"}
                  </button>
                </div>
              </div>
            ))}
            {posts.map((p) =>
              expandedConfig[p.postId] ? (
                <div
                  key={`config-${p.postId}`}
                  className="border-t border-white/6 bg-white/2 px-4 py-4"
                >
                  <div className="md:py-4">
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Subtítulo</span>
                        <SubtitleEditor
                          value={p.subtitle ?? null}
                          onSave={async (next) => {
                            await updateMeta(p.postId, { subtitle: next });
                            setPosts((rows) =>
                              rows.map((r) => (r.postId === p.postId ? { ...r, subtitle: next ?? null } : r))
                            );
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">ID</span>
                        <span className="text-xs text-zinc-300 break-all font-mono">{p.postId}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tags</span>
                        <TagListEditor
                          values={p.tags ?? []}
                          label="tags"
                          saving={false}
                          onSave={async (next) => {
                            await updateMeta(p.postId, { tags: next });
                            setPosts((rows) => rows.map((r) => (r.postId === p.postId ? { ...r, tags: next } : r)));
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Categorias</span>
                        <TagListEditor
                          values={p.categories ?? []}
                          label="categorias"
                          saving={false}
                          onSave={async (next) => {
                            await updateMeta(p.postId, { categories: next });
                            setPosts((rows) => rows.map((r) => (r.postId === p.postId ? { ...r, categories: next } : r)));
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Co-autor</span>
                        <select
                          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 md:min-w-[160px]"
                          value={p.coAuthorUserId ?? ""}
                          onChange={async (e) => {
                            const next = e.target.value;
                            await updateMeta(p.postId, { coAuthorUserId: next || null });
                            setPosts((rows) => rows.map((r) => (r.postId === p.postId ? { ...r, coAuthorUserId: next || null } : r)));
                          }}
                        >
                          <option value="">Nenhum</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Parágrafos</span>
                        <ParagraphCommentsToggle
                          postId={p.postId}
                          enabled={p.paragraphCommentsEnabled !== false}
                          onToggle={(next) =>
                            setPosts((rows) =>
                              rows.map((r) =>
                                r.postId === p.postId ? { ...r, paragraphCommentsEnabled: next } : r
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null
            )}
            {posts.length === 0 && !loading && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-400 md:table-row md:border-0 md:bg-transparent md:p-0">
                <div className="py-8 text-center">
                  Nenhum post encontrado.
                </div>
              </div>
            )}
            <div className="border-t border-white/6 px-4 py-3 flex items-center justify-center">
              {error && <span className="text-xs text-red-400 mr-4">{error}</span>}
              {hasMore ? (
                <button
                  onClick={() => onLoadMore(false)}
                  disabled={loading}
                  className="text-xs text-[#A8A095] hover:text-[#f1f1f1] disabled:opacity-40 transition-colors"
                >
                  {loading ? "carregando..." : "mostrar mais"}
                </button>
              ) : (
                <span className="text-xs text-[#A8A095]/50">todos os posts carregados</span>
              )}
            </div>
          </div>
        </div>

      </div>

      <CommentsModal
        mode={modalMode}
        postId={modalPostId}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalPostId(null);
          setModalMode("all");
        }}
      />
    </>
  );
}
