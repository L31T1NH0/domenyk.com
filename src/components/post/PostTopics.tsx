"use client"

import { useEffect, useMemo, useState } from "react"

type HeadingEntry = {
  id: string
  text: string
  level: number
  element: HTMLHeadingElement
}

function slugify(text: string) {
  const normalized = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  const slug = normalized
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")

  return slug || "topico"
}

function collectHeadings(containerSelector: string): HeadingEntry[] {
  const container = document.querySelector<HTMLElement>(containerSelector)
  if (!container) return []

  const counts = new Map<string, number>()
  const headings = Array.from(container.querySelectorAll<HTMLHeadingElement>("h1, h2, h3, h4"))

  return headings
    .map((element) => {
      const text = element.textContent?.trim().replace(/^#+\s*/, "") ?? ""
      if (!text) return null

      let id = element.id.trim()
      if (!id) {
        const base = slugify(text)
        const count = counts.get(base) ?? 0
        counts.set(base, count + 1)
        id = count === 0 ? base : `${base}-${count}`
        element.id = id
      }

      return {
        id,
        text,
        level: Number(element.tagName.slice(1)),
        element,
      }
    })
    .filter((heading): heading is HeadingEntry => heading !== null)
}

type Props = {
  containerSelector?: string
}

export function PostTopics({ containerSelector = "[data-post-content]" }: Props) {
  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const update = () => setHeadings(collectHeadings(containerSelector))
    update()

    const container = document.querySelector<HTMLElement>(containerSelector)
    if (!container) return

    const observer = new MutationObserver(update)
    observer.observe(container, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [containerSelector])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setPrefersReducedMotion(media.matches)

    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    if (headings.length === 0) {
      return
    }

    let frame: number | null = null

    const updateActiveHeading = () => {
      frame = null
      const focusLine = window.scrollY + window.innerHeight * 0.38
      let nextActiveId = headings[0]?.id ?? null

      for (const heading of headings) {
        const top = heading.element.getBoundingClientRect().top + window.scrollY
        if (top <= focusLine) nextActiveId = heading.id
        else break
      }

      setActiveId((current) => (current === nextActiveId ? current : nextActiveId))
    }

    const requestUpdate = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(updateActiveHeading)
    }

    requestUpdate()
    window.addEventListener("scroll", requestUpdate, { passive: true })
    window.addEventListener("resize", requestUpdate)

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", requestUpdate)
      window.removeEventListener("resize", requestUpdate)
    }
  }, [headings])

  const visibleHeadings = useMemo(
    () => headings.filter((heading) => heading.text.length > 0),
    [headings]
  )

  if (visibleHeadings.length === 0) return null

  return (
    <aside className="fixed top-24 left-[calc(50%+20rem)] z-20 hidden max-h-[calc(100vh-7rem)] w-56 flex-col overflow-y-auto rounded-lg border border-white/10 bg-[#040404]/80 p-3 text-sm text-[#A8A095] shadow-xl shadow-black/20 backdrop-blur-xl xl:flex">
      <span className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#f1f1f1]">
        Neste artigo
      </span>
      <nav className="flex flex-col gap-1" aria-label="Tópicos do artigo">
        {visibleHeadings.map((heading) => {
          const active = heading.id === activeId

          return (
            <button
              key={heading.id}
              type="button"
              title={heading.text}
              aria-current={active ? "true" : undefined}
              onClick={() => {
                heading.element.scrollIntoView({
                  behavior: prefersReducedMotion ? "auto" : "smooth",
                  block: "start",
                })
              }}
              className={[
                "w-full truncate rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070]/70",
                heading.level > 2 ? "pl-4 text-xs" : "",
                active
                  ? "bg-white/10 text-[#f1f1f1]"
                  : "hover:bg-white/5 hover:text-[#f1f1f1]",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {heading.text}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
