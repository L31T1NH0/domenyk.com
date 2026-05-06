import type { Metadata } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "domenyk", template: "%s — domenyk" },
  description: "Blog pessoal",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
	    <html lang="pt-BR" className="h-full antialiased dark-mode" suppressHydrationWarning>
	      <body className="min-h-full flex flex-col dark-mode" suppressHydrationWarning>
	        <Script
	          id="theme-bootstrap"
	          strategy="beforeInteractive"
	          dangerouslySetInnerHTML={{
		            __html: `(function(){try{var d=localStorage.getItem('theme')!=='light';var e=document.documentElement;e.classList.toggle('dark-mode',d);e.classList.toggle('light-mode',!d);if(document.body){document.body.classList.toggle('dark-mode',d);document.body.classList.toggle('light-mode',!d)}}catch(e){document.documentElement.classList.add('dark-mode')}})()`,
	          }}
	        />
        <ClerkProvider>
          {children}
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  )
}
