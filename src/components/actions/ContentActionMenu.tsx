"use client"

import Link from "next/link"
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type SVGProps,
} from "react"
import {
  EllipsisHorizontalIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"

type ActionIcon = ComponentType<SVGProps<SVGSVGElement>>

export type ContentMenuAction = {
  label: string
  icon: ActionIcon
  href?: string
  onSelect?: () => Promise<void> | void
  disabled?: boolean
  pendingLabel?: string
}

export type ContentMenuDeleteAction = {
  label?: string
  title: string
  description: string
  onDelete: () => Promise<void> | void
  disabled?: boolean
}

type Props = {
  label: string
  actions: ContentMenuAction[]
  deleteAction?: ContentMenuDeleteAction
  triggerClassName?: string
  menuClassName?: string
}

const DEFAULT_TRIGGER_CLASS = "relative grid size-8 place-items-center rounded-md text-neutral-500 outline-none transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#A8A095] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
const MENU_ITEM_CLASS = "flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-neutral-700 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#d8d4ce] dark:hover:bg-white/[0.07] dark:hover:text-[#f1f1f1] dark:focus-visible:bg-white/[0.07]"

export function ContentActionMenu({
  label,
  actions,
  deleteAction,
  triggerClassName = DEFAULT_TRIGGER_CLASS,
  menuClassName = "",
}: Props) {
  const menuId = `content-actions-${useId().replace(/:/g, "")}`
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const focusFirstOnOpenRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState("")

  function menuItems() {
    return Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])") ?? []
    )
  }

  function resetMenu() {
    setOpen(false)
    setConfirmingDelete(false)
    setPendingAction(null)
    setError("")
  }

  function closeMenu({ restoreFocus = false } = {}) {
    resetMenu()
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function openMenu(focusFirst = false) {
    focusFirstOnOpenRef.current = focusFirst
    setOpen(true)
    setConfirmingDelete(false)
    setError("")
  }

  useEffect(() => {
    if (!open) return
    if (focusFirstOnOpenRef.current) {
      focusFirstOnOpenRef.current = false
      requestAnimationFrame(() => menuItems()[0]?.focus())
    }

    function dismissMenu() {
      setOpen(false)
      setConfirmingDelete(false)
      setPendingAction(null)
      setError("")
    }

    function closeFromOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) dismissMenu()
    }

    function closeFromKeyboard(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      if (confirmingDelete) {
        setConfirmingDelete(false)
        setError("")
        requestAnimationFrame(() => menuItems().at(-1)?.focus())
      } else {
        dismissMenu()
        requestAnimationFrame(() => triggerRef.current?.focus())
      }
    }

    document.addEventListener("pointerdown", closeFromOutside)
    document.addEventListener("keydown", closeFromKeyboard)
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside)
      document.removeEventListener("keydown", closeFromKeyboard)
    }
  }, [confirmingDelete, open])

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (confirmingDelete || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
    const items = menuItems()
    if (items.length === 0) return
    event.preventDefault()
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }

  async function runAction(action: ContentMenuAction) {
    if (!action.onSelect || action.disabled || pendingAction) return
    setPendingAction(action.label)
    setError("")
    try {
      await action.onSelect()
      closeMenu()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível concluir a ação.")
      setPendingAction(null)
    }
  }

  async function confirmDelete() {
    if (!deleteAction || deleteAction.disabled || pendingAction) return
    setPendingAction(deleteAction.label ?? "Excluir")
    setError("")
    try {
      await deleteAction.onDelete()
      closeMenu()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível excluir.")
      setPendingAction(null)
    }
  }

  return (
    <div ref={rootRef} className="relative" data-swipe-ignore>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp"].includes(event.key)) return
          event.preventDefault()
          openMenu(true)
        }}
        className={triggerClassName}
      >
        <EllipsisHorizontalIcon className="size-5" aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role={confirmingDelete ? "dialog" : "menu"}
          aria-label={confirmingDelete ? deleteAction?.title : label}
          onKeyDown={handleMenuKeyDown}
          className={`absolute right-0 top-[calc(100%+0.25rem)] z-30 w-[min(14rem,calc(100vw-2rem))] rounded-[10px] border border-neutral-200 bg-white p-1.5 text-neutral-950 shadow-[0_4px_8px_rgb(0_0_0_/_0.12)] dark:border-white/10 dark:bg-[#0b0b0b] dark:text-[#f1f1f1] dark:shadow-[0_4px_8px_rgb(0_0_0_/_0.45)] ${menuClassName}`}
        >
          {confirmingDelete && deleteAction ? (
            <div>
              <div className="px-2.5 pb-2 pt-1.5">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    <TrashIcon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5">{deleteAction.title}</p>
                    <p className="mt-1 text-xs leading-[1.45] text-neutral-600 dark:text-[#A8A095]">{deleteAction.description}</p>
                  </div>
                </div>
                {error && <p role="alert" className="mt-2 text-xs leading-5 text-red-700 dark:text-red-400">{error}</p>}
              </div>
              <div className="flex items-center justify-end gap-1.5 border-t border-neutral-200 px-2 pt-1.5 dark:border-white/10">
                <button
                  ref={cancelRef}
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={() => {
                    setConfirmingDelete(false)
                    setError("")
                    requestAnimationFrame(() => menuItems().at(-1)?.focus())
                  }}
                  className="min-h-9 rounded-md px-2.5 text-xs font-medium text-neutral-700 outline-none transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:opacity-40 dark:text-[#d8d4ce] dark:hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void confirmDelete()}
                  className="min-h-9 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white outline-none transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-wait disabled:opacity-60 dark:focus-visible:ring-offset-[#0b0b0b]"
                >
                  {pendingAction ? "Excluindo…" : deleteAction.label ?? "Excluir"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {actions.map((action) => {
                const Icon = action.icon
                const content = (
                  <>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span>{pendingAction === action.label ? action.pendingLabel ?? "Aguarde…" : action.label}</span>
                  </>
                )

                return action.href ? (
                  <Link
                    key={action.label}
                    href={action.href}
                    role="menuitem"
                    aria-disabled={action.disabled || undefined}
                    tabIndex={action.disabled ? -1 : 0}
                    onClick={(event) => {
                      if (action.disabled) {
                        event.preventDefault()
                        return
                      }
                      closeMenu()
                    }}
                    className={`${MENU_ITEM_CLASS} ${action.disabled ? "pointer-events-none opacity-40" : ""}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    disabled={action.disabled || Boolean(pendingAction)}
                    aria-disabled={action.disabled || Boolean(pendingAction)}
                    onClick={() => void runAction(action)}
                    className={MENU_ITEM_CLASS}
                  >
                    {content}
                  </button>
                )
              })}
              {deleteAction && (
                <div role="none" className="mt-1 border-t border-neutral-200 pt-1 dark:border-white/10">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={deleteAction.disabled || Boolean(pendingAction)}
                    aria-disabled={deleteAction.disabled || Boolean(pendingAction)}
                    onClick={() => {
                      setConfirmingDelete(true)
                      setError("")
                      requestAnimationFrame(() => cancelRef.current?.focus())
                    }}
                    className={`${MENU_ITEM_CLASS} text-red-700 hover:bg-red-50 hover:text-red-800 focus-visible:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 dark:focus-visible:bg-red-500/10`}
                  >
                    <TrashIcon className="size-4 shrink-0" aria-hidden />
                    <span>{deleteAction.label ?? "Excluir"}</span>
                  </button>
                </div>
              )}
              {error && <p role="alert" className="px-2.5 py-2 text-xs leading-5 text-red-700 dark:text-red-400">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
