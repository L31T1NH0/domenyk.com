import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-w-0 rounded-xl border border-admin-border bg-admin-card text-admin-foreground shadow-sm", className)} {...props} />
}
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
}
export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("text-base leading-none font-semibold tracking-tight", className)} {...props} />
}
export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-admin-muted-foreground", className)} {...props} />
}
export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-6 pb-6", className)} {...props} />
}
