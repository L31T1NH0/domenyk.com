"use client"

type ToolbarButtonProps = {
  onClick: () => void
  title: string
  variant?: "default" | "compact" | "comment"
  expanded?: boolean
  children: React.ReactNode
}

export function ToolbarButton({ onClick, title, variant = "default", expanded, children }: ToolbarButtonProps) {
  const size = variant === "comment" ? "size-10" : "size-10 sm:size-9"
  return (
    <button
      type="button"
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-expanded={expanded}
      data-editor-variant={variant}
      data-expanded={expanded || undefined}
      className={`editor-toolbar-button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent text-xs font-semibold leading-none text-inherit transition-colors hover:border-neutral-500/15 hover:bg-neutral-500/10 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-white/10 dark:hover:bg-white/[0.08] dark:hover:text-neutral-50 ${size}`}
    >
      {children}
    </button>
  )
}
