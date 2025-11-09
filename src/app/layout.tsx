import { ReactNode, Suspense } from "react";
import "./global.css"; // Mantém o CSS global
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { ClerkProvider } from "@clerk/nextjs";

import AnalyticsProvider from "@components/analytics/AnalyticsProvider";
import { getAnalyticsClientConfig } from "@lib/analytics/config";
import { resolveAdminStatus } from "@lib/admin";
import { cn } from "@lib/cn";

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const analyticsConfig = getAnalyticsClientConfig();

  let isAdmin = false;
  try {
    const status = await resolveAdminStatus();
    isAdmin = status.isAdmin;
  } catch {
    isAdmin = false;
  }

  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body
          className={cn(
            "min-h-screen bg-zinc-100 text-zinc-900 transition-colors duration-300",
            "dark:bg-zinc-950 dark:text-zinc-100"
          )}
        >
          <Suspense fallback={null}>
            <AnalyticsProvider isAdmin={isAdmin} config={analyticsConfig}>
              {children}
            </AnalyticsProvider>
          </Suspense>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}