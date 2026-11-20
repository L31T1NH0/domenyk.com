"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon } from "@heroicons/react/24/outline"
import { formatSiteDate } from "@/lib/datetime"
import { fetchLatestNote, type LatestNote } from "@/lib/latest-note"
import { descriptionFromMarkdown } from "@/lib/seo"

export function LatestNotePreview() {
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error"
    note: LatestNote | null
  }>({ status: "loading", note: null })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 8000)

    fetchLatestNote(controller.signal)
      .then(note => { if (active) setState({ status: "ready", note }) })
      .catch(() => { if (active) setState({ status: "error", note: null }) })
      .finally(() => window.clearTimeout(timeout))

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const { note, status } = state

  return (
    <div aria-busy={status === "loading"} aria-live="polite" className="mt-4 rounded-lg bg-neutral-950/[0.04] p-5 dark:bg-white/[0.06]">
      {status === "loading" ? (
        <div role="status" className="min-h-28">
          <span className="sr-only">Carregando última nota…</span>
          <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
            <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-white/10" />
            <div className="h-4 w-full rounded bg-neutral-200 dark:bg-white/10" />
            <div className="h-4 w-4/5 rounded bg-neutral-200 dark:bg-white/10" />
          </div>
        </div>
      ) : note ? (
        <>
          <time dateTime={note.publishedAt} className="text-xs text-neutral-600 dark:text-neutral-400">
            {formatSiteDate(note.publishedAt, { day: "numeric", month: "short", year: "numeric" })}
          </time>
          <p className="mt-3 line-clamp-4 break-words text-pretty text-[16px] leading-relaxed text-neutral-950 dark:text-neutral-100">{descriptionFromMarkdown(note.content, 240) || "Uma nova nota foi publicada."}</p>
        </>
      ) : (
        <p className="min-h-20 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {status === "error" ? "Não foi possível carregar a última nota agora." : "Ainda não há notas publicadas."}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        {note && (
          <Link href={`/notes/${note.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-sm font-medium underline decoration-neutral-400 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4">
            Ler nota completa <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        )}
        <Link href="/notes" className="inline-flex min-h-11 items-center rounded-sm text-neutral-600 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-neutral-400 dark:hover:text-white">Todas as notas</Link>
      </div>
    </div>
  )
}
