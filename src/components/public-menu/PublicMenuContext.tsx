"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { PostLocale } from "@/lib/post-locales"

export type PublicMenuLanguageOption = {
  locale: PostLocale
  href?: string
}

type LanguageMenuState = {
  currentLocale: PostLocale
  options: PublicMenuLanguageOption[]
}

type PublicMenuContextValue = LanguageMenuState & {
  setLanguageMenu: (state: LanguageMenuState) => void
}

const DEFAULT_LANGUAGE_MENU: LanguageMenuState = {
  currentLocale: "pt",
  options: [],
}

const PublicMenuContext = createContext<PublicMenuContextValue | null>(null)

export function PublicMenuProvider({ children }: { children: ReactNode }) {
  const [languageMenu, setLanguageMenu] = useState<LanguageMenuState>(DEFAULT_LANGUAGE_MENU)
  const value = useMemo(() => ({ ...languageMenu, setLanguageMenu }), [languageMenu])

  return <PublicMenuContext.Provider value={value}>{children}</PublicMenuContext.Provider>
}

export function usePublicMenu() {
  const context = useContext(PublicMenuContext)
  if (!context) throw new Error("usePublicMenu must be used inside PublicMenuProvider")
  return context
}

export function PostLanguageMenuRegistration({
  currentLocale,
  options,
}: {
  currentLocale: PostLocale
  options: PublicMenuLanguageOption[]
}) {
  const { setLanguageMenu } = usePublicMenu()
  const optionsKey = options.map(({ locale, href }) => `${locale}:${href ?? ""}`).join("|")

  useEffect(() => {
    setLanguageMenu({ currentLocale, options })
    return () => setLanguageMenu(DEFAULT_LANGUAGE_MENU)
    // optionsKey represents the serializable server-provided options without depending on array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocale, optionsKey, setLanguageMenu])

  return null
}
