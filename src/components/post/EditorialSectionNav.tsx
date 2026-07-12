"use client"

import { useEffect, useState } from "react"

type HeadingEntry = {
  id: string
  text: string
  level: number
}

type Props = {
  label: string
}

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "secao"
}

export function EditorialSectionNav({ label }: Props) {
  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const content = document.querySelector<HTMLElement>("[data-post-content]")
    if (!content) return

    const usedIds = new Set<string>()
    const entries = Array.from(content.querySelectorAll<HTMLHeadingElement>("h2, h3"))
      .map((heading) => {
        const text = heading.textContent?.trim() ?? ""
        if (!text) return null

        let id = heading.id || slugify(text)
        let suffix = 2
        while (usedIds.has(id)) id = `${slugify(text)}-${suffix++}`
        heading.id = id
        usedIds.add(id)

        return { id, text, level: Number(heading.tagName.slice(1)) }
      })
      .filter((heading): heading is HeadingEntry => heading !== null)

    if (entries.length === 0) return

    let frame = window.requestAnimationFrame(() => {
      frame = 0
      setHeadings(entries)
      setActiveId(entries[0].id)
    })
    const updateActiveHeading = () => {
      frame = 0
      const focusLine = window.scrollY + Math.min(180, window.innerHeight * 0.28)
      let next = entries[0].id

      for (const entry of entries) {
        const element = document.getElementById(entry.id)
        if (element && element.getBoundingClientRect().top + window.scrollY <= focusLine) {
          next = entry.id
        }
      }
      setActiveId(next)
    }
    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateActiveHeading)
    }

    window.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("resize", scheduleUpdate)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
    }
  }, [])

  if (headings.length === 0) return null

  return (
    <nav className="editorial-section-nav" aria-label={label}>
      <p>{label}</p>
      <div className="editorial-section-links">
        {headings.map((heading, index) => (
          <a
            key={heading.id}
            href={`#${encodeURIComponent(heading.id)}`}
            aria-current={activeId === heading.id ? "location" : undefined}
            data-level={heading.level}
            onClick={(event) => {
              const target = document.getElementById(heading.id)
              if (!target) return
              event.preventDefault()
              target.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                block: "start",
              })
              window.history.replaceState(null, "", `#${encodeURIComponent(heading.id)}`)
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{heading.text}</span>
          </a>
        ))}
      </div>
    </nav>
  )
}
