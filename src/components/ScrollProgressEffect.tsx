"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

function setScrollVariables(progress: number, visible: boolean) {
  const root = document.documentElement
  root.style.setProperty("--scroll-progress", visible ? `${(progress * 100).toFixed(3)}%` : "0%")
  root.style.setProperty("--scroll-progress-visible", visible ? "1" : "0")
}

function hasTopicMinimap(content: HTMLElement) {
  return content.querySelector("h1, h2, h3, h4") !== null
}

export function ScrollProgressEffect() {
  const pathname = usePathname()

  useEffect(() => {
    const container = document.querySelector<HTMLElement>("[data-scroll-progress-root]")
    if (!container) { setScrollVariables(0, false); return }

    const content = container.querySelector<HTMLElement>("[data-post-content]")
    if (!content) { setScrollVariables(0, false); return }

    let animationFrame = 0
    const desktopMinimapMedia = window.matchMedia("(min-width: 80rem)")

    const update = () => {
      animationFrame = 0
      const contentTop = content.getBoundingClientRect().top + window.scrollY
      const totalScrollable = Math.max(content.scrollHeight - window.innerHeight, 0)
      if (totalScrollable <= 0) { setScrollVariables(0, false); return }
      const progress = Math.min(1, Math.max(0, (window.scrollY - contentTop) / totalScrollable))
      const minimapVisible = desktopMinimapMedia.matches && hasTopicMinimap(content)
      setScrollVariables(progress, !minimapVisible)
    }

    const requestUpdate = () => {
      if (animationFrame) return
      animationFrame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", requestUpdate, { passive: true })
    window.addEventListener("resize", requestUpdate)
    window.addEventListener("load", requestUpdate)
    window.visualViewport?.addEventListener("resize", requestUpdate)
    window.visualViewport?.addEventListener("scroll", requestUpdate)
    desktopMinimapMedia.addEventListener("change", requestUpdate)

    const resizeObserver = new ResizeObserver(requestUpdate)
    resizeObserver.observe(content)
    const mutationObserver = new MutationObserver(requestUpdate)
    mutationObserver.observe(content, { childList: true, subtree: true })

    return () => {
      window.removeEventListener("scroll", requestUpdate)
      window.removeEventListener("resize", requestUpdate)
      window.removeEventListener("load", requestUpdate)
      window.visualViewport?.removeEventListener("resize", requestUpdate)
      window.visualViewport?.removeEventListener("scroll", requestUpdate)
      desktopMinimapMedia.removeEventListener("change", requestUpdate)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      if (animationFrame) cancelAnimationFrame(animationFrame)
      setScrollVariables(0, false)
    }
  }, [pathname])

  return null
}
