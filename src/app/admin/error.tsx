"use client"

import Link from "next/link"
import { ArrowPathIcon, HomeIcon } from "@heroicons/react/24/outline"

export default function AdminError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <section className="admin-error-state" role="alert">
      <span className="admin-error-icon" aria-hidden>!</span>
      <div>
        <h1>Não foi possível abrir esta área</h1>
        <p>Os dados não foram alterados. Tente carregar novamente ou volte para a visão geral.</p>
        <div>
          <button type="button" className="admin-button-primary" onClick={unstable_retry}><ArrowPathIcon aria-hidden /> Tentar novamente</button>
          <Link href="/admin" className="admin-button-secondary"><HomeIcon aria-hidden /> Visão geral</Link>
        </div>
      </div>
    </section>
  )
}
