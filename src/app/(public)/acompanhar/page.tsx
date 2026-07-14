import type { Metadata } from "next"
import { BackHome } from "@/components/BackHome"
import { PushSubscriptionManager } from "@/components/notifications/PushSubscriptionManager"

export const metadata: Metadata = {
  title: "Acompanhar publicações",
  description: "Receba uma notificação quando Domenyk publicar um post ou uma nota.",
  robots: { index: false, follow: true },
}

export default function FollowPage() {
  return (
    <div id="follow-content-boundary" className="py-8 sm:py-12">
      <header className="max-w-[34rem]">
        <h1 className="text-balance font-[family-name:var(--font-display)] text-3xl tracking-[-0.03em] text-zinc-950 dark:text-white sm:text-4xl">Acompanhe as publicações</h1>
        <p className="mt-3 max-w-[58ch] text-pretty text-sm leading-6 text-zinc-600 dark:text-zinc-300">Ative uma vez e escolha o que deseja receber. A permissão vale apenas para este navegador e pode ser removida a qualquer momento.</p>
      </header>
      <section aria-label="Preferências de notificação" className="mt-8 border-y border-zinc-200 py-5 dark:border-white/10">
        <PushSubscriptionManager />
      </section>
      <p className="mt-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">No iPhone e no iPad, pode ser necessário adicionar o site à Tela de Início antes de ativar notificações.</p>
      <BackHome boundaryId="follow-content-boundary" label="Voltar para a página inicial" />
    </div>
  )
}
