"use client"

import { useState } from "react"
import { ShareIcon } from "@heroicons/react/24/solid"

export function NoteShareButton({ noteId }: { noteId: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  async function share() {
    setError("")
    setCopied(false)
    try {
      const url = new URL(`/notes/${encodeURIComponent(noteId)}`, window.location.origin)
      await navigator.clipboard.writeText(url.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError("Não foi possível copiar o link. Tente novamente.")
    }
  }

  return <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2">
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "Link copiado" : "Compartilhar nota"}
      className="pointer-events-auto inline-flex min-h-8 items-center gap-1.5 rounded text-xs leading-none text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
    >
      <ShareIcon className="size-4" aria-hidden />
      <span role="status">{copied ? "Copiado" : "Compartilhar"}</span>
    </button>
    {error && <span role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</span>}
  </div>
}
