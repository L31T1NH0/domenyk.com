"use client"

import { DocumentPlusIcon } from "@heroicons/react/24/outline"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type CreatedNote = { _id: string }

type DropdownPosition = {
  left: number
  top: number
  above: boolean
}

const DROPDOWN_WIDTH = 288
const DROPDOWN_ESTIMATED_HEIGHT = 176
const VIEWPORT_MARGIN = 12

function quoteAsMarkdown(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line.trim()}`)
    .join("\n")
}

export function PostSelectionNoteGenerator({ postPath }: { postPath: string }) {
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [excerpt, setExcerpt] = useState("")
  const [position, setPosition] = useState<DropdownPosition | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const close = useCallback(() => {
    if (submitting) return
    setPosition(null)
    setExcerpt("")
    setError("")
    window.getSelection()?.removeAllRanges()
  }, [submitting])

  const readSelection = useCallback((focusAction = false) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const start = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as Element
      : range.startContainer.parentElement
    const end = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer as Element
      : range.endContainer.parentElement
    const content = start?.closest("[data-post-content]")

    if (!content || !end || !content.contains(end)) return

    const selectedText = selection.toString().replace(/\s+/g, " ").trim()
    const selectionRect = range.getBoundingClientRect()
    if (!selectedText || (selectionRect.width === 0 && selectionRect.height === 0)) return

    const availableWidth = Math.min(DROPDOWN_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
    const centeredLeft = selectionRect.left + selectionRect.width / 2 - availableWidth / 2
    const left = Math.min(
      window.innerWidth - availableWidth - VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, centeredLeft)
    )
    const above = selectionRect.bottom + DROPDOWN_ESTIMATED_HEIGHT + VIEWPORT_MARGIN > window.innerHeight

    setExcerpt(selectedText)
    setError("")
    setPosition({
      left,
      top: above ? Math.max(VIEWPORT_MARGIN, selectionRect.top - 8) : selectionRect.bottom + 8,
      above,
    })

    if (focusAction) requestAnimationFrame(() => actionRef.current?.focus())
  }, [])

  useEffect(() => {
    const handlePointerUp = () => window.setTimeout(() => readSelection(), 0)
    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Shift" || event.shiftKey) readSelection(true)
    }
    const handleSelectionChange = () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
      selectionTimerRef.current = setTimeout(() => readSelection(), 500)
    }

    document.addEventListener("pointerup", handlePointerUp)
    document.addEventListener("keyup", handleKeyUp)
    document.addEventListener("selectionchange", handleSelectionChange)
    return () => {
      document.removeEventListener("pointerup", handlePointerUp)
      document.removeEventListener("keyup", handleKeyUp)
      document.removeEventListener("selectionchange", handleSelectionChange)
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
    }
  }, [readSelection])

  useEffect(() => {
    if (!position) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) close()
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      close()
    }
    const handleViewportChange = () => close()

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("scroll", handleViewportChange, true)
    window.addEventListener("resize", handleViewportChange)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("scroll", handleViewportChange, true)
      window.removeEventListener("resize", handleViewportChange)
    }
  }, [close, position])

  async function publish() {
    if (!excerpt || submitting) return
    setSubmitting(true)
    setError("")

    try {
      const content = `${quoteAsMarkdown(excerpt)}\n\n[Leia o post completo](${postPath})`
      const response = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await response.json().catch(() => null) as (CreatedNote & { error?: string }) | null
      if (!response.ok || !data?._id) {
        throw new Error(data?.error ?? "Não foi possível publicar a nota.")
      }

      setPosition(null)
      router.push(`/notes/${data._id}`)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível publicar a nota.")
      setSubmitting(false)
    }
  }

  if (!position) return null

  return (
    <div
      ref={dropdownRef}
      role="dialog"
      aria-label="Gerar nota a partir do trecho selecionado"
      className="fixed z-[70] w-[min(18rem,calc(100vw-1.5rem))] rounded-[10px] border border-neutral-200 bg-white p-1.5 text-neutral-950 shadow-[0_4px_8px_rgb(0_0_0_/_0.12)] dark:border-white/10 dark:bg-[#0b0b0b] dark:text-[#f1f1f1] dark:shadow-[0_4px_8px_rgb(0_0_0_/_0.45)]"
      style={{
        left: position.left,
        top: position.top,
        transform: position.above ? "translateY(-100%)" : undefined,
      }}
    >
      <blockquote className="line-clamp-3 border-l border-[#E00070] px-2.5 py-1.5 text-xs leading-[1.5] text-neutral-600 dark:text-[#A8A095]">
        {excerpt}
      </blockquote>
      {error && <p role="alert" className="px-2.5 py-1.5 text-xs leading-5 text-red-700 dark:text-red-400">{error}</p>}
      <button
        ref={actionRef}
        type="button"
        onClick={() => void publish()}
        disabled={submitting}
        className="mt-1 flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium text-neutral-700 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500 disabled:cursor-wait disabled:opacity-50 dark:text-[#d8d4ce] dark:hover:bg-white/[0.07] dark:hover:text-[#f1f1f1] dark:focus-visible:bg-white/[0.07] dark:focus-visible:ring-neutral-300"
      >
        <DocumentPlusIcon className="size-4 shrink-0" aria-hidden />
        {submitting ? "Gerando nota…" : "Gerar nota"}
      </button>
    </div>
  )
}
