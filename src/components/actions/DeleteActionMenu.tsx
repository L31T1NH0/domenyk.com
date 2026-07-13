"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDownIcon, EllipsisHorizontalIcon, TrashIcon } from "@heroicons/react/24/outline"

type TriggerVariant = "icon" | "button" | "text"

type Props = {
  title: string
  description?: string
  onDelete: () => Promise<void> | void
  triggerLabel?: string
  triggerAriaLabel?: string
  triggerVariant?: TriggerVariant
  triggerClassName?: string
  confirmLabel?: string
  disabled?: boolean
}

const DEFAULT_DESCRIPTION = "Esta ação é permanente e não pode ser desfeita."

function defaultTriggerClass(variant: TriggerVariant) {
  if (variant === "icon") {
    return "grid size-8 place-items-center rounded-md text-zinc-500 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-zinc-300"
  }
  if (variant === "text") {
    return "inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-red-700 outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-500/10"
  }
  return "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 outline-none transition-colors hover:border-red-400 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-500/10"
}

export function DeleteActionMenu({
  title,
  description = DEFAULT_DESCRIPTION,
  onDelete,
  triggerLabel = "Excluir",
  triggerAriaLabel,
  triggerVariant = "icon",
  triggerClassName,
  confirmLabel = "Excluir",
  disabled = false,
}: Props) {
  const id = `delete-menu-${useId().replace(/:/g, "")}`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return

    function positionMenu() {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const menu = menuRef.current?.getBoundingClientRect()
      if (!trigger || !menu) return
      const gap = 8
      const edge = 12
      const left = Math.min(window.innerWidth - menu.width - edge, Math.max(edge, trigger.right - menu.width))
      const fitsBelow = trigger.bottom + gap + menu.height <= window.innerHeight - edge
      const top = fitsBelow
        ? trigger.bottom + gap
        : Math.max(edge, trigger.top - menu.height - gap)
      setPosition({ top, left })
    }

    positionMenu()
    window.addEventListener("resize", positionMenu)
    window.addEventListener("scroll", positionMenu, true)
    return () => {
      window.removeEventListener("resize", positionMenu)
      window.removeEventListener("scroll", positionMenu, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => cancelRef.current?.focus())

    function closeFromOutside(event: PointerEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
      setError("")
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      setOpen(false)
      setError("")
      triggerRef.current?.focus()
    }

    document.addEventListener("pointerdown", closeFromOutside)
    document.addEventListener("keydown", closeFromKeyboard)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("pointerdown", closeFromOutside)
      document.removeEventListener("keydown", closeFromKeyboard)
    }
  }, [open])

  async function confirmDelete() {
    setPending(true)
    setError("")
    try {
      await onDelete()
      setOpen(false)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível excluir. Tente novamente.")
    } finally {
      setPending(false)
    }
  }

  const triggerContent = triggerVariant === "icon" ? (
    <EllipsisHorizontalIcon className="size-5" aria-hidden />
  ) : (
    <>
      {triggerVariant === "button" && <TrashIcon className="size-4" aria-hidden />}
      <span>{triggerLabel}</span>
      <ChevronDownIcon className="size-3.5" aria-hidden />
    </>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || pending}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={triggerAriaLabel ?? triggerLabel}
        title={triggerVariant === "icon" ? triggerAriaLabel ?? triggerLabel : undefined}
        onClick={() => {
          setError("")
          setPosition(null)
          setOpen((current) => !current)
        }}
        className={triggerClassName ?? defaultTriggerClass(triggerVariant)}
      >
        {triggerContent}
      </button>

      {typeof document !== "undefined" && open && createPortal(
        <div
          ref={menuRef}
          id={id}
          role="dialog"
          aria-label="Confirmar exclusão"
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
          className="fixed z-[120] w-[min(18rem,calc(100vw-1.5rem))] rounded-[10px] border border-zinc-200 bg-white p-1.5 text-zinc-950 shadow-[0_4px_8px_rgb(0_0_0_/_0.12)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:shadow-[0_4px_8px_rgb(0_0_0_/_0.45)]"
        >
          <div className="px-2.5 pb-2 pt-2">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                <TrashIcon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5">{title}</p>
                <p className="mt-1 text-xs leading-[1.45] text-zinc-600 dark:text-zinc-400">{description}</p>
              </div>
            </div>
            {error && <p role="alert" className="mt-2 text-xs leading-5 text-red-700 dark:text-red-400">{error}</p>}
          </div>
          <div className="flex items-center justify-end gap-1.5 border-t border-zinc-200 px-2 pt-1.5 dark:border-zinc-800">
            <button
              ref={cancelRef}
              type="button"
              disabled={pending}
              onClick={() => { setOpen(false); setError(""); triggerRef.current?.focus() }}
              className="min-h-8 rounded-md px-2.5 text-xs font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void confirmDelete()}
              className="min-h-8 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white outline-none transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-wait disabled:opacity-60 dark:focus-visible:ring-offset-zinc-950"
            >
              {pending ? "Excluindo…" : confirmLabel}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
