"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"

export type EditorToolbarMenuOption<T extends string> = {
  description?: string
  icon?: ReactNode
  label: string
  value: T
}

type Props<T extends string> = {
  accessibleLabel: string
  icon?: ReactNode
  label: string
  onChange: (value: T) => void
  options: readonly EditorToolbarMenuOption<T>[]
  value?: T
  variant?: "default" | "compact" | "comment"
}

export function EditorToolbarMenu<T extends string>({
  accessibleLabel,
  icon,
  label,
  onChange,
  options,
  value,
  variant = "default",
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const focusOnOpen = useRef(false)
  const id = useId()

  const close = (restoreFocus = false) => {
    setOpen(false)
    setPosition(null)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const triggerRect = trigger.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const margin = 10
    const openAbove = triggerRect.bottom + menuRect.height + margin > window.innerHeight && triggerRect.top > menuRect.height
    setPosition({
      left: Math.max(margin, Math.min(triggerRect.left, window.innerWidth - menuRect.width - margin)),
      top: openAbove ? triggerRect.top - menuRect.height - 6 : triggerRect.bottom + 6,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    if (position && focusOnOpen.current) {
      focusOnOpen.current = false
      requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"], button')?.focus())
    }
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close()
    }
    const reposition = () => close()
    document.addEventListener("pointerdown", dismiss, true)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      document.removeEventListener("pointerdown", dismiss, true)
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open, position])

  function menuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitemradio"]') ?? [])
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === "Escape") {
      event.preventDefault()
      close(true)
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const direction = event.key === "ArrowDown" ? 1 : -1
      items[(current + direction + items.length) % items.length]?.focus()
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      items[event.key === "Home" ? 0 : items.length - 1]?.focus()
    }
  }

  return <>
    <button
      ref={triggerRef}
      type="button"
      className="editor-toolbar-menu-trigger"
      data-editor-variant={variant}
      aria-controls={id}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onMouseDown={event => event.preventDefault()}
      onClick={event => {
        if (open) return close()
        focusOnOpen.current = event.detail === 0
        setOpen(true)
      }}
    >
      {icon && <span className="editor-toolbar-menu-icon" aria-hidden>{icon}</span>}
      <span className="editor-toolbar-menu-label">{label}</span>
      <ChevronDownIcon className="editor-toolbar-menu-chevron" aria-hidden />
    </button>
    {open && createPortal(
      <div
        ref={menuRef}
        id={id}
        role="menu"
        aria-label={accessibleLabel}
        className="editor-toolbar-menu"
        onKeyDown={menuKeyDown}
        style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
      >
        {options.map(option => <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={value === option.value}
          onMouseDown={event => event.preventDefault()}
          onClick={() => { onChange(option.value); close(true) }}
        >
          <span className="editor-toolbar-menu-option-icon" aria-hidden>{option.icon}</span>
          <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
          <CheckIcon className="editor-toolbar-menu-check" aria-hidden />
        </button>)}
      </div>,
      document.body,
    )}
  </>
}
