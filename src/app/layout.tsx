// src/app/layout.tsx (Server Component)
import { ReactNode } from "react";
import "./global.css"; // Mantém o CSS global
import { DefaultSeo } from "next-seo";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid";
import { Metadata } from "next";

import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        {/* <AdjustmentsHorizontalIcon className="size-6 flex justify-end" /> */}
        <body className="min-h-screen bg-zinc-900 text-white">
          <SignedOut>
            <SignInButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
