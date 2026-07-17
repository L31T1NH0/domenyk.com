"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Bars3Icon } from "@heroicons/react/24/outline"
import { AutoFitText } from "@/components/text/AutoFitText"
import styles from "./PostTopics.module.css"

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
  const navRef = useRef<HTMLElement>(null)
  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [paragraphCommentsOpen, setParagraphCommentsOpen] = useState(false)
  const [compactExpanded, setCompactExpanded] = useState(false)

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
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      const open = Boolean(detail?.open)
      setParagraphCommentsOpen(open)
      if (!open) setCompactExpanded(false)
    }

    window.addEventListener("paragraph-comments-open-change", onChange)
    return () => window.removeEventListener("paragraph-comments-open-change", onChange)
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
  const activeIndex = Math.max(
    0,
    visibleHeadings.findIndex((heading) => heading.id === activeId)
  )
  const compactStartIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, visibleHeadings.length - 1))
  const displayedHeadings = paragraphCommentsOpen
    ? visibleHeadings.slice(compactStartIndex, compactStartIndex + (compactExpanded ? 3 : 1))
    : visibleHeadings

  useEffect(() => {
    if (!activeId || paragraphCommentsOpen) return

    const nav = navRef.current
    const activeTopic = nav?.querySelector<HTMLElement>(`[data-topic-id="${CSS.escape(activeId)}"]`)
    if (!nav || !activeTopic) return

    const viewportInset = 8
    const topicTop = activeTopic.offsetTop
    const topicBottom = topicTop + activeTopic.offsetHeight
    const viewportTop = nav.scrollTop + viewportInset
    const viewportBottom = nav.scrollTop + nav.clientHeight - viewportInset

    if (topicTop < viewportTop) {
      nav.scrollTo({
        top: Math.max(0, topicTop - viewportInset),
        behavior: prefersReducedMotion ? "auto" : "smooth",
      })
    } else if (topicBottom > viewportBottom) {
      nav.scrollTo({
        top: topicBottom - nav.clientHeight + viewportInset,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      })
    }
  }, [activeId, paragraphCommentsOpen, prefersReducedMotion])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("paragraph-topics-compact-change", {
      detail: { expanded: paragraphCommentsOpen && compactExpanded },
    }))

    return () => {
      window.dispatchEvent(new CustomEvent("paragraph-topics-compact-change", {
        detail: { expanded: false },
      }))
    }
  }, [compactExpanded, paragraphCommentsOpen])

  if (visibleHeadings.length === 0) return null

  return (
    <aside
      className={[
        "fixed top-24 left-[calc(50%+20rem)] z-20 hidden w-64 flex-col overflow-hidden border border-neutral-950/10 bg-[#f4f4f4]/95 text-sm text-neutral-600 transition-[height,border-radius] duration-200 ease-out dark:border-white/10 dark:bg-[#040404]/95 dark:text-[#A8A095] xl:flex",
        paragraphCommentsOpen
          ? compactExpanded
            ? "h-44 rounded-t-lg border-b-0"
            : "h-32 rounded-t-lg border-b-0"
          : "h-[min(28.5rem,calc(100dvh-7rem))] rounded-lg",
      ].join(" ")}
    >
      <div className={["border-b border-neutral-950/10 px-4 dark:border-white/10", paragraphCommentsOpen ? "py-2.5" : "py-3"].join(" ")}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-neutral-950 dark:text-[#f1f1f1]">
            {paragraphCommentsOpen ? "Lendo agora" : "Neste artigo"}
          </span>
          <span className="tabular-nums text-[0.68rem] text-neutral-500 dark:text-[#A8A095]/80">
            {activeIndex + 1}/{visibleHeadings.length}
          </span>
        </div>
        <div className="mt-2 h-px overflow-hidden rounded-full bg-neutral-950/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-[#E00070] transition-[width] duration-200 ease-out"
            style={{
              width: `${((activeIndex + 1) / visibleHeadings.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <nav
        ref={navRef}
        className={[
          "relative flex flex-col px-2",
          paragraphCommentsOpen
            ? "h-[4.35rem] overflow-hidden py-1.5"
            : `min-h-0 flex-1 overflow-y-auto py-2 ${styles.scrollViewport}`,
          paragraphCommentsOpen && compactExpanded ? "h-[7.25rem]" : "",
        ].join(" ")}
        aria-label="Tópicos do artigo"
      >
        {displayedHeadings.map((heading) => {
          const active = heading.id === activeId
          const visualLevel = Math.min(3, Math.max(1, heading.level))
          const levelMarker = "#".repeat(visualLevel)
          const levelClasses = {
            1: "pl-2 font-semibold",
            2: "pl-5 font-medium",
            3: "pl-8 font-normal",
          }[visualLevel]

          return (
            <button
              key={heading.id}
              data-topic-id={heading.id}
              type="button"
              title={heading.text}
              aria-label={`Tópico nível ${visualLevel}: ${heading.text}`}
              aria-current={active ? "location" : undefined}
              onClick={() => {
                heading.element.scrollIntoView({
                  behavior: prefersReducedMotion ? "auto" : "smooth",
                  block: "start",
                })
                window.history.replaceState(null, "", `#${encodeURIComponent(heading.id)}`)
              }}
              className={[
                "group relative grid w-full grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-1.5 rounded-md pr-2 text-left transition-[background-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070]/70",
                levelClasses,
                paragraphCommentsOpen ? "h-8 py-1.5" : "h-12 shrink-0 py-2",
                paragraphCommentsOpen
                  ? active
                    ? "text-neutral-950 dark:text-[#f1f1f1]"
                    : "text-neutral-500 dark:text-[#A8A095]/85"
                  : active
                    ? "bg-neutral-950/[0.06] text-neutral-950 dark:bg-white/[0.07] dark:text-[#f1f1f1]"
                    : "hover:bg-neutral-950/[0.035] hover:text-neutral-950 dark:hover:bg-white/[0.04] dark:hover:text-[#f1f1f1]",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "mt-[0.2rem] block font-[family-name:var(--font-mono)] text-[0.55rem] font-semibold leading-none tracking-[-0.12em] transition-colors",
                  active
                    ? "text-[#E00070]"
                    : "text-neutral-400 group-hover:text-neutral-600 dark:text-[#A8A095]/55 dark:group-hover:text-[#A8A095]/85",
                ].join(" ")}
              >
                {levelMarker}
              </span>
              <AutoFitText
                text={heading.text}
                minSize={11}
                maxSize={visualLevel === 1 ? 13 : visualLevel === 2 ? 12 : 11}
                maxLines={paragraphCommentsOpen ? 1 : 2}
                className={[
                  "block min-w-0 overflow-hidden leading-snug",
                  visualLevel > 1 && !active ? "text-neutral-500 dark:text-[#A8A095]/85" : "",
                  visualLevel > 1 && !paragraphCommentsOpen
                    ? "group-hover:text-neutral-700 dark:group-hover:text-[#f1f1f1]"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </button>
          )
        })}
        {paragraphCommentsOpen && (
          <button
            type="button"
            aria-expanded={compactExpanded}
            aria-label={compactExpanded ? "Mostrar menos tópicos" : "Mostrar mais tópicos"}
            onClick={() => setCompactExpanded((current) => !current)}
            className="mx-auto mt-1 grid h-6 w-8 place-items-center rounded-full text-neutral-500 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070]/70 dark:text-[#A8A095] dark:hover:text-[#f1f1f1]"
          >
            <Bars3Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </nav>
    </aside>
  )
}
