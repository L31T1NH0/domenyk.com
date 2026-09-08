"use client"

type ToolbarButtonProps = {
  onClick: () => void
  title: string
  variant?: "default" | "compact" | "comment"
  expanded?: boolean
  children: React.ReactNode
}

export function ToolbarButton({ onClick, title, variant = "default", expanded, children }: ToolbarButtonProps) {
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
      className="editor-toolbar-button"
    >
      {children}
    </button>
  )
}
