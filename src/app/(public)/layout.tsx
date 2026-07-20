import { ScrollProgressEffect } from "@/components/ScrollProgressEffect"
import { PublicMenu } from "@/components/public-menu/PublicMenu"
import { PublicMenuProvider } from "@/components/public-menu/PublicMenuContext"
import { ViewReferrerTracker } from "@/components/ViewReferrerTracker"
import { headers } from "next/headers"
import { PublicAnalytics } from "@/components/analytics/PublicAnalytics"
import { siteCalendarYear } from "@/lib/datetime"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const currentYear = siteCalendarYear()
  const nonce = (await headers()).get("x-nonce") ?? undefined

  return (
    <PublicMenuProvider>
      <div data-public-shell data-scroll-progress-root className="mx-auto mb-4 flex w-full max-w-[36rem] flex-col overflow-x-visible px-4 sm:w-[min(100%,34.5rem)] sm:max-w-[100vw]">
        <div aria-hidden data-scroll-progress-bar />
        <ScrollProgressEffect />
        <ViewReferrerTracker />
        <header className="flex items-center justify-end py-1">
          <PublicMenu />
        </header>
        <main className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
        <footer className="mb-4 mt-12 text-center text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p>© {currentYear} domenyk.com</p>
          <p className="mt-1 break-all">bc1qfv788krszr8xz3uxvvzy33pp8jph0hw53557d4</p>
        </footer>
      </div>
      <PublicAnalytics nonce={nonce} />
    </PublicMenuProvider>
  )
}
