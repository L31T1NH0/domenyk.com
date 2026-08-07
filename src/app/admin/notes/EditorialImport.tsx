"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

type PreviewItem = {
  editorialId: string
  title: string
  action: "keep" | "update" | "archive"
  position: number
  status: "matched" | "unchanged" | "missing" | "ambiguous" | "duplicate"
  detail?: string
}

type Preview = {
  canApply: boolean
  counts: {
    units: number
    archive: number
    update: number
    unchanged: number
    missing: number
    ambiguous: number
    duplicate: number
  }
  items: PreviewItem[]
}

function actionLabel(action: PreviewItem["action"]) {
  return action === "archive" ? "Excluir" : action === "update" ? "Atualizar" : "Manter"
}

function statusLabel(status: PreviewItem["status"]) {
  return status === "matched" ? "Encontrada" : status === "unchanged" ? "Sem mudança" : status === "missing" ? "Ausente" : status === "ambiguous" ? "Ambígua" : "Duplicada"
}

export function EditorialImport() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")
  const [bundle, setBundle] = useState<unknown>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function inspectFile(file: File) {
    setBusy(true); setError(""); setMessage(""); setPreview(null); setConfirming(false); setFileName(file.name)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      setBundle(parsed)
      const response = await fetch("/api/admin/notes/editorial-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", bundle: parsed }),
      })
      const data = await response.json() as Preview & { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Não foi possível ler o pacote.")
      setPreview(data)
    } catch (cause) {
      setBundle(null)
      setError(cause instanceof Error ? cause.message : "Não foi possível ler o pacote.")
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!bundle || !preview?.canApply) return
    setBusy(true); setError(""); setMessage("")
    try {
      const response = await fetch("/api/admin/notes/editorial-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "apply", bundle }),
      })
      const data = await response.json() as { error?: string; applied?: number }
      if (!response.ok) throw new Error(data.error ?? "Não foi possível aplicar o pacote.")
      setMessage(`${data.applied ?? 0} nota(s) aplicada(s).`)
      setPreview(null); setBundle(null); setFileName(""); setConfirming(false)
      if (inputRef.current) inputRef.current.value = ""
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível aplicar o pacote.")
    } finally {
      setBusy(false)
    }
  }

  const unresolved = preview ? preview.counts.missing + preview.counts.ambiguous + preview.counts.duplicate : 0
  return <section className="admin-section" aria-labelledby="editorial-import-title">
    <header>
      <div>
        <h2 id="editorial-import-title">Importar revisão editorial</h2>
        <p>Carregue o pacote gerado pela Mesa Editorial. A prévia encontra as notas pelo conteúdo antes de alterar o site.</p>
      </div>
      {preview && <span className={`admin-record-status ${preview.canApply ? "is-live" : "is-review"}`}>{preview.canApply ? "Pronto para aplicar" : "Bloqueado"}</span>}
    </header>

    <div className="admin-form-grid">
      <label className="admin-field admin-field-wide">
        <span>Pacote JSON <small>gerado pela Mesa Editorial</small></span>
        <input ref={inputRef} type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectFile(file) }} />
      </label>

      {fileName && <p className="admin-page-note admin-field-wide">Arquivo carregado: <strong>{fileName}</strong></p>}
      {error && <p className="admin-form-error admin-field-wide" role="alert">{error}</p>}
      {message && <p className="admin-form-success admin-field-wide" role="status">{message}</p>}

      {preview && <>
        <dl className="admin-note-metrics admin-field-wide">
          <div><dt>Unidades</dt><dd>{preview.counts.units}</dd></div>
          <div><dt>Atualizar</dt><dd>{preview.counts.update}</dd></div>
          <div><dt>Excluir</dt><dd>{preview.counts.archive}</dd></div>
          <div><dt>Sem mudança</dt><dd>{preview.counts.unchanged}</dd></div>
        </dl>

        <div className="admin-field-wide">
          <p className="admin-page-note">A aplicação exige correspondência única para cada nota. {unresolved ? `${unresolved} item(ns) precisam de correção antes da aplicação.` : "Nenhuma correspondência insegura foi encontrada."}</p>
          <ul className="admin-pick-list">
            {preview.items.filter((item) => item.status !== "unchanged").slice(0, 30).map((item) => <li key={`${item.editorialId}:${item.position}`}>
              <span><strong>{item.title}</strong><small>Parte {item.position} · {actionLabel(item.action)}{item.detail ? ` · ${item.detail}` : ""}</small></span>
              <span className={`admin-record-status ${item.status === "matched" ? "is-live" : item.status === "unchanged" ? "is-muted" : "is-review"}`}>{statusLabel(item.status)}</span>
            </li>)}
          </ul>
        </div>

        <div className="admin-editor-actions admin-field-wide">
          {!confirming ? <button type="button" className="admin-button-primary" disabled={busy || !preview.canApply} onClick={() => setConfirming(true)}>Preparar aplicação</button> : <>
            <button type="button" className="admin-button-secondary" disabled={busy} onClick={() => setConfirming(false)}>Voltar</button>
            <button type="button" className="admin-button-danger" disabled={busy} onClick={() => void apply()}>Confirmar alterações e exclusões</button>
          </>}
        </div>
      </>}
    </div>
  </section>
}
