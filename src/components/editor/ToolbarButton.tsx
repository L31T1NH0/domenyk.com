"use client"

type ToolbarButtonProps = {
  onClick: () => void
  title: string
  variant?: "default" | "compact" | "comment"
  expanded?: boolean
  children: React.ReactNode
}

export function ToolbarButton({ onClick, title, variant = "default", expanded, children }: ToolbarButtonProps) {
  const compact = variant === "compact"
  const comment = variant === "comment"

  return (
    <button
      type="button"
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-expanded={expanded}
      className={
        compact
          ? "grid size-8 place-items-center rounded-full text-xs font-semibold text-[#A8A095] transition-colors hover:bg-white/10 hover:text-[#f1f1f1] disabled:opacity-40"
          : comment
            ? "grid size-11 place-items-center rounded-md text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-950/[0.06] hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100 sm:size-8"
          : "grid size-8 place-items-center rounded-md text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800"
      }
    >
      {children}
    </button>
  )
}
