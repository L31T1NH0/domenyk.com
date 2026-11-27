import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
}
export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("sticky top-0 bg-admin-card [&_tr]:border-b", className)} {...props} />
}
export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
}
export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b border-admin-border hover:bg-admin-muted/50", className)} {...props} />
}
export function TableHead({ className, scope = "col", ...props }: ComponentProps<"th">) {
  return <th scope={scope} className={cn("h-11 px-4 text-start align-middle font-medium text-admin-muted-foreground", className)} {...props} />
}
export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("p-4 align-middle", className)} {...props} />
}
