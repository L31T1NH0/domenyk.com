"use client"

import { useEffect, useRef, useState } from "react"
const TOPIC_LINK_CLASS_NAME = "flex min-h-6 shrink-0 items-start py-0.5 pr-3 leading-5"

function topicIndent(level: number) {
  return `${1.5 + Math.max(0, level - 2)}rem`
}

function fitTopicWindow(heights: number[], active: number, budget: number, gap: number) {
  let start = active
  let end = active + 1
  let used = heights[active] ?? 0
  let before = 0
  let after = 0

  while (start > 0 || end < heights.length) {
    const previous = start > 0 ? heights[start - 1] + gap : Infinity
    const next = end < heights.length ? heights[end] + gap : Infinity
    const fitsBefore = used + previous <= budget
    const fitsAfter = used + next <= budget
    if (!fitsBefore && !fitsAfter) break

    if (fitsBefore && (!fitsAfter || before < after)) {
      start -= 1
      used += previous
      before += previous
    } else {
      end += 1
      used += next
      after += next
    }
  }

  return { start, end }
}

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
  const [topicWindow, setTopicWindow] = useState({ start: 0, end: 1 })
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLParagraphElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLParagraphElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)

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
  const displayedHeadings = headings.slice(topicWindow.start, topicWindow.end)
  const hasEarlierTopics = topicWindow.start > 0
  const hasLaterTopics = topicWindow.end < headings.length

  useEffect(() => {
    const panel = panelRef.current
    const title = titleRef.current
    const measurement = measurementRef.current
    const marker = markerRef.current
    if (!panel || !title || !measurement || !marker || headings.length === 0) return

    let frame = 0
    const update = () => {
      frame = 0
      if (panel.getBoundingClientRect().width === 0) return

      const heights = Array.from(measurement.children, (item) => item.getBoundingClientRect().height)
      const gap = parseFloat(getComputedStyle(measurement).rowGap) || 0
      const headerHeight = title.getBoundingClientRect().height + (parseFloat(getComputedStyle(panel).rowGap) || 0)
      const markersHeight = marker.getBoundingClientRect().height * 2 + gap * 2
      const anchor = Math.max(0, activeIndex)
      const panelTop = Math.max(24, panel.getBoundingClientRect().top)
      const availableHeight = Math.max(0, window.innerHeight - panelTop - 24)
      const panelHeight = paragraphCommentsOpen
        ? Math.min(availableHeight, Math.max(128, headerHeight + markersHeight + heights[anchor]))
        : availableHeight
      const contentHeight = Math.max(0, panelHeight - headerHeight)
      const totalHeight = heights.reduce((sum, height) => sum + height, 0) + gap * Math.max(0, heights.length - 1)
      const next = totalHeight <= contentHeight
        ? { start: 0, end: headings.length }
        : fitTopicWindow(heights, anchor, Math.max(0, contentHeight - markersHeight), gap)

      setTopicWindow((current) => current.start === next.start && current.end === next.end ? current : next)
    }
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    requestUpdate()
    const observer = new ResizeObserver(requestUpdate)
    observer.observe(measurement)
    observer.observe(title)
    window.addEventListener("resize", requestUpdate)
    window.visualViewport?.addEventListener("resize", requestUpdate)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", requestUpdate)
      window.visualViewport?.removeEventListener("resize", requestUpdate)
    }
  }, [headings, activeIndex, paragraphCommentsOpen])

  useEffect(() => {
    const nav = navRef.current
    const list = listRef.current
    const indicator = indicatorRef.current
    if (!nav || !list || !indicator) return

    const update = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="location"]')
      indicator.style.opacity = active ? "1" : "0"
      if (!active) return

      indicator.style.transform = `translateY(${active.offsetTop}px)`
      indicator.style.height = `${active.offsetHeight}px`
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(list)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [activeId, headings, topicWindow, paragraphCommentsOpen])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const notifyHeight = () => {
      window.dispatchEvent(new CustomEvent("paragraph-topics-compact-change", {
        detail: { height: paragraphCommentsOpen ? panel.getBoundingClientRect().height : 128 },
      }))
    }
    notifyHeight()
    const observer = new ResizeObserver(notifyHeight)
    observer.observe(panel)

    return () => {
      observer.disconnect()
      window.dispatchEvent(new CustomEvent("paragraph-topics-compact-change", {
        detail: { height: 128 },
      }))
    }
  }, [headings.length, paragraphCommentsOpen])

  if (headings.length === 0) return null

  return (
    <aside
      className={[
        "z-20 hidden w-[var(--post-sidebar-width)] text-sm text-neutral-600 dark:text-[#A8A095] xl:block",
        paragraphCommentsOpen
          ? "fixed top-24 left-[var(--post-sidebar-left)]"
          : "absolute inset-y-0 left-[calc(100%+var(--post-column-gap))]",
      ].join(" ")}
    >
      <div
        ref={panelRef}
        className={[
          "flex flex-col gap-3 border-l border-neutral-950/10 dark:border-white/10",
          paragraphCommentsOpen
            ? "min-h-32 bg-[#f4f4f4] dark:bg-[#040404]"
            : "sticky top-6",
        ].join(" ")}
      >
        <p ref={titleRef} className="shrink-0 pl-6 font-medium text-neutral-950 dark:text-[#f1f1f1]">
          {paragraphCommentsOpen ? "Lendo agora" : "Neste artigo"}
        </p>
        <nav
          ref={navRef}
          aria-label="Tópicos do artigo"
          className="relative flex min-h-0 flex-col gap-1.5"
        >
          <div aria-hidden="true" inert className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
            <p ref={markerRef} className="pl-6 text-xs leading-5">Mais tópicos</p>
            <div ref={measurementRef} className="flex flex-col gap-1.5">
              {headings.map((heading) => (
                <div key={heading.id} className={TOPIC_LINK_CLASS_NAME} style={{ paddingLeft: topicIndent(heading.level) }}>
                  <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{heading.text}</span>
                </div>
              ))}
            </div>
          </div>
          {hasEarlierTopics && (
            <p className="pl-6 text-xs leading-5 text-neutral-500 dark:text-[#A8A095]">
              {topicWindow.start} {topicWindow.start === 1 ? "tópico anterior" : "tópicos anteriores"}
            </p>
          )}
          <div ref={listRef} className="relative flex flex-col gap-1.5">
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
                  TOPIC_LINK_CLASS_NAME,
                  "transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E00070] motion-reduce:transition-none dark:hover:text-[#f1f1f1]",
                  heading.id === activeId ? "text-neutral-950 dark:text-[#f1f1f1]" : "",
                ].join(" ")}
                style={{ paddingLeft: topicIndent(heading.level) }}
              >
                <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{heading.text}</span>
              </a>
            ))}
            <span
              ref={indicatorRef}
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 w-px bg-[#E00070] opacity-0 transition-[transform,height,opacity] duration-300 ease-out motion-reduce:transition-none"
            />
          </div>
          {hasLaterTopics && (
            <p className="pl-6 text-xs leading-5 text-neutral-500 dark:text-[#A8A095]">
              {headings.length - topicWindow.end} {headings.length - topicWindow.end === 1 ? "próximo tópico" : "próximos tópicos"}
            </p>
          )}
        </nav>
      </div>
    </aside>
  )
}
