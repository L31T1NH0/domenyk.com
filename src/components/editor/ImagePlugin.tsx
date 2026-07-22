"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $createParagraphNode, $nodesOfType } from "lexical"
import {
  Bars3BottomLeftIcon,
  Bars3BottomRightIcon,
  PhotoIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import {
  $createImageNode,
  ImageNode,
  type ImageFlowWidth,
  type ImageLayout,
  type ImageThemeMode,
} from "./ImageNode"
import { $insertEditorBlock } from "./insert-editor-block"

type MediaAsset = {
  url: string
  pathname: string
  size: number
  uploadedAt: string
  contentType?: string
}

type Props = {
  compact?: boolean
  menuPlacement?: "above" | "below"
  uploadEndpoint?: string
  assetsEndpoint?: string
  allowAssetLibrary?: boolean
}

type MenuPosition = {
  top: number
  left: number
  maxHeight: number
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const body = await response.text()
  if (!body.trim()) return null
  try {
    return JSON.parse(body) as unknown
  } catch {
    return null
  }
}

function responseError(data: unknown, fallback: string): string {
  if (typeof data === "object" && data && "error" in data && typeof data.error === "string" && data.error.trim()) {
    return data.error
  }
  return fallback
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
  const [alt, setAlt] = useState("")
  const [layout, setLayout] = useState<ImageLayout>("block")
  const [flowWidth, setFlowWidth] = useState<ImageFlowWidth>(42)
  const [themeMode, setThemeMode] = useState<ImageThemeMode>("original")
  const [hasFlowImage, setHasFlowImage] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  useEffect(() => {
    const refresh = () => {
      editor.getEditorState().read(() => {
        setHasFlowImage($nodesOfType(ImageNode).some((node) => node.getLayout() !== "block"))
      })
    }
    refresh()
    return editor.registerUpdateListener(refresh)
  }, [editor])

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    setMenuPosition(null)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return

    const viewportMargin = 12
    const anchorGap = 8
    const triggerRect = trigger.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const panelHeight = panel.scrollHeight
    const spaceAbove = Math.max(0, triggerRect.top - viewportMargin - anchorGap)
    const spaceBelow = Math.max(0, window.innerHeight - triggerRect.bottom - viewportMargin - anchorGap)
    const preferredSpace = menuPlacement === "above" ? spaceAbove : spaceBelow
    const alternateSpace = menuPlacement === "above" ? spaceBelow : spaceAbove
    const usePreferredPlacement = panelHeight <= preferredSpace || preferredSpace >= alternateSpace
    const openAbove = usePreferredPlacement ? menuPlacement === "above" : menuPlacement !== "above"
    const availableHeight = openAbove ? spaceAbove : spaceBelow
    const renderedHeight = Math.min(panelHeight, availableHeight)
    const top = openAbove
      ? Math.max(viewportMargin, triggerRect.top - anchorGap - renderedHeight)
      : triggerRect.bottom + anchorGap
    const left = Math.min(
      Math.max(viewportMargin, triggerRect.right - panelRect.width),
      Math.max(viewportMargin, window.innerWidth - viewportMargin - panelRect.width),
    )
    const nextPosition = {
      top: Math.round(top),
      left: Math.round(left),
      maxHeight: Math.max(0, Math.floor(availableHeight)),
    }

    setMenuPosition((current) => (
      current
      && current.top === nextPosition.top
      && current.left === nextPosition.left
      && current.maxHeight === nextPosition.maxHeight
        ? current
        : nextPosition
    ))
  }, [menuPlacement])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [error, layout, open, showAssets, updateMenuPosition])

  useEffect(() => {
    if (!open || !menuPosition) return
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [menuPosition, open])

  useEffect(() => {
    if (!open) return

    const reposition = () => updateMenuPosition()
    const resizeObserver = new ResizeObserver(reposition)
    if (triggerRef.current) resizeObserver.observe(triggerRef.current)
    if (panelRef.current) resizeObserver.observe(panelRef.current)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      closeMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeMenu(true)
        return
      }
      if (event.key !== "Tab" || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [closeMenu, open, updateMenuPosition])

  function insertImage(url: string) {
    if (layout !== "block" && hasFlowImage) {
      setError("Este conteúdo já possui uma figura de contorno. Insira esta imagem no layout normal.")
      return
    }
    editor.update(() => {
      const paragraph = $createParagraphNode()
      paragraph.append($createImageNode(url, alt.trim(), layout, flowWidth, themeMode))
      $insertEditorBlock(paragraph)
    })
    closeMenu()
    setError("")
    setAlt("")
    setThemeMode("original")
    if (fileRef.current) fileRef.current.value = ""
  }

  async function uploadAndInsert(file: File) {
    if (layout !== "block" && hasFlowImage) {
      setError("Este conteúdo já possui uma figura de contorno. Selecione “Normal” antes do upload.")
      return
    }
    setUploading(true)
    setError("")
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(uploadEndpoint, { method: "POST", body: form })
      const data = await readJsonResponse(res)
      const url = typeof data === "object" && data && "url" in data && typeof data.url === "string"
        ? data.url
        : ""
      if (!res.ok || !url) {
        throw new Error(responseError(data, `Falha no upload (HTTP ${res.status})`))
      }
      insertImage(url)
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
      const data = await readJsonResponse(res)
      if (!res.ok || !Array.isArray(data)) {
        throw new Error(responseError(data, `Não foi possível carregar os assets (HTTP ${res.status}).`))
      }
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os assets.")
    } finally {
      setLoadingAssets(false)
    }
  }

  const buttonClassName = compact
    ? "grid size-11 place-items-center rounded-full text-[#A8A095] transition-colors hover:bg-white/10 hover:text-[#f1f1f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8A095]/35 disabled:opacity-40"
    : "grid size-11 place-items-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/35 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 disabled:opacity-40"
  const panelClassName = "fixed z-40 w-[min(23rem,calc(100vw-1.5rem))] overscroll-contain overflow-y-auto rounded-xl border border-neutral-200/80 bg-white/95 p-3 shadow-lg shadow-black/10 backdrop-blur dark:border-white/10 dark:bg-neutral-950/95 dark:shadow-black/40"

  return (
    <div className="relative z-20 ml-auto">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) closeMenu()
          else {
            setMenuPosition(null)
            setOpen(true)
          }
        }}
        className={buttonClassName}
        aria-label="Adicionar imagem"
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Adicionar imagem"
      >
        <PhotoIcon className="size-4" aria-hidden />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Adicionar imagem"
          className={panelClassName}
          style={{
            top: menuPosition?.top ?? 0,
            left: menuPosition?.left ?? 0,
            maxHeight: menuPosition?.maxHeight,
            visibility: menuPosition ? "visible" : "hidden",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Adicionar imagem</p>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                Envie uma nova imagem ou escolha uma existente.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => closeMenu(true)}
              className="grid size-11 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
              aria-label="Fechar"
            >
              <XMarkIcon className="size-4" aria-hidden />
            </button>
          </div>

          <fieldset className="mt-3">
            <legend className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Composição</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-white/[0.05]">
              {([
                { value: "block", label: "Normal", icon: RectangleStackIcon },
                { value: "flow-left", label: "Esquerda", icon: Bars3BottomLeftIcon },
                { value: "flow-right", label: "Direita", icon: Bars3BottomRightIcon },
              ] as const).map((option) => {
                const Icon = option.icon
                const active = layout === option.value
                const disabled = option.value !== "block" && hasFlowImage
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLayout(option.value)}
                    disabled={disabled}
                    aria-pressed={active}
                    className={[
                      "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 disabled:cursor-not-allowed disabled:opacity-35",
                      active
                        ? "bg-white text-neutral-950 shadow-sm dark:bg-neutral-800 dark:text-white"
                        : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white",
                    ].join(" ")}
                  >
                    <Icon className="size-4" aria-hidden />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {layout !== "block" && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Largura do recorte</span>
              <div className="flex rounded-md bg-neutral-100 p-0.5 dark:bg-white/[0.05]" role="group" aria-label="Largura do recorte">
                {([32, 42, 52] as const).map((width) => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => setFlowWidth(width)}
                    aria-pressed={flowWidth === width}
                    className={[
                      "min-h-11 rounded px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60",
                      flowWidth === width
                        ? "bg-white text-neutral-950 shadow-sm dark:bg-neutral-800 dark:text-white"
                        : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white",
                    ].join(" ")}
                  >
                    {width}%
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="mt-3 block">
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Texto alternativo</span>
            <input
              type="text"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              placeholder="Descreva o que aparece na imagem"
              className="mt-1.5 min-h-11 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm text-neutral-900 placeholder:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/50 dark:border-white/10 dark:text-neutral-100 dark:placeholder:text-neutral-400"
            />
          </label>

          {layout !== "block" && (
            <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Use SVG, PNG ou WebP com transparência para o texto acompanhar a silhueta.
            </p>
          )}

          <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-xs text-neutral-700 focus-within:ring-2 focus-within:ring-neutral-500/50 dark:border-white/10 dark:text-neutral-300">
            <span>
              <strong className="block font-medium">Adaptar arte monocromática ao tema</strong>
              <span className="mt-0.5 block text-neutral-600 dark:text-neutral-400">Inverte apenas esta imagem no tema escuro.</span>
            </span>
            <input
              type="checkbox"
              checked={themeMode === "adaptive-monochrome"}
              onChange={(event) => setThemeMode(event.target.checked ? "adaptive-monochrome" : "original")}
              className="size-4 shrink-0 accent-neutral-900 dark:accent-white"
            />
          </label>

          <div className={allowAssetLibrary ? "mt-3 grid grid-cols-2 gap-2" : "mt-3 grid gap-2"}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50/70 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-100 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-200 dark:hover:bg-white/10"
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
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40",
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
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" className="hidden"
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
        </div>,
        document.body,
      )}
    </div>
  )
}
