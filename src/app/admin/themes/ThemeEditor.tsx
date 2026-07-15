"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import { ArrowDownIcon, ArrowUpIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline"
import type { SerializedPostSummary } from "@/lib/db/posts"
import type { SerializedTheme } from "@/lib/db/themes"

type Props = { theme?: SerializedTheme; posts: SerializedPostSummary[] }

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function ThemeEditor({ theme, posts }: Props) {
  const router = useRouter()
  const [name, setName] = useState(theme?.name ?? "")
  const [slug, setSlug] = useState(theme?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(Boolean(theme))
  const [description, setDescription] = useState(theme?.description ?? "")
  const [active, setActive] = useState(theme?.active ?? false)
  const [postIds, setPostIds] = useState(theme?.postIds ?? [])
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const byId = useMemo(() => new Map(posts.map((post) => [post._id, post])), [posts])
  const selectedPosts = postIds.flatMap((id) => {
    const post = byId.get(id)
    return post ? [post] : []
  })
  const availablePosts = posts.filter((post) => !postIds.includes(post._id) && `${post.title} ${post.slug}`.toLowerCase().includes(query.trim().toLowerCase()))

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
    setSaving(true)
    setError("")
    const response = await fetch(theme ? `/api/admin/themes/${theme._id}` : "/api/admin/themes", {
      method: theme ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description, active, postIds }),
    })
    const data = await response.json().catch(() => null) as { _id?: string; error?: string } | null
    setSaving(false)
    if (!response.ok) return setError(data?.error ?? "Não foi possível salvar o tema.")
    router.push(`/admin/temas/${data?._id ?? theme?._id}`)
    router.refresh()
  }

  async function remove() {
    if (!theme) return
    const response = await fetch(`/api/admin/themes/${theme._id}`, { method: "DELETE" })
    if (!response.ok) {
      const message = "Não foi possível excluir o tema."
      setError(message)
      throw new Error(message)
    }
    router.push("/admin/temas")
    router.refresh()
  }

  return (
    <div className="admin-theme-workspace">
      <section className="admin-theme-identity">
        <header className="admin-workspace-header"><div><h2>Identidade do tema</h2><p>Nome, endereço e texto que explicam a coleção.</p></div></header>
        <div className="admin-form-grid">
            <label className="admin-field"><span>Nome</span><input value={name} maxLength={80} onChange={(event) => { setName(event.target.value); if (!slugTouched) setSlug(slugify(event.target.value)) }} /></label>
            <label className="admin-field"><span>Slug</span><div className="admin-input-prefix"><span>/temas/</span><input value={slug} maxLength={100} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)) }} /></div></label>
            <label className="admin-field admin-field-wide"><span>Descrição</span><textarea value={description} maxLength={500} rows={4} onChange={(event) => setDescription(event.target.value)} /><small>{description.length}/500</small></label>
        </div>
      </section>

      <div className="admin-theme-texts">
        <section className="admin-theme-selected">
          <header className="admin-workspace-header"><div><h2>Textos selecionados</h2><p>A ordem abaixo é a ordem da página pública.</p></div><span className="admin-section-count">{selectedPosts.length}</span></header>
          <div className="admin-order-list">
            {selectedPosts.map((post, index) => (
              <div key={post._id} className="admin-order-row">
                <span className="admin-order-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="admin-list-primary"><strong>{post.title}</strong><small>{post.published ? "Publicado" : "Rascunho"} · {post.readingTimeMinutes} min</small></span>
                <span className="admin-order-actions">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Subir ${post.title}`}><ArrowUpIcon /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === selectedPosts.length - 1} aria-label={`Descer ${post.title}`}><ArrowDownIcon /></button>
                  <button type="button" onClick={() => setPostIds((ids) => ids.filter((id) => id !== post._id))} aria-label={`Retirar ${post.title} deste tema`}><XMarkIcon /></button>
                </span>
              </div>
            ))}
            {selectedPosts.length === 0 && <p className="admin-empty">Nenhum texto selecionado.</p>}
          </div>
        </section>

        <section className="admin-theme-available">
          <header className="admin-workspace-header"><div><h2>Adicionar textos</h2><p>Um post pode fazer parte de vários temas.</p></div></header>
          <label className="admin-control-search admin-theme-search"><MagnifyingGlassIcon aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título ou slug" /></label>
          <div className="admin-pick-list">
            {availablePosts.slice(0, 30).map((post) => <button key={post._id} type="button" onClick={() => setPostIds((ids) => [...ids, post._id])}><span><strong>{post.title}</strong><small>{post.slug}</small></span><span>Adicionar</span></button>)}
            {availablePosts.length === 0 && <p className="admin-empty">Nenhum post disponível para este filtro.</p>}
          </div>
        </section>
      </div>

      <footer className="admin-theme-footer">
        <div className="admin-theme-publish"><label className="admin-toggle-row"><span><strong>Tema ativo</strong><small>Permite a página pública e a entrada no sitemap.</small></span><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /></label><dl><div><dt>Textos</dt><dd>{postIds.length}</dd></div><div><dt>Indexação</dt><dd>{active ? "Permitida" : "Bloqueada"}</dd></div></dl></div>
        <div className="admin-theme-submit">{error && <p className="admin-form-error" role="alert">{error}</p>}<div className="admin-editor-actions">{theme && <DeleteActionMenu title={`Excluir o tema “${theme.name}”?`} description="O tema será apagado, mas os posts relacionados permanecerão no site." onDelete={remove} triggerLabel="Excluir tema" triggerVariant="button" triggerClassName="admin-button-danger" />}<button type="button" className="admin-button-primary" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button></div></div>
      </footer>
    </div>
  )
}
