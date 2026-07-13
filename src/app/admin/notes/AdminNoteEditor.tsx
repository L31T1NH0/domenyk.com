"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { SerializedNote } from "@/lib/db/notes"

export function AdminNoteEditor({ note }: { note: SerializedNote }) {
  const router = useRouter()
  const [title, setTitle] = useState(note.title ?? "")
  const [content, setContent] = useState(note.content)
  const [seoTitle, setSeoTitle] = useState(note.seoTitle ?? "")
  const [seoDescription, setSeoDescription] = useState(note.seoDescription ?? "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const indexable = Boolean(seoTitle.trim() && seoDescription.trim())

  async function save() {
    setSaving(true); setMessage("")
    const response = await fetch(`/api/admin/notes/${note._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content, seoTitle, seoDescription }) })
    const data = await response.json().catch(() => null) as { error?: string } | null
    setSaving(false)
    if (!response.ok) return setMessage(data?.error ?? "Não foi possível salvar a nota.")
    setMessage("Alterações salvas.")
    router.refresh()
  }

  async function remove() {
    if (!confirm("Excluir esta nota? Esta ação não pode ser desfeita.")) return
    const response = await fetch(`/api/admin/notes/${note._id}`, { method: "DELETE" })
    if (!response.ok) return setMessage("Não foi possível excluir a nota.")
    router.push("/admin/notes"); router.refresh()
  }

  return <div className="admin-resource-layout">
    <main className="admin-resource-main">
      <section className="admin-section"><header><div><h2>Conteúdo</h2><p>O título editorial é opcional e aparece no site. Os campos SEO não aparecem no corpo da nota.</p></div></header><div className="admin-form-grid">
        <label className="admin-field admin-field-wide"><span>Título editorial <small>opcional</small></span><input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="admin-field admin-field-wide"><span>Texto da nota</span><textarea className="admin-content-textarea" value={content} maxLength={20000} rows={18} onChange={(event) => setContent(event.target.value)} /></label>
      </div></section>
    </main>
    <aside className="admin-inspector">
      <section><header><h2>SEO</h2><span className={`admin-status ${indexable ? "is-positive" : "is-warning"}`}>{indexable ? "Indexável" : "Não indexável"}</span></header><p className="admin-inspector-copy">{indexable ? "A nota pode entrar no Google e no sitemap." : "Preencha os dois campos para liberar a indexação."}</p><div className="admin-inspector-fields">
        <label className="admin-field"><span>Título SEO</span><input value={seoTitle} maxLength={120} onChange={(event) => setSeoTitle(event.target.value)} /><small>{seoTitle.length}/120</small></label>
        <label className="admin-field"><span>Descrição SEO</span><textarea value={seoDescription} maxLength={300} rows={5} onChange={(event) => setSeoDescription(event.target.value)} /><small>{seoDescription.length}/300</small></label>
      </div></section>
      <section><header><h2>Prévia de busca</h2></header><div className="admin-search-preview"><span>domenyk.com › notes › {note._id}</span><strong>{seoTitle || "Título SEO da nota"}</strong><p>{seoDescription || "A descrição usada pelo Google aparecerá aqui."}</p></div></section>
      {message && <p className={message === "Alterações salvas." ? "admin-form-success" : "admin-form-error"} role="status">{message}</p>}
      <button type="button" className="admin-button-primary admin-save-button" disabled={saving || !content.trim()} onClick={save}>{saving ? "Salvando…" : "Salvar alterações"}</button>
      <button type="button" className="admin-button-danger" onClick={remove}>Excluir nota</button>
    </aside>
  </div>
}
