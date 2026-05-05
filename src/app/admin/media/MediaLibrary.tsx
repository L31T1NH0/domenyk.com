"use client"

import { ClipboardDocumentIcon, TrashIcon } from "@heroicons/react/24/outline"
import { useRef, useState } from "react"
import type { SerializedMediaItem } from "@/lib/blob"

type Props = { initialMedia: SerializedMediaItem[] }

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
        { url: data.url, pathname: file.name, size: file.size, uploadedAt: new Date().toISOString() },
        ...prev,
      ])
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
    if (!confirm("Deletar esta imagem permanentemente dos assets?")) return

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
      setError(err instanceof Error ? err.message : "Erro ao deletar imagem.")
    } finally {
      setDeletingUrl(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-white p-5 text-center shadow-sm transition-colors hover:border-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600 sm:p-8"
        onClick={() => fileRef.current?.click()}
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
          accept="image/*"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]) }}
        />
        {uploading ? (
          <p className="text-sm text-neutral-400">Enviando...</p>
        ) : (
          <>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Arraste ou clique para enviar</p>
            <p className="text-xs text-neutral-400">PNG, JPG, WebP, GIF</p>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {media.map((item) => (
          <div
            key={item.url}
            className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 shadow-sm dark:border-neutral-900 dark:bg-neutral-900"
            title={item.pathname}
          >
            <img src={item.url} alt="" className="w-full h-full object-cover" style={{ filter: "none" }} />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => copyUrl(item.url)}
                className="grid size-9 place-items-center rounded-full bg-white/90 text-neutral-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white"
                aria-label={copied === item.url ? "URL copiada" : "Copiar URL"}
                title={copied === item.url ? "URL copiada" : "Copiar URL"}
              >
                <ClipboardDocumentIcon className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => remove(item)}
                disabled={deletingUrl === item.url}
                className="grid size-9 place-items-center rounded-full bg-white/90 text-red-600 hover:bg-white disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Deletar permanentemente"
                title="Deletar permanentemente"
              >
                <TrashIcon className="size-5" aria-hidden />
              </button>
            </div>
            {copied === item.url && (
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                copiado
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
