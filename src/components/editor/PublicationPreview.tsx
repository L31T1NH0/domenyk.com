"use client"

import { useEffect, useState } from "react"
import { YOUTUBE_EMBED_ORIGIN } from "@/lib/youtube-embed"

function attribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

/** Uses the publication renderer and the very same loaded application styles. */
export function PublicationPreview({ content }: { content: string }) {
  const [preview, setPreview] = useState("")
  const [error, setError] = useState("")
  useEffect(() => {
    const abort = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/content-preview", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }), signal: abort.signal,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Não foi possível gerar a prévia.")
        if (abort.signal.aborted) return
        const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => `<link rel="stylesheet" href="${attribute(link.href)}">`).join("")
        const theme = document.documentElement.className
        setPreview(`<!doctype html><html class="${attribute(theme)}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${YOUTUBE_EMBED_ORIGIN}; img-src https: http:; style-src 'unsafe-inline' ${location.origin}; font-src ${location.origin} data:">${links}<style>html,body{margin:0;padding:0;min-height:0;background:transparent}body{padding:16px}</style></head><body><div data-public-shell><div class="post-content">${result.html}</div></div></body></html>`)
        setError("")
      } catch (error) {
        if (!abort.signal.aborted) setError(error instanceof Error ? error.message : "Não foi possível gerar a prévia.")
      }
    }, 250)
    return () => { clearTimeout(timer); abort.abort() }
  }, [content])
  return <div className="publication-preview">
    {error && <p role="alert" className="publication-css-error">{error}</p>}
    {!preview && !error && <p role="status">Preparando prévia…</p>}
    {preview && <iframe title="Prévia da publicação" sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen srcDoc={preview} className="h-96 w-full border border-neutral-200 dark:border-white/10" />}
  </div>
}
