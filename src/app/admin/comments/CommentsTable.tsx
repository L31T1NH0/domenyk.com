"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon, TrashIcon } from "@heroicons/react/24/outline"
import type { CommentParentSummary, SerializedComment } from "@/lib/db/comments"

type AdminComment = SerializedComment & { parent: CommentParentSummary }
type Filter = "all" | "post" | "note"

export function CommentsTable({ comments: initial }: { comments: AdminComment[] }) {
  const [comments, setComments] = useState(initial)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [error, setError] = useState("")
  const filtered = useMemo(() => comments.filter((comment) => {
    if (filter !== "all" && comment.parent.type !== filter) return false
    const search = `${comment.authorName} ${comment.content} ${comment.parent.title}`.toLocaleLowerCase("pt-BR")
    return search.includes(query.trim().toLocaleLowerCase("pt-BR"))
  }), [comments, filter, query])

  async function remove(id: string) {
    if (!confirm("Excluir este comentário? Esta ação não pode ser desfeita.")) return
    setError("")
    const response = await fetch(`/api/admin/comments/${id}`, { method: "DELETE" })
    if (response.ok) return setComments((current) => current.filter((comment) => comment._id !== id))
    setError("Não foi possível excluir o comentário.")
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
        <button type="button" onClick={() => remove(comment._id)} aria-label={`Excluir comentário de ${comment.authorName}`} className="admin-comment-delete"><TrashIcon /></button>
      </article>
    })}
    {filtered.length === 0 && <p className="admin-empty">Nenhum comentário encontrado.</p>}
  </section>
}
