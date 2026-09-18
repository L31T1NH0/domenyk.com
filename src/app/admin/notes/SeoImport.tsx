"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type PreviewItem = { id: string; seoTitle: string; status: "update" | "unchanged" | "missing"; detail?: string }
type Preview = { canApply: boolean; counts: { total: number; update: number; unchanged: number; missing: number }; items: PreviewItem[] }

export function SeoImport() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [bundle, setBundle] = useState<unknown>(null)
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function inspect(file: File) {
    setBusy(true); setError(""); setMessage(""); setPreview(null); setConfirming(false); setFileName(file.name)
    try {
      const parsed = JSON.parse(await file.text())
      setBundle(parsed)
      const response = await fetch("/api/admin/notes/seo-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "preview", bundle: parsed }) })
      const data = await response.json() as Preview & { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Não foi possível ler o arquivo.")
      setPreview(data)
    } catch (cause) {
      setBundle(null); setError(cause instanceof Error ? cause.message : "Não foi possível ler o arquivo.")
    } finally { setBusy(false) }
  }

  async function apply() {
    if (!bundle || !preview?.canApply) return
    setBusy(true); setError(""); setMessage("")
    try {
      const response = await fetch("/api/admin/notes/seo-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "apply", bundle }) })
      const data = await response.json() as { error?: string; applied?: number }
      if (!response.ok) throw new Error(data.error ?? "Não foi possível aplicar o SEO.")
      setMessage(`${data.applied ?? 0} nota(s) atualizada(s).`); setBundle(null); setPreview(null); setFileName(""); setConfirming(false)
      if (inputRef.current) inputRef.current.value = ""
      router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível aplicar o SEO.")
    } finally { setBusy(false) }
  }

  return <section className="admin-section" aria-labelledby="seo-import-title">
    <header>
      <div><h2 id="seo-import-title">Importar dados SEO</h2><p>Atualize título e descrição SEO de várias notas usando os IDs do arquivo.</p></div>
      <Link className="admin-button-secondary" href="/api/admin/notes/seo-import" prefetch={false} download>Baixar guia do formato</Link>
    </header>
    <div className="admin-form-grid">
      <label className="admin-field admin-field-wide"><span>Arquivo JSON</span><input ref={inputRef} type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspect(file) }} /></label>
      {fileName && <p className="admin-page-note admin-field-wide">Arquivo carregado: <strong>{fileName}</strong></p>}
      {error && <p className="admin-form-error admin-field-wide" role="alert">{error}</p>}
      {message && <p className="admin-form-success admin-field-wide" role="status">{message}</p>}
      {preview && <>
        <dl className="admin-note-metrics admin-field-wide"><div><dt>Total</dt><dd>{preview.counts.total}</dd></div><div><dt>Atualizar</dt><dd>{preview.counts.update}</dd></div><div><dt>Sem mudança</dt><dd>{preview.counts.unchanged}</dd></div><div><dt>Ausentes</dt><dd>{preview.counts.missing}</dd></div></dl>
        <ul className="admin-pick-list admin-field-wide">{preview.items.slice(0, 30).map((item) => <li key={item.id}><span><strong>{item.seoTitle}</strong><small>{item.id}{item.detail ? ` · ${item.detail}` : ""}</small></span><span className={`admin-record-status ${item.status === "missing" ? "is-review" : item.status === "unchanged" ? "is-muted" : "is-live"}`}>{item.status === "update" ? "Atualizar" : item.status === "unchanged" ? "Sem mudança" : "Ausente"}</span></li>)}</ul>
        <div className="admin-editor-actions admin-field-wide">{!confirming ? <button type="button" className="admin-button-primary" disabled={busy || !preview.canApply} onClick={() => setConfirming(true)}>Preparar importação</button> : <><button type="button" className="admin-button-secondary" disabled={busy} onClick={() => setConfirming(false)}>Voltar</button><button type="button" className="admin-button-primary" disabled={busy} onClick={() => void apply()}>Confirmar importação</button></>}</div>
      </>}
    </div>
  </section>
}
