"use client"

import NextLink from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore, type ReactNode } from "react"
import { Theme } from "@astryxdesign/core/theme"
import { AppShell } from "@astryxdesign/core/AppShell"
import { MobileNavToggle } from "@astryxdesign/core/MobileNav"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav"
import { LinkProvider } from "@astryxdesign/core/Link"
import { InternationalizationProvider } from "@astryxdesign/core/i18n"
import ptBR from "@astryxdesign/core/locales/pt-BR.generated.js"
import { themes, defaultThemeSlug } from "../../../astryx-themes"
import { useAdminAccount } from "../useAdminAccount"
import { Banner } from "@astryxdesign/core/Banner"
import { Avatar, Button, HStack, Link, Text, VStack } from "./ui"
import { ChartBarIcon, PencilSquareIcon, DocumentTextIcon, RectangleStackIcon, ChatBubbleLeftRightIcon, LinkIcon, TagIcon, EnvelopeIcon, BellIcon, PhotoIcon, UsersIcon, ArrowTopRightOnSquareIcon, SunIcon, MoonIcon, UserCircleIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline"

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
  const current = navigation.flatMap(group => [...group.items]).find(([href]) => href !== "/admin" && pathname.startsWith(href))?.[1] ?? "Visão geral"
  return <InternationalizationProvider locale="pt-BR" messages={{ "pt-BR": ptBR }}><Theme theme={themes[defaultThemeSlug]} mode={dark ? "dark" : "light"}>
    <LinkProvider component={NextLink}>
      <VStack className="admin-workspace min-h-dvh" gap={0}>
      <AppShell height="auto" variant="wash" contentPadding={0} sideNav={
        <SideNav collapsible={{ buttonLabel: "Recolher navegação" }} resizable={{ defaultWidth: 248, minWidth: 220, maxWidth: 360 }}
          header={<VStack gap={4}><SideNavHeading heading="domenyk" subheading="Estúdio de publicação" headingHref="/admin" /><Button label="Escrever post" icon={<PencilSquareIcon className="size-5" />} variant="primary" href="/admin/posts/new" /></VStack>}
          footer={<SideNavSection title="Conta" isHeaderHidden>
            <SideNavItem label="Ver site" href="/" icon={ArrowTopRightOnSquareIcon} />
            <SideNavItem label={dark ? "Usar tema claro" : "Usar tema escuro"} icon={dark ? SunIcon : MoonIcon} onClick={account.toggleTheme} />
            <SideNavItem label="Minha conta" icon={UserCircleIcon} onClick={account.openUserProfile} />
            <SideNavItem label="Sair" icon={ArrowRightStartOnRectangleIcon} onClick={() => void account.signOut()} />
          </SideNavSection>}>
          {navigation.map(group => <SideNavSection key={group.title} title={group.title}>
            {group.items.map(([href, label, icon]) => <SideNavItem key={href} href={href} label={label} icon={icon}
              isSelected={href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/")} />)}
          </SideNavSection>)}
        </SideNav>
      }>
        <HStack as="header" hAlign="between" gap={3} className="min-w-0 border-b border-border px-4 py-3 md:px-8">
          <HStack gap={3}><MobileNavToggle label="Abrir navegação" /><Link href="/admin">Painel</Link><Text color="secondary">/</Text><Text type="label">{current}</Text></HStack>
          <HStack gap={2}>
            <HStack className="hidden md:flex" gap={2}>
              <Button label={dark ? "Usar tema claro" : "Usar tema escuro"} icon={dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />} variant="ghost" size="sm" onClick={account.toggleTheme} />
              <Button label="Ver site" href="/" icon={<ArrowTopRightOnSquareIcon className="size-4" />} variant="ghost" size="sm" />
            </HStack>
            <Avatar name={account.user?.fullName ?? "Admin"} src={account.user?.imageUrl} size="sm" />
          </HStack>
        </HStack>
        <Layout height="auto" contentWidth={1200} content={<LayoutContent padding={6} isScrollable={false}>
          <VStack gap={8} className="min-w-0 py-4">
            {localPreview && <Banner status="info" title="Ambiente de teste local" description="As alterações não são publicadas no site principal." />}
            {children}
          </VStack>
        </LayoutContent>} />
      </AppShell>
      </VStack>
    </LinkProvider>
  </Theme></InternationalizationProvider>
}
