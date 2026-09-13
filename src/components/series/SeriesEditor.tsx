"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDownIcon, ArrowUpIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import type { SerializedPostSummary } from "@/lib/db/posts"
import type { SerializedEditorialSeries } from "@/lib/db/series"
import { slugifyPostTitle } from "@/lib/post-locales"

type Props = {
  series?: SerializedEditorialSeries
  posts: SerializedPostSummary[]
}

export function SeriesEditor({ series, posts }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(series?.title ?? "")
  const [slug, setSlug] = useState(series?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(Boolean(series))
  const [description, setDescription] = useState(series?.description ?? "")
  const [published, setPublished] = useState(series?.published ?? false)
  const [postIds, setPostIds] = useState(series?.postIds ?? [])
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const byId = useMemo(() => new Map(posts.map((post) => [post._id, post])), [posts])
  const selectedPosts = postIds.flatMap((id) => {
    const post = byId.get(id)
    return post ? [post] : []
  })
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR")
  const availablePosts = posts.filter((post) => (
    !postIds.includes(post._id)
    && `${post.title} ${post.slug}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
  ))
  const totalReadingTime = selectedPosts.reduce((total, post) => total + post.readingTimeMinutes, 0)

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= postIds.length) return
    setPostIds((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch(series ? `/api/admin/series/${series._id}` : "/api/admin/series", {
        method: series ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, description, published, postIds }),
      })
      const data = await response.json().catch(() => null) as { _id?: string; error?: string } | null
      if (!response.ok) throw new Error(data?.error ?? "Não foi possível salvar a série.")
      router.push(`/admin/series/${data?._id ?? series?._id}`)
      router.refresh()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar a série.")
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!series) return
    const response = await fetch(`/api/admin/series/${series._id}`, { method: "DELETE" })
    if (!response.ok) {
      const message = "Não foi possível excluir a série."
      setError(message)
      throw new Error(message)
    }
    router.push("/admin/series")
    router.refresh()
  }

  return (
    <div className="admin-theme-workspace admin-series-workspace">
      <section className="admin-theme-identity">
        <header className="admin-workspace-header">
          <div><h2>Identidade da série</h2><p>O tema maior que conecta e apresenta todos os capítulos.</p></div>
        </header>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Título</span>
            <input value={title} maxLength={140} onChange={(event) => {
              const value = event.target.value
              setTitle(value)
              if (!slugTouched) setSlug(slugifyPostTitle(value))
            }} />
          </label>
          <label className="admin-field">
            <span>Slug</span>
            <div className="admin-input-prefix"><span>/series/</span><input value={slug} maxLength={100} onChange={(event) => { setSlugTouched(true); setSlug(slugifyPostTitle(event.target.value)) }} /></div>
          </label>
          <label className="admin-field admin-field-wide">
            <span>Apresentação</span>
            <textarea value={description} maxLength={1200} rows={5} onChange={(event) => setDescription(event.target.value)} />
            <small>{description.length}/1200</small>
          </label>
        </div>
      </section>

      <div className="admin-theme-texts">
        <section className="admin-theme-selected">
          <header className="admin-workspace-header">
            <div><h2>Ordem de leitura</h2><p>Cada item continua sendo um post e também se torna um capítulo.</p></div>
            <span className="admin-section-count">{selectedPosts.length}</span>
          </header>
          <div className="admin-order-list">
            {selectedPosts.map((post, index) => (
              <div key={post._id} className="admin-order-row">
                <span className="admin-order-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="admin-list-primary">
                  <strong>{post.title}</strong>
                  <small>{post.published ? "Publicado" : "Rascunho"} · {post.readingTimeMinutes} min</small>
                </span>
                <span className="admin-order-actions">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir ${post.title}`}><ArrowUpIcon /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === selectedPosts.length - 1} aria-label={`Descer ${post.title}`}><ArrowDownIcon /></button>
                  <button type="button" onClick={() => setPostIds((ids) => ids.filter((id) => id !== post._id))} aria-label={`Retirar ${post.title} desta série`}><XMarkIcon /></button>
                </span>
              </div>
            ))}
            {selectedPosts.length === 0 && <p className="admin-empty">A série ainda não tem capítulos.</p>}
          </div>
        </section>

        <section className="admin-theme-available">
          <header className="admin-workspace-header">
            <div><h2>Adicionar capítulos</h2><p>Escolher um post já ligado a outra série irá transferi-lo.</p></div>
            {series && <Link href={`/admin/posts/new?series=${encodeURIComponent(series.publicId)}`} className="admin-button-secondary">Escrever novo</Link>}
          </header>
          <label className="admin-control-search admin-theme-search"><MagnifyingGlassIcon aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título ou slug" /></label>
          <div className="admin-pick-list">
            {availablePosts.slice(0, 40).map((post) => (
              <button key={post._id} type="button" onClick={() => setPostIds((ids) => [...ids, post._id])}>
                <span>
                  <strong>{post.title}</strong>
                  <small>{post.series && post.series.id !== series?.publicId ? `Em “${post.series.title}” · ` : ""}{post.slug}</small>
                </span>
                <span>{post.series && post.series.id !== series?.publicId ? "Transferir" : "Adicionar"}</span>
              </button>
            ))}
            {availablePosts.length === 0 && <p className="admin-empty">Nenhum post disponível para este filtro.</p>}
          </div>
        </section>
      </div>

      <footer className="admin-theme-footer">
        <div className="admin-theme-publish">
          <label className="admin-toggle-row">
            <span><strong>Série pública</strong><small>Libera a leitura completa e a indexação.</small></span>
            <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
          </label>
          <dl><div><dt>Capítulos</dt><dd>{postIds.length}</dd></div><div><dt>Leitura</dt><dd>{totalReadingTime} min</dd></div></dl>
        </div>
        <div className="admin-theme-submit">
          {error && <p className="admin-form-error" role="alert">{error}</p>}
          <div className="admin-editor-actions">
            {series && <DeleteActionMenu title={`Excluir a série “${series.title}”?`} description="Os posts permanecerão publicados, apenas sem o vínculo entre capítulos." onDelete={remove} triggerLabel="Excluir série" triggerVariant="button" triggerClassName="admin-button-danger" />}
            <button type="button" className="admin-button-primary" onClick={save} disabled={saving}>{saving ? "Salvando…" : series ? "Salvar alterações" : "Criar série"}</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
