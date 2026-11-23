"use client"

import NextLink from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore, type ReactNode } from "react"
import { Theme } from "@astryxdesign/core/theme"
import { AppShell } from "@astryxdesign/core/AppShell"
import { Layout, LayoutContent } from "@astryxdesign/core/Layout"
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav"
import { LinkProvider } from "@astryxdesign/core/Link"
import { InternationalizationProvider } from "@astryxdesign/core/i18n"
import ptBR from "@astryxdesign/core/locales/pt-BR.generated.js"
import { themes, defaultThemeSlug } from "../../../astryx-themes"
import { useAdminAccount } from "../useAdminAccount"
import { Banner } from "@astryxdesign/core/Banner"
import { Divider, VStack } from "./ui"
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
  return <InternationalizationProvider locale="pt-BR" messages={{ "pt-BR": ptBR }}><Theme theme={themes[defaultThemeSlug]} mode={dark ? "dark" : "light"}>
    <LinkProvider component={NextLink}>
      <AppShell height="auto" variant="surface" contentPadding={0} sideNav={
        <SideNav collapsible={{ buttonLabel: "Recolher navegação" }} resizable={{ defaultWidth: 300, minWidth: 220, maxWidth: 420 }}
          header={<SideNavHeading heading="domenyk" subheading="Seu espaço de publicação" headingHref="/admin" />}
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
        <Layout height="auto" contentWidth={768} content={<LayoutContent padding={6} isScrollable={false}>
          <VStack gap={8} className="min-w-0 py-6">
            {localPreview && <Banner status="info" title="Ambiente de teste local" description="As alterações não são publicadas no site principal." />}
            {children}
            <Divider />
          </VStack>
        </LayoutContent>} />
      </AppShell>
    </LinkProvider>
  </Theme></InternationalizationProvider>
}
