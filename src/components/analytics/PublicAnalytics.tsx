"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { Analytics } from "@vercel/analytics/next"

const PRIVATE_PUBLIC_PATHS = ["/fale-comigo", "/notificacoes"]

export function PublicAnalytics({ nonce }: { nonce?: string }) {
  const pathname = usePathname()
  if (PRIVATE_PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null
  }

  return (
    <>
      <Script id="microsoft-clarity" nonce={nonce} strategy="afterInteractive">
        {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","wnikfbzpwx");`}
      </Script>
      <Analytics />
    </>
  )
}
