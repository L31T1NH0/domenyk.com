"use client"

import { ArrowUpTrayIcon, CheckIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline"
import { useRef, useState } from "react"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"
import type { SerializedMediaItem } from "@/lib/blob"

type Props = { initialMedia: SerializedMediaItem[] }

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaLibrary({ initialMedia }: Props) {
  const [media, setMedia] = useState(initialMedia)
  const [uploading, setUploading] = useState(false)
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setUploading(true)
    setError("")
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/admin/media", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erro ao enviar imagem.")
      setMedia((prev) => [
        {
          url: data.url,
          pathname: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          contentType: data.contentType ?? file.type,
        },
        ...prev,
      ])
      if (fileRef.current) fileRef.current.value = ""
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar imagem.")
    } finally {
      setUploading(false)
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  async function remove(item: SerializedMediaItem) {
    setDeletingUrl(item.url)
    setError("")
    try {
      const res = await fetch("/api/admin/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Erro ao deletar imagem.")
      setMedia((prev) => prev.filter((asset) => asset.url !== item.url))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao deletar imagem."
      setError(message)
      throw new Error(message)
    } finally {
      setDeletingUrl(null)
    }
  }

  return (
    <div className="admin-media-library">
      <div
        className="admin-media-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) upload(file)
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]) }}
        />
        {uploading ? (
          <div className="admin-media-upload-state" role="status">
            <span className="admin-media-upload-icon"><ArrowUpTrayIcon aria-hidden /></span>
            <span><strong>Enviando imagem</strong><small>O arquivo aparecerá na biblioteca assim que terminar.</small></span>
          </div>
        ) : (
          <div className="admin-media-upload-state">
            <span className="admin-media-upload-icon"><ArrowUpTrayIcon aria-hidden /></span>
            <span><strong>Envie uma imagem</strong><small>Arraste um arquivo para esta área ou escolha no dispositivo. SVG, PNG, JPG e WebP.</small></span>
            <button type="button" className="admin-button-secondary" onClick={() => fileRef.current?.click()}>Escolher arquivo</button>
          </div>
        )}
      </div>
      {error && <p className="admin-form-error" role="alert">{error}</p>}

      <section className="admin-media-section">
        <header><div><h2>Biblioteca</h2><p>{media.length} {media.length === 1 ? "arquivo disponível" : "arquivos disponíveis"}</p></div></header>
        <div className="admin-media-grid">
        {media.map((item) => (
          <figure
            key={item.url}
            className="admin-media-item"
            title={item.pathname}
          >
            <div className="admin-media-preview"><img src={item.url} alt="" /></div>
            <figcaption>
              <span className="admin-media-meta"><strong>{item.pathname}</strong><small>{formatBytes(item.size)}</small></span>
              <span className="admin-media-actions">
              <button
                type="button"
                onClick={() => copyUrl(item.url)}
                className="admin-icon-button"
                aria-label={copied === item.url ? "URL copiada" : "Copiar URL"}
                title={copied === item.url ? "URL copiada" : "Copiar URL"}
              >
                {copied === item.url ? <CheckIcon aria-hidden /> : <ClipboardDocumentIcon aria-hidden />}
              </button>
              <DeleteActionMenu
                title="Excluir esta imagem?"
                description="O arquivo será apagado permanentemente dos assets e poderá deixar referências quebradas no site."
                onDelete={() => remove(item)}
                disabled={deletingUrl === item.url}
                triggerAriaLabel={`Opções da imagem ${item.pathname}`}
                triggerClassName="admin-icon-button"
              />
              </span>
            </figcaption>
          </figure>
        ))}
        {media.length === 0 && <p className="admin-empty admin-media-empty">Nenhuma imagem enviada. Use a área acima para começar.</p>}
        </div>
      </section>
    </div>
  )
}
