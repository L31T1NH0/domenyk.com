// src/app/layout.tsx (Server Component)
import { ReactNode } from "react";
import "./global.css"; // Mantém o CSS global
import { DefaultSeo } from "next-seo";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

const defaultSEO = {
  title: "Domenyk - Blog",
  description: "Minhas opiniões.", // Descrição mais detalhada para SEO
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://blog-roan-nu.vercel.app",
    siteName: "Domenyk - Blog",
  },
  twitter: {
    handle: "@l31t1",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
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
