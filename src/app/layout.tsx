import { ReactNode, Suspense } from "react";
import "./global.css"; // Mantém o CSS global
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { ClerkProvider } from "@lib/clerk-frontend";

import AnalyticsProvider from "@components/analytics/AnalyticsProvider";
import { getAnalyticsClientConfig } from "@lib/analytics/config";
import { resolveAdminStatus } from "@lib/admin";

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const analyticsConfig = getAnalyticsClientConfig();

  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? undefined;

  if (!publishableKey && process.env.NODE_ENV === "production" && process.env.CI !== "1") {
    throw new Error(
      "Configure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY antes de iniciar a aplicação em produção."
    );
  }

  let isAdmin = false;
  try {
    const status = await resolveAdminStatus();
    isAdmin = status.isAdmin;
  } catch {
    isAdmin = false;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="pt-BR">
        <body className="min-h-screen bg-zinc-900 text-white">
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