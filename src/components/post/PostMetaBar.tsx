"use client"

import { useEffect, useMemo, useState } from "react"
import { ClockIcon, EyeIcon, ShareIcon } from "@heroicons/react/24/solid"

type Props = {
  publicId: string
  dateLabel?: string
  readingTime: string
  initialViews?: number
}

const VIEW_TTL_MS = 24 * 60 * 60 * 1000
const pendingViewPublicIds = new Set<string>()

export function PostMetaBar({ publicId, dateLabel, readingTime, initialViews = 0 }: Props) {
  const [views, setViews] = useState(initialViews)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const storageKey = `post-viewed:${publicId}`
    const now = Date.now()
    const previousView = Number(localStorage.getItem(storageKey) ?? 0)

    if (pendingViewPublicIds.has(publicId) || (previousView && now - previousView < VIEW_TTL_MS)) {
      return
    }

    let cancelled = false
    pendingViewPublicIds.add(publicId)

    fetch(`/api/posts/${encodeURIComponent(publicId)}?view=1`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((post) => {
        if (!cancelled && typeof post?.views === "number") {
          setViews(post.views)
          localStorage.setItem(storageKey, String(now))
        }
      })
      .finally(() => {
        pendingViewPublicIds.delete(publicId)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [publicId])

  const displayViews = useMemo(() => `${views} views`, [views])

  async function share() {
    if (typeof window === "undefined") return
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="mt-4 flex items-center text-sm text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-3">
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
        <div className="flex items-center gap-2 min-w-0 whitespace-normal sm:whitespace-nowrap">
          {dateLabel && <time>{dateLabel}</time>}
          {dateLabel && <span aria-hidden className="mx-1 text-zinc-400">|</span>}
          <div className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Tempo de leitura:</span>
              {readingTime}
            </span>
            <span aria-hidden className="mx-1 text-zinc-400">•</span>
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Views:</span>
              {displayViews}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={share}
          aria-label="Compartilhar"
          className="justify-self-end inline-flex shrink-0 items-center justify-center gap-1 sm:gap-2 h-7 w-7 p-0 sm:h-auto sm:w-auto sm:px-2 sm:py-1.5 text-xs sm:text-sm font-medium text-cyan-600 hover:text-cyan-700 active:text-cyan-700 rounded-full border border-transparent hover:border-cyan-200/60 dark:hover:border-cyan-800/60 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
        >
          <ShareIcon className="block h-3 w-3 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">{copied ? "Copiado" : "Compartilhar"}</span>
        </button>
      </div>
    </div>
  )
}
