"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import type { CommentParentSummary, SerializedComment } from "@/lib/db/comments"

type AdminComment = SerializedComment & { parent: CommentParentSummary }
type Filter = "all" | "post" | "note"

export function CommentsTable({ comments: initial }: { comments: AdminComment[] }) {
  const [comments, setComments] = useState(initial)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [error, setError] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const detailRequest = useRef(0)
  const filtered = useMemo(() => comments.filter((comment) => {
    if (filter !== "all" && comment.parent.type !== filter) return false
    const search = `${comment.authorName} ${comment.content} ${comment.parent.title}`.toLocaleLowerCase("pt-BR")
    return search.includes(query.trim().toLocaleLowerCase("pt-BR"))
  }), [comments, filter, query])

  async function remove(id: string) {
    setError("")
    const response = await fetch(`/api/admin/comments/${id}`, { method: "DELETE" })
    if (response.ok) return setComments((current) => current.filter((comment) => comment._id !== id))
    const message = "Não foi possível excluir o comentário."
    setError(message)
    throw new Error(message)
  }

  async function toggleDetails(id: string) {
    const request = ++detailRequest.current
    if (detailId === id) {
      setDetailId(null)
      setDetailRecord(null)
      setDetailError("")
      return
    }

    setDetailId(id)
    setDetailRecord(null)
    setDetailError("")
    setDetailLoading(true)
    const response = await fetch(`/api/admin/comments/${id}`, { cache: "no-store" })
    const data = await response.json().catch(() => null) as { record?: Record<string, unknown>; error?: string } | null
    if (request !== detailRequest.current) return
    setDetailLoading(false)
    if (!response.ok || !data?.record) return setDetailError(data?.error ?? "Não foi possível carregar os detalhes.")
    setDetailRecord(data.record)
  }

  function detailValue(value: unknown) {
    if (value === null) return "null"
    if (value === undefined) return "undefined"
    if (typeof value === "string") return value
    return JSON.stringify(value, null, 2)
  }

  return <section className="admin-list admin-comments-list">
    <div className="admin-list-toolbar">
      <div><strong>Comentários recentes</strong><small>{filtered.length} de {comments.length}</small></div>
      <div className="admin-comments-tools">
        <label className="admin-search"><MagnifyingGlassIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar comentário, autor ou post" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="Filtrar pelo tipo de conteúdo">
          <option value="all">Posts e notas</option><option value="post">Somente posts</option><option value="note">Somente notas</option>
        </select>
      </div>
    </div>
    {error && <p className="admin-form-error admin-comments-error" role="alert">{error}</p>}
    <div className="admin-comments-head"><span>Comentário</span><span>Publicado em</span><span>Quando</span><span aria-hidden /></div>
    {filtered.map((comment) => {
      const publicHref = comment.parent.publicHref && comment.paragraphId
        ? `${comment.parent.publicHref}#${comment.paragraphId}`
        : comment.parent.publicHref
      return <article key={comment._id} className="admin-comment-row">
        <div className="admin-comment-main">
          {comment.authorImageUrl ? <img src={comment.authorImageUrl} alt="" /> : <span className="admin-comment-avatar">{comment.authorName.slice(0, 1).toUpperCase()}</span>}
          <div className="admin-comment-body">
            <div className="admin-comment-author"><strong>{comment.authorName}</strong>{comment.paragraphId && <span>Comentário em parágrafo</span>}</div>
            <div className="note-content comment-content admin-comment-content" dangerouslySetInnerHTML={{ __html: comment.contentHtml }} />
          </div>
        </div>
        <div className="admin-comment-parent">
          <span>{comment.parent.type === "post" ? "Post" : comment.parent.type === "note" ? "Nota" : "Origem"}</span>
          {comment.parent.adminHref ? <Link href={comment.parent.adminHref}>{comment.parent.title}</Link> : <strong>{comment.parent.title}</strong>}
          {publicHref && <Link href={publicHref} target="_blank" className="admin-comment-public-link">Abrir conversa <ArrowTopRightOnSquareIcon /></Link>}
        </div>
        <time dateTime={comment.createdAt}>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ptBR })}</time>
        <div className="admin-comment-actions">
          <button type="button" onClick={() => toggleDetails(comment._id)} aria-expanded={detailId === comment._id} aria-controls={`comment-details-${comment._id}`} className="admin-comment-details-button">{detailId === comment._id ? "Fechar" : "Detalhes"}</button>
          <DeleteActionMenu title="Excluir comentário?" description={`O comentário de ${comment.authorName} será removido permanentemente.`} onDelete={() => remove(comment._id)} triggerAriaLabel={`Opções do comentário de ${comment.authorName}`} triggerClassName="admin-comment-delete" />
        </div>
        {detailId === comment._id && <div id={`comment-details-${comment._id}`} className="admin-comment-details">
          <header><div><strong>Registro no banco de dados</strong><span>Leitura direta da coleção <code>comments</code></span></div><small>{detailRecord ? `${Object.keys(detailRecord).length} campos` : ""}</small></header>
          {detailLoading && <p className="admin-comment-details-state">Consultando o registro atual…</p>}
          {detailError && <p className="admin-form-error" role="alert">{detailError}</p>}
          {detailRecord && <div className="admin-comment-details-table-wrap"><table><thead><tr><th scope="col">Campo</th><th scope="col">Tipo</th><th scope="col">Valor armazenado</th></tr></thead><tbody>{Object.entries(detailRecord).map(([field, value]) => <tr key={field}><th scope="row">{field}</th><td>{value === null ? "null" : Array.isArray(value) ? "array" : typeof value}</td><td><pre>{detailValue(value)}</pre></td></tr>)}</tbody></table></div>}
        </div>}
      </article>
    })}
    {filtered.length === 0 && <p className="admin-empty">Nenhum comentário encontrado.</p>}
  </section>
}
