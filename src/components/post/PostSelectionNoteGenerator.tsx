"use client"

import { XMarkIcon } from "@heroicons/react/24/outline"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type CreatedNote = {
  _id: string
}

function quoteAsMarkdown(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line.trim()}`)
    .join("\n")
}

export function PostSelectionNoteGenerator({ postPath }: { postPath: string }) {
  const router = useRouter()
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [excerpt, setExcerpt] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const readSelection = useCallback(() => {
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
    if (!selectedText) return

    setExcerpt(selectedText)
    setError("")
    if (!dialogRef.current?.open) dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    const handlePointerUp = () => window.setTimeout(readSelection, 0)
    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Shift" || event.shiftKey) readSelection()
    }
    const handleSelectionChange = () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
      selectionTimerRef.current = setTimeout(readSelection, 500)
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

  function close() {
    if (submitting) return
    dialogRef.current?.close()
    window.getSelection()?.removeAllRanges()
    setExcerpt("")
    setError("")
  }

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

      dialogRef.current?.close()
      router.push(`/notes/${data._id}`)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível publicar a nota.")
      setSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      className="fixed inset-0 m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white p-0 text-neutral-950 shadow-2xl backdrop:bg-black/60 dark:border-white/10 dark:bg-[#0b0b0b] dark:text-[#f1f1f1]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-white/10">
        <h2 id={titleId} className="text-base font-semibold">Gerar nota</h2>
        <button
          type="button"
          onClick={close}
          disabled={submitting}
          aria-label="Fechar"
          className="grid size-8 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <XMarkIcon className="size-4" aria-hidden />
        </button>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Trecho selecionado</p>
        <blockquote className="mt-2 max-h-56 overflow-y-auto border-l-2 border-[#E00070] pl-3 text-sm leading-relaxed text-neutral-700 dark:text-[#d8d4ce]">
          {excerpt}
        </blockquote>
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">A nota incluirá este trecho e o link “Leia o post completo”.</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-4 dark:border-white/10">
        <button type="button" onClick={close} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-white/10">
          Cancelar
        </button>
        <button type="button" onClick={() => void publish()} disabled={submitting || !excerpt} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">
          {submitting ? "Publicando…" : "Publicar nota"}
        </button>
      </div>
    </dialog>
  )
}
