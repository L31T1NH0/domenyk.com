"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import type { SerializedNote } from "@/lib/db/notes"
import type { NoteMetrics } from "@/lib/db/note-metrics"

export function AdminNoteEditor({ note, metrics }: { note: SerializedNote; metrics: Omit<NoteMetrics, "updatedAt"> }) {
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
    const response = await fetch(`/api/admin/notes/${note._id}`, { method: "DELETE" })
    if (!response.ok) {
      const error = "Não foi possível excluir a nota."
      setMessage(error)
      throw new Error(error)
    }
    router.push("/admin/notes"); router.refresh()
  }

  return <div className="admin-note-workspace">
    <main className="admin-note-compose">
      <header className="admin-workspace-header"><div><h2>Conteúdo</h2><p>O título editorial é opcional. O texto aparece no site exatamente como escrito aqui.</p></div></header>
      <div className="admin-note-fields">
        <label className="admin-field"><span>Título editorial <small>opcional</small></span><input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="admin-field"><span>Texto da nota</span><textarea className="admin-note-content" value={content} maxLength={20000} rows={20} onChange={(event) => setContent(event.target.value)} /></label>
      </div>
    </main>

    <aside className="admin-note-settings">
      <section>
        <header><div><h2>Audiência interna</h2><p>Métricas privadas desta nota</p></div><span className="admin-record-status is-muted">Privado</span></header>
        <dl className="admin-note-metrics"><div><dt>Views reais</dt><dd>{metrics.directViews}</dd></div><div><dt>Exposições na home</dt><dd>{metrics.homeImpressions}</dd></div><div><dt>Exposições em /notes</dt><dd>{metrics.notesImpressions}</dd></div><div><dt>Leitura estimada</dt><dd>{note.readingEstimate.estimatedReadingSeconds}s</dd></div><div><dt>Complexidade</dt><dd>{note.readingEstimate.complexity}</dd></div><div><dt>Margem na timeline</dt><dd>{note.readingEstimate.impressionThresholdMs / 1000}s · {Math.round(note.readingEstimate.impressionVisibleRatio * 100)}%</dd></div></dl>
        <p className="admin-note-help">Abrir a página individual registra uma view real imediatamente. Nas timelines, tempo em aba oculta não conta.</p>
      </section>

      <section>
        <header><div><h2>SEO</h2><p>{indexable ? "A nota pode entrar no Google e no sitemap." : "Preencha os dois campos para liberar a indexação."}</p></div><span className={`admin-record-status ${indexable ? "is-live" : "is-review"}`}>{indexable ? "Indexável" : "Não indexável"}</span></header>
        <div className="admin-note-seo-fields">
          <label className="admin-field"><span>Título SEO</span><input value={seoTitle} maxLength={120} onChange={(event) => setSeoTitle(event.target.value)} /><small>{seoTitle.length}/120</small></label>
          <label className="admin-field"><span>Descrição SEO</span><textarea value={seoDescription} maxLength={300} rows={5} onChange={(event) => setSeoDescription(event.target.value)} /><small>{seoDescription.length}/300</small></label>
        </div>
      </section>

      <section><header><div><h2>Prévia de busca</h2><p>Resultado aproximado para mecanismos de busca</p></div></header><div className="admin-search-preview"><span>domenyk.com › notes › {note._id}</span><strong>{seoTitle || "Título SEO da nota"}</strong><p>{seoDescription || "A descrição usada pelo Google aparecerá aqui."}</p></div></section>
    </aside>

    <footer className="admin-editor-footer">
      <div>{message && <p className={message === "Alterações salvas." ? "admin-form-success" : "admin-form-error"} role="status">{message}</p>}</div>
      <div className="admin-editor-actions">
        <DeleteActionMenu title="Excluir esta nota?" onDelete={remove} triggerLabel="Excluir nota" triggerVariant="button" triggerClassName="admin-button-danger" />
        <button type="button" className="admin-button-primary" disabled={saving || !content.trim()} onClick={save}>{saving ? "Salvando…" : "Salvar alterações"}</button>
      </div>
    </footer>
  </div>
}
