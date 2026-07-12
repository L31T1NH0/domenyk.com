import type { Metadata } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { Analytics } from "@vercel/analytics/next"
import localFont from "next/font/local"
import { headers } from "next/headers"
import { absoluteUrl, jsonLd, siteConfig } from "@/lib/seo"
import "./globals.css"

const polySans = localFont({
  src: "./PolySans-Slim.woff2",
  variable: "--font-display",
  display: "swap",
  fallback: ["Arial", "system-ui", "sans-serif"],
})

const geist = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  variable: "--font-text",
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
})

const geistMono = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2",
  variable: "--font-mono",
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: { default: siteConfig.title, template: `%s — ${siteConfig.name}` },
  description: siteConfig.description,
  authors: [{ name: siteConfig.author, url: absoluteUrl("/sobre") }],
  creator: siteConfig.author,
  publisher: siteConfig.author,
  category: "politics",
  keywords: ["Domenyk", "política", "liberalismo", "ideias", "opinião", "debate público"],
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "256x256", type: "image/x-icon" }],
    shortcut: "/favicon.ico",
  },
  alternates: { canonical: "/" },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
    images: [{ url: absoluteUrl(siteConfig.image), width: 1200, height: 630, alt: siteConfig.author }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [absoluteUrl(siteConfig.image)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const nonce = requestHeaders.get("x-nonce") ?? undefined
  const requestedLanguage = requestHeaders.get("x-site-language")
  const documentLanguage = requestedLanguage === "en" || requestedLanguage === "de" || requestedLanguage === "id"
    ? requestedLanguage
    : "pt-BR"
  return (
	    <html lang={documentLanguage} className={`${polySans.variable} ${geist.variable} ${geistMono.variable} h-full antialiased dark-mode`} suppressHydrationWarning>
	      <body className="min-h-full flex flex-col dark-mode" suppressHydrationWarning>
	        <script
	          id="theme-bootstrap"
	          nonce={nonce}
	          suppressHydrationWarning
	          type="text/javascript"
	          dangerouslySetInnerHTML={{
		            __html: `(function(){try{var d=localStorage.getItem('theme')!=='light';var e=document.documentElement;e.classList.toggle('dark-mode',d);e.classList.toggle('light-mode',!d);if(document.body){document.body.classList.toggle('dark-mode',d);document.body.classList.toggle('light-mode',!d)}}catch(e){document.documentElement.classList.add('dark-mode')}})()`,
	          }}
	        />
	        <script
	          id="website-person-json-ld"
	          nonce={nonce}
	          suppressHydrationWarning
	          type="application/ld+json"
	          dangerouslySetInnerHTML={{
		            __html: jsonLd({
		              "@context": "https://schema.org",
		              "@graph": [
		                {
		                  "@type": "WebSite",
		                  "@id": `${siteConfig.url}/#website`,
		                  url: siteConfig.url,
		                  name: siteConfig.name,
		                  description: siteConfig.description,
		                  inLanguage: "pt-BR",
		                  publisher: { "@id": `${siteConfig.url}/#person` },
		                },
		                {
		                  "@type": "Person",
		                  "@id": `${siteConfig.url}/#person`,
		                  name: siteConfig.author,
		                  url: absoluteUrl("/sobre"),
		                  image: absoluteUrl("/images/profile.jpg"),
		                  description: siteConfig.description,
		                  knowsAbout: ["política", "liberalismo", "instituições", "debate público"],
		                },
		              ],
		            }),
	          }}
	        />
	        <script
	          id="microsoft-clarity"
	          nonce={nonce}
	          suppressHydrationWarning
	          type="text/javascript"
	          dangerouslySetInnerHTML={{
		            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","wnikfbzpwx");`,
	          }}
	        />
        <ClerkProvider dynamic>
          {children}
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  )
}
