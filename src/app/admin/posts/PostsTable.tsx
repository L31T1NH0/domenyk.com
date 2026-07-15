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
    <div className="admin-locale-list" aria-label="Estado das traduções">
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
        const state = !translation ? "is-missing" : stale ? "is-stale" : translation.published ? "is-live" : "is-draft"

        return (
          <span key={locale} title={`${POST_LOCALE_DETAILS[locale].adminLabel}: ${label}`} className={`admin-locale-state ${state}`}>
            {POST_LOCALE_DETAILS[locale].shortLabel} · {label}
          </span>
        )
      })}
    </div>
  )
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span className={`admin-record-status ${published ? "is-live" : "is-review"}`}>
      {published ? "Publicado" : "Rascunho"}
    </span>
  )
}

function PostFlags({ post }: { post: SerializedPostSummary }) {
  return (
    <>
      {post.pinned && <span className="admin-record-flag is-pinned">Fixado</span>}
      {post.hiddenFromTimeline && <span className="admin-record-flag">Oculto</span>}
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
  return (
    <div className={`admin-record-actions ${compact ? "is-compact" : ""}`}>
      <button type="button" onClick={() => onTogglePublish(post)} className="admin-record-action">
        {post.published ? "Despublicar" : "Publicar"}
      </button>
      <button type="button" onClick={() => onTogglePin(post)} className="admin-record-action">
        {post.pinned ? "Desafixar" : "Fixar"}
      </button>
      <Link href={`/admin/posts/${post._id}/edit`} className="admin-record-icon-action" aria-label={`Editar ${post.title}`}>
        <PencilSquareIcon aria-hidden />
      </Link>
      <DeleteActionMenu
        title={`Excluir “${post.title}”?`}
        description="O post e seus comentários serão apagados permanentemente."
        onDelete={() => onRemove(post._id)}
        triggerAriaLabel={`Opções de ${post.title}`}
        triggerClassName="admin-record-icon-action"
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
    <section className="admin-records admin-post-records">
      <div className="admin-records-toolbar">
        <div className="admin-records-toolbar-row">
          <div><strong>Todos os posts</strong><small>{filteredPosts.length} de {posts.length} registros{selectedIds.length > 0 ? ` · ${selectedIds.length} selecionados` : ""}</small></div>
          <div className="admin-record-controls">
            <label className="admin-control-search"><MagnifyingGlassIcon aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar posts" /></label>
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="admin-control" aria-label="Filtrar por publicação"><option value="all">Todos</option><option value="published">Publicados</option><option value="draft">Rascunhos</option></select>
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as VisibilityFilter)} className="admin-control" aria-label="Filtrar por visibilidade"><option value="all">Toda timeline</option><option value="timeline">Visíveis</option><option value="hidden">Ocultos</option></select>
            <button type="button" onClick={() => download(actionIds)} disabled={actionIds.length === 0 || busyAction === "download"} className="admin-control-button"><ArrowDownTrayIcon aria-hidden />Exportar</button>
            <div className="admin-record-config">
              <button type="button" onClick={() => setShowConfig((value) => !value)} className="admin-icon-control" aria-label="Configurar tabela" aria-expanded={showConfig}><Cog6ToothIcon aria-hidden /></button>
              {showConfig && <div className="admin-posts-columns-panel"><strong>Colunas visíveis</strong>{columns.map((column) => <label key={column.key}><input type="checkbox" checked={visibleColumns[column.key]} onChange={(event) => setVisibleColumns((prev) => ({ ...prev, [column.key]: event.target.checked }))} className="admin-check" />{column.label}</label>)}</div>}
            </div>
          </div>
        </div>

        {actionError && <p className="admin-form-error admin-records-error" role="alert">{actionError}</p>}
        {selectedIds.length > 0 && <div className="admin-record-selection"><strong>{selectedIds.length} selecionados</strong><button type="button" onClick={() => hideFromTimeline(selectedIds)} disabled={busyAction === "hide"}><EyeSlashIcon aria-hidden />Ocultar da timeline</button><button type="button" onClick={() => download(selectedIds)} disabled={busyAction === "download"}><ArrowDownTrayIcon aria-hidden />Baixar textos</button><DeleteActionMenu title={selectedIds.length === 1 ? "Excluir o post selecionado?" : `Excluir ${selectedIds.length} posts?`} description={selectedIds.length === 1 ? "O post e seus comentários serão apagados permanentemente." : "Os posts selecionados e seus comentários serão apagados permanentemente."} onDelete={() => remove(selectedIds)} disabled={busyAction === "delete"} triggerLabel="Deletar" triggerVariant="text" triggerClassName="admin-record-delete" /></div>}
      </div>

      {filteredPosts.length === 0 ? <div className="admin-empty">Nenhum post encontrado.</div> : <>
        <div className="admin-post-cards">
          {filteredPosts.map((post) => <article key={post._id} className="admin-post-card">
            <input type="checkbox" checked={selected[post._id] === true} onChange={(event) => setPostSelected(post._id, event.target.checked)} aria-label={`Selecionar ${post.title}`} className="admin-check" />
            <div className="admin-post-card-body"><header><div><h2>{post.title}</h2><span><PostFlags post={post} /></span></div><p>{post.slug}</p></header><TranslationBadges post={post} /><dl><div><dt>Status</dt><dd><StatusBadge published={post.published} /></dd></div><div><dt>Publicado</dt><dd>{formatDate(post.publishedAt ?? post.createdAt)}</dd></div><div><dt>Views</dt><dd>{post.views ?? 0}</dd></div><div><dt>Leitura</dt><dd>{post.readingTimeMinutes} min</dd></div></dl><PostRowActions post={post} onTogglePublish={togglePublish} onTogglePin={togglePin} onRemove={(id) => remove([id])} /></div>
          </article>)}
        </div>

        <div className="admin-record-table-wrap admin-post-table-wrap">
          <table className="admin-record-table admin-post-table">
            <thead><tr><th scope="col"><input type="checkbox" checked={allFilteredSelected} onChange={toggleFilteredSelection} aria-label="Selecionar posts filtrados" className="admin-check" /></th><th scope="col">Post</th>{visibleColumns.status && <th scope="col">Status</th>}{visibleColumns.date && <th scope="col">Publicado</th>}{visibleColumns.views && <th scope="col">Views</th>}{visibleColumns.reading && <th scope="col">Leitura</th>}{visibleColumns.style && <th scope="col">Estilo</th>}<th scope="col">Ações</th></tr></thead>
            <tbody>{filteredPosts.map((post) => <tr key={post._id}><td><input type="checkbox" checked={selected[post._id] === true} onChange={(event) => setPostSelected(post._id, event.target.checked)} aria-label={`Selecionar ${post.title}`} className="admin-check" /></td><td><div className="admin-post-cell"><div><Link href={`/admin/posts/${post._id}`}>{post.title}</Link><span><PostFlags post={post} /></span></div><p>{post.slug}</p><TranslationBadges post={post} /></div></td>{visibleColumns.status && <td><StatusBadge published={post.published} /></td>}{visibleColumns.date && <td><time>{formatDate(post.publishedAt ?? post.createdAt)}</time></td>}{visibleColumns.views && <td className="admin-record-number">{post.views ?? 0}</td>}{visibleColumns.reading && <td className="admin-record-number">{post.readingTimeMinutes} min</td>}{visibleColumns.style && <td>{post.style}</td>}<td><PostRowActions post={post} compact onTogglePublish={togglePublish} onTogglePin={togglePin} onRemove={(id) => remove([id])} /></td></tr>)}</tbody>
          </table>
        </div>
      </>}
    </section>
  )
}
