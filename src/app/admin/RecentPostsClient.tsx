"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import VisibilityToggle from "./VisibilityToggle";
import ParagraphCommentsToggle from "./ParagraphCommentsToggle";
import CommentsModal from "./CommentsModal";

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
};

type SortKey = "date" | "views" | "status";
type SortOrder = "asc" | "desc";

function CheckboxBtn({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${checked
          ? "border-zinc-500 bg-zinc-100 text-zinc-900"
          : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
        }`}
    >
      <span className={`inline-block h-3 w-3 rounded-sm ${checked ? "bg-zinc-900" : "bg-transparent border border-zinc-600"}`} />
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

  const headerCells = [
    { key: "select", label: "", className: "md:w-12" },
    { key: "title", label: "Título" },
    { key: "subtitle", label: "Subtítulo", hide: true },
    { key: "id", label: "ID", hide: true },
    { key: "date", label: "Data" },
    { key: "views", label: "Views", align: "right" as const },
    { key: "comments", label: "Comentários", align: "right" as const },
    { key: "tags", label: "Tags", hide: true },
    { key: "categories", label: "Categorias", hide: true },
    { key: "coAuthor", label: "Co-autor", hide: true },
    { key: "paragraphs", label: "Parágrafos", align: "right" as const, hide: true },
    { key: "visibility", label: "Visibilidade", align: "right" as const },
  ];

  const cellBase = "md:table-cell md:border-t md:border-zinc-800/90 md:px-4 md:py-2.5";
  const cellHide = "md:hidden";
  const headerCellBase = "md:table-cell md:px-4 md:py-3";

  return (
    <>
      <div className="space-y-4 text-sm md:table md:w-full md:border-separate md:space-y-0 md:[border-spacing:0]">
        <div className="hidden md:table-header-group bg-zinc-900/70 text-zinc-400 backdrop-blur">
          <div className="md:table-row">
            {headerCells.map((cell) => (
              <div
                key={cell.key}
                className={`${cell.hide ? "md:hidden" : headerCellBase} font-medium ${cell.className ?? ""} ${cell.align === "right" ? "text-right" : ""}`}
              >
                {cell.label}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 md:table-row-group md:space-y-0">
          {selectedIds.length > 0 && (
            <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/70 p-4 shadow-[0_12px_32px_-24px_rgba(0,0,0,0.9)] md:table-row md:rounded-none md:border-0 md:bg-zinc-900/40 md:p-0 md:shadow-none">
              <div className={`${cellBase}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-zinc-300">{selectedIds.length} selecionado(s)</div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <button
                      onClick={() => bulkAction("visibility", { hidden: false })}
                      disabled={bulkLoading}
                      className="inline-flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60 sm:w-auto"
                    >
                      Tornar visível
                    </button>
                    <button
                      onClick={() => bulkAction("visibility", { hidden: true })}
                      disabled={bulkLoading}
                      className="inline-flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
                    >
                      Ocultar
                    </button>
                    <button
                      onClick={() => bulkAction("delete")}
                      disabled={bulkLoading}
                      className="inline-flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-red-300 hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/70 p-4 shadow-[0_12px_32px_-24px_rgba(0,0,0,0.9)] md:table-row md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <div className={`${cellBase}`}>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
                <CheckboxBtn
                  checked={allSelected}
                  onChange={(next) => {
                    const map: Record<string, boolean> = {};
                    posts.forEach((row) => (map[row.postId] = next));
                    setSelected(map);
                  }}
                  label="selecionar todos"
                />
                <span className="text-zinc-400">order:</span>
                <button
                  onClick={() => toggleSort("date")}
                  className={`rounded-md border px-3 py-2 transition-colors ${sortKey === "date" ? "border-zinc-500 bg-zinc-100 text-zinc-900" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"}`}
                >
                  data
                </button>
                <button
                  onClick={() => toggleSort("views")}
                  className={`rounded-md border px-3 py-2 transition-colors ${sortKey === "views" ? "border-zinc-500 bg-zinc-100 text-zinc-900" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"}`}
                >
                  views
                </button>
                <button
                  onClick={() => toggleSort("status")}
                  className={`rounded-md border px-3 py-2 transition-colors ${sortKey === "status" ? "border-zinc-500 bg-zinc-100 text-zinc-900" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"}`}
                >
                  status
                </button>
                <div className="ml-2 flex items-center gap-2">
                  <span className="text-zinc-400">↓↑</span>
                  <button
                    onClick={() => setSortOrder("asc")}
                    className={`rounded-md border px-3 py-2 transition-colors ${sortOrder === "asc" ? "border-zinc-500 bg-zinc-100 text-zinc-900" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"}`}
                    title="Crescente"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => setSortOrder("desc")}
                    className={`rounded-md border px-3 py-2 transition-colors ${sortOrder === "desc" ? "border-zinc-500 bg-zinc-100 text-zinc-900" : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"}`}
                    title="Decrescente"
                  >
                    ↓
                  </button>
                </div>
                <span className="mx-2 hidden h-4 w-px bg-zinc-800 md:block" />
                <button
                  onClick={() => {
                    setModalMode("all");
                    setModalPostId(null);
                    setModalOpen(true);
                  }}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200 transition-colors hover:bg-zinc-800 sm:w-auto"
                >
                  ver todos os comentarios
                </button>
              </div>
            </div>
          </div>
          {posts.map((p) => (
            <div
              key={p.postId}
              className="space-y-4 rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-4 transition-all hover:border-zinc-700 md:table-row md:space-y-0 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:hover:bg-zinc-900/40"
            >
              <div className={`${cellBase} md:w-12`}>
                <div className="flex items-center justify-between md:block">
                  <span className="text-xs font-medium uppercase text-zinc-500 md:hidden">Seleção</span>
                  <CheckboxBtn
                    checked={!!selected[p.postId]}
                    onChange={(next) => setSelected((s) => ({ ...s, [p.postId]: next }))}
                  />
                </div>
              </div>
              <div className={`${cellBase} md:max-w-[320px] md:align-top`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Título</div>
                <Link
                  href={`/posts/${p.postId}`}
                  className="block text-sm font-medium text-zinc-100 hover:underline md:max-w-[320px] md:truncate"
                >
                  {p.title}
                </Link>
              </div>
              <div className={`${cellHide}`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Subtítulo</div>
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
              <div className={`${cellHide}`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">ID</div>
                <div className="text-sm text-zinc-400 break-all">{p.postId}</div>
              </div>
              <div className={`${cellBase}`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Data</div>
                <div className="text-sm text-zinc-400">{p.date ?? "-"}</div>
              </div>
              <div className={`${cellBase} md:text-right`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Views</div>
                <div className="text-sm">{p.views ?? 0}</div>
              </div>
              <div className={`${cellBase} md:text-right`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Comentários</div>
                <button
                  onClick={() => {
                    setModalMode("post");
                    setModalPostId(p.postId);
                    setModalOpen(true);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 md:w-auto"
                  title="Visualizar comentários"
                >
                  {p.commentCount ?? 0} comentários
                </button>
              </div>
              <div className={`${cellHide}`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Tags</div>
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
              <div className={`${cellHide}`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Categorias</div>
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
              <div className={`${cellHide}`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Co-autor</div>
                <select
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 md:min-w-[160px] md:w-auto"
                  value={p.coAuthorUserId ?? ""}
                  onChange={async (e) => {
                    const next = e.target.value;
                    await updateMeta(p.postId, { coAuthorUserId: next || null });
                    setPosts((rows) => rows.map((r) => (r.postId === p.postId ? { ...r, coAuthorUserId: next || null } : r)));
                  }}
                >
                  <option value="">Nenhum</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`${cellHide}`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Parágrafos</div>
                <div className="mt-2 md:mt-0">
                  <ParagraphCommentsToggle
                    postId={p.postId}
                    enabled={p.paragraphCommentsEnabled !== false}
                    onToggle={(next) =>
                      setPosts((rows) =>
                        rows.map((r) =>
                          r.postId === p.postId
                            ? { ...r, paragraphCommentsEnabled: next }
                            : r
                        )
                      )
                    }
                  />
                </div>
              </div>
              <div className={`${cellBase} md:text-right`}>
                <div className="text-xs font-medium uppercase text-zinc-500 md:hidden">Visibilidade</div>
                <div className="mt-2 md:mt-0">
                  <VisibilityToggle postId={p.postId} hidden={p.hidden} />
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && !loading && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-400 md:table-row md:border-0 md:bg-transparent md:p-0">
              <div className={`${cellBase} text-center md:py-8`}>
                Nenhum post encontrado.
              </div>
            </div>
          )}
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/70 p-4 shadow-[0_12px_32px_-24px_rgba(0,0,0,0.9)] md:table-row md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <div className={`${cellBase}`}>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                {error && <span className="text-sm text-red-500 sm:mr-4">{error}</span>}
                {hasMore ? (
                  <button
                    onClick={() => onLoadMore(false)}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
                  >
                    {loading ? "Carregando..." : "Mostrar mais"}
                  </button>
                ) : (
                  <span className="text-sm text-zinc-400">Todos os posts carregados</span>
                )}
              </div>
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
