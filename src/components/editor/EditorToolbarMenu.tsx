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
  const triggerSize = variant === "comment" ? "h-10 min-w-10" : "h-10 min-w-10 sm:h-9 sm:min-w-9"

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
      className={`editor-toolbar-menu-trigger inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 text-xs font-semibold leading-none text-inherit transition-colors hover:border-neutral-500/15 hover:bg-neutral-500/10 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50 dark:hover:border-white/10 dark:hover:bg-white/[0.08] dark:hover:text-neutral-50 ${triggerSize}`}
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
      {icon && <span className="editor-toolbar-menu-icon grid size-4 shrink-0 place-items-center" aria-hidden>{icon}</span>}
      <span className="editor-toolbar-menu-label">{label}</span>
      <ChevronDownIcon className="editor-toolbar-menu-chevron size-3 shrink-0 text-neutral-500" aria-hidden />
    </button>
    {open && createPortal(
      <div
        ref={menuRef}
        id={id}
        role="menu"
        aria-label={accessibleLabel}
        className="editor-toolbar-menu fixed z-[90] grid w-[min(17rem,calc(100vw-20px))] gap-0.5 rounded-xl border border-neutral-200 bg-white p-1.5 text-neutral-800 shadow-xl shadow-black/15 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:shadow-black/40"
        onKeyDown={menuKeyDown}
        style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
      >
        {options.map(option => <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={value === option.value}
          className="grid min-h-11 grid-cols-[1.5rem_minmax(0,1fr)_1rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none dark:hover:bg-white/[0.07] dark:focus-visible:bg-white/[0.07]"
          onMouseDown={event => event.preventDefault()}
          onClick={() => { onChange(option.value); close(true) }}
        >
          <span className="editor-toolbar-menu-option-icon grid min-w-0 place-items-center text-[10px] font-bold text-neutral-500" aria-hidden>{option.icon}</span>
          <span className="min-w-0"><strong className="block text-xs font-semibold">{option.label}</strong>{option.description && <small className="mt-0.5 block text-[10px] leading-snug text-neutral-500 dark:text-neutral-400">{option.description}</small>}</span>
          <CheckIcon className={`editor-toolbar-menu-check size-3.5 ${value === option.value ? "opacity-100" : "opacity-0"}`} aria-hidden />
        </button>)}
      </div>,
      document.body,
    )}
  </>
}
