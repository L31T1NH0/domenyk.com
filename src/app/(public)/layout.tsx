import { ScrollProgressEffect } from "@/components/ScrollProgressEffect"
import { PublicHeader, PublicFooter } from "@/components/public-menu/PublicChrome"
import { PublicMenuProvider } from "@/components/public-menu/PublicMenuContext"
import { ViewReferrerTracker } from "@/components/ViewReferrerTracker"
import { headers } from "next/headers"
import { PublicAnalytics } from "@/components/analytics/PublicAnalytics"
import { siteCalendarYear } from "@/lib/datetime"
import { ReadingPreferencesProvider, ReadingPreferencesScope } from "@/components/post/ReadingPreferencesContext"
import { FlowImageAlphaOffset } from "@/components/post/FlowImageAlphaOffset"
import { SiteVisitTracker } from "@/components/notifications/SiteVisitTracker"
import { getSiteVisitNotificationSettings } from "@/lib/db/notification-settings"
import { NoiseBackground } from "@/components/noise/NoiseBackground"
import { NoisePreferenceProvider } from "@/components/noise/NoisePreferenceContext"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const currentYear = siteCalendarYear()
  const [requestHeaders, siteVisitSettings] = await Promise.all([
    headers(),
    getSiteVisitNotificationSettings(),
  ])
  const nonce = requestHeaders.get("x-nonce") ?? undefined

  return (
    <NoisePreferenceProvider>
      <NoiseBackground />
      <ReadingPreferencesProvider>
        <PublicMenuProvider>
          <PublicHeader />
          <ReadingPreferencesScope data-public-shell data-scroll-progress-root className="mx-auto mb-4 flex w-full max-w-[36rem] flex-col overflow-x-visible px-4 sm:w-[min(100%,34.5rem)] sm:max-w-[100vw]">
            <div aria-hidden data-scroll-progress-bar />
            <ScrollProgressEffect />
            <FlowImageAlphaOffset />
            <ViewReferrerTracker />
            {(siteVisitSettings.pushEnabled || siteVisitSettings.storeInHistory) && <SiteVisitTracker />}
            <main className="flex min-w-0 flex-1 flex-col">
              {children}
            </main>
            <PublicFooter year={currentYear} />
          </ReadingPreferencesScope>
          <PublicAnalytics nonce={nonce} />
        </PublicMenuProvider>
      </ReadingPreferencesProvider>
    </NoisePreferenceProvider>
  )
}
