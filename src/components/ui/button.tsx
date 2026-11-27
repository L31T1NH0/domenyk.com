import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

const variants = {
  default: "bg-admin-primary text-admin-primary-foreground hover:bg-admin-primary/90",
  outline: "border border-admin-border bg-admin-card hover:bg-admin-muted",
  ghost: "hover:bg-admin-muted",
} as const
const sizes = { default: "min-h-10 px-4 py-2", sm: "min-h-9 px-3 py-1.5", icon: "size-10 shrink-0" } as const

export function buttonVariants({ variant = "default", size = "default", className }: {
  variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string
} = {}) {
  return cn("inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0", variants[variant], sizes[size], className)
}

export function Button({ className, variant, size, type = "button", ...props }: ComponentProps<"button"> & {
  variant?: keyof typeof variants; size?: keyof typeof sizes
}) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />
}
