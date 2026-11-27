"use client"

import NextLink from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react"
import { Theme } from "@astryxdesign/core/theme"
import { LinkProvider } from "@astryxdesign/core/Link"
import { InternationalizationProvider } from "@astryxdesign/core/i18n"
import ptBR from "@astryxdesign/core/locales/pt-BR.generated.js"
import { themes, defaultThemeSlug } from "../../../astryx-themes"
import { useAdminAccount } from "../useAdminAccount"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChartBarIcon, PencilSquareIcon, DocumentTextIcon, RectangleStackIcon, ChatBubbleLeftRightIcon, LinkIcon, TagIcon, EnvelopeIcon, BellIcon, PhotoIcon, UsersIcon, ArrowTopRightOnSquareIcon, SunIcon, MoonIcon, UserCircleIcon, ArrowRightStartOnRectangleIcon, Bars3Icon, XMarkIcon, ChevronRightIcon } from "@heroicons/react/24/outline"

const navigation = [
  { title: "Seu espaço", items: [
    ["/admin", "Visão geral", ChartBarIcon],
    ["/admin/escrevendo", "Em escrita", PencilSquareIcon],
  ] },
  { title: "Publicação", items: [
    ["/admin/posts", "Posts", DocumentTextIcon], ["/admin/notes", "Notas", PencilSquareIcon],
    ["/admin/series", "Séries", RectangleStackIcon], ["/admin/temas", "Temas", TagIcon],
    ["/admin/links", "Links", LinkIcon], ["/admin/media", "Mídia", PhotoIcon],
  ] },
  { title: "Comunidade", items: [
    ["/admin/comments", "Comentários", ChatBubbleLeftRightIcon], ["/admin/messages", "Mensagens", EnvelopeIcon],
    ["/admin/notificacoes", "Notificações", BellIcon], ["/admin/users", "Pessoas", UsersIcon],
  ] },
] as const
const subscribe = () => () => {}

export function AdminShell({ children, initialDark, localPreview }: { children: ReactNode; initialDark: boolean; localPreview: boolean }) {
  const pathname = usePathname()
  const account = useAdminAccount()
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  const dark = hydrated ? account.darkMode : initialDark
  const drawer = useRef<HTMLDialogElement>(null)
  const drawerId = useId()
  const current = navigation.flatMap(group => [...group.items]).find(([href]) => href !== "/admin" && (pathname === href || pathname.startsWith(href + "/")))?.[1] ?? "Visão geral"
  const name = account.user?.fullName ?? "Administrador"

  useEffect(() => {
    drawer.current?.close()
  }, [pathname])

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)")
    const closeOnDesktop = () => { if (desktop.matches) drawer.current?.close() }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])

  function sidebar(mobile = false) {
    return <>
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <NextLink href="/admin" onClick={() => drawer.current?.close()} className="min-w-0 rounded-sm">
          <span className="block text-xl font-semibold tracking-tight">domenyk<span className="text-admin-chart">.</span></span>
          <span className="mt-1 block text-xs text-admin-muted-foreground">Estúdio de publicação</span>
        </NextLink>
        {mobile && <Button variant="ghost" size="icon" aria-label="Fechar navegação" onClick={() => drawer.current?.close()}><XMarkIcon aria-hidden="true" /></Button>}
      </div>
      <NextLink href="/admin/posts/new" onClick={() => drawer.current?.close()} className={buttonVariants({ className: "mx-4 mb-5" })}><PencilSquareIcon aria-hidden="true" />Escrever post</NextLink>
      <nav aria-label="Administração" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {navigation.map(group => <section key={group.title} className="mb-5 last:mb-0">
          <h2 className="px-3 pb-2 text-xs font-medium text-admin-muted-foreground">{group.title}</h2>
          <ul className="space-y-1">{group.items.map(([href, label, Icon]) => {
            const selected = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/")
            return <li key={href}><NextLink href={href} aria-current={selected ? "page" : undefined} onClick={() => drawer.current?.close()}
              className={cn("flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-admin-muted", selected ? "bg-admin-muted font-medium text-admin-foreground" : "text-admin-muted-foreground")}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />{label}
            </NextLink></li>
          })}</ul>
        </section>)}
      </nav>
      <div className="space-y-3 border-t border-admin-border p-4">
        <NextLink href="/" className={buttonVariants({ variant: "ghost", className: "w-full justify-start" })}><ArrowTopRightOnSquareIcon aria-hidden="true" />Ver site</NextLink>
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-admin-muted text-sm font-medium">{name.charAt(0)}</span>
          <button type="button" onClick={account.openUserProfile} className="min-w-0 flex-1 rounded-md text-start" aria-label={`Abrir conta de ${name}`}>
            <span className="block truncate text-sm font-medium">{name}</span><span className="block text-xs text-admin-muted-foreground">Minha conta</span>
          </button>
          <Button variant="ghost" size="icon" aria-label="Sair da conta" onClick={() => void account.signOut()}><ArrowRightStartOnRectangleIcon aria-hidden="true" /></Button>
        </div>
      </div>
    </>
  }

  return <div className="admin-workspace min-h-dvh bg-admin-background text-admin-foreground" data-admin-theme={dark ? "dark" : "light"}>
    <a href="#admin-content" className="sr-only z-50 rounded-md bg-admin-primary p-3 text-admin-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4">Ir para o conteúdo</a>
    <aside aria-label="Menu do painel" className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-admin-border bg-admin-card lg:flex">{sidebar()}</aside>
    <dialog ref={drawer} id={drawerId} aria-label="Navegação do painel" className="fixed inset-y-0 start-0 m-0 h-dvh max-h-dvh w-80 max-w-full border-0 border-e border-admin-border bg-admin-card p-0 text-admin-foreground open:flex open:flex-col">{sidebar(true)}</dialog>
    <div className="min-w-0 lg:ms-64">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-admin-border bg-admin-card px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegação" aria-haspopup="dialog" aria-controls={drawerId} onClick={() => drawer.current?.showModal()}><Bars3Icon aria-hidden="true" /></Button>
          <nav aria-label="Caminho da página"><ol className="flex flex-wrap items-center gap-2 text-sm">
            <li><NextLink href="/admin" className="text-admin-muted-foreground hover:text-admin-foreground">Painel</NextLink></li>
            <li aria-hidden="true"><ChevronRightIcon className="size-3 text-admin-muted-foreground" /></li>
            <li aria-current="page" className="font-medium">{current}</li>
          </ol></nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label={dark ? "Usar tema claro" : "Usar tema escuro"} onClick={account.toggleTheme}>{dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}</Button>
          <Button variant="ghost" size="icon" aria-label="Minha conta" onClick={account.openUserProfile}><UserCircleIcon aria-hidden="true" /></Button>
        </div>
      </header>
      <main id="admin-content" tabIndex={-1} className="mx-auto min-w-0 max-w-screen-2xl p-4 sm:p-6 lg:p-8">
        {localPreview && <p role="status" className="mb-6 rounded-lg border border-admin-border bg-admin-muted p-4 text-sm">Ambiente de teste local. As alterações não são publicadas no site principal.</p>}
        {/* Existing management screens still need their providers during migration. */}
        <InternationalizationProvider locale="pt-BR" messages={{ "pt-BR": ptBR }}><Theme theme={themes[defaultThemeSlug]} mode={dark ? "dark" : "light"}>
          <LinkProvider component={NextLink}>{children}</LinkProvider>
        </Theme></InternationalizationProvider>
      </main>
    </div>
  </div>
}
