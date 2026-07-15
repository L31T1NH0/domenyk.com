"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import type { SerializedPostSummary } from "@/lib/db/posts"
import { isTranslationRevisionStale, POST_LOCALE_DETAILS, TRANSLATION_LOCALES } from "@/lib/post-locales"

type Props = { posts: SerializedPostSummary[] }
type StatusFilter = "all" | "published" | "draft"
type VisibilityFilter = "all" | "timeline" | "hidden"
type ColumnKey = "status" | "date" | "views" | "reading" | "style"

const columns: Array<{ key: ColumnKey; label: string }> = [
  { key: "status", label: "Status" },
  { key: "date", label: "Publicado" },
  { key: "views", label: "Views" },
  { key: "reading", label: "Leitura" },
  { key: "style", label: "Estilo" },
]

function formatDate(value?: string) {
  if (!value) return "Sem data"
  return format(new Date(value), "dd MMM yyyy", { locale: ptBR })
}

function postMatchesQuery(post: SerializedPostSummary, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  return [
    post.title,
    post.slug,
    post.publicId,
    post.excerpt,
    ...TRANSLATION_LOCALES.flatMap((locale) => {
      const translation = post.translations?.[locale]
      return translation ? [translation.title, translation.excerpt, translation.subtitle, ...(translation.tags ?? [])] : []
    }),
    ...post.tags,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalized))
}

function TranslationBadges({ post }: { post: SerializedPostSummary }) {
  const originalUpdatedAt = post.originalContentUpdatedAt ?? post.updatedAt

  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-label="Estado das traduções">
      {TRANSLATION_LOCALES.map((locale) => {
        const translation = post.translations?.[locale]
        const stale = translation
          ? isTranslationRevisionStale(translation.sourceUpdatedAt, originalUpdatedAt)
          : false
        const label = !translation
          ? "sem tradução"
          : stale
            ? `${translation.published ? "publicado" : "rascunho"}, revisão pendente`
            : translation.published ? "publicado" : "rascunho"
        const color = !translation
          ? "bg-neutral-100 text-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400"
          : stale
            ? "bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300"
            : translation.published
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"

        return (
          <span key={locale} title={`${POST_LOCALE_DETAILS[locale].adminLabel}: ${label}`} className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
            {POST_LOCALE_DETAILS[locale].shortLabel} · {label}
          </span>
        )
      })}
    </div>
  )
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${published ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
      {published ? "Publicado" : "Rascunho"}
    </span>
  )
}

function PostFlags({ post }: { post: SerializedPostSummary }) {
  return (
    <>
      {post.pinned && <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">fixado</span>}
      {post.hiddenFromTimeline && <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-white/10 dark:text-neutral-300">oculto</span>}
    </>
  )
}

type PostRowActionsProps = {
  post: SerializedPostSummary
  compact?: boolean
  onTogglePublish: (post: SerializedPostSummary) => void
  onTogglePin: (post: SerializedPostSummary) => void
  onRemove: (id: string) => Promise<void>
}

function PostRowActions({ post, compact = false, onTogglePublish, onTogglePin, onRemove }: PostRowActionsProps) {
  const iconSize = compact ? "size-7" : "size-8"
  const textPadding = compact ? "px-2 py-1" : "px-2 py-1.5"

  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => onTogglePublish(post)} className={`rounded-md ${textPadding} text-xs text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100`}>
        {post.published ? "Despublicar" : "Publicar"}
      </button>
      <button type="button" onClick={() => onTogglePin(post)} className={`rounded-md ${textPadding} text-xs text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100`}>
        {post.pinned ? "Desafixar" : "Fixar"}
      </button>
      <Link href={`/admin/posts/${post._id}/edit`} className={`grid ${iconSize} place-items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-white/10 dark:hover:text-neutral-100`} aria-label={`Editar ${post.title}`}>
        <PencilSquareIcon className="size-4" aria-hidden />
      </Link>
      <DeleteActionMenu
        title={`Excluir “${post.title}”?`}
        description="O post e seus comentários serão apagados permanentemente."
        onDelete={() => onRemove(post._id)}
        triggerAriaLabel={`Opções de ${post.title}`}
        triggerClassName={`grid ${iconSize} place-items-center rounded-md text-neutral-500 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white`}
      />
    </div>
  )
}

