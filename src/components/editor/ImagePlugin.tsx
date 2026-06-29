"use client"

import { useRef, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $createParagraphNode, $insertNodes } from "lexical"
import { PhotoIcon, Squares2X2Icon, XMarkIcon } from "@heroicons/react/24/outline"
import { $createImageNode } from "./ImageNode"

type MediaAsset = {
  url: string
  pathname: string
  size: number
  uploadedAt: string
}

type Props = {
  compact?: boolean
  menuPlacement?: "above" | "below"
  uploadEndpoint?: string
  assetsEndpoint?: string
  allowAssetLibrary?: boolean
}

export function ImagePlugin({
  compact = false,
  menuPlacement = "above",
  uploadEndpoint = "/api/admin/media",
  assetsEndpoint = "/api/admin/media",
  allowAssetLibrary = true,
}: Props) {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showAssets, setShowAssets] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  function insertImage(url: string) {
    editor.update(() => {
      const paragraph = $createParagraphNode()
      paragraph.append($createImageNode(url))
      $insertNodes([paragraph])
    })
    setOpen(false)
    setError("")
  }

  async function uploadAndInsert(file: File) {
    setUploading(true)
    setError("")
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(uploadEndpoint, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? "Falha no upload")
      insertImage(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a imagem.")
    } finally {
      setUploading(false)
    }
  }

  async function loadAssets() {
    if (showAssets) {
      setShowAssets(false)
      return
    }

    setShowAssets(true)
    if (assets.length > 0 || loadingAssets) return

    setLoadingAssets(true)
    setError("")
    try {
      const res = await fetch(assetsEndpoint, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error ?? "Não foi possível carregar os assets.")
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os assets.")
    } finally {
      setLoadingAssets(false)
    }
  }

  const buttonClassName = compact
    ? "grid size-8 place-items-center rounded-full text-[#A8A095] transition-colors hover:bg-white/10 hover:text-[#f1f1f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8A095]/35 disabled:opacity-40"
    : "grid size-8 place-items-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/35 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 disabled:opacity-40"
  const panelClassName = [
    "absolute right-0 w-[min(23rem,calc(100vw-2rem))] rounded-xl border border-neutral-200/80 bg-white/95 p-3 shadow-xl shadow-black/10 backdrop-blur dark:border-white/10 dark:bg-neutral-950/95 dark:shadow-black/40",
    menuPlacement === "above" ? "bottom-10" : "top-10",
  ].join(" ")

  return (
    <div className="relative z-20 ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
        aria-label="Adicionar imagem"
        title="Adicionar imagem"
      >
        <PhotoIcon className="size-4" aria-hidden />
      </button>

      {open && (
        <div className={panelClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Adicionar imagem</p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                Envie uma nova imagem ou escolha uma existente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-100"
              aria-label="Fechar"
            >
              <XMarkIcon className="size-4" aria-hidden />
            </button>
          </div>

          <div className={allowAssetLibrary ? "mt-3 grid grid-cols-2 gap-2" : "mt-3 grid gap-2"}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50/70 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-100 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-200 dark:hover:bg-white/10"
            >
              <PhotoIcon className="size-4" aria-hidden />
              {uploading ? "enviando..." : "Upload"}
            </button>
            {allowAssetLibrary && (
              <button
                type="button"
                onClick={loadAssets}
                disabled={loadingAssets}
                className={[
                  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40",
                  showAssets
                    ? "border-neutral-300 bg-neutral-900 text-white dark:border-white/20 dark:bg-white dark:text-neutral-950"
                    : "border-neutral-200 bg-neutral-50/70 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-200 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <Squares2X2Icon className="size-4" aria-hidden />
                {loadingAssets ? "carregando..." : showAssets ? "Ocultar assets" : "Ver assets"}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) uploadAndInsert(e.target.files[0]) }} />

          {allowAssetLibrary && showAssets && (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/60 p-2 dark:border-white/10 dark:bg-white/[0.03]">
              {loadingAssets ? (
                <p className="py-6 text-center text-xs text-neutral-500">Carregando assets...</p>
              ) : assets.length === 0 ? (
                <p className="py-6 text-center text-xs text-neutral-500">Nenhuma imagem encontrada.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {assets.map((asset) => (
                    <button
                      key={asset.url}
                      type="button"
                      onClick={() => insertImage(asset.url)}
                      className="group relative aspect-square overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 transition hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/30"
                      title={asset.pathname}
                    >
                      <img src={asset.url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" style={{ filter: "none" }} />
                      <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" aria-hidden />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
