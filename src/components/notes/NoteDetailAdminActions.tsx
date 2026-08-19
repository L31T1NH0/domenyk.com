"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { DeleteActionMenu } from "@/components/actions/DeleteActionMenu"

export function NoteDetailAdminActions({ noteId }: { noteId: string }) {
  const router = useRouter()

  async function remove() {
    const response = await fetch(`/api/admin/notes/${noteId}`, { method: "DELETE" })
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(data?.error ?? "Não foi possível excluir a nota.")
    }
    router.push("/notes")
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/admin/notes/${noteId}`}
        className="inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:text-[#c2bbb1] dark:hover:bg-white/10 dark:hover:text-[#f1f1f1] dark:focus-visible:ring-neutral-300"
      >
        Editar
      </Link>
      <DeleteActionMenu
        title="Excluir esta nota?"
        description="A nota, seus comentários e suas métricas internas serão apagados permanentemente."
        onDelete={remove}
        triggerAriaLabel="Excluir nota"
      />
    </div>
  )
}
