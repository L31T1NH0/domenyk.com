import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"

type Props = {
  title: string
  description?: string
  back?: { href: string; label: string }
  actions?: ReactNode
}

export function AdminCommandHeader({ title, description, back, actions }: Props) {
  return (
    <header className="admin-command-header">
      <div className="admin-command-heading">
        {back && (
          <Link href={back.href} className="admin-command-back">
            <ArrowLeftIcon aria-hidden />
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-command-actions">{actions}</div>}
    </header>
  )
}
