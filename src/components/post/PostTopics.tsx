"use client"

import { useEffect, useRef, useState } from "react"
import { Bars3Icon } from "@heroicons/react/24/outline"

type HeadingEntry = {
  id: string
  text: string
  level: number
  element: HTMLElement
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

  const usedIds = new Set(Array.from(document.querySelectorAll("[id]"), (element) => element.id))
  const headings = Array.from(container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"))

  const entries = headings
    .map((element) => {
      const text = element.textContent?.trim().replace(/^#+\s*/, "") ?? ""
      if (!text) return null

      let id = element.id.trim()
      if (!id) {
        const base = slugify(text)
        id = base
        let suffix = 1
        while (usedIds.has(id)) id = `${base}-${suffix++}`
        usedIds.add(id)
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

  const comments = document.querySelector<HTMLElement>("[data-post-comments]")
  if (entries.length > 0 && comments?.id) {
    entries.push({ id: comments.id, text: "Comentários", level: 2, element: comments })
  }
  return entries
}

type Props = {
  containerSelector?: string
}

export function PostTopics({ containerSelector = "[data-post-content]" }: Props) {
  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [paragraphCommentsOpen, setParagraphCommentsOpen] = useState(false)
  const [compactExpanded, setCompactExpanded] = useState(false)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const container = document.querySelector<HTMLElement>(containerSelector)
    if (!container) return

    const update = () => {
      const next = collectHeadings(containerSelector)
      setHeadings((current) => current.length === next.length && current.every((entry, index) => (
        entry.id === next[index].id && entry.text === next[index].text &&
        entry.level === next[index].level && entry.element === next[index].element
      )) ? current : next)
    }
    const frame = window.requestAnimationFrame(update)
    const observer = new MutationObserver(update)
    observer.observe(container, { childList: true, subtree: true, characterData: true })

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [containerSelector])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setPrefersReducedMotion(media.matches)

    const frame = window.requestAnimationFrame(update)
    media.addEventListener("change", update)
    return () => {
      window.cancelAnimationFrame(frame)
      media.removeEventListener("change", update)
    }
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
      const focusLine = window.scrollY + window.innerHeight * 0.5
      let nextActiveId: string | null = null

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
    window.addEventListener("hashchange", requestUpdate)
    const resizeObserver = new ResizeObserver(requestUpdate)
    const container = document.querySelector(containerSelector)
    if (container) resizeObserver.observe(container)

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", requestUpdate)
      window.removeEventListener("resize", requestUpdate)
      window.removeEventListener("hashchange", requestUpdate)
      resizeObserver.disconnect()
    }
  }, [headings, containerSelector])

  const activeIndex = headings.findIndex((heading) => heading.id === activeId)
  const displayedHeadings = paragraphCommentsOpen
    ? headings.slice(Math.max(activeIndex, 0), Math.max(activeIndex, 0) + (compactExpanded ? 3 : 1))
    : headings
  const displayedActiveIndex = displayedHeadings.findIndex((heading) => heading.id === activeId)

  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!nav || !active || paragraphCommentsOpen) return

    const navBounds = nav.getBoundingClientRect()
    const activeBounds = active.getBoundingClientRect()
    if (activeBounds.top < navBounds.top) {
      nav.scrollTop -= navBounds.top - activeBounds.top
    } else if (activeBounds.bottom > navBounds.bottom) {
      nav.scrollTop += activeBounds.bottom - navBounds.bottom
    }
  }, [activeId, paragraphCommentsOpen])

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

  if (headings.length === 0) return null

  return (
    <aside
      className={[
        "left-[calc(50%+20rem)] z-20 hidden w-64 text-sm text-neutral-600 dark:text-[#A8A095] xl:block",
        paragraphCommentsOpen ? "fixed top-24" : "absolute inset-y-0",
      ].join(" ")}
    >
      <div
        className={[
          "flex flex-col gap-3 border-l border-neutral-950/10 dark:border-white/10",
          paragraphCommentsOpen
            ? `bg-[#f4f4f4] dark:bg-[#040404] ${compactExpanded ? "h-44" : "h-32"}`
            : "sticky top-6 max-h-[calc(100dvh-3rem)]",
        ].join(" ")}
      >
        <p className="shrink-0 pl-6 font-medium text-neutral-950 dark:text-[#f1f1f1]">
          {paragraphCommentsOpen ? "Lendo agora" : "Neste artigo"}
        </p>
        <nav
          ref={navRef}
          aria-label="Tópicos do artigo"
          className={paragraphCommentsOpen ? "overflow-hidden" : "min-h-0 overflow-y-auto overscroll-y-contain"}
        >
          <div className="relative flex flex-col gap-1.5">
            {displayedHeadings.map((heading) => (
              <a
                key={heading.id}
                href={`#${encodeURIComponent(heading.id)}`}
                title={heading.text}
                aria-current={heading.id === activeId ? "location" : undefined}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  const hash = `#${encodeURIComponent(heading.id)}`
                  if (window.location.hash !== hash) window.history.pushState(null, "", hash)
                  window.scrollTo({
                    top: Math.max(0, heading.element.getBoundingClientRect().top + window.scrollY - 104),
                    behavior: prefersReducedMotion ? "auto" : "smooth",
                  })
                }}
                className={[
                  "flex h-6 shrink-0 items-center pr-3 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E00070] motion-reduce:transition-none dark:hover:text-[#f1f1f1]",
                  heading.id === activeId ? "text-neutral-950 dark:text-[#f1f1f1]" : "",
                ].join(" ")}
                style={{ paddingLeft: `${1.5 + Math.max(0, heading.level - 2)}rem` }}
              >
                <span className="truncate">{heading.text}</span>
              </a>
            ))}
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 h-6 w-px bg-[#E00070] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none"
              style={{
                transform: `translateY(${Math.max(0, displayedActiveIndex) * 1.875}rem)`,
                opacity: displayedActiveIndex < 0 ? 0 : 1,
              }}
            />
          </div>
        </nav>
        {paragraphCommentsOpen && (
          <button
            type="button"
            aria-expanded={compactExpanded}
            aria-label={compactExpanded ? "Mostrar menos tópicos" : "Mostrar mais tópicos"}
            onClick={() => setCompactExpanded((current) => !current)}
            className="mx-auto grid h-6 w-8 shrink-0 place-items-center rounded-full text-neutral-600 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E00070] dark:text-[#A8A095] dark:hover:text-[#f1f1f1]"
          >
            <Bars3Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </aside>
  )
}