export function PostsTable({ posts: initial }: Props) {
  const [posts, setPosts] = useState(initial)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [visibility, setVisibility] = useState<VisibilityFilter>("all")
  const [showConfig, setShowConfig] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState("")
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    status: true,
    date: true,
    views: true,
    reading: true,
    style: false,
  })

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (!postMatchesQuery(post, query)) return false
      if (status === "published" && !post.published) return false
      if (status === "draft" && post.published) return false
      if (visibility === "timeline" && post.hiddenFromTimeline === true) return false
      if (visibility === "hidden" && post.hiddenFromTimeline !== true) return false
      return true
    })
  }, [posts, query, status, visibility])

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected])
  const allFilteredSelected = filteredPosts.length > 0 && filteredPosts.every((post) => selected[post._id])

  function setPostSelected(id: string, checked: boolean) {
    setSelected((prev) => ({ ...prev, [id]: checked }))
  }

  function toggleFilteredSelection() {
    setSelected((prev) => {
      const next = { ...prev }
      for (const post of filteredPosts) next[post._id] = !allFilteredSelected
      return next
    })
  }

  async function patchPost(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error("Não foi possível atualizar o post.")
  }

  async function togglePostBoolean(id: string, key: "published" | "pinned", current: boolean) {
    setActionError("")
    try {
      await patchPost(id, { [key]: !current })
      setPosts((prev) => prev.map((post) => (post._id === id ? { ...post, [key]: !current } : post)))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível atualizar o post.")
    }
  }

  function togglePublish(post: SerializedPostSummary) {
    void togglePostBoolean(post._id, "published", post.published)
  }

  function togglePin(post: SerializedPostSummary) {
    void togglePostBoolean(post._id, "pinned", post.pinned)
  }

  async function hideFromTimeline(ids: string[]) {
    setBusyAction("hide")
    setActionError("")
    try {
      await Promise.all(ids.map((id) => patchPost(id, { hiddenFromTimeline: true })))
      setPosts((prev) => prev.map((post) => (ids.includes(post._id) ? { ...post, hiddenFromTimeline: true } : post)))
      setSelected({})
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível ocultar os posts.")
    } finally {
      setBusyAction(null)
    }
  }

  async function remove(ids: string[]) {
    setBusyAction("delete")
    setActionError("")
    try {
      const responses = await Promise.all(ids.map((id) => fetch(`/api/admin/posts/${id}`, { method: "DELETE" })))
      if (responses.some((res) => !res.ok)) throw new Error("Não foi possível deletar todos os posts.")
      setPosts((prev) => prev.filter((post) => !ids.includes(post._id)))
      setSelected({})
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível deletar os posts."
      setActionError(message)
      throw new Error(message)
    } finally {
      setBusyAction(null)
    }
  }

  async function download(ids: string[]) {
    setBusyAction("download")
    setActionError("")
    try {
      const res = await fetch("/api/admin/posts/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error("Não foi possível exportar os posts.")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `posts-${new Date().toISOString().slice(0, 10)}.md`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível exportar os posts.")
    } finally {
      setBusyAction(null)
    }
  }

  const actionIds = selectedIds.length > 0 ? selectedIds : filteredPosts.map((post) => post._id)

  return (
    <section className="admin-posts-table">
      <div className="admin-posts-toolbar">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold">Todos os posts</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {filteredPosts.length} de {posts.length} registros
              {selectedIds.length > 0 ? ` · ${selectedIds.length} selecionados` : ""}
            </p>
          </div>

          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <label className="relative min-w-0">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar posts"
                className="admin-posts-control admin-posts-search"
              />
            </label>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="admin-posts-control"
            >
              <option value="all">Todos</option>
              <option value="published">Publicados</option>
              <option value="draft">Rascunhos</option>
            </select>

            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as VisibilityFilter)}
              className="admin-posts-control"
            >
              <option value="all">Toda timeline</option>
              <option value="timeline">Visíveis</option>
              <option value="hidden">Ocultos</option>
            </select>

            <button
              type="button"
              onClick={() => download(actionIds)}
              disabled={actionIds.length === 0 || busyAction === "download"}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-3 text-sm transition hover:bg-neutral-50 disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5 sm:w-auto"
            >
              <ArrowDownTrayIcon className="size-4" aria-hidden />
              Exportar
            </button>

            <div className="relative justify-self-start">
              <button
                type="button"
                onClick={() => setShowConfig((value) => !value)}
                className="grid h-9 w-9 place-items-center rounded-md border border-neutral-200 transition hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
                aria-label="Configurar tabela"
              >
                <Cog6ToothIcon className="size-4" aria-hidden />
              </button>

              {showConfig && (
                <div className="admin-posts-columns-panel">
                  <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Colunas</p>
                  {columns.map((column) => (
                    <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={visibleColumns[column.key]}
                        onChange={(event) => setVisibleColumns((prev) => ({ ...prev, [column.key]: event.target.checked }))}
                        className="size-4 rounded border-neutral-300"
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {actionError && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {actionError}
          </p>
        )}

        {selectedIds.length > 0 && (
          <div className="admin-posts-selection">
            <span className="text-xs font-medium text-neutral-500">{selectedIds.length} selecionados</span>
            <button
              type="button"
              onClick={() => hideFromTimeline(selectedIds)}
              disabled={busyAction === "hide"}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-700 transition hover:bg-white dark:text-neutral-200 dark:hover:bg-white/10"
            >
              <EyeSlashIcon className="size-3.5" aria-hidden />
              Ocultar da timeline
            </button>
            <button
              type="button"
              onClick={() => download(selectedIds)}
              disabled={busyAction === "download"}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-700 transition hover:bg-white dark:text-neutral-200 dark:hover:bg-white/10"
            >
              <ArrowDownTrayIcon className="size-3.5" aria-hidden />
              Baixar textos
            </button>
            <DeleteActionMenu
              title={selectedIds.length === 1 ? "Excluir o post selecionado?" : `Excluir ${selectedIds.length} posts?`}
              description={selectedIds.length === 1 ? "O post e seus comentários serão apagados permanentemente." : "Os posts selecionados e seus comentários serão apagados permanentemente."}
              onDelete={() => remove(selectedIds)}
              disabled={busyAction === "delete"}
              triggerLabel="Deletar"
              triggerVariant="text"
              triggerClassName="inline-flex min-h-8 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 outline-none transition hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-500/10"
            />
          </div>
        )}
      </div>

      {filteredPosts.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-neutral-500">Nenhum post encontrado.</div>
      ) : (
        <>
        <div className="admin-posts-mobile">
          {filteredPosts.map((post) => (
            <article key={post._id} className="px-4 py-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected[post._id] === true}
                  onChange={(event) => setPostSelected(post._id, event.target.checked)}
                  aria-label={`Selecionar ${post.title}`}
                  className="mt-1 size-4 shrink-0 rounded border-neutral-300"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="min-w-0 break-words text-sm font-medium text-neutral-950 dark:text-neutral-100">{post.title}</h2>
                    <PostFlags post={post} />
                  </div>
                  <p className="mt-1 break-all text-xs text-neutral-500">{post.slug}</p>
                  <TranslationBadges post={post} />
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-500">
                    <StatusBadge published={post.published} />
                    <span className="text-right">{formatDate(post.publishedAt ?? post.createdAt)}</span>
                    <span>{post.views ?? 0} views</span>
                    <span className="text-right">{post.readingTimeMinutes} min</span>
                  </div>
                  <div className="mt-3">
                    <PostRowActions
                      post={post}
                      onTogglePublish={togglePublish}
                      onTogglePin={togglePin}
                      onRemove={(id) => remove([id])}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="admin-posts-desktop">
          <table className="admin-posts-data-table">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-400">
              <tr>
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleFilteredSelection}
                    aria-label="Selecionar posts filtrados"
                    className="size-4 rounded border-neutral-300"
                  />
                </th>
                <th scope="col" className="px-4 py-3 font-medium">Post</th>
                {visibleColumns.status && <th scope="col" className="px-4 py-3 font-medium">Status</th>}
                {visibleColumns.date && <th scope="col" className="px-4 py-3 font-medium">Publicado</th>}
                {visibleColumns.views && <th scope="col" className="px-4 py-3 font-medium text-right">Views</th>}
                {visibleColumns.reading && <th scope="col" className="px-4 py-3 font-medium text-right">Leitura</th>}
                {visibleColumns.style && <th scope="col" className="px-4 py-3 font-medium">Estilo</th>}
                <th scope="col" className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/10">
              {filteredPosts.map((post) => (
                <tr key={post._id} className="transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selected[post._id] === true}
                      onChange={(event) => setPostSelected(post._id, event.target.checked)}
                      aria-label={`Selecionar ${post.title}`}
                      className="size-4 rounded border-neutral-300"
                    />
                  </td>
                  <td className="max-w-[28rem] px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/posts/${post._id}`} className="truncate font-medium text-neutral-950 hover:underline dark:text-neutral-100">{post.title}</Link>
                        <PostFlags post={post} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">{post.slug}</p>
                      <TranslationBadges post={post} />
                    </div>
                  </td>
                  {visibleColumns.status && (
                    <td className="px-4 py-3">
                      <StatusBadge published={post.published} />
                    </td>
                  )}
                  {visibleColumns.date && <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{formatDate(post.publishedAt ?? post.createdAt)}</td>}
                  {visibleColumns.views && <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{post.views ?? 0}</td>}
                  {visibleColumns.reading && <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{post.readingTimeMinutes} min</td>}
                  {visibleColumns.style && <td className="px-4 py-3 text-neutral-500">{post.style}</td>}
                  <td className="px-4 py-3">
                    <PostRowActions
                      post={post}
                      compact
                      onTogglePublish={togglePublish}
                      onTogglePin={togglePin}
                      onRemove={(id) => remove([id])}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  )
}
